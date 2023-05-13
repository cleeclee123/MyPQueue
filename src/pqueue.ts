// refactor of https://github.com/doo-gl/concurrent-promise-queue/blob/main/src/index.ts
// better/more explicit encapsulation
// using maps for promisesBeingExecuted and promiseExecutedCallbacks
// try catch, error handling improvements, and add my logger with winston
// spliting up execute() into multiple functions

import { v4 as uuid } from "uuid";
import { createLogger, transports, format, Logger } from "winston";

export type PromiseSupplier<T> = () => Promise<T>;

type PromiseExecutionListener<T> = (result: FinishedPromiseResult<T>) => void;

interface FinishedPromiseResult<T> {
  isSuccess: boolean;
  result: T | null;
  error: unknown;
}

interface QueuedPromise<T> {
  id: string;
  promiseSupplier: PromiseSupplier<T>;
}

export interface QueueOptions {
  maxNumberOfConcurrentPromises?: number;
  unitOfTimeMillis?: number;
  maxThroughputPerUnitTime?: number;
}

export class NewConcurrentPromiseQueue<T> {
  private readonly maxNumberOfConcurrentPromises: number;
  private readonly unitOfTimeMillis: number;
  private readonly maxThroughputPerUnitTime: number;
  private promisesToExecute: Array<QueuedPromise<T>> = [];
  private promisesBeingExecuted = new Map<string, QueuedPromise<T>>();
  private promiseExecutedCallbacks = new Map<
    string,
    PromiseExecutionListener<T>
  >();
  private promiseCompletedTimesLog: Date[] = [];
  protected logger_: Logger;

  constructor(options: QueueOptions) {
    const defaultOptions = {
      maxNumberOfConcurrentPromises: 1,
      unitOfTimeMillis: 100,
      maxThroughputPerUnitTime: 1000,
    } as const;

    const finalOptions = { ...defaultOptions, ...options };

    this.maxNumberOfConcurrentPromises =
      finalOptions.maxNumberOfConcurrentPromises;
    this.unitOfTimeMillis = finalOptions.unitOfTimeMillis;
    this.maxThroughputPerUnitTime = finalOptions.maxThroughputPerUnitTime;

    this.logger_ = createLogger({
      transports: [new transports.Console()],
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    });
  }

  public numberOfQueuedPromises(): number {
    return this.promisesToExecute.length;
  }

  public numberOfExecutingPromises(): number {
    return this.promisesBeingExecuted.size;
  }

  public addPromise(promiseSupplier: PromiseSupplier<T>): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const id = uuid();
      this.promisesToExecute.push({ id, promiseSupplier });
      this.promiseExecutedCallbacks.set(
        id,
        ({ isSuccess, result, error }: FinishedPromiseResult<T>) => {
          isSuccess ? resolve(result) : reject(error);
        }
      );
      this.execute();
    });
  }

  private execute(): void {
    try {
      while (this.canExecuteMorePromises()) {
        const promise = this.promisesToExecute.shift();
        if (!promise) return;
        this.promisesBeingExecuted.set(promise.id, promise);
        promise
          .promiseSupplier()
          .then((result) => {
            this.onPromiseFulfilled(promise.id, result);
            this.logger_.info(`Promise ${promise.id} fulfilled`);
            this.logger_.info(`${promise.id} result, ${result}`);
          })
          .catch((error) => {
            this.onPromiseRejected(promise.id, error);
            this.logger_.error(`Promise ${promise.id} failed`);
            this.logger_.error(`${promise.id} error, ${error}`);
          });
      }
    } catch (error) {
      this.logger_.error(`execute error, ${error}`);
    }
  }

  private canExecuteMorePromises(): boolean {
    const now = Date.now();
    const timeThreshold = now - this.unitOfTimeMillis;
    this.promiseCompletedTimesLog = this.promiseCompletedTimesLog.filter(
      (time) => time.getTime() >= timeThreshold
    );
    return (
      this.promisesBeingExecuted.size < this.maxNumberOfConcurrentPromises &&
      this.promiseCompletedTimesLog.length < this.maxThroughputPerUnitTime
    );
  }

  private onPromiseFulfilled(id: string, result: T): void {
    const callback = this.promiseExecutedCallbacks.get(id);
    if (callback) {
      callback({ isSuccess: true, result, error: null });
    }
    this.finalizePromise(id);
  }

  private onPromiseRejected(id: string, error: unknown): void {
    const callback = this.promiseExecutedCallbacks.get(id);
    if (callback) {
      callback({ isSuccess: false, result: null, error });
    }
    this.finalizePromise(id);
  }

  private finalizePromise(id: string): void {
    this.promisesBeingExecuted.delete(id);
    this.promiseExecutedCallbacks.delete(id);
    this.promiseCompletedTimesLog.push(new Date(Date.now()));
    this.execute();
  }
}