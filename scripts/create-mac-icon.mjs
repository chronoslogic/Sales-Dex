import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceIcon = path.join(rootDir, "build", "icon.png");
const iconsetDir = path.join(rootDir, "build", "icon.iconset");
const outputIcon = path.join(rootDir, "build", "icon.icns");

const iconEntries = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

if (process.platform !== "darwin") {
  console.log("Skipping macOS icon generation because this is not a macOS machine.");
  process.exit(0);
}

await fs.access(sourceIcon);
await fs.rm(iconsetDir, { recursive: true, force: true });
await fs.mkdir(iconsetDir, { recursive: true });

for (const [fileName, size] of iconEntries) {
  await execFileAsync("sips", ["-z", String(size), String(size), sourceIcon, "--out", path.join(iconsetDir, fileName)]);
}

await execFileAsync("iconutil", ["-c", "icns", iconsetDir, "-o", outputIcon]);
await fs.rm(iconsetDir, { recursive: true, force: true });

console.log(`Created ${path.relative(rootDir, outputIcon)}`);
