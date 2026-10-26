---
name: LeadLine
description: Registered post for leads. Every enquiry signed for, stamped once, and timed until the first call.
colors:
  paper: "oklch(0.982 0.004 255)"
  paper-surface: "oklch(0.955 0.009 258)"
  card-white: "oklch(1 0 0)"
  postmark-ink: "oklch(0.23 0.035 262)"
  ink-muted: "oklch(0.46 0.03 260)"
  hairline: "oklch(0.885 0.013 258)"
  input-stroke: "oklch(0.86 0.015 258)"
  registered-blue: "oklch(0.44 0.17 263)"
  registered-blue-soft: "oklch(0.94 0.035 263)"
  rail-blue: "oklch(0.33 0.13 264)"
  rail-foreground: "oklch(0.97 0.01 255)"
  rail-muted: "oklch(0.82 0.05 262)"
  focus-blue: "oklch(0.52 0.19 263)"
  ok-green: "oklch(0.5 0.12 155)"
  ok-soft: "oklch(0.95 0.04 155)"
  warn-amber: "oklch(0.52 0.12 65)"
  warn-soft: "oklch(0.95 0.05 80)"
  franking-red: "oklch(0.53 0.2 27)"
  franking-red-soft: "oklch(0.95 0.035 25)"
  hub-teal: "oklch(0.55 0.1 195)"
  hub-teal-soft: "oklch(0.94 0.035 195)"
  stage-new: "oklch(0.55 0.025 260)"
  stage-contacted: "oklch(0.72 0.09 263)"
  stage-consult: "oklch(0.56 0.15 263)"
  stage-accepted: "oklch(0.36 0.16 264)"
  stage-lost: "oklch(0.8 0.01 260)"
typography:
  display:
    fontFamily: "Archivo, sans-serif"
    fontSize: "clamp(3.4rem, 9.5vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "Archivo, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Archivo, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01'"
  label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.035em"
    fontVariation: "'wdth' 76"
  measure:
    fontFamily: "Azeret Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "'tnum'"
rounded:
  stamp: "3px"
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.registered-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-on-rail:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.rail-blue}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  input-field:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.postmark-ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  app-rail:
    backgroundColor: "{colors.rail-blue}"
    textColor: "{colors.rail-foreground}"
    height: "92px"
  lead-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.postmark-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  stage-column:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.xl}"
  timer-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok-green}"
    typography: "{typography.measure}"
    rounded: "{rounded.pill}"
    height: "24px"
  timer-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-amber}"
    typography: "{typography.measure}"
    rounded: "{rounded.pill}"
    height: "24px"
  timer-overdue:
    backgroundColor: "{colors.franking-red-soft}"
    textColor: "{colors.franking-red}"
    typography: "{typography.measure}"
    rounded: "{rounded.pill}"
    height: "24px"
  timer-critical:
    backgroundColor: "{colors.franking-red}"
    textColor: "{colors.card-white}"
    typography: "{typography.measure}"
    rounded: "{rounded.pill}"
    height: "24px"
  outcome-stamp-created:
    backgroundColor: "{colors.registered-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "0 6px"
    height: "20px"
  outcome-stamp-duplicate:
    textColor: "{colors.registered-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "0 6px"
    height: "20px"
  outcome-stamp-rejected:
    textColor: "{colors.postmark-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.stamp}"
    padding: "0 6px"
    height: "20px"
  arrival-postmark:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.registered-blue}"
    rounded: "{rounded.pill}"
    padding: "3px"
    size: "48px"
  arrival-chip:
    backgroundColor: "{colors.registered-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: LeadLine

## Overview

**Creative North Star: "Registered Post"**

