# Publish World of Maxxia on GitHub

This workspace supports a **single source repository**, downloadable GitHub Releases and a GitHub Pages **landing page with a playable game**.

## 1. Create the repository

1. Create an empty repository on GitHub, such as `World-of-Maxxia`. Do not generate a new README or license there.
2. Extract `World-of-Maxxia-GitHub-Repository-MP27.zip` and open a terminal in its `World-of-Maxxia/` folder.
3. Run:

   ```bash
   git init
   git add .
   git commit -m "Prepare World of Maxxia MP27 public preview"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/World-of-Maxxia.git
   git push -u origin main
   ```

   Replace `YOUR-USERNAME` with your actual account or organization. If the repository is already initialized, use a normal commit and push rather than re-running `git init`.

4. In the repository **About** panel, a suggested description is:

   > Browser-based party dungeon crawler and modular RPG adventure authoring toolkit, with a C# WinForms editor.

   Suggested topics: `rpg`, `dungeon-crawler`, `browser-game`, `typescript`, `phaser`, `csharp`, `winforms`, `game-engine`, `modding`.

## 2. Enable the playable GitHub Pages site

1. Open **Settings → Pages** and select **GitHub Actions** as the build/deployment source.
2. Push to `main` or manually run **Actions → Publish Pages → Run workflow**.
3. The workflow installs dependencies, builds the game, combines it with `website/` and deploys it as a static site. The front page is `/`; the playable game is `/play/`.
4. The workflow uses relative asset paths so it works at a project URL such as `https://YOUR-USERNAME.github.io/World-of-Maxxia/`, not just at a domain root.

If publishing on a custom domain, configure the domain through GitHub Pages settings separately. Do not assume an arbitrary deployment URL is a live demo until the workflow succeeds.

## 3. Make a GitHub Release

1. Open **Releases → Draft a new release**.
2. Create tag `v0.27.0-mp27` (or another version you choose), title it `World of Maxxia / Maxxia Maker — MP27 Preview` and mark it **Pre-release**.
3. Paste the text from [`RELEASE_NOTES.md`](../RELEASE_NOTES.md) into the description.
4. Attach `World-of-Maxxia-MP27-Play.zip`. Attach the source/Pages archives if you also want ready-to-use ZIP downloads; GitHub generates its own source archives from the tag.
5. Publish after CI and Pages checks are green.

## 4. Licenses and rights

No license granting reuse of the project's original code/art was present in the supplied snapshot. The cleaned repository therefore includes an **all-rights-reserved** project notice and preserves third-party licenses. A public GitHub repository is *source-visible*, not automatically open source. Choose a license consciously before advertising the project as open source. The original author owns that choice.

## 5. Release validation

- `npm run check:generated` / `npm run check:game` / `npm run check:mp27` succeed in the GitHub Actions environment.
- `npm run build:game` creates `engine/world-of-maxxia/dist/index.html`.
- `node tools/prepare-pages.mjs` creates `_site/index.html` and `_site/play/index.html`.
- On the actual Pages URL, the game loads without asset 404s, can start a party, and can open the Counterfeit Gallery sample.
- Manual browser, mobile/touch and Windows GUI tests are still necessary; CI cannot certify those experiences on its own.

**Save data warning:** Browser saves use the local origin. The GitHub Pages site and `http://localhost:3000` do not share localStorage. Export/import saves to migrate deliberately.
