---
name: Better Explore
description: A personal GitHub discovery feed, read like a short morning digest.
colors:
  kiln-orange: "#fb8a4c"
  kiln-orange-light-theme: "#c2410c"
  kiln-wash: "#3a2216"
  kiln-wash-light-theme: "#fdeee4"
  kiln-bar-fill: "#5a3420"
  kiln-bar-fill-light-theme: "#f3c9ae"
  momentum-green: "#4ade80"
  momentum-green-light-theme: "#15803d"
  page: "#121211"
  page-light-theme: "#f6f5f1"
  surface: "#1b1b19"
  surface-light-theme: "#ffffff"
  ink: "#ecebe6"
  ink-light-theme: "#1d1c19"
  ink-soft: "#b3b0a6"
  ink-soft-light-theme: "#57544c"
  ink-faint: "#7d7a71"
  ink-faint-light-theme: "#8a867b"
  rule: "#2c2b28"
  rule-light-theme: "#e4e1d8"
  chip: "#262522"
  chip-light-theme: "#efede6"
  bar-track: "#24231f"
  bar-track-light-theme: "#e9e5d9"
  on-kiln: "#ffffff"
typography:
  brand-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  repo-title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  badge:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.04em"
  data:
    fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  data-small:
    fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  hairline: "3px"
  tag: "6px"
  avatar: "8px"
  card: "12px"
  pill: "999px"
spacing:
  tight: "3px"
  chip-gap: "5px"
  inline: "8px"
  stack: "12px"
  section: "16px"
  gutter: "20px"
  block: "24px"
  column-gap: "32px"
  empty: "48px"
  page-end: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-primary-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  button-starred:
    backgroundColor: "{colors.kiln-orange}"
    textColor: "{colors.on-kiln}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  segmented-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "5px 13px"
  segmented-tab-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "5px 13px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 18px 14px"
  topic-chip:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.data-small}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  topic-chip-matched:
    backgroundColor: "{colors.kiln-wash}"
    textColor: "{colors.kiln-orange}"
    typography: "{typography.data-small}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  badge-new:
    backgroundColor: "{colors.kiln-wash}"
    textColor: "{colors.kiln-orange}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  badge-fork:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.badge}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  taste-bar:
    backgroundColor: "{colors.bar-track}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.page}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
---

# Design System: Better Explore

## Overview

**Creative North Star: "The Morning Digest"**

Better Explore should read like a short, warm daily briefing: open it, take in what's new, act on two or three things, close it. Everything serves a two-minute skim. The page is calm and slightly warm, like newsprint in the light theme and a dim reading room in the dark one. The content does the talking: repo names, the "Because …" line and the numbers lead, and the controls step back.

The system is quiet on purpose. Surfaces are flat and separated by thin rules, not shadows. There is one warm accent, Kiln Orange, and it only marks things that are about *you*. Measured data (topics, languages, star counts, rates, match %) is set in monospace, which gives the digest a quiet ledger-like precision without becoming a dashboard. Controls are soft pills that sit low in the hierarchy.

Dark is the primary theme. It is where the screenshot lives and where the owner reads it. The light theme is a full equal in structure and token roles, and every change must still work in both.

**Key Characteristics:**
- Warm off-black and paper neutrals with a slight yellow cast, never pure grey.
- One accent (Kiln Orange) reserved for personal relevance; one functional green reserved for momentum.
- System sans for reading, system monospace for data. No web fonts.
- Flat surfaces, 1px rules, shadows only on things that float.
- Pill controls, 12px cards, 6px data tags.
- A single column of picks beside a sticky taste sidebar.

## Colors

