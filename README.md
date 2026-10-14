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
   deep-link protocols `com.blackcandle.tesseract` + `tesseract`.
   `package.json`'s name is `tesseract-desktop` to match.
2. **Icons** are the Black Candle candle mark on the #08090B tile:
   `build/icon.png`, `build/icon.ico`, and the Icon Composer bundle
   `build/icon.icon` (layer asset renamed to `candle.png`).

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

Linux targets: `.tar.gz` + `.deb` in `dist/`. Windows (NSIS) builds on
the same host through electron-builder's wine path. **macOS targets
require a macOS host** — electron-builder will not produce them on
Linux; the same commands run unchanged on a Mac.

## Distribution

Per SPEC §8.2: installers are served from the authenticated Black Candle
download endpoint (authd session required); GitHub Releases are the
build archive only. v1 ships unsigned, with documented install steps.
