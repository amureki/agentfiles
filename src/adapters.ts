import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import picomatch from "picomatch";
import {
  expand,
  expectedTarget,
  hash,
  inspectFile,
  inside,
  sourceLabel,
  textFile,
  walk,
} from "./files.ts";
import type {
  Harness,
  HarnessId,
  Inventory,
  Item,
  Kind,
  Placement,
  State,
} from "./types.ts";

export interface ScanOptions {
  home: string;
  dotfiles: string;
  codexDir: string;
  piDir: string;
  versions?: Partial<Record<HarnessId, string>>;
}
type Config = Record<string, any>;
export interface AdapterContext {
  options: ScanOptions;
  items: Item[];
  warnings: string[];
  add: (
    kind: Kind,
    name: string,
    description: string,
    placement: Placement,
    version?: string,
    source?: string,
  ) => void;
}
export interface HarnessAdapter {
  id: HarnessId;
  scan: (context: AdapterContext) => Harness;
}

export function readConfig(path: string): Config {
  const raw = textFile(path);
  return path.endsWith(".toml") ? (parseToml(raw) as Config) : JSON.parse(raw);
}
export function piEnabled(
  path: string,
  patterns: string[],
  base: string,
  home: string,
  packageFilter = false,
): boolean {
  const candidates = [path, relative(base, path), basename(path)];
  if (basename(path) === "SKILL.md")
    candidates.push(dirname(path), relative(base, dirname(path)));
  const exact = (pattern: string) =>
    candidates.slice(0, 2).includes(pattern.replace(/\/$/, "")) ||
    (basename(path) === "SKILL.md" &&
      [dirname(path), relative(base, dirname(path))].includes(
        pattern.replace(/\/$/, ""),
      )) ||
    expand(pattern, home, base) === path ||
    (basename(path) === "SKILL.md" &&
      expand(pattern, home, base) === dirname(path));
  const matches = (pattern: string) =>
    candidates.some((candidate) =>
      picomatch(pattern, { dot: true })(candidate),
    );
  const plain = patterns.filter((p) => !/^[!+-]/.test(p));
  let enabled = !packageFilter || !plain.length || plain.some(matches);
  if (patterns.some((p) => p.startsWith("!") && matches(p.slice(1))))
    enabled = false;
  if (patterns.some((p) => p.startsWith("+") && exact(p.slice(1))))
    enabled = true;
  if (patterns.some((p) => p.startsWith("-") && exact(p.slice(1))))
    enabled = false;
  return enabled;
}

