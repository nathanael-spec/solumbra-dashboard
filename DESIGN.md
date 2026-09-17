# DESIGN.md for Solumbra

A plain text design system for AI coding agents. Read this before writing any UI for a
Solumbra surface, then build to it exactly.

**Source of truth.** This file lives at `brand-assets/DESIGN.md` in the SOLUMBRA-OS repo and
is copied into the root of each product repo. Edit the copy in SOLUMBRA-OS and re copy out.
The values here are compiled from `brand-assets/brand-strategy/` (the approved brand docs) and
from `solumbra-site/styles/brand.css` (the shipped implementation). Where those two ever
disagree, the shipped CSS wins, because it was judged on a real screen.

**Scope.** This governs Solumbra's own surfaces: the marketing site, the intake form, the
console, the flow diagrams, the sales pages, decks and PDFs. It does **not** govern client
work. A mockup built for a prospect uses that prospect's brand, not this one.

---

## Overview

Solumbra is an AI implementation agency. The customer is not afraid AI will fail. They are
afraid of looking foolish spending money on something they cannot evaluate, sold by someone
who talks faster than they can follow.

So the brand promise is **composure**, and every visual decision follows from it.

Four properties define the look:

1. **Glass is the material.** Frosted, transparent, physical. There is no flat design
   anywhere in this system.
2. **Digital objects have weight.** Panes sit in space, catch light, and hold an edge. A
   Solumbra button looks like something you could pick up.
3. **Color is restrained.** Grounds are near black or warm bone. Color appears only as light
   passing through glass or as one buried glow. Never as a filled block.
4. **Small technical type against large quiet objects.** Spec sheet labels at 10px with wide
   tracking, set against a big calm surface. It reads as documentation of something real.

**The one governing rule:** visuals carry calm, copy carries urgency. The business message is
"adapt or fall behind" and that urgency belongs in words. Anything that makes the interface
look like it is in a hurry (countdown timers, starbursts, exclamation marks, progress bars
that imply a deadline) is a bug, not emphasis.

---

## Colors

Two modes. **Dark is the default.** Glass reads best against depth. Light mode is a genuine
alternate and the mode for print and long documents. One mode per composition, never both in
the same frame.

**Geometry never changes between modes.** Blur, radius, spacing and type sizes are identical.
Only color and opacity differ. That is what lets one build serve both.

### Dark mode, the four values

| Token | Hex | Use |
|---|---|---|
| `--void` | `#07090B` | The ground. Near black, faintly cool. Most of the frame. |
| `--onyx` | `#101418` | Second surface, a panel behind panels. Sparingly. |
| `--sheen` | `#8A9C9C` | The brightest point of the luminous form. Cool grey green. |
| `--ember` | `#A6631D` | The buried glow. One per composition. |

`--sheen` is not a fill. It is the peak of a large soft gradient that falls to `--void` over
most of its area. In the source reference it occupies about a fifth of the frame and touches
full brightness in about a fiftieth of it.

**The ember guard.** `--ember` is a dark rust at roughly 44% luminance, not a glow color.
Three rules keep it a light source instead of a decoration:

1. It only appears inside the luminous form. Never on flat black, never as a wash.
2. It is always behind glass or behind the form's own falloff. Never a clean edged shape you
   could point at.
3. One per composition, and it never touches a pane's edge.

If a screenshot shows something that looks like orange light, the value was used at the wrong
opacity.

### Light mode

| Token | Hex | Use |
|---|---|---|
| `--bone` | `#EFEAE1` | Light ground. Warm, paper like, never pure white. |
| `--bone-hi` | `#F7F4EE` | Raised light surface. |
| `--bone-lo` | `#E3DCD1` | Recessed light surface, hairlines. |

**Neither ground is ever a flat fill.** Dark carries the luminous form plus grain. Light
carries a wide low contrast gradient plus grain. A perfectly flat rectangle of either value
reads as cheap.

### Text

