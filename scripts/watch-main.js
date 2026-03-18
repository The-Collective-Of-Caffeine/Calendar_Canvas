const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const readyFile = path.join(process.cwd(), ".main-ready");
const tscEntrypoint = require.resolve("typescript/bin/tsc");

let outputBuffer = "";
let markedReady = false;

function removeReadyFile() {
  if (fs.existsSync(readyFile)) {
    fs.unlinkSync(readyFile);
  }
}

function markReady() {
  if (markedReady) {
    return;
  }

  fs.writeFileSync(readyFile, `${Date.now()}\n`, "utf8");
  markedReady = true;
}

function processChunk(chunk, writer) {
  const text = chunk.toString();
  writer.write(text);

  outputBuffer = `${outputBuffer}${text}`.slice(-4000);

  if (/Found 0 errors\./.test(outputBuffer)) {
    markReady();
  }
}

function shutdown(code) {
  removeReadyFile();
  process.exit(code);
}

removeReadyFile();

const child = spawn(
  process.execPath,
  [tscEntrypoint, "-p", "tsconfig.main.json", "--watch", "--preserveWatchOutput"],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"]
  }
);

child.stdout.on("data", (chunk) => processChunk(chunk, process.stdout));
child.stderr.on("data", (chunk) => processChunk(chunk, process.stderr));

child.on("exit", (code, signal) => {
  removeReadyFile();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
  shutdown(0);
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  shutdown(0);
});
