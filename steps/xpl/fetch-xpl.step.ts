import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";

export const config: ApiRouteConfig = {
  type: "api",
  name: "XplDataApi",
  description: "API endpoint to trigger XPL data processing",
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
  emits: ["xpl.fetch.requested"],
  flows: ["api-endpoints"],
};

export const handler: Handlers["XplDataApi"] = async (
  req,
  { logger, traceId, emit }
) => {
  try {
    const isCronCall = req.headers?.["x-cron-call"] === "true";

    // Emit event to trigger the processing
    await (emit as any)({
      topic: "xpl.fetch.requested",
      data: {
        source: isCronCall ? "cron" : "api",
        traceId,
      },
    });

    // Return immediate response
    return {
      status: 200,
      body: {
        success: true,
        message: "XPL data processing triggered successfully",
        totalBuyOrders: 0,
        totalSellOrders: 0,
        totalEntries: 0,
        savedToDatabase: 0,
      },
    };
  } catch (error) {
    logger.error("Failed to trigger XPL data processing", {
      error: (error as Error).message,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: "Failed to trigger XPL data processing",
      },
    };
  }
};