| Token | Value | Use |
|---|---|---|
| `--w-95` | `rgba(255,255,255,.95)` | Primary text on `--void`. |
| `--w-68` | `rgba(255,255,255,.68)` | Secondary text on `--void`. |
| `--w-46` | `rgba(255,255,255,.46)` | Spec labels on `--void`. |
| `--ink` | `#15171B` | Primary text on `--bone`. |
| `--slate-70` | `#4A4F57` | Secondary text on `--bone`. |
| `--slate-50` | `#787E87` | **Display type on `--bone`.** Quiet, not black. |
| `--slate-30` | `#A9AEB6` | Hairlines, disabled, spec labels on `--bone`. |

Text on dark is **white, not bone**. On a near black ground with a warm glow in it, warm text
loses its edge.

Display type sits at `--w-95` on dark and `--slate-50` on light. Emphasis comes from scale,
never from weight and never from black.

### Glass

| Token | Value | Use |
|---|---|---|
| `--glass-fill` | `rgba(255,255,255,.10)` | Default pane fill on dark. |
| `--glass-fill-lo` | `rgba(255,255,255,.05)` | Quiet pane, hover on a transparent control. |
| `--glass-blur` | `20px` | Default `backdrop-filter` blur. |

Fill and blur move together in four steps: `.05 / .075 / .10 / .15` at blur `6 / 12 / 20 / 40`.
`.10` at `20` is the reference card's own value and the default. On light mode the fill scale
is `.12 / .22 / .34 / .50`.

### Refraction, light mode only

These are **edge and light values. They are never fills.** They appear as 1px rim gradients,
specular highlights, and buried subsurface glow.

| Token | Hex | Role |
|---|---|---|
| `--key` | `#FFFCF7` | Key light. Rim highlight, top edge. |
| `--warm` | `#FFF0DB` | Warm vertical strip light. |
| `--amber` | `#F2C48A` | Buried subsurface glow. One per composition. |
| `--cool` | `#A8C7FF` | Cool rim light, lower right. |
| `--steel` | `#C7D2E4` | Neutral reflected fill. |

Dispersion ramp for spectral edges: `--warm` to `--key` to `--cool`, at 1px to 2px and never
above 40% opacity.

**In dark mode there is no dispersion rim at all.** The dark rim is white only.

**The guard on `--cool`:** the moment it becomes a fill, a button color, or a gradient wash, it
turns into exactly the mid tone corporate blue this brand is defined against. Edge only.

### The brand has no brand color

There is no fill color to reach for, and that is the system working, not a gap. When a
composition needs energy it comes from a glass edge catching light, or from the one buried
ember. Never from an accent block. If you find yourself wanting a primary button color, use a
brighter pane instead.

---

## Typography

### Font family

**Inter, at every size, in every role.** One face. Variable, axes `opsz` 14 to 32 and `wght`
100 to 900. Use weights 400, 500 and 600 only.

```css
--font: "Inter", "Inter Variable", "Helvetica Now Display", "Helvetica Neue",
        -apple-system, Arial, sans-serif;
```

Self host the `.woff2`. Never hotlink Google Fonts: it costs a third party DNS round trip on
first paint and leaks visitor data.

**Optical size is not optional.** Inter's `opsz` axis is the difference between the text cut
and the display cut. Set it to the top of the range for anything above 24px, and to match the
rendered size below that. Never let it default.

### Display ladder

| Role | Size | Weight | opsz | Tracking | Leading |
|---|---|---|---|---|---|
| Display XL | 120 to 160px | 400 | 32 | -0.025em | 1.00 |
| Display | 72 to 110px | 400 | 32 | -0.022em | 1.02 |
| Headline | 40 to 64px | 500 | 32 | -0.020em | 1.05 |
| Subhead | 24 to 34px | 500 | 32 | -0.015em | 1.20 |
| Deck | 18 to 22px | 400 | 20 | -0.005em | 1.45 |

Weight comes **down** as size goes up. At 160px, weight 500 reads as bold. At 44px it reads as
normal.

### Working ladder

