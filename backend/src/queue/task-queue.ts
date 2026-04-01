import PQueue from "p-queue";
import { logger } from "../config/logger";

/**
 * In-process task queue using p-queue
 * No Redis dependency - perfect for single-user desktop app
 */
class TaskQueue {
  private queue: PQueue;

  constructor() {
    this.queue = new PQueue({
      concurrency: 2, // Process 2 tasks at a time
      interval: 1000,
      intervalCap: 5, // Max 5 tasks per second
    });

    this.queue.on("active", () => {
      logger.debug(
        `Queue: ${this.queue.size} pending, ${this.queue.pending} active`
      );
    });

    this.queue.on("idle", () => {
      logger.debug("Queue: all tasks completed");
    });

    this.queue.on("error", (error) => {
      logger.error({ error }, "Queue task error");
    });
  }

  async add<T>(fn: () => Promise<T>, priority?: number): Promise<T> {
    return this.queue.add(fn, { priority }) as Promise<T>;
  }

  get size() {
    return this.queue.size;
  }

  get pending() {
    return this.queue.pending;
  }

  get isIdle() {
    return this.queue.size === 0 && this.queue.pending === 0;
  }

  clear() {
    this.queue.clear();
  }
}

export const taskQueue = new TaskQueue();
