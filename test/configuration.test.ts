import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDetail } from "../src/discovery.ts";
import { inspectFile } from "../src/files.ts";
import { piEnabled, scan } from "../src/adapters.ts";

function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "myai-test-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home"),
    dotfiles = join(home, "dotfiles");
  for (const dir of [
    ".codex",
    ".pi/agent",
    ".agents/skills/sample",
    "dotfiles/.codex",
    "dotfiles/.pi/agent",
    "dotfiles/.agents/skills/sample",
  ])
    mkdirSync(join(home, dir), { recursive: true });
  writeFileSync(join(dotfiles, "AGENTS.md"), "Shared rules\n");
  symlinkSync("../AGENTS.md", join(dotfiles, ".codex/AGENTS.md"));
  symlinkSync("../../AGENTS.md", join(dotfiles, ".pi/agent/AGENTS.md"));
  symlinkSync("../dotfiles/.codex/AGENTS.md", join(home, ".codex/AGENTS.md"));
  symlinkSync(
    "../../dotfiles/.pi/agent/AGENTS.md",
    join(home, ".pi/agent/AGENTS.md"),
  );
  writeFileSync(
    join(home, ".agents/skills/sample/SKILL.md"),
    "---\nname: sample\ndescription: Sample workflow\n---\nInstructions\n",
  );
  writeFileSync(
    join(dotfiles, ".codex/config.toml"),
    '# Keep this comment\nmodel = "test-model"\n[mcp_servers.private]\nsecret = "NEVER_EXPOSE_ME"\n',
  );
  symlinkSync(
    "../dotfiles/.codex/config.toml",
    join(home, ".codex/config.toml"),
  );
  writeFileSync(
    join(dotfiles, ".pi/agent/settings.json"),
    JSON.stringify(
      { defaultModel: "test-model", secret: "NEVER_EXPOSE_ME", skills: [] },
      null,
      2,
    ),
  );
  symlinkSync(
    "../../dotfiles/.pi/agent/settings.json",
    join(home, ".pi/agent/settings.json"),
  );
  const options = {
    home,
    dotfiles,
    codexDir: join(home, ".codex"),
    piDir: join(home, ".pi/agent"),
    versions: { codex: "test", pi: "test" },
  };
  return { root, home, dotfiles, options, inventory: () => scan(options) };
}
test("resolves parent links and merges shared instructions across harnesses", (t) => {
  const { home, dotfiles, inventory } = fixture(t);
  const file = inspectFile(join(home, ".codex/AGENTS.md"), dotfiles);
  assert.equal(file.resolved, join(dotfiles, "AGENTS.md"));
  assert.equal(file.links.length, 2);
  const rules = inventory().items.find((i) => i.kind === "instructions")!;
  assert.equal(rules.placements.length, 2);
  assert.equal(rules.source, "Dotfiles");
});
test("settings details do not expose arbitrary sections or credentials", (t) => {
  const { inventory, options } = fixture(t);
  for (const item of inventory().items.filter((i) => i.kind === "settings")) {
    const detail = readDetail(options, item.id);
    assert.ok(!detail.content.includes("NEVER_EXPOSE_ME"));
    assert.ok(!("editable" in detail));
  }
});
test("duplicate skill names from divergent sources are uncertain", (t) => {
  const { home, inventory } = fixture(t);
  mkdirSync(join(home, ".pi/agent/skills/other"), { recursive: true });
  writeFileSync(
    join(home, ".pi/agent/skills/other/SKILL.md"),
    "---\nname: sample\ndescription: Different source\n---\nDifferent\n",
  );
  const items = inventory().items.filter((i) => i.name === "sample");
  assert.equal(items.length, 2);
  for (const item of items)
    assert.equal(
      item.placements.find((p) => p.harness === "pi")!.state,
      "unknown",
    );
});
test("Pi pattern handling respects force-exclusion precedence and skill directories", () => {
  const path = "/home/user/.agents/skills/sample/SKILL.md";
  assert.equal(
    piEnabled(path, ["!skills/**"], "/home/user/.agents", "/home/user"),
    false,
  );
  assert.equal(
    piEnabled(
      path,
      ["!skills/**", "+" + path],
      "/home/user/.agents",
      "/home/user",
    ),
    true,
  );
  assert.equal(
    piEnabled(
      path,
      ["+" + path, "-skills/sample"],
      "/home/user/.agents",
      "/home/user",
    ),
    false,
  );
});
test("global instruction overrides are visible and override the fallback", (t) => {
  const { home, inventory } = fixture(t);
  writeFileSync(
    join(home, ".codex/AGENTS.override.md"),
    "Override instructions\n",
  );
  const result = inventory();
  assert.equal(
    result.items.find((i) => i.name === "AGENTS.override.md")!.placements[0]
      .state,
    "available",
  );
  assert.equal(
    result.items
      .find((i) => i.name === "AGENTS.md")!
      .placements.find((p) => p.harness === "codex")!.state,
    "overridden",
  );
});
test("broken unmanaged skill symlinks remain visible without invented repair targets", (t) => {
  const { home, inventory } = fixture(t);
  symlinkSync(
    "/missing/skill-source",
    join(home, ".agents/skills/broken-skill"),
  );
  const item = inventory().items.find((i) => i.name === "broken-skill")!;
  assert.equal(item.placements[0].state, "broken");
  assert.ok(!("repairTarget" in item.placements[0]));
});

