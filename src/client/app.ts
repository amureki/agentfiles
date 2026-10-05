import type { Detail, Inventory, Item, Kind, Placement } from "../types.ts";

const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  instructions:
    '<path d="M8 3h8l4 4v14H4V3h4Z"/><path d="M15 3v5h5M8 12h8M8 16h6"/>',
  skills:
    '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/>',
  extensions: '<path d="M9 3h6v5h5v6h-5v7H9v-7H4V8h5V3Z"/>',
  packages:
    '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7 5.8l9 5"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  rules:
    '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11-2l3 3M4 16l3 3a7 7 0 0 0 11-2"/>',
  link: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3V6Z"/>',
};
const icon = (name: string, className = "") =>
  `<svg class="icon ${className}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.grid}</svg>`;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const titles: Record<Kind, string> = {
  instructions: "Instructions",
  skills: "Skills",
  extensions: "Extensions",
  packages: "Packages",
  settings: "Settings",
  rules: "Permission rules",
};
let inventory: Inventory, detail: Detail | undefined;
let category: Kind | "all" = "all",
  query = "",
  source = "all",
  selectedId = "",
  detailTab = "source",
  busy = false;
let selectionSequence = 0;
const expandedSkillSources = new Map<string, boolean>();
const app = document.querySelector<HTMLDivElement>("#app")!;

function saveView(replace = false) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries({
    view: category === "all" ? "" : category,
    source: source === "all" ? "" : source,
    q: query,
    item: selectedId,
    tab: selectedId && detailTab === "content" ? "content" : "",
  })) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href !== location.href)
    history[replace ? "replaceState" : "pushState"](null, "", url);
}

async function restoreView() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view") ?? "all";
  category = Object.hasOwn(titles, view) ? (view as Kind) : "all";
  const filter = params.get("source") ?? "all";
  source = [
    "all",
    "dotfiles",
    "local",
    "plugin",
    "package",
    "built-in",
  ].includes(filter)
    ? filter
    : "all";
  query = params.get("q") ?? "";
  selectedId = inventory.items.some((item) => item.id === params.get("item"))
    ? params.get("item")!
    : "";
  detailTab = params.get("tab") === "content" ? "content" : "source";
  detail = undefined;
  saveView(true);
  const sequence = ++selectionSequence;
  render();
  if (selectedId) {
    try {
      const next = await api<Detail>(`detail?id=${selectedId}`);
      if (sequence !== selectionSequence) return;
      detail = next;
      updateInspector();
    } catch (error) {
      if (sequence === selectionSequence)
        notify((error as Error).message, true);
    }
  }
}

