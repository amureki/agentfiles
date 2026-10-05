import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  join,
  relative,
  resolve,
  sep,
  parse as parsePath,
} from "node:path";
import type { FileInfo, LinkStep } from "./types.ts";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const inside = (path: string, root: string) =>
  path === root || path.startsWith(root + sep);
export const expand = (path: string, home: string, base: string) =>
  resolve(
    base,
    path === "~"
      ? home
      : path.startsWith("~/")
        ? join(home, path.slice(2))
        : path,
  );
export function textFile(path: string): string {
  if (statSync(path).size > 512 * 1024)
    throw new Error("File exceeds the 512 KB preview limit.");
  return readFileSync(path, "utf8");
}
export function inspectFile(path: string, dotfiles: string): FileInfo {
  const links: LinkStep[] = [];
  let pending = resolve(path),
    hops = 0;
  outer: while (hops < 40) {
    const root = parsePath(pending).root;
    const parts = pending.slice(root.length).split(sep).filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      current = join(current, parts[i]);
      try {
        if (lstatSync(current).isSymbolicLink()) {
          const target = resolve(dirname(current), readlinkSync(current));
          links.push({ path: current, target });
          pending = resolve(target, ...parts.slice(i + 1));
          hops++;
          continue outer;
        }
      } catch {
        break;
      }
    }
    break;
  }
  const exists = hops < 40 && existsSync(pending);
  const resolved = exists ? realpathSync(pending) : pending;
  const info: FileInfo = {
    path: resolve(path),
    resolved,
    links,
    exists,
    managed: inside(
      resolved,
      existsSync(dotfiles) ? realpathSync(dotfiles) : dotfiles,
    ),
  };
  if (exists && statSync(resolved).isFile()) {
    try {
      info.hash = hash(textFile(resolved));
      info.version = `sha256:${info.hash.slice(0, 10)}`;
    } catch {
      /* Oversized sources remain visible. */
    }
  }
  return info;
}
export function walk(
  root: string,
  accept: (path: string) => boolean,
  maxDepth = 7,
): string[] {
  const found: string[] = [],
    visited = new Set<string>();
  function visit(path: string, depth: number) {
    if (depth > maxDepth || found.length > 3000) return;
    try {
      if (lstatSync(path).isSymbolicLink() && !existsSync(path)) {
        if (accept(path)) found.push(path);
        else if (accept(join(path, "SKILL.md")))
          found.push(join(path, "SKILL.md"));
        return;
      }
    } catch {
      return;
    }
    try {
      const canonical = realpathSync(path);
      if (visited.has(canonical)) return;
      const stat = statSync(path);
      if (stat.isFile()) {
        if (accept(path)) found.push(path);
        return;
      }
      if (!stat.isDirectory()) return;
      visited.add(canonical);
      for (const entry of readdirSync(path).sort()) {
        if (
          [
            "node_modules",
            ".git",
            "references",
            "scripts",
            "assets",
            "sessions",
          ].includes(entry)
        )
          continue;
        if (entry.startsWith(".") && entry !== ".system") continue;
        visit(join(path, entry), depth + 1);
      }
    } catch {
      /* Missing and unreadable entries are handled by their owning source. */
    }
  }
  visit(root, 0);
  return found;
}
export function sourceLabel(
  info: FileInfo,
  home: string,
  dotfiles: string,
): string {
  if (info.managed) return "Dotfiles";
  if (inside(info.resolved, join(home, ".codex", "plugins")))
    return "Codex plugin";
  if (info.path.includes("/.system/")) return "Built-in";
  return "Local";
}
export function expectedTarget(
  path: string,
  home: string,
  dotfiles: string,
): string | undefined {
  if (!inside(path, home)) return;
  const expected = join(dotfiles, relative(home, path));
  if (existsSync(expected) && statSync(expected).isFile())
    return realpathSync(expected);
}
