import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function createDemoHome() {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agentfiles-demo-")));
  try {
    const files = JSON.parse(
      readFileSync(new URL("../examples/demo.json", import.meta.url), "utf8"),
    ) as Record<string, string>;
    for (const [path, content] of Object.entries(files)) {
      const target = join(home, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    for (const [path, target] of [
      [".codex/AGENTS.md", "../dotfiles/AGENTS.md"],
      [".pi/agent/AGENTS.md", "../../dotfiles/AGENTS.md"],
      [
        ".agents/skills/code-review",
        "../../dotfiles/.agents/skills/code-review",
      ],
    ])
      symlinkSync(target, join(home, path));
    return {
      home,
      cleanup: () => rmSync(home, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(home, { recursive: true, force: true });
    throw error;
  }
}