LeadLine treats every enquiry as a registered item: received, verified, stamped once, tracked end to end, with the clock on it always visible. The world is registered-envelope stock: cool paper ground, deep registered blue carrying whole fields (the landing hero and the app's header rail), postmark blue-black ink for type, and a franking red that appears only when something is overdue or has failed. Structure comes from the envelope itself: crossed paper bands with blue double rules on the landing hero and across the top of the footer, perforated rules between docket rows and landing list rows, boxed counter stamps in blue ink for delivery outcomes, and a postmark ring as the brand mark and the arrival stamp.

The app is dense and operational. A board of stage columns on a paper surface, white cards with a measured clock in the corner, a delivery log that reads as a proof-of-delivery docket ("3 deliveries → 1 lead"), and a trace page that reads as a tracking history in two lanes. One family, Archivo, speaks in two widths: condensed caps for anything that would be printed on a label or stamp, normal width for reading. Azeret Mono appears only where something is measured.

The state vocabulary is total: each colour and each mark means one thing, everywhere, so the legend is always true. Motion is spent once, on the arrival postmark. Dark mode follows the operating system (prefers-color-scheme); there is no in-app toggle.

**Key Characteristics:**
- Registered-blue fields (rail, hero, footer) on cool paper; white cards and dockets sit on them.
- Archivo width axis: condensed caps for labels and stamps, normal width for reading.
- Azeret Mono only for times, ids, counts and phone numbers, always tabular.
- One colour, one meaning: green, amber and red belong to the clock (red also to failure); teal is the hub; registered blue is the request, every primary action, and, in rising ink weights, the stages and delivery outcomes.
- One authored motion: the postmark stamp that lands on a new arrival.

## Colors

Cool, low-chroma paper and ink around hue 255-262, one saturated registered blue, and a strict state set; all values are OKLCH and live as CSS custom properties in `src/app/globals.css`, with a dark counterpart for each under `prefers-color-scheme: dark`.

### Primary
- **Registered Blue** (registered-blue): the brand and every primary action, focused selection, the request lane in traces, the arrival postmark and the arrival chip, Created and Duplicate outcome stamps and their timeline dots, the caret and text selection tint. Dark mode lifts it (brand `oklch(0.72 0.12 262)`, primary button `oklch(0.62 0.15 263)`).
- **Rail Blue** (rail-blue): the deep ink that fills whole fields: the sticky app header rail, the landing hero, the closing footer. Text on it is rail-foreground; secondary text and inactive tabs are rail-muted. Hover on the rail is a white 10% wash.
- **Registered Blue Soft** (registered-blue-soft): treatment chips on cards and the drop-target wash on a stage column.

### Secondary
- **Hub Teal** (hub-teal, hub-teal-soft): the LISTEN hub lane in trace waterfalls, nothing else. Request work is blue, hub fan-out is teal.

### Tertiary
- **Stage ink weights** (stage-new neutral slate, then registered blue at rising strength: stage-contacted pale, stage-consult mid, stage-accepted full ink; stage-lost faint grey): one per pipeline stage, used as the 3px rule on top of each column and as the dot wherever a stage is named. Green, amber and red never mark a stage. Dark mode inverts the ramp so Treatment accepted is still the strongest (contacted `oklch(0.5 0.09 263)`, consult `oklch(0.66 0.13 263)`, accepted `oklch(0.82 0.1 262)`; new `oklch(0.7 0.025 260)`, lost `oklch(0.42 0.015 260)`).

### Neutral
- **Paper** (paper): page ground.
- **Paper Surface** (paper-surface): stage columns, alternate landing sections, stat tiles.
- **Card White** (card-white): cards, dockets, popovers.
- **Postmark Ink** (postmark-ink): all body type.
- **Ink Muted** (ink-muted): secondary text, timestamps, counts.
- **Hairline** (hairline) and **Input Stroke** (input-stroke): card borders, dividers, field strokes. In dark mode both become white at 11% and 16%. Perforation dots are postmark ink at 28%, so they hold in both themes.

### State
- **On-time Green** (ok-green on ok-soft): timer under 3 minutes, a contact made inside 5 minutes, a live connection.
- **Nearing Amber** (warn-amber on warn-soft): timer from 3 to 5 minutes, reconnecting states.
- **Franking Red** (franking-red on franking-red-soft): timer from 5 to 60 minutes, Urgent, an offline or failed stream, a rolled-back move, the "Over 5 minutes" stat when non-zero. Not used for Rejected or Lost, which are ink states. From 60 minutes the timer inverts to solid red with white digits (critical).

### Named Rules
**The Franking Red Rule.** Red means overdue or failure and nothing else. `destructive` is aliased to it, so a destructive action reads as a failure state, never as decoration or brand.

**The True Legend Rule.** Every colour carries one meaning across the whole product. Green, amber and red belong to the speed-to-lead clock (red also to failure); stages and delivery outcomes speak in registered-blue ink weights, so they never borrow the clock's colours. A new meaning needs a new colour token, not a reused one.

**The Blue Field Rule.** Registered blue fills whole fields (rail, hero, footer) or marks single actions; it is never a mid-strength tint spread across content areas.

## Typography

**Display Font:** Archivo, width axis (with sans-serif fallback)
**Body Font:** Archivo, normal width, stylistic set ss01
**Label/Mono Font:** Archivo condensed caps for labels; Azeret Mono for measurement

**Character:** One grotesque in two voices: the condensed caps of a printed post label, and a plain reading width. The mono is a meter, not a style: it appears only where a number is measured.

### Hierarchy
- **Display** (800, clamp(3.4rem, 9.5vw, 6rem) on the hero, clamp(2.4rem, 6vw, 4rem) in the footer close, line-height 0.88, width 72%, uppercase): one statement per field on landing rails. Not used inside the app.
- **Headline** (600, clamp(1.9rem, 3.6vw, 2.75rem), line-height 1.08, -0.015em): landing section headings, normal width, sentence case.
- **Title** (600, 0.875-1.125rem): lead names on cards, step and problem titles.
- **Body** (400, 1rem, 1.5; 1.125rem relaxed on the hero sub; secondary copy 0.875rem/0.75rem in ink-muted): prose capped at roughly 34rem or `max-w-prose`.
- **Label** (650, 0.65-0.8rem, 0.035em, width 76%, uppercase): column headers, platform names on cards (META, GOOGLE), outcome stamps, menu group labels, lane names, the "Coming" marker, the wordmark (at 1.05rem, 0.06em).
- **Measure** (Azeret Mono, 0.68-0.875rem, tabular numerals): timers, received times, column counts, request ids, span names, phone numbers.

### Named Rules
**The Two Widths Rule.** Condensed caps are for what would be printed on a label or stamp; anything read as a sentence stays at normal width and sentence case.

**The Meter Rule.** Mono is reserved for measurement. Never set prose, buttons or names in Azeret Mono.

**The Fixed Digit Rule.** Every live number is tabular with a fixed minimum width (timers 4.25rem), so ticking and hydration placeholders ("–:––") never shift layout.

## Layout

The app frame is a sticky rail: a 52px row (wordmark, divider, clinic switcher, live status pill) over a 40px tab row with a 2px underline on the active tab. Below it, a row of stat tiles, then the board: stage columns 19rem wide that scroll horizontally, becoming equal auto columns at xl, with a webhook-deliveries docket as a side column at wide sizes. On mobile each column is a full-width page in a snapping scroller with a stage switcher above. Inside columns, cards stack with an 8px gap and 12px internal padding; the column body fades out over its last 1.5rem.

The landing hero is a full-bleed rail-blue grid split by the two crossed bands (a 3.5rem horizontal band and, from lg, a 3.5rem vertical band), headline left, white proof-of-delivery docket right. Content sections sit in a 72rem container with 20/32/48px gutters (px-5, px-8, px-12) and 80-112px vertical padding, alternating paper and paper-surface grounds; lists are perforated rows (a perforation above the list and under each row) rather than cards. The closing footer is a rail-blue field that opens with a 3.5rem paper band carrying the same blue double rule, then the display line and the white CTA.

Spacing follows Tailwind's 4px step; the recurring values are 4, 8, 12, 20 and 32px.

## Elevation & Depth

Flat by default, with depth from tonal layering: paper ground, paper-surface columns, white cards. Shadows are cool and blue-tinted (hue 262-264), soft, and used only where an object is lifted off the page or in transit.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 0 oklch(0.3 0.05 262 / 0.04)`): a barely-there baseline under board cards; hover darkens the border instead of lifting.
- **In transit** (`box-shadow: 0 18px 40px -16px oklch(0.25 0.1 262 / 0.45)`): the card in the drag overlay, with a 1deg tilt.
- **Popover** (`box-shadow: 0 10px 30px -12px oklch(0.25 0.08 262 / 0.35)`): dropdown menus.
- **Notice panel** (`box-shadow: 0 1px 2px oklch(0 0 0 / 0.04), 0 8px 24px -12px oklch(0.3 0.1 262 / 0.18)`): the empty and fault panel.
- **Postmark** (`box-shadow: 0 2px 6px -2px oklch(0.3 0.12 263 / 0.35)`): the arrival postmark sitting over a card edge.
- **Arrival chip** (`box-shadow: 0 8px 20px -8px oklch(0.3 0.15 263 / 0.6)`): the floating "New lead" chip at the foot of the New column.
- **Docket disclosure** (`box-shadow: 0 1px 0 oklch(0.3 0.05 262 / 0.06), 0 12px 32px -20px oklch(0.3 0.12 263 / 0.35)`): the landing's technical docket on paper.
- **Docket on the field** (`box-shadow: 0 2px 0 oklch(0.2 0.1 264 / 0.25), 0 30px 60px -25px oklch(0.12 0.08 264 / 0.7)`): the white docket sitting on the blue hero.

### Named Rules
**The Lift Means Transit Rule.** A strong shadow means the object is moving or floating (drag, menu, the arrival chip, a postmark struck over an edge). Resting cards stay flat; hover changes the border.

## Shapes

Gently rounded rectangles from an 8px base radius (`--radius: 0.5rem`): cards and fields at 8px, stage columns and panels at 11px, buttons at 6-8px. Stamps are near-square (3px) with a 1.5px border, like a rubber counter stamp. Timers, status pills and the arrival chip are full pills. The arrival postmark is a 48px circle with a 2px outer ring and a 1px inner ring, the wordmark's ring at stamp scale, resting at -4deg. Hairline borders do the structural work; the perforation is a 1px dot repeated every 7px (top or bottom edge) between docket rows and landing list rows, and the hero docket header uses a dashed rule. The brand mark is a postmark ring (two concentric circles) with three cancellation bars.

## Components

### Buttons
Quiet and compact; the field does the shouting, not the button.
- **Shape:** gently rounded (8px; 6px on the landing CTA).
- **Primary:** registered blue fill with near-white text, 32px high, 10px side padding, 14px medium weight.
- **On a blue field:** inverts to a paper-white fill with rail-blue text, 48px high, 20px padding, semibold, arrow icon nudging 2px right on hover. Secondary actions on the rail are a 30%-white outline or an underlined text link.
- **Hover / Focus:** fill drops to 80%; focus shows a 2px ring-blue outline with 2px offset; press nudges down 1px.
- **Outline / Ghost / Destructive:** outline on paper with muted hover; ghost is hover-only; destructive is a franking-red 10% wash with red text.

### Chips
- **Treatment chip:** registered-blue-soft with registered-blue text, 4px radius, medium weight.
- **Urgent chip:** franking-red-soft with red text. These are the only two filled chips on a card.

### Cards / Containers
- **Corner Style:** 8px for lead cards; 11px for stage columns.
- **Background:** card-white cards on paper-surface columns.
- **Shadow Strategy:** card rest; in-transit while dragged (see Elevation & Depth).
- **Border:** 1px hairline; registered blue plus a 2px blue ring while freshly arrived; franking red plus ring when a move is rolled back.
- **Internal Padding:** 12px.
- **Column header:** a 3px stage-ink rule across the top, condensed-caps stage name, mono count on the right.
- **Docket disclosure (landing):** a white 10px-radius docket whose summary carries the postmark mark and a condensed-caps title; the opened body starts below a perforation.
- **Lost drop target:** a dashed 2px muted-ink zone pinned to the bottom of the screen during a drag; when hovered it fills with solid postmark ink and paper text. Losing a lead is an ink state, never red.

### Inputs / Fields
- **Style:** 1px input-stroke, transparent ground (white 30% wash in dark), 8px radius, 32px high.
- **Focus:** ring-blue border with a 3px ring at 50%; caret is registered blue.
- **Error / Disabled:** franking-red border and ring; disabled at 50% opacity.

### Navigation
- **App rail:** rail-blue sticky header. Tabs are 14px rail-muted text; active is semibold rail-foreground with a 2px rail-foreground underline; a "Coming" marker sits in condensed caps in a 50% rail-muted outline.
- **Status pill:** 28px full pill on the rail, in words as well as colour: Live (white 10% wash, pulsing green dot), Connecting (white 5%), reconnecting (amber soft), Offline or failed (red soft).
- **Landing nav:** wordmark left, rail-muted text links, a 30%-white outline "Live demo" button; links hide below md.

### Speed Timer (signature)
The clock on every waiting lead: a 24px full pill in Azeret Mono with a 6px dot. Bands: green under 3 minutes, amber 3-5, red soft 5-60 with a pulsing dot, solid red with white digits (dark ink in dark mode) from 60 minutes. Once contacted it freezes into plain mono with a check, green if under 5 minutes, muted otherwise.

### Outcome Stamp (signature)
Delivery outcomes set like counter stamps: condensed caps in a 1.5px border, 3px radius, 20px high, in registered-blue ink so they never borrow the clock's colours. Created is solid blue ink, Duplicate outlined blue, Rejected postmark ink (half-strength border, 70% text), struck through. The timeline dots beside each row follow the same ink: filled blue, blue ring, ink ring. Retries group under one item headed "N deliveries → 1 lead".

### Arrival Postmark (signature, the one authored motion)
A 48px double-ring postmark (the wordmark's ring at stamp scale) in registered blue on the card's paper, "NEW" in condensed caps over the arrival time in mono, struck over the card's bottom-right corner where it restates the arrival time. Arrivals also raise a "New lead: <name>" chip pinned to the bottom of the New column (which sorts longest wait first) that jumps to the card. It lands with `stamp-in` (420ms, ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)`, from scale 1.35 and -9deg to rest at -4deg) while the card drops in 10px. On the landing docket the same postmark lands once with `stamp-land` (460ms, from scale 1.5 and -12deg to rest at -5deg) after the rows reveal in sequence (`reveal-row`, 520ms). All motion sits behind `prefers-reduced-motion: no-preference`; content is visible without it.

