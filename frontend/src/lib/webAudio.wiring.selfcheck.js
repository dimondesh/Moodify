/**
 * Safari wave-analyzer wiring: AnalyserNode must sit on the path to
 * destination. A dead-end tap (internal→analyser only) yields silence /
 * flat line while audio still plays via internal→output.
 *
 * Run: node src/lib/webAudio.wiring.selfcheck.js
 * Also asserts production source keeps analyser→output when enabled.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mockNode(name) {
  const edges = [];
  return {
    name,
    edges,
    connect(dest) {
      edges.push(dest.name);
      return dest;
    },
    disconnect() {
      edges.length = 0;
    },
  };
}

/** Mirrors applySettingsToGraph output wiring after the Safari fix. */
function wireOutput(internal, analyser, output, waveAnalyzerEnabled) {
  analyser.disconnect();
  internal.disconnect();
  if (waveAnalyzerEnabled) {
    internal.connect(analyser);
    analyser.connect(output);
  } else {
    internal.connect(output);
  }
}

function edgesOf(node) {
  return [...node.edges].sort().join(",");
}

{
  const internal = mockNode("internal");
  const analyser = mockNode("analyser");
  const output = mockNode("output");
  wireOutput(internal, analyser, output, true);
  assert(edgesOf(internal) === "analyser", `enabled: internal→${edgesOf(internal)}`);
  assert(edgesOf(analyser) === "output", `enabled: analyser→${edgesOf(analyser)}`);
}

{
  const internal = mockNode("internal");
  const analyser = mockNode("analyser");
  const output = mockNode("output");
  wireOutput(internal, analyser, output, false);
  assert(edgesOf(internal) === "output", `disabled: internal→${edgesOf(internal)}`);
  assert(edgesOf(analyser) === "", `disabled: analyser→${edgesOf(analyser)}`);
}

{
  // Old Safari-broken topology: tap-only analyser
  const internal = mockNode("internal");
  const analyser = mockNode("analyser");
  const output = mockNode("output");
  internal.connect(analyser);
  internal.connect(output);
  const broken =
    edgesOf(internal) === "analyser,output" && edgesOf(analyser) === "";
  assert(broken, "expected broken tap topology for contrast");
}

const srcPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "webAudio.ts",
);
const src = fs.readFileSync(srcPath, "utf8");
assert(
  src.includes("this.analyserNode.connect(this.outputNode)"),
  "webAudio.ts must connect analyser → output (Safari)",
);
assert(
  !/this\.internalOutputNode\.connect\(this\.analyserNode\);\s*\} else \{\s*try \{\s*this\.internalOutputNode\.disconnect\(this\.analyserNode\)/.test(
    src,
  ),
  "webAudio.ts must not use the old tap-only analyser branch",
);

console.log("webAudio.wiring.selfcheck: ok");
