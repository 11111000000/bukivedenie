# UX/UI Improvement Plan

## Goals
- Make the project feel like one coherent product, not a set of related pages.
- Improve readability and hierarchy on desktop and mobile.
- Reduce friction in navigation, selection, and data exploration.
- Make empty, loading, and error states feel intentional.
- Keep export targets (`preza.html`, `PDF`, `PPTX`) visually aligned with the web UI.

## Improvement List
1. Unify shell navigation and active state behavior.
2. Introduce a stronger type scale and spacing system.
3. Improve card, panel, table, and control styling across all pages.
4. Add consistent focus-visible, hover, and disabled states.
5. Make charts and tables easier to scan on smaller screens.
6. Add explicit loading / empty / error states for data-driven views.
7. Reduce UI density where the page is visually crowded.
8. Make presentation and exported artifacts follow the same visual language.
9. Improve keyboard accessibility and hit areas.
10. Review page-specific layouts for consistency after the global pass.

## Dialectical Analysis
- Simplicity vs expressiveness: keep the interface clean, but preserve enough density for analytical work.
- Consistency vs page-specific fit: one system should serve both the main atlas and specialized pages.
- Motion vs stability: subtle feedback helps, but heavy animation would hurt readability and export quality.
- Automation vs control: global styles should remove repetition without flattening meaningful visual differences.

## Implementation Plan
1. Refine the shared design tokens and base components in `site/src/style.css`.
2. Normalize shell/header/navigation behavior in `site/src/shared.js` and `site/index.html`.
3. Add reusable empty/error helpers for data-heavy views.
4. Update the main atlas page and sibling pages to use the improved states.
5. Check mobile layouts and tighten spacing where needed.
6. Verify browser rendering and exported presentation artifacts.
