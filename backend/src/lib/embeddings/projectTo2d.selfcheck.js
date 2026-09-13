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

// Two tight clusters in 8-d
const clusterA = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, (_, i) => (i < 4 ? 1 : 0) + Math.random() * 0.05),
);
const clusterB = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, (_, i) => (i >= 4 ? 1 : 0) + Math.random() * 0.05),
);

const points = projectEmbeddingsTo2d([...clusterA, ...clusterB]);
assert(points.length === 16, `expected 16 points, got ${points.length}`);

const a = points.slice(0, 8);
const b = points.slice(8);
const mean = (arr, key) => arr.reduce((s, p) => s + p[key], 0) / arr.length;
const ca = { x: mean(a, "x"), y: mean(a, "y") };
const cb = { x: mean(b, "x"), y: mean(b, "y") };

const intraA =
  a.reduce((s, p) => s + dist(p, ca), 0) / a.length;
const intraB =
  b.reduce((s, p) => s + dist(p, cb), 0) / b.length;
const inter = dist(ca, cb);

assert(inter > intraA * 2, `clusters not separated: inter=${inter} intraA=${intraA}`);
assert(inter > intraB * 2, `clusters not separated: inter=${inter} intraB=${intraB}`);

assert(projectEmbeddingsTo2d([]).length === 0, "empty input");
assert(projectEmbeddingsTo2d([[1, 0, 0]]).length === 1, "single point");

console.log("projectTo2d.selfcheck: ok");
