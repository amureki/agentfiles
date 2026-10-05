# Contributing

Requires Node.js 24 or later. Clone the repository and run:

```sh
npm ci
npm run demo
```

Demo mode uses synthetic files in a temporary directory. It does not read your personal harness configuration. Stop the server with Ctrl+C to remove the temporary files.

For frontend work, run `node --watch-path=src scripts/dev.mjs --demo` after installing dependencies. Reload the browser after changes.

Before submitting a pull request:

```sh
npm run check
npm run build
npm test
```

Tests use disposable fixtures and a local server. Do not add tests that access external services or real harness directories. Linux and macOS run these checks in CI; Windows support is not verified.

Keep discovery separate from the interface. Harness adapters belong in `src/adapters.ts`; file inspection belongs in `src/files.ts`. Adding a harness also requires updating the shared types and comparison columns. Explain how availability is inferred and show uncertainty when it cannot be verified.

Keep the tool read-only. Do not add credential loading, telemetry, runtime package execution, or configuration writes. CLI version discovery currently runs installed harnesses with `--version`; demo mode skips that step.

Use synthetic data in screenshots, fixtures, and bug reports. Do not submit home paths, private repository names, account details, tokens, or real prompt content. Describe the problem, expected behavior, and validation in the pull request. Small changes are easier to review.
