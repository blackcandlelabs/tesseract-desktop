// Generate desktop-update.json for a Tesseract desktop release.
// Usage: node make-update-manifest.mjs <version> <artifactDir> <outFile>
// Picks the platform installers from artifactDir by the release naming:
//   darwin-arm64: Tesseract-<version>-arm64.dmg
//   win32-x64:    Tesseract.Setup.<version>.exe
//   linux-x64:    Tesseract-<version>.tar.gz (skipped if absent)
import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";

const [version, dir, out] = process.argv.slice(2);
if (!version || !dir || !out) {
    console.error("usage: make-update-manifest.mjs <version> <artifactDir> <outFile>");
    process.exit(1);
}
const wanted = [
    ["darwin-arm64", `Tesseract-${version}-arm64.dmg`],
    ["win32-x64", `Tesseract.Setup.${version}.exe`],
    ["linux-x64", `Tesseract-${version}.tar.gz`],
];
const files = [];
for (const [platform, name] of wanted) {
    const p = path.join(dir, name);
    try {
        const data = await fs.readFile(p);
        files.push({ platform, name, sha256: createHash("sha256").update(data).digest("hex") });
    } catch {
        console.log(`skip ${platform}: ${name} not present`);
    }
}
if (files.length === 0) {
    console.error("no platform installers found");
    process.exit(1);
}
const manifest = { schema: 1, version, files };
await fs.writeFile(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${out} for ${version}: ${files.map((f) => f.platform).join(", ")}`);
