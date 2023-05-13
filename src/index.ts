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
    maxNumberOfConcurrentPromises: 10,
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
    queue.addPromise(() => transactionStatus(2, "L")),
    queue.addPromise(() => transactionStatus(3, "M")),
    queue.addPromise(() => transactionStatus(3, "N")),
    queue.addPromise(() => transactionStatus(2, "O")),
    queue.addPromise(() => transactionStatus(9, "P")),
    queue.addPromise(() => transactionStatus(5, "Q")),
    queue.addPromise(() => transactionStatus(6, "R")),
    queue.addPromise(() => transactionStatus(3, "T")),
    queue.addPromise(() => transactionStatus(2, "U")),
    queue.addPromise(() => transactionStatus(8, "V")),
    queue.addPromise(() => transactionStatus(7, "W")),
    queue.addPromise(() => transactionStatus(1, "X")),
    queue.addPromise(() => transactionStatus(5, "Y")),
    queue.addPromise(() => transactionStatus(7, "Z")),
  ]).then((results) => {
    console.log(results);
    return results;
  });
}

console.log(run());
