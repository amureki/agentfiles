# My AI

A read-only local configuration dashboard for Codex and Pi. It discovers existing files, follows symlinks, and shows what is configured without changing your dotfiles or harness settings.

## Run

Requires Node.js 24 or later.

```sh
npm ci
npm start
```

Opens [My AI](http://127.0.0.1:4317) in your default browser on macOS. The server binds to `127.0.0.1` only. Press Ctrl+C in the terminal to stop it.

To run without opening a browser:

```sh
npm run build
node src/server.ts --no-open
```

## Discovery

- Compare global Codex and Pi instructions, skills, selected settings, Pi extensions and packages, and Codex permission rules.
- Search by name, description, source, or harness path; filter by category and source.
- Browse skills in collapsible source, plugin, and package groups. Groups show skill counts, shared package versions, and per-harness availability summaries. Search expands matching groups.
- Read source content, content fingerprints, declared skill/package versions, and harness CLI versions.
- See the actual source file, harness paths, and optional symlink details.
- Inspect missing files, disabled resources, shared sources, instruction overrides, and reasons availability cannot be verified.

The interface has no editing, toggles, link repair, or undo. The server accepts GET requests only; mutation endpoints and persistent change storage are removed. Existing files and any snapshots left by earlier versions remain untouched.

`Available` means the global source should be discovered on the next load. It does not assert that a running session has loaded it, or that an extension runs without errors. Project settings, trust, launch arguments, policies, and runtime overrides are outside this iteration.

Cached Codex plugin skills are included for inspection. A cached version is not proof of the active plugin version. Entries without an explicit enabled flag in `config.toml` are marked `Not verified`; Codex app plugin state is not checked. Plugin installation and updates are out of scope. Remote/git Pi package resolution is also out of scope. Duplicate skill names from separate files remain unverified until precedence is implemented. Pi built-in extensions and MCP connection health are not inventoried.

Settings content contains selected fields and MCP server names, never raw MCP configuration or auth files.

## Paths

| Variable              | Default                       |
| --------------------- | ----------------------------- |
| `MYAI_HOME`           | Current user's home directory |
| `MYAI_DOTFILES`       | `~/dev/dotfiles`              |
| `CODEX_HOME`          | `~/.codex`                    |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent`                 |
| `MYAI_PORT`           | `4317`                        |

```sh
MYAI_DOTFILES=/path/to/dotfiles npm start
```

## Development

```sh
npm run dev
npm run check
npm test
```

The dev command rebuilds and restarts when files under `src/` change. Reload the browser after frontend changes. Tests use disposable directories and a fixture-only local server; they do not modify your harness configuration or access an external service. HTTP tests verify write requests are rejected and fixture files remain unchanged.

The stack is Node's HTTP server, plain TypeScript, a bundled browser script, and CSS. Runtime dependencies are TOML/YAML parsing and glob matching. No database, cloud service, or UI framework. The interface uses system fonts.

`src/adapters.ts` owns harness discovery and interpretation. `src/files.ts` owns file and link inspection. `src/discovery.ts` reads source details. `src/server.ts` exposes the read-only local API. `src/client/` owns the interface. Add a harness adapter without moving existing sources or introducing write operations.

Repository skill groups use the recorded GitHub origin in `~/.agents/.skill-lock.json`. No name-prefix heuristics or manual group list are used. Skills without origin metadata retain their Local/Dotfiles grouping. Recorded origin does not prove that installed contents still match the repository.
