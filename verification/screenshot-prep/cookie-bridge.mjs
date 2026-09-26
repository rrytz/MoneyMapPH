// Local-only cookie bridge for the mobile capture pass.
// Writes the Supabase auth cookie posted by the harness page into a temp file.
// The cookie value never appears in stdout, logs, or the conversation.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 8787;
const OUT = path.join(os.tmpdir(), "mm-capture-cookie.txt");

const server = http.createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (req.method === "POST" && req.url === "/cookie") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        fs.writeFileSync(OUT, body, "utf8");
        res.writeHead(200, { ...cors, "Content-Type": "text/plain" });
        res.end("ok:" + body.length);
      } catch (e) {
        res.writeHead(500, cors);
        res.end("err:" + e.message);
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, cors);
    res.end("alive");
    return;
  }
  if (req.method === "GET" && req.url === "/done") {
    server.close();
    res.writeHead(200, cors);
    res.end("closed");
    return;
  }
  res.writeHead(404, cors);
  res.end("nf");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("bridge listening on 127.0.0.1:" + PORT);
});