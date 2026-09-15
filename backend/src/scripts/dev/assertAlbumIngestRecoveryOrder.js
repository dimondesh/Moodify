/**
 * Asserts BullMQ wait/LIFO semantics used by album-ingest crash recovery:
 * already-waiting jobs must not outrun a LIFO requeue, and numeric priority
 * must not be relied on (wait is drained before the prioritized set).
 *
 * Run: node src/scripts/dev/assertAlbumIngestRecoveryOrder.js
 */
import { Queue, Worker } from "bullmq";

const connection = { url: process.env.REDIS_URL || "redis://localhost:6379" };

const run = async (label, setup) => {
  const name = `moodify-assert-ingest-${label}-${Date.now()}`;
  const q = new Queue(name, { connection });
  await setup(q);
  const order = [];
  const w = new Worker(
    name,
    async (job) => {
      order.push(job.data.id);
    },
    { connection, concurrency: 1 },
  );
  await new Promise((r) => setTimeout(r, 1500));
  await w.close();
  await q.obliterate({ force: true });
  await q.close();
  return order;
};

const assertEq = (label, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL ${label}: got ${g}, want ${w}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok ${label}: ${g}`);
};

const lifoOrder = await run("lifo", async (q) => {
  await q.add("j", { id: "militantum" });
  await q.add("j", { id: "kizaru" });
  await q.add("j", { id: "deftones-recovered" }, { lifo: true });
});
assertEq("LIFO recovery jumps wait", lifoOrder, [
  "deftones-recovered",
  "militantum",
  "kizaru",
]);

const prioOrder = await run("prio", async (q) => {
  await q.add("j", { id: "waiting-0" }, { priority: 0 });
  await q.add("j", { id: "prio-10" }, { priority: 10 });
});
assertEq(
  "priority loses to wait (do not use for recovery)",
  prioOrder,
  ["waiting-0", "prio-10"],
);

if (!process.exitCode) console.log("all asserts passed");
process.exit(process.exitCode || 0);
