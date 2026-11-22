---
name: Diabetes Legends
colors:
  surface: '#ffffff'
  surface-dim: '#e6e6e3'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f6f4'
  surface-container: '#f6f6f4'
  surface-container-high: '#e6e6e3'
  surface-container-highest: '#e6e6e3'
  on-surface: '#0a0a0a'
  on-surface-variant: '#444444'
  inverse-surface: '#0a0a0a'
  inverse-on-surface: '#ffffff'
  outline: '#666666'
  outline-variant: '#e6e6e3'
  surface-tint: '#f15a24'
  primary: '#f15a24'
  on-primary: '#ffffff'
  primary-container: '#d94714'
  on-primary-container: '#ffffff'
  inverse-primary: '#f15a24'
  secondary: '#0a0a0a'
  on-secondary: '#ffffff'
  secondary-container: '#1a1a1a'
  on-secondary-container: '#cccccc'
  tertiary: '#1a1a1a'
  on-tertiary: '#ffffff'
  error: '#c0392b'
  on-error: '#ffffff'
  background: '#ffffff'
  on-background: '#0a0a0a'
typography:
  headline-font: Bebas Neue
  body-font: Inter
rounded:
  default: 4px
  pill: 999px
---

# Design System: Diabetes Legends Foundation

## 1. Visual Theme & Atmosphere

Diabetes Legends looks like a sports brand, not a medical charity. The feel is
a game-day program or an arena poster: tall condensed headlines in capitals,
a single hot orange against near-black and clean white, and real photography
of kids and pro athletes on the court. It is confident, energetic and warm,
never clinical, never pastel, never soft.

Pages alternate between bright white bands, quiet off-white bands and full
near-black bands, so the rhythm of light and dark does the work that
decoration would otherwise do. Space is generous, edges are crisp, and orange
is spent sparingly: a label, a number, a button, a top border. Density is low
to medium; each section makes one point.

## 2. Color Palette & Roles

### Primary Foundation
- **Court White** (`#ffffff`): default page and card background.
- **Chalk Off-White** (`#f6f6f4`): alternate section bands and quiet cards.
- **Sideline Grey** (`#e6e6e3`): hairline borders and dividers.
- **Arena Black** (`#0a0a0a`): dark sections, footer, date blocks, primary text.
- **Ink** (`#1a1a1a`): navigation text, form labels, dark gradient partner.

### Accent & Interactive
- **Legends Orange** (`#f15a24`): the only accent. Primary buttons, eyebrow
  labels, big numerals, active tabs, link text, focus borders, card top rules.
- **Deep Orange** (`#d94714`): hover and pressed state of anything orange.

### Typography & Text Hierarchy
- **Arena Black** (`#0a0a0a`): headlines and body on light.
- **Graphite** (`#444444`): secondary body copy in cards.
- **Mid Grey** (`#666666`): notes and helper text.
- **White** (`#ffffff`) and **Soft White** (`#f0f0f0`): text on dark and on photos.
- **Muted Grey** (`#888888` to `#cccccc`): footer and metadata on dark.

### Functional States
- **Success Green** (`#2e7d32`, on a 10% tint of itself): completed status pills.
- **Error Red** (`#c0392b`): form errors.
- On dark app surfaces only: ok `#4caf7d`, due soon `#f5a623`, overdue `#e5484d`.

There are no gradients as decoration, no second accent color, and no blue or
purple anywhere.

## 3. Typography Rules

### Hierarchy & Weights
- **Display and headings: Bebas Neue**, weight 400, a tall condensed
  all-capitals sans with a sports-poster character. Line height 1.05,
  letter spacing 0.01em.
  - H1: 48px scaling to 108px
  - H2: 36px scaling to 64px
  - H3: 22px scaling to 30px
  - Large numerals (dates, counts, totals): 44px to 96px, often orange.
- **Body and UI: Inter**, a neutral humanist sans. Body 17px, weight 400,
  line height 1.6. Lead paragraphs 18px to 22px.
- **Eyebrow labels:** Inter 13px, weight 700, uppercase, letter spacing
  0.18em, orange. They sit above nearly every section headline.
- **Buttons and small links:** Inter 14px to 15px, weight 700, uppercase,
  letter spacing 0.08em.

### Spacing Principles
Headlines are tight and loud; body copy is relaxed and capped at about 720px
wide. Uppercase is reserved for headlines, eyebrows, buttons and labels;
body copy is always sentence case.

