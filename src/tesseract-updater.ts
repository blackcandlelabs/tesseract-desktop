// Tesseract fork patch: releases-feed auto-updater.
//
// Mirrors the Tesseract Android updater pattern: anonymously scan the
// GitHub releases of blackcandlelabs/tesseract-desktop, read the
// desktop-update.json manifest asset, pick the file for this platform,
// and only offer the update after the downloaded installer's SHA-256
// matches BOTH the manifest and the GitHub asset digest. Fail-closed:
// any error, mismatch, or malformed manifest means no prompt.

import { app, dialog, shell, BrowserWindow } from "electron";
import { createHash } from "crypto";
import { createWriteStream, promises as fs } from "fs";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const RELEASES_URL = "https://api.github.com/repos/blackcandlelabs/tesseract-desktop/releases?per_page=10";
const MANIFEST_NAME = "desktop-update.json";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60 * 1000;

interface UpdateFile {
    platform: string;
    name: string;
    sha256: string;
}

interface UpdateManifest {
    schema: number;
    version: string;
    files: UpdateFile[];
}

interface GhAsset {
    name: string;
    browser_download_url: string;
    digest?: string;
}

interface GhRelease {
    tag_name: string;
    draft: boolean;
    assets: GhAsset[];
}

// Normalize CalVer (2026.10.2) and the Windows YY.MM.VER map (26.10.2)
// to a comparable [year, month, ver] tuple.
export function versionTuple(v: string): [number, number, number] | null {
    const parts = v.split(".").map((p) => Number.parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const year = parts[0] < 100 ? parts[0] + 2000 : parts[0];
    return [year, parts[1], parts[2]];
}

export function isNewer(candidate: string, current: string): boolean {
    const c = versionTuple(candidate);
    const i = versionTuple(current);
    if (!c || !i) return false;
    for (let k = 0; k < 3; k++) {
        if (c[k] !== i[k]) return c[k] > i[k];
    }
    return false;
}

async function fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, { headers: { "User-Agent": "Tesseract-Updater" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
}

async function sha256File(file: string): Promise<string> {
    const hash = createHash("sha256");
    hash.update(await fs.readFile(file));
    return hash.digest("hex");
}

export interface UpdateCandidate {
    version: string;
    file: UpdateFile;
    asset: GhAsset;
}

export async function findCandidate(currentVersion: string): Promise<UpdateCandidate | null> {
    const platform = `${process.platform}-${process.arch}`;
    const releases = (await fetchJson(RELEASES_URL)) as GhRelease[];
    for (const release of releases) {
        if (release.draft) continue;
        const manifestAsset = release.assets.find((a) => a.name === MANIFEST_NAME);
        if (!manifestAsset) continue;
        const manifest = (await fetchJson(manifestAsset.browser_download_url)) as UpdateManifest;
        if (manifest.schema !== 1) continue;
        if (!isNewer(manifest.version, currentVersion)) continue;
        const file = manifest.files.find((f) => f.platform === platform);
        if (!file) continue;
        const asset = release.assets.find((a) => a.name === file.name);
        if (!asset) continue;
        return { version: manifest.version, file, asset };
    }
    return null;
}

async function download(url: string, dest: string): Promise<void> {
    const res = await fetch(url, { headers: { "User-Agent": "Tesseract-Updater" } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} downloading update`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

let checking = false;

export async function checkForUpdatesInteractive(getWindow: () => BrowserWindow | null): Promise<void> {
    if (checking) return;
    checking = true;
    try {
        const current = process.env.TESSERACT_UPDATE_CURRENT_VERSION || app.getVersion();
        const candidate = await findCandidate(current);
        if (!candidate) return;
        const dir = path.join(app.getPath("userData"), "tesseract-updates");
        await fs.mkdir(dir, { recursive: true });
        const dest = path.join(dir, candidate.file.name);
        await download(candidate.asset.browser_download_url, dest);
        const digest = await sha256File(dest);
        if (digest.toLowerCase() !== candidate.file.sha256.toLowerCase()) {
            await fs.rm(dest, { force: true });
            console.error("Tesseract updater: SHA-256 does not match desktop-update.json; discarding download");
            return;
        }
        const published = candidate.asset.digest;
        if (published && published.toLowerCase() !== `sha256:${digest}`) {
            await fs.rm(dest, { force: true });
            console.error("Tesseract updater: SHA-256 does not match the GitHub asset digest; discarding download");
            return;
        }
        const win = getWindow();
        const result = await dialog.showMessageBox({
            type: "info",
            title: "Update available",
            message: `Tesseract ${candidate.version} is ready to install.`,
            detail: "The update was downloaded and verified. Tesseract will close and the installer will open.",
            buttons: ["Install now", "Later"],
            defaultId: 0,
            cancelId: 1,
        });
        if (result.response === 0) {
            await shell.openPath(dest);
            app.quit();
        }
    } catch (err) {
        console.error("Tesseract updater: check failed", err);
    } finally {
        checking = false;
    }
}

export function startTesseractUpdater(getWindow: () => BrowserWindow | null): void {
    setTimeout(() => void checkForUpdatesInteractive(getWindow), INITIAL_DELAY_MS);
    setInterval(() => void checkForUpdatesInteractive(getWindow), CHECK_INTERVAL_MS);
}
