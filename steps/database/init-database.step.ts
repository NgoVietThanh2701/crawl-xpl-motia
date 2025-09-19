import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import { createOrderBooksTable } from "../../utils/database";

export const config: ApiRouteConfig = {
  type: "api",
  name: "InitDatabase",
  description: "Initialize database and create order_books table",
  method: "POST",
  path: "/init-database",
  responseSchema: {
    200: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    500: z.object({
      success: z.boolean(),
      error: z.string(),
    }),
  },
  emits: [],
  flows: ["database-management"],
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
    logger.info("Initializing database and creating order_books table", {
      traceId,
    });

    // Create the order_books table
    await createOrderBooksTable();

    logger.info("Database initialized successfully", { traceId });

    return {
      status: 200,
      body: {
        success: true,
        message:
          "Database initialized and order_books table created successfully",
      },
    };
  } catch (error) {
    logger.error("Failed to initialize database", {
      error: (error as Error).message,
      traceId,
    });

    return {
      status: 500,
      body: {
        success: false,
        error: "Failed to initialize database",
      },
    };
  }
};
