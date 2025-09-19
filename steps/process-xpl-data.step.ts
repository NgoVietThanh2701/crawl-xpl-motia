import { EventConfig } from "motia";
import { z } from "zod";
import {
  createOrderBooksTable,
  insertOrderBook,
  updateOrderStatus,
  getAllOrderBooks,
  OrderBook,
} from "../utils/database";

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
    console.log(`🎯 [EVENT RECEIVED] ProcessXplData received event:`, {
      input,
      traceId,
    });

    const isCronCall = input.source === "cron";

    if (isCronCall) {
      console.log(`⏰ [CRON PROCESSING] Processing XPL data from cron job`, {
        traceId,
      });
    } else {
      logger.info("Processing XPL order book data from KuCoin", { traceId });
    }

    // Add small delay for cron calls to avoid immediate rate limiting
    if (isCronCall) {
      console.log(`⏳ [DELAY] Waiting 2 seconds before processing...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
    }

    // Process the data
    const result = await processXplData();

    // Log completion (no emit needed)
    console.log(`✅ [COMPLETED] XPL data processing completed successfully`);

    if (!isCronCall && result.success) {
      const successResult = result as any;
      logger.info("XPL data processing completed successfully", {
        buyOrders: successResult.totalBuyOrders,
        sellOrders: successResult.totalSellOrders,
        savedToDatabase: successResult.savedToDatabase,
        traceId,
      });
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
        let totalBuyPages = 0;
        let totalSellPages = 0;

        for (const side of sides) {
          try {
            if (!isCronCall) {
              logger.info(`Fetching ${side.toUpperCase()} orders`, {
                side,
                traceId,
              });
            }

            // Add delay between buy/sell requests to avoid rate limiting
            if (side === "sell") {
              await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay before sell
            }

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
            const firstResult = await fetchPage(URL, PARAMS, HEADERS, payload);

            if (!firstResult || !firstResult.totalPage) {
              throw new Error(
                `Invalid response for ${side} orders: ${JSON.stringify(
                  firstResult
                )}`
              );
            }

            const totalPages = firstResult.totalPage;

            if (side === "buy") {
              totalBuyPages = totalPages;
            } else {
              totalSellPages = totalPages;
            }

            if (!isCronCall) {
              logger.info(`Total pages for ${side}: ${totalPages}`, {
                side,
                totalPages,
                traceId,
              });
            }

            // Fetch all pages
            for (
              let currentPage = 1;
              currentPage <= totalPages;
              currentPage++
            ) {
              payload.currentPage = currentPage;
              const result = await fetchPage(URL, PARAMS, HEADERS, payload);

              // Add delay between requests to avoid rate limiting
              if (currentPage < totalPages) {
                await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
              }

              // Handle different response structures
              const orders = (result.data ||
                result.items ||
                result.orders ||
                []) as any[];

              // Add status field to each order
              const ordersWithStatus = orders.map((order) => ({
                ...order,
                status: "open",
              }));

              if (side === "buy") {
                allOrders.buyOrders.push(...ordersWithStatus);
              } else {
                allOrders.sellOrders.push(...ordersWithStatus);
              }
            }
          } catch (sideError) {
            logger.error(`Failed to fetch ${side} orders`, {
              error: (sideError as Error).message,
              side,
              traceId,
            });
            // Continue with other side instead of failing completely
          }
        }

        // Get existing orders from database
        const existingOrders = await getAllOrderBooks();
        if (!isCronCall) {
          logger.info(
            `Found ${existingOrders.length} existing orders in database`,
            {
              traceId,
            }
          );
        }

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
            if (!isCronCall) {
              logger.info(`Marked order as closed: ${existingOrder.uid}`, {
                traceId,
              });
            }
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

        if (!isCronCall) {
          logger.info(`Saved ${savedCount} orders to database`, {
            savedCount,
            traceId,
          });
        }

        const result = {
          success: true,
          message: "XPL data processed and saved to database successfully",
          totalBuyOrders: allOrders.buyOrders.length,
          totalSellOrders: allOrders.sellOrders.length,
          totalEntries:
            allOrders.buyOrders.length + allOrders.sellOrders.length,
          savedToDatabase: savedCount,
          closedOrders: closedCount,
          source: input.source,
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

    // Log failure (no emit needed)
    console.log(
      `❌ [FAILED] XPL data processing failed: ${errorResult.details}`
    );

    logger.error("Failed to process XPL data from KuCoin", {
      error: (error as Error).message,
      traceId,
    });

    return errorResult;
  }
};

// Helper function to fetch data from KuCoin API with retry logic
async function fetchPage(
  url: string,
  params: any,
  headers: any,
  payload: any,
  retries = 3,
  delay = 2000
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        if (attempt < retries) {
          console.log(
            `⏳ [RATE LIMIT] Attempt ${attempt}/${retries} - Waiting ${delay}ms before retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(
            `HTTP error! status: ${response.status} - Rate limited after ${retries} attempts`
          );
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(
        `⚠️ [RETRY] Attempt ${attempt}/${retries} failed:`,
        (error as Error).message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
