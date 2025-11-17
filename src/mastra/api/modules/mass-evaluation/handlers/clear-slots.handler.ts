import type { Context } from "hono";
import { redisConcurrencyManager } from "../utils/redis-concurrency-manager";

const clearSlotsHandler = async (c: Context) => {
  try {
    const result = await redisConcurrencyManager.clearAll();

    return c.json({
      success: true,
      message: "All concurrency slots cleared",
      ...result,
    });
  } catch (error: any) {
    console.error("[Clear Slots] Error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to clear slots",
      },
      500
    );
  }
};

export default clearSlotsHandler;
