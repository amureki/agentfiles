export type HarnessId = "codex" | "pi";
export type Kind =
  "instructions" | "skills" | "extensions" | "packages" | "settings" | "rules";
export type State =
  | "available"
  | "disabled"
  | "overridden"
  | "broken"
  | "unknown"
  | "unsupported";
export interface LinkStep {
  path: string;
  target: string;
}
export interface FileInfo {
  path: string;
  resolved: string;
  links: LinkStep[];
  exists: boolean;
  managed: boolean;
  hash?: string;
  version?: string;
}
export interface Placement {
  harness: HarnessId;
  state: State;
  note: string;
  file: FileInfo;
}
export interface Item {
  id: string;
  kind: Kind;
  name: string;
  description: string;
  source: string;
  origin?: { repository: string; metadataPath: string };
  placements: Placement[];
  version?: string;
}
export interface Harness {
  id: HarnessId;
  name: string;
  version: string;
  configPath: string;
  model?: string;
  installed: boolean;
}
export interface Inventory {
  demo?: boolean;
  items: Item[];
  harnesses: Harness[];
  scannedAt: string;
  dotfiles: string;
  home: string;
  warnings: string[];
  scope: string;
}
export interface Detail {
  item: Item;
  content: string;
  path: string;
}
