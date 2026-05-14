# PDF/PPTX Header Fix Plan

## Goals
- Make `PDF` and `PPTX` links in the site header open reliably after deploy.
- Remove dependence on stale browser cache for presentation assets.
- Keep the shell header and exported build output consistent.

## Improvement List
1. Ensure `preza.pdf` and `preza.pptx` are copied into the production build output.
2. Add cache-busting query strings to header links for the exported artifacts.
3. Add no-cache metadata to presentation redirect pages so old 404s do not persist.
4. Keep presentation-related navigation consistent across shell and app pages.
5. Verify the built site contains the downloadable artifacts before commit.

## Dialectical Analysis
- Direct links are simple and fast, but only work if the files are present in the deployed root.
- Cache busting reduces stale 404s, but should complement correct asset publication rather than hide deployment gaps.
- A build-time copy step adds a little complexity, but keeps deployment behavior predictable.

## Implementation Plan
1. Update the build pipeline so `preza.pdf` and `preza.pptx` are copied into `dist`.
2. Update header links to use cache-busted URLs for the presentation downloads.
3. Keep redirect and shell pages aligned with the same presentation target.
4. Build the site and confirm the downloadable artifacts exist in the published output.
5. Commit the fix and push to the deployment branch.