try {
  const groups: unknown = JSON.parse(
    sessionStorage.getItem("myai.skill-groups") ?? "[]",
  );
  if (Array.isArray(groups))
    for (const entry of groups) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "boolean"
      )
        expandedSkillSources.set(entry[0], entry[1]);
    }
} catch {
  /* View navigation works when browser storage is unavailable. */
}
window.addEventListener("popstate", () => {
  if (inventory) void restoreView();
});

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`/api/${path}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result;
}
function notify(message: string, error = false) {
  const toast = document.querySelector<HTMLDivElement>("#toast")!;
  toast.textContent = message;
  toast.className = `visible${error ? " error" : ""}`;
  setTimeout(() => (toast.className = ""), 5500);
}
const shortPath = (path: string) =>
  inventory && path.startsWith(inventory.home + "/")
    ? "~/" + path.slice(inventory.home.length + 1)
    : path;
function visibleItems() {
  return inventory.items
    .filter(
      (item) =>
        (category === "all" || item.kind === category) &&
        (source === "all" || item.source.toLowerCase().includes(source)) &&
        `${item.name} ${item.description} ${item.source} ${item.origin?.repository ?? ""} ${item.placements.map((p) => p.file.path).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Object.keys(titles).indexOf(a.kind) -
          Object.keys(titles).indexOf(b.kind) ||
        sourceRank(a.source) - sourceRank(b.source) ||
        (a.kind === "skills"
          ? (a.origin?.repository ?? a.source).localeCompare(
              b.origin?.repository ?? b.source,
            )
          : 0) ||
        a.name.localeCompare(b.name),
    );
}
function sourceRank(source: string) {
  return source === "Dotfiles"
    ? 0
    : source === "Local"
      ? 1
      : source === "Built-in"
        ? 2
        : source.startsWith("Package") || source.startsWith("Pi package")
          ? 3
          : 4;
}
function status(entry?: Placement, note?: string) {
  if (!entry)
    return '<span class="absent" title="No global source found for this harness">—</span>';
  const label = {
    available: "Available",
    disabled: "Disabled",
    broken: "Broken link",
    unknown: "Not verified",
    overridden: "Overridden",
    unsupported: "Unsupported",
  }[entry.state];
  return `<span class="state ${entry.state}" title="${escape(note ?? entry.note)}">${label}</span>`;
}
function render() {
  const counts = Object.fromEntries(
    Object.keys(titles).map((kind) => [
      kind,
      inventory.items.filter((i) => i.kind === kind).length,
    ]),
  );
  app.innerHTML = `<div class="shell">
    <aside class="sidebar" aria-label="Configuration navigation">
      <a class="brand" href="/" aria-label="My AI home">my ai</a>
      <nav><button class="nav-item ${category === "all" ? "active" : ""}" data-category="all"><span>All configuration</span><span class="count">${inventory.items.length}</span></button>
      ${Object.entries(titles)
        .map(
          ([kind, title]) =>
            `<button class="nav-item ${category === kind ? "active" : ""}" data-category="${kind}"><span>${title}</span><span class="count">${counts[kind]}</span></button>`,
        )
        .join("")}
      </nav>
      <div class="sidebar-bottom"><div class="nav-label">Harnesses</div>${inventory.harnesses.map((h) => `<div class="harness-mini"><div><strong>${h.name}</strong><span title="${escape(h.version)}">${escape(h.version.replace(/^codex-cli\s*/, ""))}</span></div>${!h.installed ? "<span>Not detected</span>" : ""}</div>`).join("")}
      </div>
    </aside>
    <main class="main">

      <div class="page-heading"><div><h1>${category === "all" ? "Configuration" : titles[category]}</h1><p>Read-only · Global configuration · availability on next load</p></div><button class="button" id="refresh" aria-label="Refresh configuration" ${busy ? "disabled" : ""}>${icon("refresh", busy ? "spinning" : "")}<span>Refresh</span></button></div>
      ${inventory.warnings.length ? `<div class="scan-warning">${icon("info")}<div>${inventory.warnings.map((w) => `<p>${escape(w)}</p>`).join("")}</div></div>` : ""}
      <div class="workspace ${selectedId ? "has-selection" : ""}"><section class="inventory-panel" aria-label="Configuration inventory">
        <div class="toolbar"><label class="search">${icon("search")}<input id="search" type="search" placeholder="Find a configuration…" aria-label="Search configuration" value="${escape(query)}"><kbd>⌘ K</kbd></label><label class="source-filter"><span class="sr-only">Filter source</span><select id="source-filter"><option value="all">All sources</option><option value="dotfiles">Dotfiles</option><option value="local">Local</option><option value="plugin">Plugins</option><option value="package">Packages</option><option value="built-in">Built-in</option></select></label></div>
        <div class="table-scroll"><table><thead><tr><th scope="col">Configuration</th><th scope="col">Codex</th><th scope="col">Pi</th></tr></thead><tbody id="rows"></tbody></table><div id="empty" class="empty" hidden>${icon("search")}<h2>No matching configuration</h2><p>Try another search or source filter.</p><button class="button" id="clear-filters">Clear filters</button></div></div>
        <footer class="inventory-footer"><span id="result-count"></span></footer>
      </section><aside class="inspector" aria-label="Source inspector" id="inspector">${renderInspector()}</aside></div>
      <footer class="page-footer"><span>${icon("folder")}<span title="${escape(inventory.dotfiles)}">${escape(shortPath(inventory.dotfiles))}</span></span><span>Scanned ${new Date(inventory.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></footer>
    </main></div>`;
  (document.querySelector("#source-filter") as HTMLSelectElement).value =
    source;
  renderRows();
  bind();
}
function renderRows() {
  const items = visibleItems();
  const sections = new Map<string, Item[]>();
  for (const item of items) {
    const key =
      item.kind === "skills"
        ? `skills:${item.origin ? "Repository · " + item.origin.repository : item.source}`
        : item.kind;
    const section = sections.get(key) ?? [];
    section.push(item);
    sections.set(key, section);
  }
  document.querySelector("#rows")!.innerHTML = [...sections]
    .map(([key, members]) => {
      const first = members[0];
      const skillGroup = first.kind === "skills";
      const groupLabel = first.origin
        ? `Repository · ${first.origin.repository}`
        : first.source;
      const expanded =
        !skillGroup ||
        Boolean(query.trim()) ||
        (expandedSkillSources.get(key) ??
          (!first.origin &&
            !/^(Plugin|Package|Pi package)/.test(first.source)));
      const versions = new Set(members.map((item) => item.version));
      const commonVersion =
        skillGroup &&
        /^(Plugin|Package|Pi package)/.test(first.source) &&
        versions.size === 1
          ? first.version
          : undefined;
      const heading = skillGroup
        ? `<tr class="source-group"><td><button class="source-group-button" data-skill-group="${escape(key)}" aria-expanded="${expanded}" aria-disabled="${Boolean(query.trim())}" aria-label="${expanded ? "Collapse" : "Expand"} ${escape(groupLabel)}">${icon("chevron", expanded ? "group-arrow expanded" : "group-arrow")}<span>${escape(groupLabel)}</span><span class="group-count">${members.length} ${members.length === 1 ? "skill" : "skills"}</span></button>${commonVersion ? `<span class="group-version">${escape(commonVersion)}</span>` : ""}</td>${(
            ["codex", "pi"] as const
          )
            .map((harness) => {
              const entries = members.map((item) =>
                item.placements.find((p) => p.harness === harness),
              );
              const states = new Set(
                entries.map((entry) => entry?.state ?? "absent"),
              );
              return `<td>${states.size === 1 ? status(entries[0], "All matching skills have this state. Expand the group for per-skill explanations.") : '<span class="state" title="Skills have different availability states. Expand this group to inspect each skill.">Mixed</span>'}</td>`;
            })
            .join("")}</tr>`
        : `<tr class="group-row"><td colspan="3"><span>${titles[first.kind]}</span><span>${members.length}</span></td></tr>`;
      if (!expanded) return heading;
      return (
        heading +
        members
          .map((item) => {
            const version = item.version?.startsWith("sha256:")
              ? item.version.slice(7)
              : (item.version ?? "Version unknown");
            const meta = skillGroup
              ? commonVersion
                ? ""
                : `<div class="item-meta"><span class="item-version">${escape(version)}</span></div>`
              : `<div class="item-meta"><span>${escape(item.source)}</span><span class="meta-separator">·</span><span class="item-version">${escape(version)}</span></div>`;
            return `<tr class="item-row ${skillGroup ? "skill-member" : ""} ${selectedId === item.id ? "selected" : ""}" data-item="${item.id}"><td><button class="item-name" data-select="${item.id}" aria-label="Inspect ${escape(item.name)}">${escape(item.name)}${item.placements.length > 1 ? `<span class="shared-mark" title="Shared source">${icon("link")}</span>` : ""}</button>${meta}</td>${(["codex", "pi"] as const).map((h) => `<td><button class="state-button" data-select="${item.id}" aria-label="Inspect ${escape(item.name)} for ${h}">${status(item.placements.find((p) => p.harness === h))}</button></td>`).join("")}</tr>`;
          })
          .join("")
      );
    })
    .join("");
  document
    .querySelectorAll<HTMLButtonElement>("[data-skill-group]")
    .forEach((button) => {
      button.onclick = () => {
        if (query.trim()) return;
        expandedSkillSources.set(
          button.dataset.skillGroup!,
          button.getAttribute("aria-expanded") !== "true",
        );
        try {
          sessionStorage.setItem(
            "myai.skill-groups",
            JSON.stringify([...expandedSkillSources]),
          );
        } catch {
          /* Expanded groups remain available for this page load. */
        }
        renderRows();
      };
      if (query.trim())
        button.title = "Matching groups stay expanded while searching.";
    });
  (document.querySelector("#empty") as HTMLElement).hidden = items.length > 0;
  document.querySelector("#result-count")!.textContent =
    `${items.length} ${items.length === 1 ? "item" : "items"}${items.length !== inventory.items.length ? ` of ${inventory.items.length}` : ""}`;
  document
    .querySelectorAll<HTMLButtonElement>("[data-select]")
    .forEach(
      (button) => (button.onclick = () => select(button.dataset.select!)),
    );
}
function renderInspector() {
  if (!selectedId)
    return `<div class="inspector-empty"><h2>Source details</h2><p>Select a configuration to see its content, availability, and file links.</p></div>`;
  if (!detail || detail.item.id !== selectedId)
    return '<div class="inspector-empty"><p>Reading source…</p></div>';
  const { item, path: sourcePath, content } = detail;
  return `<div class="inspector-head"><button class="icon-button" id="close-detail" aria-label="Close source inspector">${icon("close")}</button><h2>${escape(item.name)}</h2><p class="detail-description">${escape(item.description)}</p><div class="detail-tags"><span>${titles[item.kind]}</span><span>${escape(item.source)}</span>${item.placements.length > 1 ? `<span>${icon("link")}Shared source</span>` : ""}</div></div>
    <div class="detail-tabs" role="tablist" aria-label="Source information">${["source", "content"].map((tab) => `<button role="tab" aria-selected="${detailTab === tab}" aria-controls="detail-body" data-tab="${tab}" class="${detailTab === tab ? "active" : ""}">${tab === "source" ? "Source & state" : "Content"}</button>`).join("")}</div>
    <div class="detail-body" id="detail-body" role="tabpanel">${
      detailTab === "source"
        ? `
      <div class="source-heading"><h3>${item.placements[0].file.exists ? "Actual source file" : "Expected source file · missing"}</h3><button class="button small" data-copy="path" title="Copy full absolute path">Copy path</button></div><div class="path-box">${escape(shortPath(sourcePath))}</div><dl class="source-facts"><dt>Version</dt><dd>${escape(item.version ?? "Unknown")}</dd><dt>Managed by</dt><dd>${item.placements[0].file.managed ? "Dotfiles / Stow" : item.source.startsWith("Plugin") ? "Codex plugin" : item.source.startsWith("Package") || item.kind === "packages" ? "Pi package" : "Local files"}</dd><dt>Scope</dt><dd>Global</dd>${item.origin ? `<dt>Recorded origin</dt><dd>${escape(item.origin.repository)}<br><span class="muted">From ${escape(shortPath(item.origin.metadataPath))}. Install record; current file contents may have changed.</span></dd>` : ""}</dl>
      <h3>Harness availability</h3><div class="availability-list">${item.placements.map((p) => `<div class="availability"><div class="availability-heading"><strong>${p.harness === "pi" ? "Pi" : "Codex"}</strong>${status(p)}</div><p>${escape(p.note)}</p></div>`).join("")}</div>
      <h3>Harness paths</h3><dl class="harness-paths">${item.placements.map((p) => `<dt>${p.harness === "pi" ? "Pi" : "Codex"}</dt><dd>${p.file.path === sourcePath && !p.file.links.length ? "<span>Same as source path · no symlink</span>" : `<code>${escape(shortPath(p.file.path))}</code><span>${p.file.links.length ? "Linked to the source file" : "Direct file"}</span>`}</dd>`).join("")}</dl>
      ${
        item.placements.some((p) => p.file.links.length)
          ? `<details class="link-details"><summary>Show link details</summary><p class="link-direction">Read from the harness path to the actual source file.</p>${item.placements
              .map((p) => {
                let current = p.file.path;
                const steps = [
                  { path: current, connection: "" },
                  ...p.file.links.map((link) => {
                    const connection =
                      link.path === current ? "Symlink" : "Directory symlink";
                    current = link.target + current.slice(link.path.length);
                    return { path: current, connection };
                  }),
                ];
                if (current !== p.file.resolved)
                  steps.push({
                    path: p.file.resolved,
                    connection: "Resolves to",
                  });
                return `<div class="link-chain"><strong>${p.harness === "pi" ? "Pi" : "Codex"}</strong><ol>${steps
                  .map((step, index) => {
                    const label =
                      steps.length === 1
                        ? "Harness path · Direct file"
                        : index === 0
                          ? "Harness path"
                          : index === steps.length - 1
                            ? p.file.exists
                              ? "Source file"
                              : "Missing target"
                            : "Intermediate path";
                    return `<li>${step.connection ? `<div class="chain-connector">${icon("arrow")}<span>${step.connection}</span></div>` : ""}<span class="chain-label">${label}</span><code>${escape(shortPath(step.path))}</code></li>`;
                  })
                  .join("")}</ol></div>`;
              })
              .join("")}</details>`
          : ""
      }
      <div class="scope-note">${icon("info")}<p>Availability describes global configuration on the next load. Project settings and launch arguments can change it.</p></div>`
        : `
      <div class="content-heading"><span>${item.kind === "settings" ? "Selected settings · credentials excluded" : "Source content"}</span><button class="button small" data-copy="content">Copy content</button></div><pre class="source-content">${escape(content)}</pre>`
    }</div>
    ${detailTab === "source" ? '<div class="inspector-actions"><button class="button small" id="read-content">Read content</button></div>' : ""}`;
}
async function select(id: string) {
  selectedId = id;
  detailTab = "source";
  saveView();
  const sequence = ++selectionSequence;
  render();
  try {
    const next = await api<Detail>(`detail?id=${id}`);
    if (sequence !== selectionSequence) return;
    detail = next;
    updateInspector();
  } catch (error) {
    if (sequence === selectionSequence) notify((error as Error).message, true);
  }
}
function updateInspector() {
  const panel = document.querySelector("#inspector");
  if (panel) {
    panel.innerHTML = renderInspector();
    bindInspector();
  }
}
async function reload() {
  busy = true;
  render();
  try {
    inventory = await api<Inventory>("inventory");
    if (selectedId) {
      if (inventory.items.some((i) => i.id === selectedId))
        detail = await api<Detail>(`detail?id=${selectedId}`);
      else {
        selectedId = "";
        detail = undefined;
        saveView(true);
      }
    }
  } catch (error) {
    notify((error as Error).message, true);
  } finally {
    busy = false;
    render();
  }
}
function bind() {
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach(
    (button) =>
      (button.onclick = () => {
        category = button.dataset.category as typeof category;
        saveView();
        render();
      }),
  );
  document.querySelector<HTMLButtonElement>("#refresh")!.onclick = async () => {
    await reload();
  };
  const input = document.querySelector<HTMLInputElement>("#search");
  if (input)
    input.oninput = () => {
      query = input.value;
      saveView(true);
      renderRows();
    };
  const filter = document.querySelector<HTMLSelectElement>("#source-filter");
  if (filter)
    filter.onchange = () => {
      source = filter.value;
      saveView();
      renderRows();
    };
  const clear = document.querySelector<HTMLButtonElement>("#clear-filters");
  if (clear)
    clear.onclick = () => {
      query = "";
      source = "all";
      category = "all";
      saveView();
      render();
    };
  bindInspector();
}
function bindInspector() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-copy]")
    .forEach((button) => {
      button.onclick = async () => {
        if (!detail) return;
        const value =
          button.dataset.copy === "path" ? detail.path : detail.content;
        try {
          await navigator.clipboard.writeText(value);
          notify(
            button.dataset.copy === "path" ? "Path copied" : "Content copied",
          );
        } catch {
          notify("Could not copy. Select the text and press ⌘ C.", true);
        }
      };
    });
  const close = document.querySelector<HTMLButtonElement>("#close-detail");
  if (close)
    close.onclick = () => {
      selectedId = "";
      detail = undefined;
      selectionSequence++;
      saveView();
      render();
    };
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
    (button) =>
      (button.onclick = () => {
        detailTab = button.dataset.tab!;
        saveView();
        updateInspector();
      }),
  );
  const read = document.querySelector<HTMLButtonElement>("#read-content");
  if (read)
    read.onclick = () => {
      detailTab = "content";
      saveView();
      updateInspector();
    };
}
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    document.querySelector<HTMLInputElement>("#search")?.focus();
  }
  if (event.key === "Escape" && selectedId) {
    selectedId = "";
    detail = undefined;
    selectionSequence++;
    saveView();
    render();
  }
});
async function start() {
  try {
    inventory = await api("inventory");
    await restoreView();
  } catch (error) {
    app.innerHTML = `<main class="boot"><h1>Configuration could not load</h1><p>${escape((error as Error).message)}</p><button class="button" id="retry">Try again</button></main>`;
    document.getElementById("retry")!.onclick = start;
  }
}
start();
