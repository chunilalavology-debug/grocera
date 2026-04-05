/**
 * Copies Vite dist/ into CRA public/zippyyy-ships-app/ so /zippyyy-ships iframe
 * serves the same QuoteEngine as dev — grocery quotes must use data.rates[].
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const targetDir = path.join(root, "..", "public", "zippyyy-ships-app");
const targetAssets = path.join(targetDir, "assets");

if (!fs.existsSync(dist)) {
  console.error("Run `npm run build` first (dist/ missing).");
  process.exit(1);
}

fs.rmSync(targetAssets, { recursive: true, force: true });
fs.mkdirSync(targetAssets, { recursive: true });
fs.cpSync(path.join(dist, "assets"), targetAssets, { recursive: true });
fs.copyFileSync(path.join(dist, "index.html"), path.join(targetDir, "index.html"));
console.log("Synced dist -> ../public/zippyyy-ships-app");
