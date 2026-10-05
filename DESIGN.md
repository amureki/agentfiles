---
name: AgentFiles
description: A minimal file configuration utility.
colors:
  surface: "#fff"
  ink: "#202020"
  muted: "#666"
  line: "#e5e5e5"
  soft: "#f5f5f5"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  detail-body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  item-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.5
  button:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  path:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: "12px"
    lineHeight: 1.7
rounded:
  standard: "2px"
spacing:
  compact: "8px"
  control: "12px"
  toolbar: "15px"
  workspace: "20px"
  inspector: "22px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.standard}"
    padding: "8px 12px"
  button-small:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.standard}"
    padding: "5px 9px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.standard}"
  path-box:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.muted}"
    typography: "{typography.path}"
    rounded: "{rounded.standard}"
    padding: "10px"
---

# Design System: AgentFiles

## Overview

**Creative North Star: "A minimal file utility"**

A minimal file configuration utility uses a white canvas, dark text, and neutral gray tones. Platform sans-serif keeps controls familiar. Monospaced paths and source text make file evidence clear.

Compact headings, thin dividers, and direct labels support dense configuration data. The interface prioritizes read-only discovery and inspection. It uses no editorial styling, imagery, or decorative brand marks.

**Key Characteristics:**

- White, dark, and neutral gray; no chromatic accent.
- Platform sans-serif interface text with monospaced file evidence.
- Compact headings and direct state labels.
- Flat bordered panels; shadows reserved for floating surfaces.

## Colors

The palette has three visual families: white, dark, and neutral gray. The five frontmatter primitives separate gray roles without introducing additional color families.

### Primary
- **Dark Ink:** Primary text, active tabs, carets, and keyboard focus.

### Neutral
- **White Surface:** Canvas, sidebar, panels, and standard controls.
- **Muted Gray:** Secondary text, metadata, and source paths.
- **Divider Gray:** Panel boundaries, rows, and control strokes.
- **Soft Gray:** Hover and selection fills, search fields, path boxes, and warnings.

**The Neutral Palette Rule.** Use white, dark ink, and neutral gray tones. State meaning comes from text, not chromatic color.

## Typography

**Interface Font:** Platform sans-serif: Apple system, BlinkMacSystemFont, Segoe UI, sans-serif.
**File Font:** SFMono-Regular, Consolas, monospace.

### Hierarchy

- **Headline:** Workspace heading; headline token remains (20px) on mobile.
- **Title:** Inspector heading; title token.
- **Body:** Base interface inheritance; body token.
- **Detail Body:** Source descriptions and availability explanations; detail-body token.
- **Item Title:** Configuration names; item-title token, (13px) on wide screens and (11px) on mobile.
- **Button:** Standard actions; button token. Small actions use (11px).
- **Path:** File evidence; path token. Link chains use (1.65) line height; source content use (1.8).

Status text uses (12px), with (11px) on wide screens and (10px) on mobile. Metadata and item versions use (11px). Table headers use (12px), reduced to (9px) on mobile. Footer annotations use (8–9px); these small annotations are existing implementation details, not a preferred body-text scale. No separate display type role is used.

**The File Evidence Rule.** Use the mono stack for paths, versions, source text. Keep interface prose in platform sans-serif.

## Layout

The desktop shell has a sticky sidebar (200px) and flexible main region. Main horizontal padding is (24px). Working regions retain a flexible inventory column with a (370px) minimum, an inspector (350px), and a (20px) gap. Inspector padding is (22px); toolbar padding is (15px).

At (1550px) and above, main padding becomes (45px), inspector width (390px), and gap (24px). At (1180px) and below, sidebar width becomes (180px), main padding (20px), inspector width (310px), and gap (12px). At (980px) and below, the inspector appears only for a selection and floats over the inventory, with width (370px), top (85px), and right/bottom offsets (20px).

At (640px) and below, navigation becomes a horizontal scrolling row and main padding becomes (16px). Navigation counts and sidebar secondary sections are hidden. The inspector has (12px) side offsets, (18px) vertical offsets, and a maximum width (430px). Inventory remains a three-column comparison table. Its first column uses (49%) width on desktop and (47%) on mobile. Headers remain sticky inside the scrolling table.

## Elevation & Depth

Resting surfaces are flat: one-pixel borders and soft gray fills separate regions. Hover and selected inventory rows use the same soft fill. Two floating shadow roles and a search focus ring remain.