| Role | Size | Weight | opsz | Tracking | Notes |
|---|---|---|---|---|---|
| Body | 15 to 17px | 400 | 18 | 0 | Leading 1.6. Measure 62ch to 72ch. |
| Caption | 12 to 13px | 400 | 14 | +0.005em | 60% to 68% opacity typical. |
| UI and button | 13 to 14px | 500 | 14 | +0.01em | |
| Data and numeric | 13 to 15px | 500 | 14 | +0.02em | `font-variant-numeric: tabular-nums`. |
| Spec label | 10 to 11px | 500 | 14 | +0.18em | Uppercase. See below. |

### The scale rule

This is the load bearing part of the whole type system.

With one typeface, contrast in a composition comes entirely from **ratio**. On any given
surface the display setting is at least **2.5 times the body size**, and there is nothing in
between. The source reference measures 2.8 to 1: a 42px headline over a 15px caption inside a
451px card, with a 10px label above it.

**Nothing lives in the middle.** A 24px "medium heading" is the failure mode. It makes the page
look like a document template instead of a designed object. If a hierarchy seems to need a
third level, the answer is a spec label or more space, not another size.

### The spec label

The brand's signature typographic move. Inter 500, 10px to 11px, uppercase,
`letter-spacing: 0.18em`, set at 46% to 52% opacity against the ground.

Notation:

- Version numbers as `V.02`
- Dates in braces as `{26.07.2026}`
- Multi part labels split by a slash with spaces: `SOLUMBRA / MARK V.02 / GLASS`

**One or two per composition, and the content must be true.** A label that describes something
real is documentation. A label that says nothing is decoration, and decoration is the failure
mode this whole system exists to avoid.

### Four hard rules

- **Sentence case, with a full stop.** Headlines are sentences and they end like sentences:
  *Editable glassmorphism layouts.* Never Title Case. Never all caps above label size. The full
  stop is what stops a big line reading as a slogan.
- **Tracked tight, or not at all.** Display is negative, body is zero. The only positive
  tracking in the brand is the spec label.
- **Never above weight 600,** and never above 500 at display size. Solumbra does not shout, and
  Inter at 700 is a shout.
- **White, not bone, on dark.** Emphasis comes from scale. Weight and color stay back.

---

## Layout

### Containers

| Surface | Max width | Gutter |
|---|---|---|
| Marketing page | `1140px` | `32px`, dropping to `20px` under 640px |
| Form, single column flow | `720px` | `24px`, dropping to `18px` under 560px |
| Reading measure | `62ch` (`--measure`) | applies to any paragraph |

Never let a paragraph run wider than the measure, even inside a wide container.

### Spacing

There is no strict 4px or 8px grid. The system in the shipped CSS is a small set of intervals,
used consistently:

- **Inside a control:** `8px` gap, `12px` to `18px` padding
- **Between fields:** `34px`
- **Between a label and its input:** `12px`
- **Section padding inside a pane:** `clamp(28px, 3.4vw, 54px)`
- **Masthead to first content:** `56px`, dropping to `40px` on small screens
- **Page bottom padding:** `96px`, dropping to `72px`

### Whitespace

Space is the brand's main tool for calm. When a layout feels wrong, the first fix to try is
more space, not another element, another size, or another color. If a section looks empty, it
is probably correct.

---

## Elevation and depth

### The three layer build

A dark Solumbra composition is built in exactly this order:

1. **A near black ground.** `--void`, almost the whole frame.
2. **One large soft luminous form** crossing it, brightest at `--sheen`, falling to nothing
   over most of its area, with at most one `--ember` buried inside it.
3. **Glass laid across the boundary**, so part of each pane sits over black and part sits over
   the light.

That contrast within a single pane is the entire effect. Getting it wrong looks like grey
rectangles on a grey page.

**The light comes from behind the glass, not from the ground.** Do not try to fix a flat
looking page by raising the ground to a mid grey. That was tried, it destroyed the effect, and
it is logged as a reversed decision.

```css
/* The luminous form. Fixed, behind everything, never interactive. */
body::before {
  content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(68% 52% at 18% 12%,
      rgba(138,156,156,.22), rgba(138,156,156,.06) 42%, transparent 72%),
    radial-gradient(30% 24% at 26% 22%, rgba(166,99,29,.18), transparent 66%),
    radial-gradient(50% 40% at 88% 96%, rgba(138,156,156,.07), transparent 70%);
}
```

