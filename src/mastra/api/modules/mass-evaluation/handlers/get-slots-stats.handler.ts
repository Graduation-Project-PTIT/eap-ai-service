import type { Context } from "hono";
import { redisConcurrencyManager } from "../utils/redis-concurrency-manager";

const getStatsHandler = async (c: Context) => {
  try {
    const stats = await redisConcurrencyManager.getStats();
    return c.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("[Mass Evaluation] Error getting stats:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      500
    );
  }
};

export default getStatsHandler;
