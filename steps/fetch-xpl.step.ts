import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  createOrderBooksTable,
  insertOrderBook,
  updateOrderStatus,
  getAllOrderBooks,
  OrderBook,
} from "../utils/database";

export const config: ApiRouteConfig = {
  type: "api",
  name: "FetchXpl",
  description: "API endpoint to fetch XPL order book data from KuCoin",
  method: "GET",
  path: "/fetch-xpl",
  responseSchema: {
    200: z.object({
      success: z.boolean(),
      message: z.string(),
      totalBuyOrders: z.number(),
      totalSellOrders: z.number(),
      totalEntries: z.number(),
      savedToDatabase: z.number(),
    }),
    500: z.object({
      success: z.boolean(),
      error: z.string(),
    }),
  },
  emits: [],
  flows: ["xpl-management"],
};

export const handler: Handlers["FetchXpl"] = async (
  req,
  { logger, traceId, emit }
) => {
  try {
    logger.info("Fetching XPL order book data from KuCoin", { traceId });

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
      logger.info(`Fetching ${side.toUpperCase()} orders`, { side, traceId });

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
      const totalPages = firstResult.totalPage;

      if (side === "buy") {
        totalBuyPages = totalPages;
      } else {
        totalSellPages = totalPages;
      }

      logger.info(`Total pages for ${side}: ${totalPages}`, {
        side,
        totalPages,
        traceId,
      });

      // Fetch all pages
      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        payload.currentPage = currentPage;
        const result = await fetchPage(URL, PARAMS, HEADERS, payload);

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
    }

    // Get existing orders from database
    const existingOrders = await getAllOrderBooks();
    logger.info(`Found ${existingOrders.length} existing orders in database`, {
      traceId,
    });

    // Create sets of new order IDs for comparison
    const newOrderIds = new Set([
      ...allOrders.buyOrders.map((order) => order.id),
      ...allOrders.sellOrders.map((order) => order.id),
    ]);

    // Update status of existing orders that are no longer in new data
    for (const existingOrder of existingOrders) {
      if (!newOrderIds.has(existingOrder.uid)) {
        await updateOrderStatus(existingOrder.uid, "close");
        logger.info(`Marked order as closed: ${existingOrder.uid}`, {
          traceId,
        });
      }
    }

    // Insert/update all new orders in database
    const allOrdersToSave = [...allOrders.buyOrders, ...allOrders.sellOrders];
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

    logger.info(`Saved ${savedCount} orders to database`, {
      savedCount,
      traceId,
    });

    // Write data to file (keeping original file functionality)
    const filePath = join(process.cwd(), "xpl-token.txt");
    const now = new Date();
    const formattedTime = now.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const fileData = {
      timestamp: formattedTime,
      summary: {
        totalBuyPages,
        totalSellPages,
        totalBuyOrders: allOrders.buyOrders.length,
        totalSellOrders: allOrders.sellOrders.length,
      },
      buyOrders: allOrders.buyOrders,
      sellOrders: allOrders.sellOrders,
    };

    writeFileSync(filePath, JSON.stringify(fileData, null, 2), "utf8");

    logger.info("XPL data written to file and database successfully", {
      filePath,
      buyOrders: allOrders.buyOrders.length,
      sellOrders: allOrders.sellOrders.length,
      savedToDatabase: savedCount,
      traceId,
    });

    return {
      status: 200,
      body: {
        success: true,
        message:
          "XPL data fetched and saved to database and xpl-token.txt successfully",
        totalBuyOrders: allOrders.buyOrders.length,
        totalSellOrders: allOrders.sellOrders.length,
        totalEntries: allOrders.buyOrders.length + allOrders.sellOrders.length,
        savedToDatabase: savedCount,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch XPL data from KuCoin", {
      error: (error as Error).message,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: "Failed to fetch XPL data from KuCoin",
      },
    };
  }
};

// Helper function to fetch data from KuCoin API
async function fetchPage(url: string, params: any, headers: any, payload: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
