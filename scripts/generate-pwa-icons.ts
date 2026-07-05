/**
 * Generates placeholder PWA/favicon icons by rasterizing the mindmap logo mark
 * (mindmap-logo.svg) onto a solid square background. These are placeholders —
 * replace with real designed icon assets before any store submission.
 *
 * Run: npm run generate:icons
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(__dirname, "..");

// App/manifest icons use the app's actual dark-mode brand color.
const BRAND_BACKGROUND = "#09090b";
const BRAND_GLYPH = "#fafafa";

// The favicon is specified as true black bg + white glyph, independent of the brand color.
const FAVICON_BACKGROUND = "#000000";
const FAVICON_GLYPH = "#ffffff";

const rawSvg = readFileSync(join(ROOT, "mindmap-logo.svg"), "utf-8");
const glyphPath = rawSvg.match(/<path[^>]*\/>/)?.[0] ?? "";
const canvasUnits = 341.594;

function recoloredSvg(glyphColor: string): string {
  return rawSvg.replace('fill="#000000"', `fill="${glyphColor}"`);
}

async function renderIconPng(background: string, glyphColor: string, size: number, glyphScale: number) {
  const glyphSize = Math.round(size * glyphScale);
  const glyphBuffer = await sharp(Buffer.from(recoloredSvg(glyphColor)))
    .resize(glyphSize, glyphSize, { fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: glyphBuffer, gravity: "center" }])
    .flatten({ background })
    .png()
    .toBuffer();
}

/** Packs PNG buffers into a multi-resolution .ico container (modern ICOs can embed PNG data as-is). */
function packIco(pngBuffers: { size: number; buffer: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngBuffers.length, 4); // image count

  const dirEntries: Buffer[] = [];
  const imageData: Buffer[] = [];
  let offset = 6 + pngBuffers.length * 16;

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    imageData.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

type IconSpec = {
  file: string;
  size: number;
  /** Glyph size as a fraction of the canvas — smaller for maskable to stay in the 80% safe zone. */
  glyphScale: number;
};

const APP_ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, glyphScale: 0.72 },
  { file: "icon-512.png", size: 512, glyphScale: 0.72 },
  { file: "icon-maskable-192.png", size: 192, glyphScale: 0.58 },
  { file: "icon-maskable-512.png", size: 512, glyphScale: 0.58 },
  { file: "apple-touch-icon.png", size: 180, glyphScale: 0.72 },
];

const FAVICON_SIZES = [16, 32, 48];

async function main() {
  const publicDir = join(ROOT, "public");
  mkdirSync(publicDir, { recursive: true });

  for (const { file, size, glyphScale } of APP_ICONS) {
    const output = await renderIconPng(BRAND_BACKGROUND, BRAND_GLYPH, size, glyphScale);
    writeFileSync(join(publicDir, file), output);
    console.log(`Wrote public/${file} (${size}x${size})`);
  }

  // favicon.ico — true black bg + white glyph, multi-resolution (16/32/48).
  const faviconPngs = await Promise.all(
    FAVICON_SIZES.map(async (size) => ({
      size,
      buffer: await renderIconPng(FAVICON_BACKGROUND, FAVICON_GLYPH, size, 0.72),
    }))
  );
  writeFileSync(join(ROOT, "app", "favicon.ico"), packIco(faviconPngs));
  console.log("Wrote app/favicon.ico");

  // app/icon.svg — crisp scalable tab icon for modern browsers, same black bg + white mark.
  // Uses a single <svg> with a transformed <g> (rather than a nested <svg>) since some
  // browsers' favicon renderers don't reliably support nested <svg> elements.
  const glyphScale = 0.72;
  const inset = (canvasUnits * (1 - glyphScale)) / 2;
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasUnits} ${canvasUnits}" width="64" height="64">
  <rect width="${canvasUnits}" height="${canvasUnits}" fill="${FAVICON_BACKGROUND}" rx="48" />
  <g transform="translate(${inset} ${inset}) scale(${glyphScale})" fill="${FAVICON_GLYPH}">
    ${glyphPath}
  </g>
</svg>`;
  writeFileSync(join(ROOT, "app", "icon.svg"), iconSvg);
  console.log("Wrote app/icon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