### Trace Waterfall (signature)
A tracking history on one shared time axis with two lanes: Webhook request bars in registered blue, LISTEN hub bars in hub teal, 2px-radius bars and a rotated-square marker for "response sent". Lane names in condensed caps in the lane colour.

## Do's and Don'ts

### Do:
- **Do** fill whole fields with rail blue (header rail, hero, footer) and place white paper objects on them.
- **Do** use condensed caps (width 76%, 650, 0.035em) for anything that is a label, stamp or column name, and normal width for sentences.
- **Do** set every time, count and id in Azeret Mono with tabular numerals and a fixed minimum width.
- **Do** keep the timer bands exact: green under 3 minutes, amber 3-5, red from 5, solid red from 60.
- **Do** pair every state colour with words or an icon (status pill, stamps, timers carry text).
- **Do** gate every animation behind `prefers-reduced-motion: no-preference` and keep content visible without it.
- **Do** separate docket rows with the perforation or a hairline, and group retries as one tracked item.

### Don't:
- **Don't** use franking red for anything but overdue or failure: not brand, not emphasis, not decoration.
- **Don't** give a state colour a second meaning; hub teal is only the hub lane, and green, amber and red never mark a stage or a delivery outcome.
- **Don't** add a second authored motion; the arrival postmark is the one moment, everything else is a plain transition.
- **Don't** use Azeret Mono for prose, names or buttons.
- **Don't** set sentences or paragraphs in condensed caps.
- **Don't** add an in-app theme toggle; dark mode follows the operating system.
- **Don't** lift resting cards with shadows; hover changes the border.
