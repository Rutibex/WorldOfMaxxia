# Public landing page

The static landing page in `website/` is the homepage of the GitHub Pages deployment. The published game is assembled from `engine/world-of-maxxia/dist/` into `/play/` by `node tools/prepare-pages.mjs`. The website itself contains no browser runtime bundle.

GitHub Actions: `.github/workflows/pages.yml`. See `docs/GITHUB_DEPLOYMENT.md` for setup and publication. Renderer preview images in `media/` are labelled as such; they do not claim verified interactive screenshots.
