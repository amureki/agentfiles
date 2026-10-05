import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createDemoHome } from "../src/demo.ts";
import { scan } from "../src/adapters.ts";
import { readDetail } from "../src/discovery.ts";

test("demo fixtures are isolated, discoverable, and removed on cleanup", (t) => {
  const demo = createDemoHome();
  t.after(demo.cleanup);
  const before = readdirSync(demo.home, { recursive: true }).sort();
  const options = {
    home: demo.home,
    dotfiles: join(demo.home, "dotfiles"),
    codexDir: join(demo.home, ".codex"),
    piDir: join(demo.home, ".pi/agent"),
    versions: { codex: "Sample version", pi: "Sample version" },
  };
  const inventory = scan(options);
  assert.equal(inventory.warnings.length, 0);
  assert.ok(inventory.harnesses.every((h) => h.version === "Sample version"));
  const instructions = inventory.items.find(
    (item) => item.kind === "instructions",
  )!;
  assert.equal(instructions.placements.length, 2);
  assert.ok(instructions.placements.every((p) => p.file.managed));
  const release = inventory.items.find(
    (item) => item.name === "release-check",
  )!;
  assert.equal(release.origin?.repository, "example/workflows");
  assert.equal(
    release.placements.find((p) => p.harness === "codex")?.state,
    "disabled",
  );
  assert.match(
    readDetail(options, release.id).content,
    /sample release checklist/,
  );
  assert.deepEqual(readdirSync(demo.home, { recursive: true }).sort(), before);
  demo.cleanup();
  assert.equal(existsSync(demo.home), false);
});