**Grain is mandatory.** A fractal noise SVG at `opacity: .035`, fixed over the whole frame. It
is what keeps either ground off a flat value.

### The graded rim

Every glass surface carries the same rim, lit from one direction at 142 degrees.

| Token | Value | Role |
|---|---|---|
| `--rim-base` | `rgba(255,255,255,.12)` | The full ring, all four edges. |
| `--rim-lit` | `rgba(255,255,255,.58)` | The lit corner, top left. |
| `--rim-return` | `rgba(255,255,255,.26)` | The return light, bottom right. |

Build it from **inset box shadows with zero blur**, not from `mask-composite`. Chrome emits
mask composite as a soft mask and Quartz composites soft masks as opaque grey rectangles. That
shipped once and had to be pulled. Inset shadows stay vector and survive Quartz.

```css
box-shadow:
  inset 0 0 0 1px var(--rim-base),
  inset 1px 1px 0 0 var(--rim-lit),
  inset -1px -1px 0 0 var(--rim-return),
  inset 0 -10px 16px -12px rgba(0,0,0,.55);   /* floor shadow, panes only */
```

**One light direction for every surface on the page.** A pane lit from the top left next to a
pane lit from the bottom right breaks the illusion instantly.

There are no drop shadows in this system. Depth comes from the rim, the blur, and the layer
order.

---

## Shapes

### Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius` | `23px` | Panes, cards, large surfaces. This is 6.2mm at 96dpi. |
| `--radius-sm` | `14px` | Inputs, choices, small callouts. |
| pill | `999px` | Buttons only. |
| dot | `999px` | Markers, avatars. |

### Squircle

Large panes take a superellipse where the browser supports it:

```css
@supports (corner-shape: squircle) { .pane { corner-shape: squircle; } }
```

**Pill shaped elements are exempt.** A superellipse at full radius clamp goes visibly boxy.

### The mark

There is exactly **one approved logo file**: `brand-assets/assets/SOLUMBRA_LOGO.png`. It is a
3D glass render and there are no flat or vector variants. That is intentional: the material is
the identity.

- **Never regenerate it.** The render parameters are not reliably reproducible. A previous
  attempt from documented "locked parameters" produced a visibly different mark and it was
  caught only by pixel comparison. This PNG is the only copy of the artwork.
- Never recolor, rotate, stretch, outline or trace it.
- Minimum 64px on screen.
- Clear space is one tube diameter on all sides.
- To put it on a new background, place this file on that background.

---

## Components

### Pane

The base surface. Everything that is not the ground is a pane or lives on one.

```css
.pane {
  position: relative; z-index: 1;
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(120%);
  border-radius: var(--radius);
  box-shadow: /* the graded rim, above */;
}
```

`saturate(120%)` is part of the material. Do not drop it.

### Buttons

**Buttons are glass pills. Never a colored fill.** There is no primary color, so the primary
and secondary distinction is carried by fill level, not hue.

| Variant | Fill | Rim | Text |
|---|---|---|---|
| Primary | `--glass-fill` at blur 12px | full graded rim | `--w-95` |
| Quiet | transparent | `--rim-base` only | `--w-68` |

- Minimum height `46px`, padding `0 26px`, radius `999px`
- Type: 14px, weight 500, `opsz` 14, tracking `+0.01em`
- Hover: fill up to `rgba(255,255,255,.15)`. Quiet hover goes to `--glass-fill-lo` and text to
  `--w-95`
- Active: `translateY(1px)`
- Disabled: `opacity: .4`, cursor not allowed

### Inputs

Same rim language, quieter. Fill `rgba(255,255,255,.04)`, radius `--radius-sm`, minimum height
`48px`, padding `12px 16px`.

- **Font size must be 16px.** Anything smaller makes iOS zoom the page on focus.
- Placeholder at `rgba(255,255,255,.28)`
- Focus raises the ring to `rgba(255,255,255,.34)` and adds `--rim-lit`. Remove the default
  outline only because a visible focus ring replaces it, never leave focus unmarked.
