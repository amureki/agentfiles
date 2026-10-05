import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readDetail } from "./discovery.ts";
import { scan } from "./adapters.ts";
import type { ScanOptions } from "./adapters.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = resolve(process.env.MYAI_HOME ?? homedir());
const options: ScanOptions = {
  home,
  dotfiles: resolve(process.env.MYAI_DOTFILES ?? join(home, "dev/dotfiles")),
  codexDir: resolve(process.env.CODEX_HOME ?? join(home, ".codex")),
  piDir: resolve(process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi/agent")),
};
const first = scan(options);
options.versions = Object.fromEntries(
  first.harnesses.map((h) => [h.id, h.version]),
);
const port = Number(process.env.MYAI_PORT ?? 4317);
let base = "";
const staticFiles: Record<string, [string, string]> = {
  "/": ["index.html", "text/html"],
  "/app.js": ["app.js", "text/javascript"],
  "/style.css": ["style.css", "text/css"],
};
function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
const server = createServer((request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  if (
    request.headers.host !== new URL(base).host ||
    (request.headers.origin && request.headers.origin !== base) ||
    request.headers["sec-fetch-site"] === "cross-site"
  )
    return json(response, 403, {
      error: "Use the local My AI page to access this server.",
    });
  const url = new URL(request.url ?? "/", base);
  try {
    if (request.method === "GET") {
      if (url.pathname === "/api/inventory")
        return json(response, 200, scan(options));
      if (url.pathname === "/api/detail")
        return json(
          response,
          200,
          readDetail(options, url.searchParams.get("id") ?? ""),
        );
      const file = staticFiles[url.pathname];
      if (file) {
        response.writeHead(200, {
          "Content-Type": `${file[1]}; charset=utf-8`,
          "Cache-Control": "no-cache",
        });
        return response.end(readFileSync(join(root, "dist", file[0])));
      }
      return json(response, 404, { error: "Not found." });
    }
    response.setHeader("Allow", "GET");
    return json(response, 405, {
      error: "My AI is read-only. Only GET requests are supported.",
    });
  } catch (error) {
    json(response, 400, {
      error: error instanceof Error ? error.message : "Request failed.",
    });
  }
});
server.on("error", (error) => {
  console.error(`My AI could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`;
  console.log(`My AI → ${base}\nDotfiles: ${options.dotfiles}`);
  if (!process.argv.includes("--no-open") && process.platform === "darwin")
    execFile("open", [base]);
});
