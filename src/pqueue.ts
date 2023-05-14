/**
What's different from https://github.com/doo-gl/concurrent-promise-queue/tree/main ?

The short verison

  - enhanced readability
  - better/more explicit encapsulation
  - using maps for promisesBeingExecuted and promiseExecutedCallbacks
  - try catch, error handling improvements, and add my logger with winston
  - spliting up execute() into multiple functions

The long verison

  - Error Handling and Logging: The first class MyConcurrentPromiseQueue uses the winston logger to provide improved logging and error handling. This can be seen in the execute() 
    method, where it uses a try-catch block to log errors when they occur. In contrast, the second class, ConcurrentPromiseQueue, does not have any explicit error handling or logging.
  
    - Storage of Executing Promises and Callbacks: MyConcurrentPromiseQueue uses Map for storing executing promises (promisesBeingExecuted) and promise execution callbacks 
    (promiseExecutedCallbacks). This provides better performance and more straightforward API compared to the plain object used in ConcurrentPromiseQueue.

  - Promise Handling: In MyConcurrentPromiseQueue, each promise supplier is invoked right away in the execute() method, and the result is handled through separate onPromiseFulfilled 
    and onPromiseRejected methods. In ConcurrentPromiseQueue, each promise supplier is also invoked in the execute() method, but its result is handled right within this method.

  - Reattempt Mechanism: The ConcurrentPromiseQueue class has a mechanism to reattempt promise execution when the rate limit is exceeded (reattemptTimeoutId). 
    This feature is absent in MyConcurrentPromiseQueue.
  
  - Option Defaults: MyConcurrentPromiseQueue sets default values for the queue options by destructuring and overwriting the defaults with the provided options. 
    The ConcurrentPromiseQueue class sets defaults by using the logical OR operator to take the provided value or the default value if the provided value is not truthy.

  - Logger Control: The MyConcurrentPromiseQueue class includes a method turnOffLogger() to silence the logger. This method is not present in ConcurrentPromiseQueue.

  - Code Structuring: The MyConcurrentPromiseQueue class is more modular with different operations separated into distinct methods (onPromiseFulfilled, onPromiseRejected, finalizePromise). 
    This makes the code easier to follow and manage compared to ConcurrentPromiseQueue, where these operations are performed within the execute() method itself.

  - Overall, these changes make MyConcurrentPromiseQueue more robust and manageable, especially in a production environment where error handling, logging, and code maintainability are crucial.
 */

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

export class MyConcurrentPromiseQueue<T> {
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

  constructor(options?: QueueOptions) {
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

  public turnOffLogger(): void {
    this.logger_.transports.forEach((t) => (t.silent = true));
  }
}