function version(id: HarnessId, options: ScanOptions): string {
  if (options.versions) return options.versions[id] ?? "Not installed";
  try {
    return execFileSync(id, ["--version"], {
      timeout: 4000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")[0];
  } catch {
    return "Not detected";
  }
}
function configFor(
  path: string,
  context: AdapterContext,
): { config: Config; valid: boolean } {
  if (!existsSync(path)) return { config: {}, valid: true };
  try {
    return { config: readConfig(path), valid: true };
  } catch {
    context.warnings.push(
      `Cannot parse ${path}. Resolve the file error before changing settings.`,
    );
    return { config: {}, valid: false };
  }
}
function placement(
  path: string,
  harness: HarnessId,
  context: AdapterContext,
  note: string,
  state: State = "available",
): Placement {
  const { dotfiles } = context.options;
  const file = inspectFile(path, dotfiles);
  const result: Placement = {
    harness,
    state: file.exists ? state : "broken",
    note: file.exists
      ? note
      : "The expected file is missing or its link is broken.",
    file,
  };
  return result;
}
function instructions(
  context: AdapterContext,
  harness: HarnessId,
  directory: string,
) {
  const candidates =
    harness === "codex"
      ? ["AGENTS.override.md", "AGENTS.md"]
      : [
          "AGENTS.override.md",
          "AGENTS.md",
          "AGENTS.MD",
          "CLAUDE.md",
          "CLAUDE.MD",
        ];
  let selected = false;
  for (const candidate of candidates) {
    const path = join(directory, candidate);
    const file = inspectFile(path, context.options.dotfiles);
    if (
      !file.exists &&
      !expectedTarget(path, context.options.home, context.options.dotfiles) &&
      !file.links.some((link) => inside(link.path, directory))
    )
      continue;
    const state = selected ? "overridden" : "available";
    context.add(
      "instructions",
      candidate,
      "Global instructions",
      placement(
        path,
        harness,
        context,
        selected
          ? "A higher-priority global instruction file is selected instead of this file."
          : "Global instructions; project instructions can add or override rules.",
        state,
      ),
    );
    if (file.exists) selected = true;
  }
  if (harness === "pi")
    for (const name of ["SYSTEM.md", "APPEND_SYSTEM.md"]) {
      const path = join(directory, name);
      if (existsSync(path))
        context.add(
          "instructions",
          name,
          name === "SYSTEM.md"
            ? "Custom Pi system prompt"
            : "Additional Pi system instructions",
          placement(
            path,
            harness,
            context,
            name === "SYSTEM.md"
              ? "Replaces Pi’s default system prompt. Launch arguments can override this source."
              : "Appends to Pi’s system prompt. Launch arguments can override this source.",
          ),
        );
    }
}
function skill(
  context: AdapterContext,
  harness: HarnessId,
  path: string,
  state: State,
  note: string,
  version?: string,
  source?: string,
) {
  let meta: Config = {};
  let valid = true;
  try {
    const raw = textFile(path);
    const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (block) meta = parseYaml(block[1]) ?? {};
  } catch {
    valid = false;
  }
  const name =
    typeof meta.name === "string" ? meta.name : basename(dirname(path));
  const description =
    typeof meta.description === "string"
      ? meta.description
      : "No skill description found.";
  const entry = placement(path, harness, context, note, state);
  if (entry.file.exists && (!valid || !meta.description)) {
    entry.state = "unknown";
    entry.note =
      "Skill metadata is missing or invalid. Verify that the harness can load this file.";
  }
  if (meta["disable-model-invocation"] === true)
    entry.note += " Explicit invocation only.";
  const declaredVersion = meta.metadata?.version ?? meta.version;
  context.add(
    "skills",
    name,
    description,
    entry,
    version ??
      (typeof declaredVersion === "string" ||
      typeof declaredVersion === "number"
        ? String(declaredVersion)
        : undefined),
    source,
  );
}
function configItem(
  context: AdapterContext,
  harness: HarnessId,
  path: string,
  label: string,
) {
  if (existsSync(path))
    context.add(
      "settings",
      label,
      "Selected settings; credentials excluded",
      placement(
        path,
        harness,
        context,
        "Settings preview exposes only supported, non-secret fields.",
      ),
    );
}

export const codexAdapter: HarnessAdapter = {
  id: "codex",
  scan(context) {
    const { options } = context,
      configPath = join(options.codexDir, "config.toml");
    const { config, valid } = configFor(configPath, context);
    instructions(context, "codex", options.codexDir);
    configItem(context, "codex", configPath, "Codex settings");
    const roots = [
      join(options.home, ".agents", "skills"),
      join(options.codexDir, "skills"),
    ];
    for (const root of roots) {
      const paths = walk(root, (p) => basename(p) === "SKILL.md");
      const stored = join(options.dotfiles, relative(options.home, root));
      for (const p of options.dotfiles
        ? walk(stored, (p) => basename(p) === "SKILL.md")
        : []) {
        const installed = join(root, relative(stored, p));
        if (!paths.includes(installed)) paths.push(installed);
      }
      for (const path of paths) {
        const overrides = Array.isArray(config.skills?.config)
          ? config.skills.config
          : [];
        const file = inspectFile(path, options.dotfiles);
        const disabled = overrides.some(
          (rule: Config) =>
            rule.enabled === false &&
            typeof rule.path === "string" &&
            [file.path, file.resolved].includes(
              inspectFile(
                expand(rule.path, options.home, options.codexDir),
                options.dotfiles,
              ).resolved,
            ),
        );
        skill(
          context,
          "codex",
          path,
          valid ? (disabled ? "disabled" : "available") : "unknown",
          valid
            ? "Discovered from a global skill directory."
            : "Availability is unknown because Codex settings cannot be parsed.",
        );
      }
    }
    const cache = join(options.codexDir, "plugins", "cache");
    if (existsSync(cache))
      for (const marketplace of readdirSync(cache)) {
        const marketDir = join(cache, marketplace);
        if (!statSync(marketDir).isDirectory()) continue;
        for (const plugin of readdirSync(marketDir)) {
          const versionsDir = join(marketDir, plugin);
          if (!statSync(versionsDir).isDirectory()) continue;
          const versions = readdirSync(versionsDir)
            .filter((v) => /^\d/.test(v))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
          if (!versions.length) continue;
          const root = join(versionsDir, versions[0]);
          const pluginConfig =
            config.plugins?.[`${plugin}@${marketplace}`] ??
            config.plugins?.[
              `${plugin}@${marketplace.replace(/-remote$/, "")}`
            ];
          const state: State =
            !valid || !pluginConfig
              ? "unknown"
              : pluginConfig.enabled === false
                ? "disabled"
                : pluginConfig.enabled === true
                  ? "available"
                  : "unknown";
          for (const path of walk(
            join(root, "skills"),
            (p) => basename(p) === "SKILL.md",
          ))
            skill(
              context,
              "codex",
              path,
              state,
              `Cached plugin ${plugin}. ${!valid ? "Codex settings cannot be parsed, so enablement cannot be verified." : !pluginConfig ? "Plugin files are cached, but config.toml has no enabled flag for this plugin. Codex app plugin state is not checked." : state === "unknown" ? "The plugin configuration has no explicit enabled flag. Enablement cannot be verified." : "Enabled flag read from Codex config; cached version may differ from the active session."}`,
              versions[0],
              `Plugin · ${plugin}`,
            );
        }
      }
    for (const path of walk(join(options.codexDir, "rules"), (p) =>
      p.endsWith(".rules"),
    ))
      context.add(
        "rules",
        basename(path),
        "Command permission rules",
        placement(
          path,
          "codex",
          context,
          "Permission rule file; startup and policy settings determine its effect.",
        ),
      );
    const v = version("codex", options);
    return {
      id: "codex",
      name: "Codex",
      version: v,
      installed: v !== "Not detected" && v !== "Not installed",
      configPath,
      model: typeof config.model === "string" ? config.model : undefined,
    };
  },
};

export const piAdapter: HarnessAdapter = {
  id: "pi",
  scan(context) {
    const { options } = context,
      configPath = join(options.piDir, "settings.json");
    const { config, valid } = configFor(configPath, context);
    instructions(context, "pi", options.piDir);
    configItem(context, "pi", configPath, "Pi settings");
    const resourcePatterns = (field: string): string[] =>
      Array.isArray(config[field])
        ? config[field].filter((p: unknown) => typeof p === "string")
        : [];
    const addResource = (
      path: string,
      field: "skills" | "extensions",
      base: string,
      extra = "",
      forcedState?: State,
      v?: string,
      source?: string,
      packageName?: string,
    ) => {
      const enabled = piEnabled(
        path,
        resourcePatterns(field),
        base,
        options.home,
      );
      const state = !valid
        ? "unknown"
        : (forcedState ?? (enabled ? "available" : "disabled"));
      const note = !valid
        ? "Availability is unknown because Pi settings cannot be parsed."
        : `Discovered from a global ${field === "skills" ? "skill" : "extension"} source.${extra ? " " + extra : ""}`;
      if (field === "skills")
        skill(context, "pi", path, state, note, v, source);
      else {
        const entry = placement(path, "pi", context, note, state);
        const fileName = basename(path).replace(/\.(ts|js)$/, "");
        context.add(
          field,
          fileName === "index"
            ? (packageName ?? basename(dirname(path)))
            : fileName,
          "Pi extension",
          entry,
          v,
          source,
        );
      }
    };
    for (const field of ["skills", "extensions"] as const) {
      const roots =
        field === "skills"
          ? [join(options.piDir, field), join(options.home, ".agents", field)]
          : [join(options.piDir, field)];
      for (const spec of resourcePatterns(field))
        if (
          !/^[!+-]/.test(spec) &&
          !spec.startsWith("builtin:") &&
          !picomatch.scan(spec).isGlob
        )
          roots.push(expand(spec, options.home, options.piDir));
      for (const root of [...new Set(roots)]) {
        const accept =
          field === "skills"
            ? (p: string) => basename(p) === "SKILL.md"
            : (p: string) => /\.(ts|js)$/.test(p) && !p.endsWith(".d.ts");
        let paths = walk(root, accept, field === "extensions" ? 1 : 7);
        if (field === "extensions")
          paths = paths.filter(
            (p) =>
              dirname(p) === root ||
              ["index.ts", "index.js"].includes(basename(p)),
          );
        const stored = join(options.dotfiles, relative(options.home, root));
        if (options.dotfiles && inside(root, options.home))
          for (const p of walk(
            stored,
            accept,
            field === "extensions" ? 1 : 7,
          )) {
            const installed = join(root, relative(stored, p));
            if (!paths.includes(installed)) paths.push(installed);
          }
        const base = inside(root, join(options.home, ".agents"))
          ? join(options.home, ".agents")
          : options.piDir;
        for (const path of paths) addResource(path, field, base);
      }
    }
    for (const declaration of Array.isArray(config.packages)
      ? config.packages
      : []) {
      const spec =
        typeof declaration === "string" ? declaration : declaration?.source;
      if (typeof spec !== "string") continue;
      let root: string | undefined;
      if (spec.startsWith("npm:")) {
        const name = spec.slice(4).replace(/@[^/@]+$/, "");
        root = join(options.piDir, "npm", "node_modules", name);
      } else if (!spec.startsWith("git:") && !/^https?:/.test(spec))
        root = expand(spec, options.home, options.piDir);
      if (!root) {
        context.add(
          "packages",
          spec,
          "Declared Pi package",
          {
            harness: "pi",
            state: "unknown",
            note: "Git or remote package resolution is not supported in this iteration.",
            file: inspectFile(configPath, options.dotfiles),
          },
          undefined,
          "Pi package",
        );
        continue;
      }
      const manifest = join(root, "package.json");
      const data = existsSync(manifest)
        ? configFor(manifest, context).config
        : {};
      context.add(
        "packages",
        data.name ?? spec,
        typeof data.description === "string"
          ? data.description
          : "Declared Pi package",
        {
          harness: "pi",
          state: existsSync(manifest) ? "available" : "unknown",
          note: existsSync(manifest)
            ? `Declared as ${spec}. Installed manifest found; extension execution is not verified.`
            : "Declared package; installed manifest not found.",
          file: inspectFile(manifest, options.dotfiles),
        },
        data.version,
        "Pi package",
      );
      for (const field of ["skills", "extensions"] as const) {
        const entries = Array.isArray(data.pi?.[field]) ? data.pi[field] : [];
        for (const specPath of entries) {
          if (typeof specPath !== "string") continue;
          const accept =
            field === "skills"
              ? (p: string) => basename(p) === "SKILL.md"
              : (p: string) => /\.(ts|js)$/.test(p) && !p.endsWith(".d.ts");
          const filter: string[] =
            typeof declaration === "object" && Array.isArray(declaration[field])
              ? declaration[field]
              : [];
          for (const path of walk(resolve(root, specPath), accept, 3)) {
            const allowed = piEnabled(path, filter, root, options.home, true);
            addResource(
              path,
              field,
              options.piDir,
              `From ${data.name ?? spec}.`,
              allowed ? undefined : "disabled",
              data.version,
              `Package · ${data.name ?? spec}`,
              data.name ?? spec,
            );
          }
        }
      }
    }
    const v = version("pi", options);
    return {
      id: "pi",
      name: "Pi",
      version: v,
      installed: v !== "Not detected" && v !== "Not installed",
      configPath,
      model:
        typeof config.defaultModel === "string"
          ? config.defaultModel
          : undefined,
    };
  },
};

export const adapters: HarnessAdapter[] = [codexAdapter, piAdapter];
export function scan(options: ScanOptions): Inventory {
  const items: Item[] = [],
    warnings: string[] = [];
  if (options.dotfiles && !existsSync(options.dotfiles))
    warnings.push(
      `Dotfiles directory not found: ${options.dotfiles}. Set MYAI_DOTFILES to your repository path.`,
    );
  const origins = new Map<string, NonNullable<Item["origin"]>>();
  const metadataPath = join(options.home, ".agents", ".skill-lock.json");
  if (existsSync(metadataPath)) {
    try {
      const lock = readConfig(metadataPath);
      for (const [folder, record] of Object.entries(lock.skills ?? {})) {
        const entry = record as Config;
        if (
          !/^[^/\\.][^/\\]*$/.test(folder) ||
          entry?.sourceType !== "github" ||
          typeof entry.source !== "string" ||
          !/^[\w.-]+\/[\w.-]+$/.test(entry.source)
        )
          continue;
        const file = inspectFile(
          join(options.home, ".agents", "skills", folder, "SKILL.md"),
          options.dotfiles,
        );
        if (file.exists)
          origins.set(file.resolved, {
            repository: entry.source,
            metadataPath,
          });
      }
    } catch {
      warnings.push(
        `Cannot read skill origin metadata: ${metadataPath}. Skills remain discoverable without repository grouping.`,
      );
    }
  }
  const context: AdapterContext = {
    options,
    items,
    warnings,
    add(kind, name, description, entry, version, source) {
      const key = `${kind}:${entry.file.resolved}`;
      const id = hash(key).slice(0, 20);
      const existing = items.find((item) => item.id === id);
      if (existing) {
        const same = existing.placements.find(
          (p) => p.harness === entry.harness,
        );
        if (!same) existing.placements.push(entry);
        else if (same.state !== entry.state) {
          same.state = "unknown";
          same.note =
            "Aliases for this source have conflicting settings. Inspect the harness settings.";
        }
      } else
        items.push({
          id,
          kind,
          name,
          description,
          source:
            source ?? sourceLabel(entry.file, options.home, options.dotfiles),
          origin:
            kind === "skills" && !source
              ? origins.get(entry.file.resolved)
              : undefined,
          placements: [entry],
          version: version ?? entry.file.version,
        });
    },
  };
  const harnesses = adapters.map((adapter) => adapter.scan(context));
  for (const harness of ["codex", "pi"] as const) {
    const groups = new Map<string, Item[]>();
    for (const item of items.filter(
      (i) =>
        i.kind === "skills" &&
        i.placements.some(
          (p) => p.harness === harness && p.state === "available",
        ),
    )) {
      const group = groups.get(item.name) ?? [];
      group.push(item);
      groups.set(item.name, group);
    }
    for (const group of groups.values())
      if (group.length > 1)
        for (const item of group) {
          const p = item.placements.find((p) => p.harness === harness)!;
          p.state = "unknown";
          p.note =
            "Multiple sources declare this skill name. Precedence is not resolved in this iteration.";
        }
  }
  return {
    items: items.sort((a, b) => a.name.localeCompare(b.name)),
    harnesses,
    warnings,
    home: options.home,
    dotfiles: options.dotfiles,
    scannedAt: new Date().toISOString(),
    scope: "Global configuration · next load",
  };
}

export function safeSettings(path: string): string {
  let config: Config;
  try {
    config = readConfig(path);
  } catch {
    throw new Error(
      "Cannot parse this settings file. Repair the file before previewing it.",
    );
  }
  const selected: Config = {};
  const keys = path.endsWith(".toml")
    ? [
        "model",
        "model_provider",
        "model_reasoning_effort",
        "approval_policy",
        "sandbox_mode",
        "features",
        "skills",
        "plugins",
      ]
    : [
        "defaultProvider",
        "defaultModel",
        "defaultThinkingLevel",
        "theme",
        "tuiMode",
        "skills",
        "extensions",
        "packages",
        "enableSkillCommands",
      ];
  for (const key of keys)
    if (config[key] !== undefined) selected[key] = config[key];
  if (selected.features)
    selected.features = Object.fromEntries(
      Object.entries(selected.features).filter(
        ([, value]) => typeof value === "boolean",
      ),
    );
  if (selected.plugins)
    selected.plugins = Object.fromEntries(
      Object.entries(selected.plugins).map(([name, value]) => [
        name,
        { enabled: (value as Config)?.enabled },
      ]),
    );
  if (path.endsWith(".toml") && selected.skills)
    selected.skills = {
      config: Array.isArray(selected.skills.config)
        ? selected.skills.config.map((rule: Config) => ({
            path: rule.path,
            enabled: rule.enabled,
          }))
        : [],
    };
  if (selected.packages)
    selected.packages = selected.packages.map((value: string | Config) =>
      typeof value === "string"
        ? value
        : {
            source: value.source,
            skills: value.skills,
            extensions: value.extensions,
            prompts: value.prompts,
            themes: value.themes,
          },
    );
  // MCP values and arbitrary config sections can contain credentials; expose names only.
  if (config.mcp_servers)
    selected.mcpServerNames = Object.keys(config.mcp_servers);
  return JSON.stringify(selected, null, 2);
}
