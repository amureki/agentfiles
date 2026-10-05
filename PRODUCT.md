# My AI

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed proposal: local TypeScript server and browser UI. Framework choice delegated by approval of the smallest, extendable solution. Use Node.js HTTP and plain TypeScript with an esbuild bundle; no UI framework or database.

## Users

The owner of a macOS dotfiles repository who uses Codex and Pi and wants to discover and inspect their global configuration.

## Product Purpose

Show each harness's configuration, its source, version, and link health. Provide read-only discovery. Do not edit files, settings, links, or package installations.

## Operating Context

GNU Stow links files from dotfiles into the home directory. Instructions can share one source. Skills also live outside dotfiles. Different harness configurations are intentional.

## Capabilities and Constraints

First iteration covers global Codex and Pi instructions, skills, Pi extensions and packages, selected settings, versions, actual source files, harness paths, and optional link details. Editing, toggles, repair, and undo are removed. Configuration adapters must remain independent of the UI. Exclude credentials. Interpret availability on next load, not live session state. Project resolution, T3 Code, package installs and updates, and cross-harness translation are out of scope.

## Product Principles

- Inspect actual files, not a second configuration database.
- Respect shared sources and Stow ownership.
- Explain uncertainty rather than invent availability or versions.
- Keep both the interface and API read-only; do not create persistent change storage.

## Brand Commitments

Minimal and function first. White, dark text, and neutral gray tones. Use system typography, thin dividers, compact headings, and direct labels. No editorial styling, decorative brand marks, or reassurance copy. Alex Carpenter’s site is a reference for visual restraint, not page composition. Approved first surface: comparison table and source detail panel. Working name inferred from repository: My AI.

## Evidence on Hand

Existing files under the configured dotfiles directory and global harness directories. Do not invent inventory or status.
