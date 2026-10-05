import { readConfig, safeSettings, scan } from "./adapters.ts";
import type { ScanOptions } from "./adapters.ts";
import { textFile } from "./files.ts";
import type { Detail } from "./types.ts";
export function readDetail(options: ScanOptions, id: string): Detail {
  const item = scan(options).items.find((item) => item.id === id);
  if (!item)
    throw new Error(
      "This item is no longer in the inventory. Refresh and select it again.",
    );
  const file = item.placements[0].file;
  let content: string;
  if (!file.exists) content = "File is missing. Inspect the source paths.";
  else if (item.kind === "settings") content = safeSettings(file.resolved);
  else if (item.kind === "packages") {
    const manifest = readConfig(file.resolved);
    content = JSON.stringify(
      {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        pi: manifest.pi,
      },
      null,
      2,
    );
  } else content = textFile(file.resolved);
  return {
    item,
    content,
    path: file.resolved,
  };
}