test("disabled settings remain discoverable without change capabilities", (t) => {
  const { home, dotfiles, inventory } = fixture(t);
  const skillPath = join(home, ".agents/skills/sample/SKILL.md");
  writeFileSync(
    join(dotfiles, ".codex/config.toml"),
    `[[skills.config]]\npath = "${skillPath}"\nenabled = false\n`,
  );
  writeFileSync(
    join(dotfiles, ".pi/agent/settings.json"),
    JSON.stringify({ skills: ["-" + skillPath] }),
  );
  const item = inventory().items.find((i) => i.name === "sample")!;
  assert.deepEqual(
    item.placements.map((p) => p.state),
    ["disabled", "disabled"],
  );
  assert.ok(!("editable" in item));
  for (const placement of item.placements) {
    assert.ok(!("toggle" in placement));
    assert.ok(!("repairTarget" in placement));
  }
});

test("skill origins follow canonical installed paths, not name prefixes", (t) => {
  const { home, inventory } = fixture(t);
  const metadataPath = join(home, ".agents/.skill-lock.json");
  writeFileSync(
    metadataPath,
    JSON.stringify({
      skills: {
        sample: { sourceType: "github", source: "owner/workflows" },
        "../other": { sourceType: "github", source: "wrong/repository" },
      },
    }),
  );
  mkdirSync(join(home, ".codex/skills"), { recursive: true });
  symlinkSync("../../.agents/skills/sample", join(home, ".codex/skills/alias"));
  mkdirSync(join(home, ".pi/agent/skills/sample"), { recursive: true });
  writeFileSync(
    join(home, ".pi/agent/skills/sample/SKILL.md"),
    "---\nname: sample\n---\nDifferent source\n",
  );
  const skills = inventory().items.filter(
    (item) => item.kind === "skills" && item.name === "sample",
  );
  assert.equal(skills.length, 2);
  const installed = skills.find((item) =>
    item.placements.some(
      (p) => p.file.resolved === join(home, ".agents/skills/sample/SKILL.md"),
    ),
  )!;
  assert.deepEqual(installed.origin, {
    repository: "owner/workflows",
    metadataPath,
  });
  assert.equal(installed.source, "Local");
  assert.equal(skills.find((item) => item !== installed)!.origin, undefined);
  writeFileSync(metadataPath, "invalid json");
  const fallback = inventory();
  assert.equal(
    fallback.items.some((item) => item.origin),
    false,
  );
  assert.ok(
    fallback.warnings.some((warning) =>
      warning.includes("skill origin metadata"),
    ),
  );
});

test("dotfiles are optional and direct harness discovery remains available", (t) => {
  const { options } = fixture(t);
  const inventory = scan({ ...options, dotfiles: "" });
  assert.equal(inventory.dotfiles, "");
  assert.equal(inventory.warnings.length, 0);
  assert.ok(inventory.items.some((item) => item.name === "sample"));
  assert.ok(
    inventory.items.every((item) =>
      item.placements.every((p) => !p.file.managed),
    ),
  );
});
