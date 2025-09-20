import { CronConfig, Handlers } from "motia";

export const config: CronConfig = {
  type: "cron",
  name: "FetchXplCron",
  description: "Cron job to automatically fetch XPL data every 2 minutes",
  cron: "*/2 * * * *", // Every 2 minutes to reduce API pressure
  emits: ["xpl.fetch.requested"],
  flows: ["xpl-management"],
};

export const handler: Handlers["FetchXplCron"] = async ({
  emit,
  logger,
  traceId,
}) => {
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

    // Emit the event with cron source data
    await emit({
      topic: "xpl.fetch.requested",
      data: {
        source: "cron",
        traceId,
      },
    });

    console.log(
      `📤 [EVENT] Successfully emitted xpl.fetch.requested event from cron`
    );

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

    throw error; // Re-throw to let Motia handle the error
  }
};
