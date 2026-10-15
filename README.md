# Tesseract Desktop

Black Candle's desktop messenger for Windows, macOS, and Linux: the
[Tesseract Web](../tesseract-web) client wrapped by an Electron shell.
Sign-in is OAuth-only through Black Candle auth (MAS/OIDC), exactly like
the web and Android clients; there is no password login path.

This repository is a fork of
[element-desktop](https://github.com/element-hq/element-desktop).

## Upstream pin

- **element-desktop v1.12.13** (`bcd8401`). Rebases onto newer upstream
  releases ship as pull requests for maintainer approval, never silently
  (monthly cadence; immediately for security releases).

## The webapp

The shell packages a webapp build as `webapp.asar`. Ours is the
production **tesseract-web** build (the same artifact serving
`https://chat.internal.blackcandletech.com`): extract `/app` from the
deployed web image, add the production `config.json` (injected into the
web container at deploy time; brand "Tesseract", homeserver pinned to
`chat.internal.blackcandletech.com`), unpack it into `webapp/`, and run
`pnpm run asar-webapp`. Do NOT run upstream's `pnpm run fetch` — it
downloads Element's webapp from element-web releases.

Note the version skew and verify on every rebase: shell v1.12.13 with a
webapp built from tesseract-web (element-web v1.12.30 base). The
shell↔webapp platform bridge is exercised by booting the packaged app
to the sign-in screen before a build is called good.

## Patch inventory (vs upstream v1.12.13)

1. **Build variant** `tesseract/release/build.json`, selected with
   `VARIANT_PATH=tesseract/release/build.json`: productName "Tesseract",
   appId `com.blackcandle.tesseract`, package name `tesseract-desktop`,
   deep-link protocols `com.blackcandletech.tesseract` + `tesseract`.
   `package.json`'s name is `tesseract-desktop` to match.
2. **Icons** are the tesseract mark (hypercube wireframe, offset-depth
   projection; design: Figma "Tesseract — App Icon Candidates",
   candidate B) in #E9A33D on the #171209 tile: `build/icon.png`,
   `build/icon.ico`, `build/icon.icns` (see also item 4), and the Icon
   Composer bundle `build/icon.icon`.

3. **Native-build image fix** — `dockerbuild/Dockerfile` points apt at
   archive.debian.org (bullseye is EOL; the stock sources 404 today).
4. **macOS icon** — electron-builder 26 wants `actool` (full Xcode) to
   compile the Icon Composer bundle. v1 builds with a classic
   `build/icon.icns` (generated from the candle tile with iconutil);
   `electron-builder.ts` points at it, and the `.icon` bundle is kept
   as source under `assets/icon.icon/` for when a full-Xcode host
   builds. Restore it by moving the bundle back to `build/` and
   reverting the two icon paths.

5. **OIDC scheme pairing (login-critical)** — the desktop registers
   with MAS dynamically at login. MAS policy requires the OAuth
   redirect scheme (variant `protocols[0]`) to be the reverse-DNS of
   the webapp config's `oidc_metadata.client_uri` host. Ours are
   `com.blackcandletech.tesseract` and
   `https://tesseract.blackcandletech.com/` (the config side lives in
   the deployment's config.json, alongside logo/tos/policy URIs on the
   same host). If either side changes without the other, MAS denies
   registration and desktop login fails with a generic homeserver
   error (this exact bug shipped in the first macOS build).
6. **Windows CI artifact glob** — Windows builds run in CI
   (`.github/workflows/build-windows-tesseract.yaml`, windows-2025
   runner); the targets are squirrel + msi (electron-builder.ts).
   electron-builder writes the Squirrel update-channel files (Setup
   exe, .nupkg, RELEASES) into `dist/squirrel-windows/`, not the
   dist/ root — the original upload globs (`dist/*.exe` etc.)
   silently missed the whole set, so run 38603992011 archived only
   the MSI even though Squirrel built cleanly. The upload paths now
   include `dist/squirrel-windows/*.exe`,
   `dist/squirrel-windows/*.nupkg` and `dist/squirrel-windows/RELEASES`
   (fix a8c58ba; cherry-picked to develop as 959d3b9).

7. **OIDC fragment-state fix (login-critical)** — `src/protocol.ts`
   `getProfileFromDeeplink` read the OIDC `state` only from the URL
   query string and asserted it non-null. MAS answers in fragment
   response mode, so on the Windows argv-scan deep-link path the read
   was null and the Electron main process crashed on `.split`,
   breaking fresh Windows logins. The handler now falls back to the
   fragment and resolves to the default profile when state is absent
   (PR #1, f4575d6). Shipped in CalVer 2026.10.1.

8. **CalVer MSI mapping (Windows)** - WiX/MSI ProductVersion caps the
   major field at 255, so the CalVer year cannot be an MSI version
   (CNDL0242). The Windows CI builds in two passes: Squirrel at the
   true CalVer (2026.10.1), then the MSI with package.json's version
   mapped to YY.MM.VER (26.10.1) for that pass only - the mapping is
   monotonic across releases, so MSI upgrade chains hold.

Everything else — branding, server pinning, SSO-only login, the agent
banner — lives in the webapp (tesseract-web), not in this shell.

## Building (Linux packaging host)

```sh
pnpm install
pnpm run docker:setup          # one-time: native-module build image
pnpm run docker:install
pnpm run docker:build:native   # hak native modules (slow)
# unpack the tesseract-web build into webapp/ (see above), then:
pnpm run asar-webapp
VARIANT_PATH=tesseract/release/build.json pnpm run build  # electron-builder
```

Linux targets: `.tar.gz` + `.deb` in `dist/`. Windows targets
(squirrel + msi) build in CI — see patch item 6. **macOS targets
require a macOS host** — electron-builder will not produce them on
Linux; the same commands run unchanged on a Mac.

## Distribution

Per SPEC §8.2: installers are served from the authenticated Black Candle
download endpoint (authd session required); GitHub Releases are the
build archive only. v1 ships unsigned, with documented install steps.
