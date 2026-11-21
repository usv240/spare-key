---
version: 1
slug: "extension-src-panel-html"
primary_target: "extension/src/panel.html"
related_targets: ["extension/src/panel.css"]
---

# Side panel

Scope: the Chrome side panel, every screen (safety, choose, scanning, results, plan, Under the hood). Mode: Operate.
Audience and job: a scared, tired person on a shared or watched computer finds out who still has access and gets an
ordered plan in about five minutes; a judge understands the system in two. Most frequent job: continue to the check,
then Start the check. Constraints: 320 to 500 px wide, Quick exit first and always visible, nothing saved by default,
calm words (EXPERIENCE.md section 2). Visual world pinned by EXPERIENCE.md section 6 and PRODUCT.md Brand Commitments.

Style dealt: achromatic-ledger (design-taste-frontend, seed 1588194136), with the brand's palette and type kept. Its
near-black primary is translated to the brand's deep door green (#2F5D50), the one filled action per screen.

## Direction contract

THESIS: A well-made public-service form that happens to be interactive: ink on warm paper, one green action, facts
with a next step. It refuses the security-dashboard default of shields, red alerts, scores and counters.

OWN-WORLD: Ground #F7F4EE, white surfaces with 1px #DDD7CC edges, ink #1F2328 and #4A5058, one deep green #2F5D50 for
the single primary action and focus, caution amber #8A5200 on #FBF1E1 only for "may alert them" lines. Atkinson
Hyperlegible Next for everything, Mono only for the sent log's JSON. Radius 10 for cards, 8 for controls. A plain key mark.

STORY: The person reads that this computer may be watched, sees the hotline before anything else, and knows how to
leave in one press. Then they choose what to check, watch each page open beside the panel, read each finding as a
fact with what removing it would do, and leave with an ordered plan they can print or lock.

FIRST VIEWPORT: Bar: key mark and "Spare Key" left, Quick exit button right, sticky. Then the h1 "Before you start" at
24/700, one 17px paragraph with its "i", the hotline card (call and text rows, 48px each), the Escape line, and the
full-width primary "I understand, continue" with the secondary "Try a practice check first" under it, all inside 600px.

FORM: brief-pinned world, Operate shell with no sidebar; signature element: "What left this computer", the word-for-word
ledger of every cloud request, beside "Where each step runs". seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Scanning, results and plan screens are built on days 2 to 5; the finish review runs once they exist (day 8).
- The Alt+Shift+X shortcut may be left unassigned by Chrome; the panel names only the shortcut Chrome assigned.
