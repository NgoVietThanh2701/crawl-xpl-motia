import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import { getAllOrderBooks } from "../../utils/database";

export const config: ApiRouteConfig = {
  type: "api",
  name: "GetOrders",
  description: "Get all order books data from database for comparison",
  method: "GET",
  path: "/order-books",
  responseSchema: {
    200: z.object({
      success: z.boolean(),
      data: z.array(
        z.object({
          id: z.number(),
          uid: z.string(),
          side: z.string(),
          username: z.string(),
          price: z.number(),
          quantity: z.number(),
          funds: z.number(),
          status: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
        })
      ),
      total: z.number(),
      message: z.string(),
    }),
    500: z.object({
      success: z.boolean(),
      error: z.string(),
    }),
  },
  emits: [],
  flows: ["xpl-management"],
};

export const handler = async (
  req: any,
  {
    logger,
    traceId,
    emit,
  }: {
    logger: any;
    traceId: string;
    emit: (event: { topic: string; data: any }) => Promise<void>;
  }
) => {
  try {
    logger.info("Fetching all orders from database for comparison", {
      traceId,
    });

    // Get all orders from database
    const orders = await getAllOrderBooks();

    logger.info(`Retrieved ${orders.length} orders from database`, {
      total: orders.length,
      traceId,
    });

    return {
      status: 200,
      body: {
        success: true,
        data: orders,
        total: orders.length,
        message: `Retrieved ${orders.length} orders successfully`,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch orders from database", {
      error: (error as Error).message,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: "Failed to fetch orders from database",
      },
    };
  }
};
