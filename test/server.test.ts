import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("read-only HTTP boundary rejects writes and leaves fixture files unchanged", async (t) => {
  const home = mkdtempSync(join(tmpdir(), "agentfiles-http-"));
  for (const dir of [".codex", ".pi/agent", "dotfiles"])
    mkdirSync(join(home, dir), { recursive: true });
  writeFileSync(join(home, ".codex/AGENTS.md"), "Fixture rules\n");
  const beforePaths = readdirSync(home, { recursive: true }).sort();
  const beforeContent = readFileSync(join(home, ".codex/AGENTS.md"), "utf8");
  const child = spawn(process.execPath, ["src/server.ts", "--no-open"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: "/usr/bin:/bin",
      AGENTFILES_HOME: home,
      AGENTFILES_DOTFILES: join(home, "dotfiles"),
      AGENTFILES_PORT: "0",
      CODEX_HOME: join(home, ".codex"),
      PI_CODING_AGENT_DIR: join(home, ".pi/agent"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    rmSync(home, { recursive: true, force: true });
  });
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Fixture server did not start.")),
      10_000,
    );
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Fixture server exited ${code}`));
    });
  });
  const inventory = await fetch(url + "/api/inventory").then((r) => r.json());
  assert.equal(inventory.items.length, 1);
  assert.equal(
    (
      await fetch(url + "/api/inventory", {
        headers: { Origin: "https://foreign.example" },
      })
    ).status,
    403,
  );
  const foreignHostStatus = await new Promise<number | undefined>(
    (resolve, reject) => {
      const req = request(
        url + "/api/inventory",
        { headers: { Host: "foreign.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      req.on("error", reject);
      req.end();
    },
  );
  assert.equal(foreignHostStatus, 403);
  assert.equal(
    (await fetch(url + "/api/detail?id=../../etc/passwd")).status,
    400,
  );
  const details = await fetch(
    url + `/api/detail?id=${inventory.items[0].id}`,
  ).then((r) => r.json());
  assert.equal(details.content, beforeContent);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    for (const path of [
      "/api/preview",
      "/api/apply",
      "/api/undo",
      "/api/inventory",
      "/api/detail",
    ]) {
      const response = await fetch(url + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: inventory.items[0].id,
          action: "edit",
          content: "Overwrite attempt",
        }),
      });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "GET");
    }
  for (const path of [
    "/api/session",
    "/api/history",
    "/api/preview",
    "/api/apply",
    "/api/undo",
  ])
    assert.equal((await fetch(url + path)).status, 404);
  assert.deepEqual(readdirSync(home, { recursive: true }).sort(), beforePaths);
  assert.equal(
    readFileSync(join(home, ".codex/AGENTS.md"), "utf8"),
    beforeContent,
  );
});