## 4. Component Stylings

### Buttons
Crisp rectangles with a 4px corner, 14px by 26px padding, 2px border, bold
uppercase label. Primary is solid Legends Orange with white text, darkening
to Deep Orange on hover. Ghost is transparent with a half-opacity white
border on dark or photo backgrounds, flipping to solid white with black text
on hover. The nav call to action is solid black, turning orange on hover.
Transitions are quick, about 150ms.

### Cards & Containers
- **Pillar card:** off-white fill, 4px corner, a 4px orange rule across the
  top, a large orange Bebas numeral, then heading and copy. No shadow.
- **Event card:** white fill, grey hairline border, 4px corner, 32px padding.
  A black date block sits at the left with an orange month, a huge white day
  and a small grey year. On hover the card lifts 2px, gains a very soft
  shadow and its border turns orange.
- **Dark app card:** on black surfaces, fill `#161616`, border `#2a2a2a`,
  8px corner.
- Cards are flat by default. Shadow appears only on hover.

### Navigation
A sticky white bar, slightly translucent with a blur, with a grey hairline
beneath it. Full logo at the left, 64px tall. Links in Inter 15px weight 600,
turning orange on hover. On phones the links collapse behind a three-line
toggle into a full-width stacked panel.

### Inputs & Forms
White fields with a grey hairline border, 4px corner, 14px by 16px padding
and 16px text. Labels sit above in small bold uppercase. Focus turns the
border orange with no glow. Submit buttons span the full width.

### Domain-Specific Components
- **Photo hero:** a full-bleed action photograph under a black gradient that
  deepens toward the bottom, with a pill-shaped orange eyebrow, a white Bebas
  headline no wider than about 16 characters, a short subhead and two buttons.
- **Promo band:** a full-width solid orange strip with a small black
  uppercase label, a white Bebas line and an arrow call to action.
- **Filter pills:** fully rounded outlined pills on black; the active one is
  solid orange.
- **Photo grid:** square crops, 12px gaps, 4px corners.

## 5. Layout Principles

### Grid & Structure
Content sits in a centered container up to 1200px wide; long-form text uses
880px. Side gutters scale from 20px to 48px. Three-column grids for pillars
and people, four columns for photo grids, single-column stacks for events.

### Whitespace Strategy
Sections have 72px to 120px of vertical padding. Grid gaps are 20px to 36px.
Card padding is 28px to 32px. Spacing follows a loose 4px base.

### Alignment & Visual Balance
Left-aligned throughout: eyebrow, headline, lead paragraph, then content.
Centering is reserved for form notes and the footer on phones. Photography
carries the emotion; type and color carry the structure.

### Responsive Behavior & Touch
Below 900px, three-column grids become one column and photo grids drop to
three, then two columns below 720px. Tap targets are at least 44px tall.
Motion is limited to short hover transitions and is disabled for users who
prefer reduced motion.

## 6. Design System Notes for Stitch Generation

### Language to Use
"Bold sports-brand energy", "arena poster headlines", "condensed all-caps
display type", "one hot orange accent on black and white", "crisp 4px
corners", "flat cards with hairline borders", "full-bleed action photography
under a dark gradient". Avoid: soft, pastel, playful, medical, glassy,
gradient-heavy, rounded-bubbly.

### Color References
Legends Orange `#f15a24`, Deep Orange `#d94714`, Arena Black `#0a0a0a`,
Ink `#1a1a1a`, Court White `#ffffff`, Chalk Off-White `#f6f6f4`,
Sideline Grey `#e6e6e3`.

### Component Prompts
- "A full-bleed basketball action photo hero with a black gradient overlay,
  a small orange pill label, a huge white Bebas Neue headline in capitals,
  a short Inter subhead, a solid orange button and a white outlined button."
- "A white event card with a hairline grey border and 4px corners. On the
  left a black date block with an orange month, a very large white day
  number and a small grey year. On the right a Bebas Neue title, grey Inter
  copy and an orange uppercase text link."
- "Three off-white cards in a row, each with a thick orange top rule, a large
  orange numeral, a Bebas Neue heading and two lines of grey copy."

### Incremental Iteration
Change one thing per edit. If a screen drifts, restate: Bebas Neue capitals
for headings, Inter for everything else, orange only as accent, 4px corners,
no shadows at rest, no gradients except the photo overlay.
