/**
 * Self-check for projectEmbeddingsTo2d.
 * Run: node src/lib/embeddings/projectTo2d.selfcheck.js
 */
import { projectEmbeddingsTo2d } from "./projectTo2d.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Two tight clusters in 8-d (enough points that perplexity=30 still separates)
function makeCluster(centerOnes, n = 24) {
  return Array.from({ length: n }, (_, row) =>
    Array.from({ length: 8 }, (_, i) => {
      const base = centerOnes(i) ? 1 : 0;
      // Deterministic jitter — avoid flaky Math.random failures.
      return base + (((row * 17 + i * 13) % 10) / 10 - 0.45) * 0.04;
    }),
  );
}

const clusterA = makeCluster((i) => i < 4);
const clusterB = makeCluster((i) => i >= 4);

const { points, method } = projectEmbeddingsTo2d([...clusterA, ...clusterB]);
assert(points.length === 48, `expected 48 points, got ${points.length}`);
assert(method === "pca+tsne", `expected pca+tsne, got ${method}`);

const a = points.slice(0, 24);
const b = points.slice(24);
const mean = (arr, key) => arr.reduce((s, p) => s + p[key], 0) / arr.length;
const ca = { x: mean(a, "x"), y: mean(a, "y") };
const cb = { x: mean(b, "x"), y: mean(b, "y") };

const intraA = a.reduce((s, p) => s + dist(p, ca), 0) / a.length;
const intraB = b.reduce((s, p) => s + dist(p, cb), 0) / b.length;
const inter = dist(ca, cb);

assert(inter > intraA * 2, `clusters not separated: inter=${inter} intraA=${intraA}`);
assert(inter > intraB * 2, `clusters not separated: inter=${inter} intraB=${intraB}`);

assert(projectEmbeddingsTo2d([]).points.length === 0, "empty input");
assert(projectEmbeddingsTo2d([[1, 0, 0]]).points.length === 1, "single point");
assert(projectEmbeddingsTo2d([[1, 0, 0]]).method === "pca", "single uses pca");

console.log("projectTo2d.selfcheck: ok");
