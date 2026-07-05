#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const token = process.env.EAP_SHIM_TOKEN;
const port = Number.parseInt(process.env.PORT ?? "", 10);
const logPath = ".orchestration/autoskill/runs/shim.log";
const timeoutMs = 180_000;

if (!token || !Number.isInteger(port) || port <= 0) {
  console.error("EAP_SHIM_TOKEN and PORT are required");
  process.exit(1);
}

await mkdir(".orchestration/autoskill/runs", { recursive: true });
const log = createWriteStream(logPath, { flags: "a", mode: 0o600 });
let count = 0;
let queue = Promise.resolve();

function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function messagesToPrompt(messages) {
  return messages
    .map((message) => {
      const role = String(message.role ?? "user");
      const content = Array.isArray(message.content)
        ? message.content.map((part) => part.text ?? "").join("\n")
        : String(message.content ?? "");
      return `${role}:\n${content}`;
    })
    .join("\n\n");
}

function runCodex(prompt) {
  return new Promise(async (resolve, reject) => {
    const scratch = await mkdtemp(join(tmpdir(), "autoskill-codex-"));
    const out = join(tmpdir(), `autoskill-codex-${process.pid}-${Date.now()}.txt`);
    const child = spawn(
      "codex",
      [
        "exec",
        "--sandbox",
        "read-only",
        "--cd",
        scratch,
        "--skip-git-repo-check",
        "-m",
        "gpt-5.5",
        "--output-last-message",
        out,
        "-",
      ],
      { stdio: ["pipe", "ignore", "ignore"] },
    );
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdin.end(prompt);
    child.on("error", reject);
    child.on("close", async (code, signal) => {
      clearTimeout(timer);
      try {
        if (code !== 0) {
          reject(new Error(`codex exec failed code=${code} signal=${signal ?? ""}`));
          return;
        }
        resolve(await readFile(out, "utf8"));
      } finally {
        await rm(scratch, { recursive: true, force: true });
        await rm(out, { force: true });
      }
    });
  });
}

function enqueue(prompt) {
  const next = queue.then(() => runCodex(prompt));
  queue = next.catch(() => undefined);
  return next;
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    writeJson(res, 404, { error: { message: "not found" } });
    return;
  }

  const started = Date.now();
  const requestId = ++count;
  try {
    if (req.headers.authorization !== `Bearer ${token}`) {
      writeJson(res, 401, { error: { message: "unauthorized" } });
      return;
    }
    const body = JSON.parse(await readBody(req));
    if (body.stream) {
      writeJson(res, 400, { error: { message: "streaming is not supported" } });
      return;
    }
    const content = await enqueue(messagesToPrompt(body.messages ?? []));
    writeJson(res, 200, {
      id: `codex-auth-${requestId}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-5.5",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (error) {
    writeJson(res, 500, { error: { message: String(error.message ?? error) } });
  } finally {
    log.write(`request=${requestId} latency_ms=${Date.now() - started}\n`);
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`codex auth proxy listening on 0.0.0.0:${port}`);
});
