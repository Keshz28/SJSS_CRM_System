// Asset sizing only: preserve the complete supplied artwork and its white background.
// Run from the repository root with: node scripts/generate-brand-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = new URL("../public/brand/sj-sunrise-logo.png", import.meta.url);
const destination = new URL("../public/icons/", import.meta.url);
await mkdir(destination, { recursive: true });

for (const size of [32, 180, 192, 512]) {
  await sharp(fileURLToPath(source))
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .png()
    .toFile(fileURLToPath(new URL(`sj-logo-${size}.png`, destination)));
}

// Android launchers may crop maskable icons to a circle. Keep the entire square
// artwork within the central 80%-diameter safe circle, including the wording.
await sharp(fileURLToPath(source))
  .resize(288, 288, { fit: "contain", background: "#ffffff" })
  .extend({ top: 112, bottom: 112, left: 112, right: 112, background: "#ffffff" })
  .png()
  .toFile(fileURLToPath(new URL("sj-logo-maskable-512.png", destination)));
