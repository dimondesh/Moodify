#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const NAMES = ["moodify-analyzer", "moodify-embedding"];

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8", ...opts });
}

const hasCompose =
  run("docker", ["compose", "version"], { stdio: "pipe" }).status === 0;

if (hasCompose) {
  const result = run("docker", ["compose", "down"]);
  process.exit(result.status ?? 1);
}

for (const name of NAMES) {
  run("docker", ["rm", "-f", name]);
}
