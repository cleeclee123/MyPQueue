# MyPQueue
My Implementation of a Concurrent Promise Queue. \
Implementation heavily inspired/Refactor of [concurrent-promise-queue](https://github.com/doo-gl/concurrent-promise-queue/tree/main). Check it out!

From [concurrent-promise-queue](https://github.com/doo-gl/concurrent-promise-queue/tree/main), "Allows promises to be queued up and executed at a maximum rate defined by time or max concurrency"

## What's Different?

- enhanced readbility
- better/more explicit encapsulation
- using maps for promisesBeingExecuted and promiseExecutedCallbacks
- try catch, error handling improvements, and add my logger with winston
- spliting up execute() into multiple functions

## Install

```bash
npm i mypqueue
```

## Examples:

### Executing promises in parallel

```TypeScript
import { MyConcurrentPromiseQueue } from "./pqueue.js";

const transactionStatus = (seconds: number, id: string) =>
  new Promise((resolve, reject) => {
    if (seconds > 25) {
      reject(new Error("Request timed out"));
    }
    setTimeout(() => {
      resolve(`Your transaction is successful, ${id}`);
    }, seconds * 1000);
  });

async function run() {
  const queue = new MyConcurrentPromiseQueue({
    maxNumberOfConcurrentPromises: 5,
  });

  return await Promise.all([
    queue.addPromise(() => transactionStatus(1, "A")),
    queue.addPromise(() => transactionStatus(2, "B")),
    queue.addPromise(() => transactionStatus(2, "C")),
    queue.addPromise(() => transactionStatus(5, "D")),
    queue.addPromise(() => transactionStatus(3, "E")),
    queue.addPromise(() => transactionStatus(5, "F")),
    queue.addPromise(() => transactionStatus(1, "G")),
    queue.addPromise(() => transactionStatus(8, "H")),
    queue.addPromise(() => transactionStatus(6, "I")),
    queue.addPromise(() => transactionStatus(5, "J")),
    queue.addPromise(() => transactionStatus(1, "K")),
  ]).then((results) => {
    console.log(results);
    return results;
  });
}

console.log(run());
```

```
[2023-05-13T23:20:25.391Z] info: 40717db4-7338-4e77-9f98-c43cf1e08aaa result, Your transaction is successful, A
[2023-05-13T23:20:26.386Z] info: 7d95688a-dbbd-4dd9-a033-05071525e2a3 result, Your transaction is successful, B
[2023-05-13T23:20:26.387Z] info: 06393823-a496-44da-a0a2-3925f52231bb result, Your transaction is successful, C
[2023-05-13T23:20:27.377Z] info: 4126aba7-5fd6-4d25-8d0a-545740381912 result, Your transaction is successful, E
[2023-05-13T23:20:27.396Z] info: 9c635015-9a5b-4816-9111-648e3e15404e result, Your transaction is successful, G
[2023-05-13T23:20:29.378Z] info: d487a8e1-097b-477d-8ac5-b93db58b85d9 result, Your transaction is successful, D
[2023-05-13T23:20:30.389Z] info: e7db1abc-6c90-4589-92c8-7ae7d76f72fe result, Your transaction is successful, K
[2023-05-13T23:20:30.391Z] info: a131f9a5-b053-4fc3-b74b-662d6bd764ad result, Your transaction is successful, F
[2023-05-13T23:20:32.397Z] info: 0ba9120a-e4b4-41b5-9580-b220dc50889f result, Your transaction is successful, J
[2023-05-13T23:20:33.390Z] info: ce8e493c-ce5a-434e-b077-e5a3daa298a0 result, Your transaction is successful, I
[2023-05-13T23:20:34.401Z] info: 8bc220be-00f9-47cd-aae3-b03c8ee51463 result, Your transaction is successful, H
```