A warm, low-chroma neutral ladder with a single kiln-fired orange and a sparing momentum green. Each token has a dark value (primary) and a `-light-theme` counterpart. In code they map to the `--bg`, `--surface`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--accent`, `--accent-soft`, `--good`, `--chip`, `--bar` and `--bar-fill` custom properties in `public/style.css`, which switch on `prefers-color-scheme`.

### Primary
- **Kiln Orange** (`kiln-orange`): the brand `◆`, the New count, the New badge text, matched topic chips, the match bar fill, the Starred button, the active taste-bar outline, inline text links (Undo, clear) and the error status line.
- **Kiln Wash** (`kiln-wash`): the tinted background behind Kiln Orange text on the New badge and matched topic chips.
- **Kiln Bar Fill** (`kiln-bar-fill`): the weight fill in taste-profile bars, a muted step of the accent so the sidebar reads as warm without shouting. In the toast it also colours the Undo link.

### Secondary
- **Momentum Green** (`momentum-green`): stars-per-day (`↗ 209/day`) and nothing else.

### Neutral
- **Page** (`page`): the page background. The sticky header uses it at 88% opacity with a 10px backdrop blur.
- **Surface** (`surface`): cards, inputs, and the selected segmented tab.
- **Ink** (`ink`): primary text, repo names, descriptions, the bold words in the "Because …" line, and the filled primary button and toast background.
- **Ink Soft** (`ink-soft`): owner prefix, reasons line, stats, unselected tabs, chip text, ghost-button text.
- **Ink Faint** (`ink-faint`): status line, section labels, match %, "created … ago", empty states, card hover border.
- **Rule** (`rule`): 1px borders on cards, inputs, header bottom, avatar ring and ghost buttons.
- **Chip** (`chip`): topic chips, Fork badge, segmented-control track, avatar placeholder.
- **Bar Track** (`bar-track`): the empty track behind taste bars and the card match bar.
- **On Kiln** (`on-kiln`): white text on Kiln Orange fills (the New count and Starred button). On the dark-theme Kiln Orange this pairing is low contrast (about 2.4:1) and is a known gap, not a pattern to copy.

### Named Rules
**The It's-About-You Rule.** Kiln Orange marks only personal relevance: what's new to you, topics you follow, how well a repo fits, what you starred, and the brand mark. It is never decoration, never a section header, never a hover colour.

**The Green-Means-Momentum Rule.** Momentum Green appears only on the stars-per-day rate. Don't use it for success toasts, "online" dots or positive deltas elsewhere.

## Typography

**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto, sans-serif)
**Label/Mono Font:** ui-monospace (with SF Mono, JetBrains Mono, Menlo, monospace)

**Character:** The platform sans keeps the digest feeling native and unbranded; the platform mono gives measured things a ledger-like exactness. Two system families, zero downloads.

### Hierarchy
- **Brand Title** (700, 17px, -0.01em): "Better Explore" in the header, the only heading-sized text on the page.
- **Repo Title** (700, 16px): the repo name on each card. The owner prefix sits in front of it at 400 in Ink Soft.
- **Body** (400, 15px, 1.5): repo descriptions and default page text.
- **Body Small** (400, 13px, 1.5): the "Because …" reasons, status line, taste intro, toast and empty states.
- **Control** (600, 13px): buttons, segmented tabs; 12.5px on small buttons.
- **Label** (700, 11px, 0.08em, uppercase): sidebar section headings (TOPICS, LANGUAGES) in Ink Faint.
- **Badge** (700, 11px, 0.04em, uppercase): New and Fork badges.
- **Data** (mono 400, 12–12.5px): stars, rate, language, match %, taste-bar labels.
- **Data Small** (mono 400, 11.5px): topic chips.

### Named Rules
**The Mono-Is-Data Rule.** Machine names and measurements (topics, languages, counts, rates, percentages) are set in monospace. Sentences and human phrasing ("created 2mo ago", "Because you follow …") stay in sans.

**The No Big Type Rule.** Nothing on the feed is larger than 17px. Hierarchy comes from weight, Ink level and position, not size.

## Layout

A centred container (max 1180px, 20px side gutters) holds a two-column grid: a 240px taste sidebar and a fluid feed column, 32px apart, with 24px above and 64px below. The sidebar is sticky (offset 88px, below the sticky header). The feed is a single column of cards with 12px between them. Above the feed, the segmented view switcher sits left and the filter input and sort select sit right, wrapping when space runs out.

Inside a card the rhythm is tight: 8px between header and description, 6px to the reasons line, 10px to the topic chips (5px apart), 12px to the footer. Footer stats sit 14px apart, with a flexible spacer pushing Star and Not interested to the right edge.

At 860px and below, the gutters drop to 16px and the grid collapses to one column. The taste sidebar moves above the feed, stops being sticky, and its bars lay out in an auto-fill grid (min 130px). The search input stretches to fill the row, the segmented control scrolls horizontally if needed, and the card's match bar hides, leaving only the percentage.

**The One-Column-of-Picks Rule.** Picks are a single ranked list, one card per row. No masonry, no multi-column card grids: rank order is the information.

## Elevation & Depth

The system is flat. Depth comes from tonal steps (Page → Surface → Chip) and 1px Rule borders, not shadows. Cards have no shadow at rest or on hover; hover only darkens the border to Ink Faint. The sticky header uses translucency and a backdrop blur to separate from scrolling content.

### Shadow Vocabulary
- **Thumb lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.12)`): the selected tab inside the segmented control.
- **Float** (`box-shadow: 0 6px 24px rgb(0 0 0 / 0.2)`): the toast, which floats above the page.

### Named Rules
**The Only-Floaters-Cast-Shadows Rule.** A shadow means "this sits above the page": a toast, a selected thumb, a future popover. Cards, sidebars and inputs never cast one.

## Shapes

Three radii, assigned by what the element is. Things you press or type into are pills (999px): buttons, tabs, the segmented track, inputs, the select, badges, the New count and the toast. Containers are softly rounded (12px). Data tags and bars use a tight 6px. Avatars are 8px squircles, except the viewer's own avatar in the header, which is a circle. The card's match bar is a 44 × 5px bar with 3px corners.