### Shadow Vocabulary

- **Floating Inspector:** (0 12px 48px #00000018), used by the narrow-screen overlay.
- **Toast:** (0 8px 28px #00000018), used by transient feedback.
- **Search Focus:** (0 0 0 2px var(--soft)), paired with a muted-gray border.

**The Floating Surface Rule.** Use shadows for the floating inspector and toast. Resting panels use borders and tonal separation.

## Shapes

Panels, buttons, navigation, fields, source boxes, and warning surfaces use the standard corner token. Borders are (1px). Link-chain steps use explicit path labels and downward SVG arrows. Inline SVG icons use rounded caps and joins, usually (18px) with stroke width (1.6). Branding is plain text.

## Components

### Buttons

Compact actions use standard corners and a minimum height (34px). Standard hover uses soft gray. Small buttons use a minimum height (29px). Icon buttons have transparent backgrounds and (5px) padding; hover uses soft gray. Disabled controls use opacity (0.5). Keyboard focus uses a dark (2px) outline with (3px) offset.

### Source annotations

Source tags are unboxed text annotations: muted gray, (11px) type, and (7px) gaps. They are not interactive filters.

### Cards / Containers

White working surfaces use standard corners and divider-gray borders. Content padding belongs to the specific region rather than a universal card inset. Availability groups use internal row separators.

### Inputs / Fields

Search has a (34px) height, soft gray fill, divider-gray border, standard corners, and padding (7px 9px). Focus-within changes the border to muted gray and adds the search focus ring. Source filters share the height and corner language. Source content is read-only.

### Navigation

Navigation uses (13px) text and padding (10px 12px). Default text is muted gray; hover and active fill are soft gray; active text uses dark ink and weight (600). Inspector tabs use a dark active (2px) bottom rule. Mobile navigation keeps category actions in a single scrolling row.

### Availability and source evidence

Availability uses explicit text labels without colored dots. Available text uses dark ink; disabled and other neutral states use muted gray. Not verified text uses dark ink and weight (600); broken-link text adds a dotted underline to dark ink and weight (600). Paths use a soft gray box. The inspector starts with Actual source file, the physical location. Harness paths follow. Direct paths identical to the source are summarized without repeating the file name. Full chains are collapsed under Show link details; they resolve from harness path to physical source. Expanded chains label the harness path, intermediate paths, and source file. Downward arrows carry a Symlink or Directory symlink label. Each step keeps the complete file path, including the file name when a parent directory is linked.

Toasts fade and translate over (.2s ease-out). Refresh spins over (1s linear). Reduced-motion preference disables animation and transitions.

## Do's and Don'ts

### Do:

- **Do** use thin dividers and soft gray fills to separate working regions.
- **Do** wrap long file paths and item names inside their containers.
- **Do** identify availability and uncertainty with direct text labels.
- **Do** use visible keyboard focus and honor reduced motion.

### Don't:

- **Don't** introduce chromatic accents, decorative brand marks, or imagery.
- **Don't** add category kickers above workspace or inspector headings.
- **Don't** use editorial display type or promotional copy.
- **Don't** give resting panels floating shadows.

## Read-only discovery

The interface provides search, source filters, refresh, source/content tabs, and optional link details. Availability is a label, not a switch. Editing, review/apply actions, link repair, change history, and undo are removed. The API accepts GET only.

## Skill source groups

Skills are grouped by their source label. Plugin and package groups start collapsed; Dotfiles, Local, and Built-in start expanded. Group rows use soft gray fill, 12px semibold labels, a small SVG chevron, and 11px counts. A shared plugin/package version appears once under the group label. Members are indented and retain individual availability. A group shows the shared state only when all its matching members agree; otherwise it shows Mixed. Search expands matching groups and disables collapse until the search is cleared. Group counts reflect the active filters.

Repository origins from `~/.agents/.skill-lock.json` create separate collapsed skill groups. Metadata is matched to the resolved installed file, including symlink aliases, rather than a skill name or prefix. Local/Dotfiles ownership remains unchanged in filters and the inspector. The inspector labels the repository as a recorded install origin, because files can change after installation. Missing metadata falls back to the existing source groups.

Text selection uses the ink background and white text so it remains visible on gray path/content surfaces. The source inspector has Copy path (full absolute path) and Copy content (displayed content only), with success/error feedback. Copying does not change harness configuration.
