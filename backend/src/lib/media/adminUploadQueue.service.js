import {
  enterGlobalUploadLease,
  leaveGlobalUploadLease,
} from "./adminUploadLease.service.js";
import { v4 as uuidv4 } from "uuid";

const queue = [];
const history = []; // Храним историю последних задач
let processing = false;

async function drain() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue[0];
    job.status = "processing";
    enterGlobalUploadLease();
    try {
      const result = await job.fn();
      job.status = "completed";
      if (job.resolve) job.resolve(result);
    } catch (e) {
      job.status = "error";
      job.error = e.message;
      if (job.reject) job.reject(e);
    } finally {
      leaveGlobalUploadLease();
      const finishedJob = queue.shift();
      history.unshift(finishedJob);
      if (history.length > 50) history.pop(); // Храним максимум 50 последних задач
    }
  }
  processing = false;
}

// Добавили title для красоты в UI
export function enqueueAdminFileJob(fn, title = "Фоновая задача") {
  return new Promise((resolve, reject) => {
    queue.push({
      id: uuidv4(),
      title,
      status: "waiting",
      fn,
      resolve,
      reject,
    });
    drain();
  });
}

export function getAdminFileQueueSnapshot() {
  return {
    waitingCount: queue.length > 0 ? queue.length - 1 : 0,
    busy: processing,
    activeJobs: queue.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
    })),
    history: history.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      error: j.error,
    })),
  };
}