- Textarea minimum height `108px`, `resize: vertical`

### Choices

Radio and checkbox rows. **The selected state is a second, brighter pane inside the first.**
You read the layer change, not a fill color.

- Rest: fill `rgba(255,255,255,.035)`, ring `rgba(255,255,255,.09)`, text `--w-68`
- Hover: fill `.07`, text `--w-95`
- Selected: fill `.13`, text `--w-95`, full graded rim
- The marker is a **ring that fills with light**, never a colored tick. 16px circle for single
  select, 5px radius square for multi select.

### Progress

**No progress bars.** A bar reads as a deadline and nothing in this brand is allowed to look
hurried. Use a counted set of marks instead: `22px` by `2px` rounded dots, at `.16` opacity for
pending, `.42` for done and `.90` for current.

### Dividers and callouts

- Divider: `1px`, `rgba(255,255,255,.09)`, no margin above, `34px` below
- Callout or error block: radius `--radius-sm`, fill `rgba(255,255,255,.05)`, ring
  `rgba(255,255,255,.14)`, text `--w-68` at 14px. Errors are stated quietly. A correction offer
  is a quiet underlined link, not a red box.

---

## Motion

Motion is short, small and functional. It confirms that something happened. It never
entertains.

- Duration `140ms` to `200ms`, easing `ease`
- Only these properties animate: `background`, `color`, `box-shadow`, `opacity`, and
  `transform` limited to a 1px nudge
- No parallax, no scroll jacking, no entrance animations on page load, no bouncing, no
  spinning logos
- **Always honor reduced motion:**

```css
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

---

## Do and do not

### Do

- Keep `--void` (`#07090B`) as the anchor surface. The faint cool tint is intentional.
- Put one large soft light form behind the panes and lay the glass across its edge.
- Use grain on every ground.
- Light every surface on a page from the same direction.
- Let scale carry the hierarchy: display at 2.5 times body, nothing in between.
- End headlines with a full stop.
- Use one or two spec labels per screen, and make the content factually true.
- Reach for more space before reaching for another element.

### Do not

- Do not introduce a brand color, a primary button fill, or a colored badge.
- Do not use mid tone corporate blue, gradient mesh purple, saturated teal, pastel mint or
  pink.
- Do not use `--amber`, `--ember` or `--cool` as a fill. They are edge and light values.
- Do not use pure `#FFFFFF` as a ground, or a mid grey as a dark ground.
- Do not set a 24px heading between the display size and the body size.
- Do not use Title Case, all caps above label size, or weight 700.
- Do not use stock AI imagery: neural nets, glowing brains, circuit boards, humanoid robots.
- Do not use countdown timers, starbursts, exclamation marks or progress bars.
- Do not use flat vector illustration.
- Do not regenerate, recolor or trace the logo.
- Do not use `mask-composite` for the rim.
- Do not add drop shadows.

---

## Responsive behavior

### Breakpoints

The shipped code uses `560px`, `640px`, `760px`, `860px` and `1000px`. Pick the one nearest the
content's own break, do not invent new ones.

### Rules

- Mobile first is not required, but every layout must be checked at `375px` wide.
- Touch targets are minimum `44px` by `44px`. Buttons are already `46px`.
- On small screens the footer bar becomes a reversed column and buttons go full width, so the
  forward action sits under the thumb.
- Display sizes use `clamp()`, for example `clamp(40px, 7vw, 62px)`. Body sizes do not scale.
- Pane padding uses `clamp()`. Radius does not: `23px` stays `23px` at every width.
- Backdrop blur is expensive. On pages with many panes, keep blurred surfaces under about a
  dozen and drop the blur, not the fill, if a mobile device stutters.

---

## Copy rules

An agent writing UI text on this brand is writing brand copy. These are not suggestions.

- **No dashes anywhere.** Not em, not en, not hyphens joining words. Write "10 minute call",
  "day to day", "near black".
