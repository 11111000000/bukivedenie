# Mobile Design Improvement Plan

## Goal
Make the site feel deliberate, readable, and fast on phones while keeping the desktop layout calm and analytical.

## Problems Observed
- The global shell is usable on mobile, but the header still feels dense and visually heavy.
- Navigation is functional, but it competes with the title block and needs stronger mobile hierarchy.
- Several panels rely on fixed chart heights, which can feel cramped or too tall on smaller screens.
- Text hierarchy is inconsistent across pages: titles, subtitles, descriptions, and empty states do not yet follow one clear system.
- Some tables and charts need better spacing, stronger labels, and clearer empty/error states.

## Design Principles
- Keep the interface static, legible, and calm.
- Prefer one-column flow on small screens.
- Make touch targets large enough for real phones.
- Use short, explicit descriptions directly above each widget.
- Let empty states explain the missing data instead of showing generic placeholders.
- Preserve the analytical density on desktop without making the mobile version feel like a shrink-to-fit copy.

## Proposed Improvements
1. Refine the shell header into a clearer mobile-first composition.
2. Keep navigation available, but reduce its visual weight on phones.
3. Normalize spacing, borders, shadows, and type scale across the shared CSS.
4. Improve chart containers so mobile heights feel intentional rather than compressed.
5. Standardize panel descriptions and empty states across all pages.
6. Make tables easier to scan by improving scroll containers and sticky headers.
7. Review the presentation page and ensure its mobile experience matches the main atlas.
8. Keep `preza.html` and other shell-linked pages visible in the navigation flow.

## Implementation Areas
- `site/index.html`
- `site/src/style.css`
- `site/src/shared.js`
- `site/src/main.js`
- `site/src/lingvistics.js`
- `site/src/pages/war-and-peace/*.js`

## Recommended Subtasks
1. Rework the shell header and mobile menu behavior.
2. Tighten the shared design tokens and mobile breakpoints.
3. Improve descriptions and empty states on the main dashboard.
4. Apply the same treatment to the War and Peace pages.
5. Rebuild and test on small-screen dimensions.
6. Commit and push the result to both remotes.

## Success Criteria
- The site reads clearly on a narrow phone viewport.
- Navigation is obvious but not overpowering.
- Charts, tables, and empty states all feel intentionally designed.
- The build succeeds without regressions.
