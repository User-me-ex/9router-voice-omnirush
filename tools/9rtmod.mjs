#!/usr/bin/env node
/*
 * 9rtmod - one-command launcher for the 9Router voice/OmniRush build.
 *
 * The repository only carries the changed files, so on first run this script:
 *   1. clones upstream 9Router at the matching tag into .9rtmod/app
 *   2. overlays the files from this repository on top
 *   3. installs dependencies and produces a production build
 *   4. starts custom-server.js (voice gateway included)
 *
 * Requires Node.js >= 20.9 and git on PATH.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Global npm installs land under node_modules; keep working files in the user home
// instead of writing inside the npm prefix.
const INSTALLED = REPO.split(path.sep).includes("node_modules");
const WORK = INSTALLED ? path.join(os.homedir(), ".9rtmod") : path.join(REPO, ".9rtmod");
const APP_DIR = path.join(WORK, "app");
const LOGS = path.join(WORK, "logs");
const STATE = path.join(WORK, "state.json");

const UPSTREAM = "https://github.com/decolua/9router.git";
const BASE_TAG = "v0.5.112";
const PATCH = path.join(REPO, "patch", "9router-voice-omnirush.patch");
const DEFAULT_PORT = 20128;

const OVERLAY = [
  "custom-server.js",
  "live-gateway.js",
  "voice-gateway.js",
  "omni-overload-hook.cjs",
  "Dockerfile",
  "next.config.mjs",
  "open-sse",
  "public",
  "src",
];

const isWin = process.platform === "win32";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`\n[9rtmod] ${msg}\n`);
  process.exit(1);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(patch) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ ...readState(), ...patch }, null, 2));
}

function run(cmd, args, opts = {}) {
  const useShell = opts.shell ?? false;
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
    shell: useShell,
  });
  if (res.error) fail(`${cmd} failed: ${res.error.message}`);
  if (res.status !== 0) fail(`${cmd} exited with code ${res.status}`);
}

function npm(args, opts = {}) {
  run("npm", args, { ...opts, shell: isWin });
}

function git(args, opts = {}) {
  run("git", args, opts);
}

function repoCommit() {
  const res = spawnSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : "";
}

function hasFullTree() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
    return pkg.name === "9router-app" && fs.existsSync(path.join(REPO, "custom-server.js"));
  } catch {
    return false;
  }
}

function appDir() {
  return hasFullTree() ? REPO : APP_DIR;
}

function upstreamTags() {
  const res = spawnSync("git", ["ls-remote", "--tags", "--refs", UPSTREAM, "v*"], { encoding: "utf8" });
  if (res.status !== 0) return [];
  return res.stdout
    .split(/\r?\n/)
    .map((line) => (line.split("\t")[1] || "").replace("refs/tags/", ""))
    .filter((tag) => /^v\d+(\.\d+)*$/.test(tag))
    .sort((a, b) => version(a) - version(b));
}

function version(tag) {
  const parts = tag.replace(/^v/, "").split(".").map(Number);
  return parts[0] * 1e6 + parts[1] * 1e3 + parts[2];
}

function latestTag() {
  const tags = upstreamTags();
  return tags.length ? tags[tags.length - 1] : BASE_TAG;
}

function overlay(app) {
  for (const entry of OVERLAY) {
    const src = path.join(REPO, entry);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(app, entry), { recursive: true, force: true });
  }
}

function prepare(force = false, tag = BASE_TAG) {
  if (hasFullTree()) return REPO;

  const state = readState();
  const ready =
    fs.existsSync(path.join(APP_DIR, "custom-server.js")) && (!state.base || state.base === tag);
  if (ready && !force) return APP_DIR;

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  log(`Fetching upstream 9Router ${tag}...`);
  git(["clone", "--depth", "1", "--branch", tag, UPSTREAM, APP_DIR]);

  log("Applying local changes...");
  if (tag !== BASE_TAG && fs.existsSync(PATCH)) {
    git(["fetch", "--depth", "1", "origin", "tag", BASE_TAG], { cwd: APP_DIR });
    const applied = spawnSync("git", ["apply", "--3way", "--binary", PATCH], {
      cwd: APP_DIR,
      stdio: "inherit",
    });
    if (applied.status !== 0) {
      log(`\n[9rtmod] ${BASE_TAG} changes do not merge cleanly onto ${tag}.`);
      log("[9rtmod] Falling back to file overlay; modified files stay at their");
      log(`[9rtmod] ${BASE_TAG} content while the rest of the tree is ${tag}.\n`);
      overlay(APP_DIR);
    }
  } else {
    overlay(APP_DIR);
  }

  writeState({ preparedAt: new Date().toISOString(), base: tag, preparedCommit: repoCommit() });
  return APP_DIR;
}

function sqliteWorks(app) {
  const res = spawnSync(
    process.execPath,
    ["-e", "require('better-sqlite3'); process.stdout.write('ok')"],
    { cwd: app, encoding: "utf8" }
  );
  return res.status === 0;
}

function ensureDeps(app) {
  if (!fs.existsSync(path.join(app, "node_modules")) || !sqliteWorks(app)) {
    log("Installing dependencies (first run, a few minutes)...");
    npm(["install", "--no-audit", "--no-fund"], { cwd: app });
    if (!sqliteWorks(app)) {
      log("Rebuilding native module better-sqlite3...");
      spawnSync("npm", ["install-scripts", "approve", "better-sqlite3"], {
        cwd: app,
        stdio: "ignore",
        shell: isWin,
      });
      npm(["rebuild", "better-sqlite3"], { cwd: app });
    }
    if (!sqliteWorks(app)) {
      fail("better-sqlite3 could not be built. Install build tools (Visual Studio Build Tools) and rerun.");
    }
  }
}

function newestSourceMtime(app) {
  let newest = 0;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git", ".9rtmod", "logs"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  };
  visit(app);
  return newest;
}

function ensureBuild(app, force = false) {
  const buildId = path.join(app, ".next", "BUILD_ID");
  const state = readState();
  const commit = repoCommit();
  const built = fs.existsSync(buildId);
  const staleCommit = commit && state.buildCommit !== commit;
  let staleTime = false;
  if (built) {
    const buildTime = fs.statSync(buildId).mtimeMs;
    staleTime = hasFullTree() && newestSourceMtime(app) > buildTime + 1000;
  }

  if (built && !force && !staleCommit && !staleTime) return;

  log("Building (first run, several minutes)...");
  const home = path.join(WORK, "build-home");
  const roaming = path.join(home, "Roaming");
  fs.mkdirSync(roaming, { recursive: true });

  npm(["run", "build"], {
    cwd: app,
    env: {
      // Next 16 build tracing walks the user profile on Windows and can crash
      // with EPERM on protected AppData folders; point it at a local home.
      APPDATA: roaming,
      USERPROFILE: home,
      HOME: home,
      NODE_OPTIONS: "--max-old-space-size=6144",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  if (!fs.existsSync(buildId)) fail("build finished without .next/BUILD_ID");
  writeState({ buildCommit: commit, builtAt: new Date().toISOString() });
}

function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

async function healthy(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitHealth(port, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await healthy(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function tailLog() {
  if (!fs.existsSync(LOGS)) return "";
  const files = fs
    .readdirSync(LOGS)
    .filter((f) => f.endsWith(".log"))
    .map((f) => path.join(LOGS, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!files.length) return "";
  const lines = fs.readFileSync(files[0], "utf8").trimEnd().split(/\r?\n/);
  return `${files[0]}\n${lines.slice(-40).join("\n")}`;
}

async function start(port, opts) {
  const state = readState();
  if (alive(state.pid) && state.port === port && (await healthy(port))) {
    log(`Already running: http://localhost:${port} (pid ${state.pid})`);
    return;
  }
  if (!(await portFree(port))) {
    fail(`Port ${port} is already in use. Pick another with: --port <n>`);
  }

  fs.mkdirSync(LOGS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = fs.openSync(path.join(LOGS, `server-${stamp}.log`), "a");

  const child = spawn(process.execPath, [path.join(appDir(), "custom-server.js"), "--port", String(port)], {
    cwd: appDir(),
    detached: true,
    windowsHide: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, NODE_ENV: "production" },
  });
  child.unref();
  writeState({ pid: child.pid, port, startedAt: new Date().toISOString() });

  if (!(await waitHealth(port, 180))) {
    log(tailLog());
    fail(`Server did not become healthy on port ${port}. Logs: ${LOGS}`);
  }
  log(`\n  9Router is running: http://localhost:${port}`);
  log(`  Voice WebSocket : ws://127.0.0.1:${port}/v1/voice/<live-config>`);
  log(`  Dashboard       : http://localhost:${port}/dashboard/live`);
  log(`  Stop            : ./9rtmod stop\n`);
}

function stop() {
  const state = readState();
  const pid = state.pid;
  if (!alive(pid)) {
    log("Not running.");
    writeState({ pid: null });
    return;
  }
  if (isWin) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
  writeState({ pid: null });
  log(`Stopped pid ${pid}.`);
}

async function status() {
  const state = readState();
  const app = appDir();
  const build = fs.existsSync(path.join(app, ".next", "BUILD_ID"));
  log(`repo    : ${REPO}`);
  log(`mode    : ${hasFullTree() ? "full source tree" : `overlay on upstream ${readState().base || BASE_TAG}`}`);
  log(`app     : ${app}`);
  log(`build   : ${build ? "present" : "missing"}`);
  const port = state.port || DEFAULT_PORT;
  const up = await healthy(port);
  log(`port ${port}: ${up ? `LISTENING (pid ${state.pid})` : "not running"}`);
  if (up) log(`url     : http://localhost:${port}`);
}

function logs() {
  const text = tailLog();
  log(text || "No logs yet.");
}

function usage() {
  log(`Usage: 9rtmod [command] [--port <n>] [--to <tag>] [--rebuild]

Commands:
  start      install/build if needed, then run (default)
  stop       stop the running server
  restart    stop, then start
  status     show build and process state
  logs       print the last server log
  build      rebuild, then restart
  update     move to the newest upstream release, keep modifications
  doctor     environment check
  help       this text`);
}

function doctor() {
  const major = Number(process.versions.node.split(".")[0]);
  log(`node    : ${process.version} ${major >= 20 ? "(ok)" : "(too old, need >= 20.9)"}`);
  const gitVersion = spawnSync("git", ["--version"], { encoding: "utf8" });
  log(`git     : ${gitVersion.status === 0 ? gitVersion.stdout.trim() : "missing"}`);
  const app = appDir();
  log(`app     : ${app}`);
  log(`deps    : ${fs.existsSync(path.join(app, "node_modules")) ? "installed" : "missing"}`);
  log(`sqlite  : ${fs.existsSync(path.join(app, "node_modules")) ? (sqliteWorks(app) ? "ok" : "broken") : "n/a"}`);
  log(`build   : ${fs.existsSync(path.join(app, ".next", "BUILD_ID")) ? "present" : "missing"}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv.find((a) => !a.startsWith("-")) || "start";
  const portArg = argv.indexOf("--port");
  const port = portArg !== -1 ? Number(argv[portArg + 1]) : DEFAULT_PORT;
  const force = argv.includes("--rebuild") || argv.includes("--force");
  const toArg = argv.indexOf("--to");
  const toTag = toArg !== -1 ? argv[toArg + 1] : "";

  if (!Number.isInteger(port) || port <= 0) fail("invalid --port");

  if (command === "help" || command === "-h" || command === "--help") return usage();
  if (command === "doctor") return doctor();
  if (command === "status") return status();
  if (command === "logs") return logs();
  if (command === "stop") return stop();

  if (command === "update") {
    const target = toTag || latestTag();
    log(`Updating modified build to upstream ${target} (changes are kept)...`);
    if (!hasFullTree() && fs.existsSync(path.join(REPO, ".git"))) {
      spawnSync("git", ["-C", REPO, "pull", "--ff-only"], { stdio: "inherit" });
    }
    const state = readState();
    if (alive(state.pid)) stop();
    const app = prepare(true, target);
    ensureDeps(app);
    ensureBuild(app, true);
    log(`Updated to ${target}; local modifications reapplied.`);
    return start(port);
  }

  if (command === "restart") stop();

  const app = prepare(force, toTag || BASE_TAG);
  ensureDeps(app);
  ensureBuild(app, force || command === "build");

  if (command === "build") {
    log("Build complete.");
    return;
  }
  await start(port);
}

main().catch((err) => fail(err?.stack || String(err)));
