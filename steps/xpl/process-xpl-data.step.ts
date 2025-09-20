import { EventConfig } from "motia";
import { z } from "zod";
import {
  createOrderBooksTable,
  insertOrderBook,
  updateOrderStatus,
  getAllOrderBooks,
  OrderBook,
} from "../../utils/database";

export const config: EventConfig = {
  type: "event",
  name: "ProcessXplData",
  description: "Event step to process XPL order book data from KuCoin",
  subscribes: ["xpl.fetch.requested"],
  emits: [],
  input: z.object({
    source: z.string().optional(), // "api" or "cron"
    traceId: z.string().optional(),
  }),
  flows: ["xpl-processing"],
};

export const handler = async (
  input: any,
  {
    logger,
    traceId,
    emit,
    state,
  }: { logger: any; traceId: string; emit: any; state: any }
) => {
  try {
    const isCronCall = input.source === "cron";

    // No delays - use concurrent processing instead

    // Process the data
    const result = await processXplData();

    // Only log success if truly successful (no errors)
    if (
      !isCronCall &&
      result.success &&
      "totalBuyOrders" in result &&
      "totalSellOrders" in result
    ) {
      const successResult = result as any;
      if (
        successResult.totalBuyOrders > 0 &&
        successResult.totalSellOrders > 0
      ) {
        logger.info("XPL data processing completed successfully", {
          buyOrders: successResult.totalBuyOrders,
          sellOrders: successResult.totalSellOrders,
          savedToDatabase: successResult.savedToDatabase,
          traceId,
        });
      }
    }

    return result;

    async function processXplData() {
      try {
        // Ensure database table exists
        await createOrderBooksTable();

        const URL =
          "https://www.kucoin.com/_api/grey-market-trade/grey/market/orderBook";
        const PARAMS = { lang: "vi_VN" };
        const HEADERS = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Content-Type": "application/json",
          Origin: "https://www.kucoin.com",
          Referer: "https://www.kucoin.com/vi/pre-market/XPL",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        };

        const sides = ["buy", "sell"];
        const allOrders: { buyOrders: any[]; sellOrders: any[] } = {
          buyOrders: [],
          sellOrders: [],
        };

        // Process buy and sell orders sequentially with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Processing timeout")), 15000); // 15 second timeout
        });

        const processingPromise = (async () => {
          for (const side of sides) {
            try {
              // Clean processing without delays

              const payload = {
                currentPage: 1,
                pageSize: 10,
                deliveryCurrency: "XPL",
                ownOrder: false,
                maxAmount: null,
                minAmount: null,
                sortFields: null,
                side: side,
              };

              // Fetch first page to get total pages
              const firstResult = await fetchPage(
                URL,
                PARAMS,
                HEADERS,
                payload
              );

              if (!firstResult || !firstResult.totalPage) {
                // Handle rate limiting gracefully - return empty orders
                if (firstResult && firstResult.totalPage === 0) {
                  console.log(
                    `⚠️ [RATE LIMITED] ${side} orders - returning empty data`
                  );
                  continue; // Skip to next side
                }
                throw new Error(
                  `Invalid response for ${side} orders: ${JSON.stringify(
                    firstResult
                  )}`
                );
              }

              const totalPages = firstResult.totalPage;

              // Handle case when no pages due to rate limiting
              if (totalPages === 0) {
                console.log(
                  `⚠️ [RATE LIMITED] ${side} orders - no pages available`
                );
                continue; // Skip to next side
              }

              // Fetch pages sequentially to avoid background processing
              const ordersWithStatus: any[] = [];
              for (
                let currentPage = 1;
                currentPage <= totalPages;
                currentPage++
              ) {
                payload.currentPage = currentPage;
                const result = await fetchPage(URL, PARAMS, HEADERS, payload);

                // Handle different response structures
                const orders = (result.data ||
                  result.items ||
                  result.orders ||
                  []) as any[];

                // Add status field to each order
                const pageOrders = orders.map((order) => ({
                  ...order,
                  status: "open",
                }));

                ordersWithStatus.push(...pageOrders);
              }

              // Add to allOrders directly
              if (side === "buy") {
                allOrders.buyOrders = ordersWithStatus;
              } else {
                allOrders.sellOrders = ordersWithStatus;
              }
            } catch (sideError) {
              logger.error(`Failed to fetch ${side} orders`, {
                error: (sideError as Error).message,
                side,
                traceId,
              });
              // Continue with empty orders for failed side
            }
          }
        })();

        // Race between processing and timeout
        try {
          await Promise.race([processingPromise, timeoutPromise]);
        } catch (error) {
          if ((error as Error).message === "Processing timeout") {
            logger.error("Processing timed out after 15 seconds", { traceId });
          } else {
            throw error;
          }
        }

        // Get existing orders from database
        const existingOrders = await getAllOrderBooks();

        // Create sets of new order IDs for comparison
        const newOrderIds = new Set([
          ...allOrders.buyOrders.map((order) => order.id),
          ...allOrders.sellOrders.map((order) => order.id),
        ]);

        // Update status of existing orders that are no longer in new data
        let closedCount = 0;
        for (const existingOrder of existingOrders) {
          if (!newOrderIds.has(existingOrder.uid)) {
            await updateOrderStatus(existingOrder.uid, "close");
            closedCount++;
          }
        }

        // Insert/update all new orders in database
        const allOrdersToSave = [
          ...allOrders.buyOrders,
          ...allOrders.sellOrders,
        ];
        let savedCount = 0;

        for (const order of allOrdersToSave) {
          try {
            await insertOrderBook({
              uid: order.id,
              side: order.side,
              username: order.userShortName || order.username || "Unknown",
              price: parseFloat(order.price) || 0,
              quantity: parseFloat(order.size) || 0,
              funds: parseFloat(order.funds) || 0,
              status: "open",
            });
            savedCount++;
          } catch (error) {
            logger.error(`Failed to save order ${order.id}`, {
              error: (error as Error).message,
              orderId: order.id,
              traceId,
            });
          }
        }

        // Check if we got any data at all
        const hasAnyData =
          allOrders.buyOrders.length > 0 || allOrders.sellOrders.length > 0;

        const result = {
          success: true,
          message: hasAnyData
            ? "XPL data processed and saved to database successfully"
            : "XPL data processing completed - no new data due to rate limiting",
          totalBuyOrders: allOrders.buyOrders.length,
          totalSellOrders: allOrders.sellOrders.length,
          totalEntries:
            allOrders.buyOrders.length + allOrders.sellOrders.length,
          savedToDatabase: savedCount,
          closedOrders: closedCount,
          source: input.source,
          rateLimited: !hasAnyData,
        };

        return result;
      } catch (error) {
        const errorResult = {
          success: false,
          error: "Failed to process XPL data from KuCoin",
          details: (error as Error).message,
          source: input.source,
        };

        logger.error("Failed to process XPL data from KuCoin", {
          error: (error as Error).message,
          traceId,
        });

        return errorResult;
      }
    }
  } catch (error) {
    const errorResult = {
      success: false,
      error: "Failed to process XPL data from KuCoin",
      details: (error as Error).message,
      source: input.source,
    };

    logger.error("Failed to process XPL data from KuCoin", {
      error: (error as Error).message,
      traceId,
    });

    return errorResult;
  }
};

// Simple request cache - no delays, just caching
const requestCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds cache

// Request deduplication - prevent duplicate requests
const pendingRequests = new Map<string, Promise<any>>();

// Clean fetch function - no delays, just cache and deduplication
async function fetchPage(url: string, params: any, headers: any, payload: any) {
  const requestKey = `${url}-${JSON.stringify(payload)}`;

  // Check cache first
  const cached = requestCache.get(requestKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Check if request is already pending
  const pendingRequest = pendingRequests.get(requestKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Create new request promise
  const requestPromise = (async () => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });

      // Handle rate limiting gracefully
      if (response.status === 429) {
        // Return empty result instead of throwing error
        return {
          data: [],
          items: [],
          orders: [],
          totalPage: 0,
          totalCount: 0,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Cache successful result
      requestCache.set(requestKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(requestKey);
    }
  })();

  // Store pending request
  pendingRequests.set(requestKey, requestPromise);

  return requestPromise;
}
