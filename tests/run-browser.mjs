import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import worker from "../worker.js";

const browserPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const live = process.argv.includes("--live");
const profile = await mkdtemp(join(tmpdir(), "job-post-test-"));
let finish;
const results = new Promise((resolve) => { finish = resolve; });
const server = createServer(async (request, response) => {
  if (live && request.url === "/api/proxy") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      const result = await worker.fetch(new Request("https://app.example/api/proxy", {
        method: request.method, headers: { "Content-Type": "application/json" }, body
      }), {});
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) { response.writeHead(502); response.end(error.message); }
    return;
  }
  if (request.url === "/results" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.end("OK");
    finish(JSON.parse(body));
    return;
  }
  const files = { "/tests/crawler.html": "crawler.html", "/crawler.js": "../crawler.js" };
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (!files[pathname]) { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", pathname.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8");
  response.end(await readFile(new URL(files[pathname], import.meta.url)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = spawn(browserPath, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/tests/crawler.html${live ? "?live=1" : ""}`], { stdio: "ignore" });
browser.on("error", (error) => finish([{ name: "browser launch", ok: false, error: error.message }]));
const timeout = setTimeout(() => finish([{ name: "browser tests", ok: false, error: "Timed out" }]), 25000);
try {
  const output = await results;
  for (const result of output) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`);
  if (output.some((result) => !result.ok)) process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  browser.kill();
  server.closeAllConnections();
  server.close();
}
