import { CronConfig } from "motia";

export const config: CronConfig = {
  type: "cron",
  name: "FetchXplCron",
  description: "Cron job to fetch XPL order book data from KuCoin every minute",
  cron: "*/1 * * * *", // Every minute
  emits: [],
  flows: ["xpl-management"],
};

export const handler = async (req: any, context: any) => {
  try {
    const startTime = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    console.log(`🔄 [START] ${startTime} - Fetching XPL data...`);

    // Call the main fetch function by making HTTP request to the API endpoint
    const response = await fetch("http://localhost:3000/fetch-xpl", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-cron-call": "true", // Mark as cron call to reduce logging
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const endTime = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      console.log(
        `✅ [COMPLETE] ${endTime} - FetchXplCron completed successfully:`,
        {
          buyOrders: result.totalBuyOrders,
          sellOrders: result.totalSellOrders,
          savedToDatabase: result.savedToDatabase,
          totalEntries: result.totalEntries,
        }
      );
    } else {
      throw new Error(result.error || "Unknown error occurred");
    }
  } catch (error) {
    const errorTime = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    console.error(
      `❌ [ERROR] ${errorTime} - FetchXplCron failed:`,
      (error as Error).message
    );
  }
};
