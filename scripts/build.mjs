import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/client/app.ts"],
  bundle: true,
  outfile: "dist/app.js",
  target: "es2022",
  minify: true,
  sourcemap: true,
});
await Promise.all(
  ["index.html", "style.css"].map((file) =>
    copyFile(`src/client/${file}`, `dist/${file}`),
  ),
);