- Short sentences. One idea per sentence.
- Plain words. Explain any tool the first time it is named. Never use a tool name as a verb.
- Sentence case with a full stop on headlines.
- No hype, no urgency theatre, no "unlock", "supercharge", "game changing", "revolutionary".
- Numbers are stated plainly and are always true. Never invent a metric, a saving, or a price.
- **Never publish a price the agent computed itself.** Prices come from the pricing engines.

---

## Agent prompt guide

Paste one of these with the file.

**New page:**
> Build this page against DESIGN.md. Dark mode. Start with `--void`, add one soft luminous
> form with a single ember inside it, then lay glass panes across its edge. Display at 2.5
> times the body size with nothing in between. Glass pill buttons, no color fills. Sentence
> case headlines with a full stop. One spec label, and it has to be true.

**Existing page, checking it:**
> Audit this page against DESIGN.md. List every place it breaks a rule, quote the rule, and
> give the fix. Look hardest for: a mid size heading between display and body, a colored fill
> standing in for a button state, a flat ground with no light form or grain, and rims lit from
> different directions.

**A component:**
> Build this as a Solumbra pane per DESIGN.md. Graded rim from three inset box shadows at zero
> blur, radius 23px, fill `rgba(255,255,255,.10)`, blur 20px with `saturate(120%)`. No drop
> shadow. States change fill level, never hue.

**Light mode:**
> Same geometry, light palette. Ground `--bone` with a wide low contrast gradient plus grain.
> Display type at `--slate-50`, not black. Glass fills step `.12 / .22 / .34 / .50`. Refraction
> tokens allowed on edges only, never as fills.

---

## Data display

Set on 2026-09-17 by the dashboard, the first dense screen. It composes the tokens above and
changes nothing in them.

- **Tiles are panes.** Radius 23, fill `.05`, the three inset rim shadows, padding 16 to 18px.
  A tile has a spec label (10.5px, uppercase, 0.18em, 46%), one body, and one quiet foot line
  (12px, 46%) that says what the number is and where it came from.
- **Hero numbers** are 30 to 44px at weight 400, tabular, with the unit at half size in 46%.
  Body and label text stays 12 to 13px. Nothing lives between the two sizes.
- **Series are light, not hue.** Series one is white at `.86`, series two is `--sheen`, series
  three is white at `.34`. Never more than three series, and any chart with two or more carries
  a legend and a tooltip, so identity never rests on colour. `--ember` appears only as a dashed
  reference line (a ceiling, a benchmark, break even), never as a series or a fill.
- **Grid lines** are white at `.06`, horizontal only. Axis text is 11px at 46%. No axis lines.
- **Bars** have 4px rounded tops, a 2px gap between neighbours, and a 38px maximum width.
  Lines are 2px with no dots until hover. Nothing animates in.
- **Tables** keep the console's roster style: 10.5px uppercase headings at 46%, 13px cells,
  1px `.09` rules, numbers right aligned and tabular, row hover `.03`.
- **Rates keep the sample size rule.** Under 10 in the denominator a rate is shown as a
  fraction ("2 of 6"), never a percentage.
- **Progress** is still counted marks, twenty of them at 18 by 2px, never a bar.
- **Density.** The page grid is 12 columns, 14px gap, 18 by 28px padding, and each screen is
  laid out to fit 1440 by 900 with no page scroll. Under 1000px the grid is two columns and
  the page scrolls; under 640px one column.
- **A source that fails** shows a plain sentence in its tile, radius 14, fill `.04`, ring `.12`.
  Never a red box, never an icon.

## Known gaps

Things this file does not yet cover, so an agent should ask rather than invent:

- **Light mode components.** The token set is complete but no button, input or choice has been
  built and judged on bone. Derive from the dark specs and flag it as unreviewed.
- **Icons.** No icon set is chosen. Do not mix icon families inside one screen.
- **Email.** No HTML email template exists. Backdrop blur does not survive most email clients,
  so glass will need a flat substitute and that substitute is not designed yet.
- **Density.** The data display section above sets the dense scale for a dashboard. Forms and
  marketing pages keep the spacing in the rest of this file.

---

*Compiled 2026-08-15. Format follows the DESIGN.md convention collected at
github.com/VoltAgent/awesome-design-md.*
