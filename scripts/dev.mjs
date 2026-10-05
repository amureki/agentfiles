await import("./build.mjs");
process.argv.push("--no-open");
await import("../src/server.ts");
