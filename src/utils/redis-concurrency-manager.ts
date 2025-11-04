import Redis from 'ioredis';

/**
 * Redis-based concurrency manager for distributed workflow execution control
 * 
 * Features:
 * - Redis-backed state (survives restarts)
 * - Works across multiple service instances
 * - Configurable max concurrent evaluations
 * - Queue tasks when limit is reached
 * - Track active evaluations
 * - Promise-based API with pub/sub notifications
 */
class RedisConcurrencyManager {
  private redis: Redis;
  private subscriber: Redis;
  private maxConcurrent: number;
  private readonly ACTIVE_KEY = 'eval:active';
  private readonly QUEUE_KEY = 'eval:queue';
  private readonly CHANNEL = 'eval:slot_available';
  private readonly TASK_PREFIX = 'eval:task:';
  private readonly TASK_TTL = 3600; // 1 hour

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_EVALUATIONS || '5');

    // Main Redis client for operations
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Separate client for pub/sub
    this.subscriber = new Redis(redisUrl);

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    console.log(`Redis Concurrency Manager initialized with max ${this.maxConcurrent} concurrent evaluations`);
  }

  /**
   * Acquire a slot for task execution
   * Waits if max concurrent limit is reached
   */
  async acquire(taskId: string): Promise<void> {
    while (true) {
      const activeCount = await this.redis.scard(this.ACTIVE_KEY);

      if (activeCount < this.maxConcurrent) {
        // Try to add to active set
        const added = await this.redis.sadd(this.ACTIVE_KEY, taskId);
        
        if (added === 1) {
          // Successfully acquired slot
          await this.setTaskMetadata(taskId, 'active', Date.now());
          console.log(`Task ${taskId} acquired slot (${activeCount + 1}/${this.maxConcurrent})`);
          return;
        }
      }

      // Queue is full, add to waiting queue
      const queueData = JSON.stringify({ taskId, queuedAt: Date.now() });
      await this.redis.rpush(this.QUEUE_KEY, queueData);
      console.log(`Task ${taskId} queued, waiting for slot...`);

      // Wait for slot available notification
      await this.waitForSlot(taskId);
    }
  }

  /**
   * Release a slot after task completion
   */
  async release(taskId: string): Promise<void> {
    // Remove from active set
    await this.redis.srem(this.ACTIVE_KEY, taskId);
    
    // Update task metadata
    await this.setTaskMetadata(taskId, 'completed', Date.now());

    const activeCount = await this.redis.scard(this.ACTIVE_KEY);
    console.log(`Task ${taskId} released slot (${activeCount}/${this.maxConcurrent})`);

    // Notify waiting tasks
    await this.redis.publish(this.CHANNEL, 'slot_available');

    // Process next task from queue
    await this.processQueue();
  }

  /**
   * Wait for a slot to become available
   */
  private async waitForSlot(taskId: string): Promise<void> {
    return new Promise((resolve) => {
      const messageHandler = async (channel: string, message: string) => {
        if (channel === this.CHANNEL && message === 'slot_available') {
          // Check if this task is next in queue
          const queueData = await this.redis.lindex(this.QUEUE_KEY, 0);
          if (queueData) {
            const { taskId: nextTaskId } = JSON.parse(queueData);
            if (nextTaskId === taskId) {
              // Remove from queue
              await this.redis.lpop(this.QUEUE_KEY);
              this.subscriber.unsubscribe(this.CHANNEL);
              this.subscriber.off('message', messageHandler);
              resolve();
            }
          }
        }
      };

      this.subscriber.on('message', messageHandler);
      this.subscriber.subscribe(this.CHANNEL);
    });
  }

  /**
   * Process next task from queue
   */
  private async processQueue(): Promise<void> {
    const queueLength = await this.redis.llen(this.QUEUE_KEY);
    if (queueLength > 0) {
      await this.redis.publish(this.CHANNEL, 'slot_available');
    }
  }

  /**
   * Set task metadata in Redis
   */
  private async setTaskMetadata(taskId: string, status: string, timestamp: number): Promise<void> {
    const key = `${this.TASK_PREFIX}${taskId}`;
    await this.redis.hset(key, 'status', status, 'timestamp', timestamp.toString());
    await this.redis.expire(key, this.TASK_TTL);
  }

  /**
   * Get current concurrency statistics
   */
  async getStats(): Promise<{ active: number; queued: number; max: number }> {
    const active = await this.redis.scard(this.ACTIVE_KEY);
    const queued = await this.redis.llen(this.QUEUE_KEY);
    
    return {
      active,
      queued,
      max: this.maxConcurrent,
    };
  }
}

// Export singleton instance
export const redisConcurrencyManager = new RedisConcurrencyManager();