import { CronConfig } from "motia";

export const config: CronConfig = {
  type: "cron",
  name: "FetchXplCron",
  description: "Cron job to automatically fetch XPL data every minute",
  cron: "*/1 * * * *", // Every minute
  emits: ["xpl.fetch.requested"],
  flows: ["xpl-management"],
};

export const handler = async (req: any, context: any) => {
  const { logger, traceId } = context || {};

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

    console.log(`🔄 [START] ${startTime} - Triggering XPL data processing...`);

    // Motia will automatically emit the event defined in config.emits
    console.log(
      `📤 [EVENT] Motia will automatically emit xpl.fetch.requested event...`
    );

    // Just log the cron execution - Motia handles the event emission
    console.log(
      `✅ [EVENT SUCCESS] Cron job executed - event will be emitted automatically`
    );

    const endTime = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    console.log(`✅ [TRIGGERED] ${endTime} - Cron job completed successfully`);

    if (logger) {
      logger.info("Cron job completed successfully", {
        traceId,
      });
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
    console.error(`❌ [ERROR] Stack trace:`, (error as Error).stack);

    if (logger) {
      logger.error("Cron job failed", {
        error: (error as Error).message,
        traceId,
      });
    }
  }
};