**The Pill-Card-Tag Rule.** Pill (999px) for controls, card (12px) for containers, tag (6px) for data. A new element takes the radius of its kind; no in-between values.

## Components

### Buttons
Quiet pills; only Refresh and Star are filled.
- **Shape:** full pill (999px).
- **Primary:** Ink fill and border with Page text, 600 weight, 13px, 6px 14px. Used for Refresh.
- **Small:** 12.5px, 4px 11px. Used for Star in the card footer.
- **Ghost:** transparent with a Rule border and Ink Soft text. Used for Not interested and Restore. On hover the text goes to Ink and the border to Ink Faint.
- **Starred:** Kiln Orange fill and border with white text ("★ Starred").
- **Hover / Disabled:** filled buttons drop to 88% opacity on hover and 50% when disabled (Refresh while refreshing, labelled "Refreshing…").
- **Text link:** no chrome, Kiln Orange, 600 weight. Used for Undo and clear.

### Chips
Topic chips: data tags you can click to filter.
- **Style:** Chip background, Ink Soft text, mono 11.5px, 2px 8px, 6px corners, no border. Up to 8 per card.
- **State:** a topic you follow is shown in Kiln Wash with Kiln Orange text at 600. Hover lifts the text to Ink.

### Cards / Containers
One repo per card.
- **Corner Style:** 12px.
- **Background:** Surface on Page.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Rule; Ink Faint on hover (0.15s transition).
- **Internal Padding:** 16px top, 18px sides, 14px bottom.
- **Anatomy:** a 32px avatar, `owner /` in Ink Soft, the repo name in bold, New and Fork badges, and the match meter pushed right. Below that: description, the "Because …" reasons line, topic chips, then a footer with ★ stars, ↗ rate (green), language, age, and Star and Not interested on the right.
- **Dismissed:** the whole card is shown at 60% opacity in the Dismissed view.

### Inputs / Fields
- **Style:** Surface background, 1px Rule border, pill corners, 13px text, 6px 13px. The search field is 180px wide, or fills the row on narrow screens. The sort select shares the style.
- **Focus:** browser default focus ring. No custom treatment is defined yet.

### Navigation
- **Segmented view switcher** (For you / New / This week / Dismissed): a Chip-coloured pill track with 3px padding. Tabs are transparent, 600 13px Ink Soft. The selected tab becomes a Surface thumb with Ink text and the Thumb lift shadow. The New tab carries a Kiln Orange count pill (white 11px, min 18px wide) that disappears when empty.
- **Header:** sticky, translucent Page with a blur and a bottom Rule. The Kiln Orange `◆` and the brand title sit on the left with the status line beneath (13px Ink Faint, truncated with an ellipsis; Kiln Orange on error). Refresh and the viewer's avatar sit on the right.

### Match Meter (signature)
A 44 × 5px Bar Track with a Kiln Orange fill set to the match percentage, followed by the mono percentage in Ink Faint. It sits at the right end of the card header. On narrow screens only the number remains.

### Taste Bars (signature)
The sidebar's learned profile: a list of full-width buttons, each a Bar Track row (6px corners, 3px 8px) with a Kiln Bar Fill that grows to the item's relative weight (minimum 6%). The mono 12px label sits on top. Hover or an active filter sets the label bold; the active bar also gets a 2px inset Kiln Orange outline. Bars are 3px apart, and sections are 22px apart under uppercase Label headings.

### Toast
A fixed Ink pill centred 24px above the bottom edge, with Page text at 13px, 10px 16px padding, the Float shadow, and an optional Undo link in Kiln Bar Fill. It dismisses itself after 5 seconds.

## Do's and Don'ts

### Do:
- **Do** design and check in the dark theme first, then confirm the light theme with the `-light-theme` token counterparts.
- **Do** keep Kiln Orange for personal relevance (new, followed, fit, starred, brand mark) per the It's-About-You Rule.
- **Do** set every count, rate, topic, language and percentage in the system monospace.
- **Do** separate surfaces with 1px Rule borders and tonal steps (Page → Surface → Chip).
- **Do** use pill (999px) for controls, 12px for containers and 6px for data tags.
- **Do** keep the feed a single ranked column, with the reason for each pick visible on the card.

### Don't:
- **Don't** introduce a second accent hue; status and emphasis come from Ink levels, weight and Kiln Orange.
- **Don't** use Momentum Green for anything other than stars-per-day.
- **Don't** put shadows on cards, the sidebar or inputs; only floating elements cast them.
- **Don't** set anything on the feed larger than 17px or add display-size headings.
- **Don't** use pure grey (#808080-style) neutrals; the ladder is warm.
- **Don't** add web fonts; the system sans and mono stacks are part of the zero-dependency setup.
