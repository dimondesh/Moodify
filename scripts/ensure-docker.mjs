#!/usr/bin/env node
/**
 * Bring up analyzer (:5001) and embedding (:5006) for local dev.
 * Prefers `docker compose`; falls back to plain docker build/run when the
 * Compose plugin is missing (common on Ubuntu docker.io packages).
 *
 * Code changes are live via bind-mount + uvicorn --reload.
 * Containers are recreated only when the image id changes (Dockerfile /
 * requirements.txt), not on every npm run dev.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_LABEL = "com.moodify.dev";

const SERVICES = [
  {
    name: "moodify-analyzer",
    context: "analyzer",
    port: 5001,
    volumes: ["analyzer:/app"],
  },
  {
    name: "moodify-embedding",
    context: "embedding",
    port: 5006,
    volumes: ["embedding:/app", "/app/venv"],
  },
];

function run(cmd, args, { inherit = true, cwd = root } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function out(cmd, args) {
  const result = run(cmd, args, { inherit: false });
  if (result.status !== 0) return "";
  return (result.stdout || "").trim();
}

function hasCompose() {
  return run("docker", ["compose", "version"], { inherit: false }).status === 0;
}

function containerExists(name) {
  return run("docker", ["container", "inspect", name], { inherit: false }).status === 0;
}

function label(name, key) {
  return out("docker", [
    "container",
    "inspect",
    "-f",
    `{{index .Config.Labels "${key}"}}`,
    name,
  ]);
}

function removeIfLegacy(name) {
  if (!containerExists(name)) return;
  if (label(name, "com.docker.compose.project") || label(name, DEV_LABEL) === "1") {
    return;
  }
  console.log(`Removing legacy container ${name}`);
  run("docker", ["rm", "-f", name]);
}

function upWithCompose() {
  for (const { name } of SERVICES) removeIfLegacy(name);
  const up = run("docker", ["compose", "up", "-d", "--build"]);
  if (up.status !== 0) process.exit(up.status ?? 1);
}

function resolveVolume(vol) {
  if (vol.startsWith("/")) return vol; // anonymous volume
  const [host, ...rest] = vol.split(":");
  return `${path.join(root, host)}:${rest.join(":")}`;
}

function ensureService(svc) {
  removeIfLegacy(svc.name);

  console.log(`Building ${svc.name}...`);
  const build = run("docker", ["build", "-t", svc.name, path.join(root, svc.context)]);
  if (build.status !== 0) process.exit(build.status ?? 1);

  const imageId = out("docker", ["image", "inspect", "-f", "{{.Id}}", svc.name]);
  const running =
    out("docker", ["container", "inspect", "-f", "{{.State.Running}}", svc.name]) ===
    "true";
  const managed = label(svc.name, DEV_LABEL) === "1";
  const currentImage = out("docker", [
    "container",
    "inspect",
    "-f",
    "{{.Image}}",
    svc.name,
  ]);

  if (running && managed && currentImage === imageId) {
    console.log(`${svc.name} already up to date`);
    return;
  }

  if (containerExists(svc.name)) {
    console.log(`Recreating ${svc.name}...`);
    run("docker", ["rm", "-f", svc.name]);
  } else {
    console.log(`Starting ${svc.name}...`);
  }

  const args = [
    "run",
    "-d",
    "--name",
    svc.name,
    "--restart",
    "unless-stopped",
    "--label",
    `${DEV_LABEL}=1`,
    "-p",
    `${svc.port}:${svc.port}`,
  ];
  for (const vol of svc.volumes) {
    args.push("-v", resolveVolume(vol));
  }
  args.push(
    svc.name,
    "uvicorn",
    "app:app",
    "--host",
    "0.0.0.0",
    "--port",
    String(svc.port),
    "--reload",
  );

  const started = run("docker", args);
  if (started.status !== 0) process.exit(started.status ?? 1);
}

function upWithDocker() {
  for (const svc of SERVICES) ensureService(svc);
}

if (hasCompose()) {
  upWithCompose();
} else {
  console.log("docker compose not found; using docker build/run fallback");
  upWithDocker();
}
