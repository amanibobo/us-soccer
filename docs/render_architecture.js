// Render docs/architecture.excalidraw to SVG and PNG with Excalidraw's own exporter.
//
//   node docs/render_architecture.js
//
// Needs `playwright` resolvable (npx playwright install chromium once). It loads
// @excalidraw/excalidraw from esm.sh inside headless Chromium, so it needs network.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const HERE = __dirname;
const SRC = path.join(HERE, "architecture.excalidraw");
const OUT_SVG = path.join(HERE, "architecture.svg");
const OUT_PNG = path.join(HERE, "architecture.png");
const OUT_WEB = path.join(HERE, "..", "web", "public", "architecture.png");
const OUT_WEB_DARK = path.join(HERE, "..", "web", "public", "architecture-dark.png");

(async () => {
  const doc = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.setContent("<!doctype html><html><body></body></html>");
  const result = await page.evaluate(async (doc) => {
    const mod = await import("https://esm.sh/@excalidraw/excalidraw@0.18.0?deps=react@19.1.0,react-dom@19.1.0");
    const opts = {
      elements: doc.elements,
      appState: { ...doc.appState, exportBackground: true, exportWithDarkMode: false, exportEmbedScene: false, exportPadding: 32 },
      files: doc.files,
    };
    const toB64 = async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    const dims = (w, h) => ({ width: w * 2, height: h * 2, scale: 2 });
    const svg = await mod.exportToSvg(opts);
    const png = await toB64(await mod.exportToBlob({ ...opts, mimeType: "image/png", getDimensions: dims }));
    const dark = await toB64(
      await mod.exportToBlob({ ...opts, appState: { ...opts.appState, exportWithDarkMode: true, viewBackgroundColor: "#161618" }, mimeType: "image/png", getDimensions: dims }),
    );
    return { svg: new XMLSerializer().serializeToString(svg), png, dark };
  }, doc);
  fs.writeFileSync(OUT_SVG, result.svg);
  const png = Buffer.from(result.png, "base64");
  fs.writeFileSync(OUT_PNG, png);
  fs.writeFileSync(OUT_WEB, png);
  fs.writeFileSync(OUT_WEB_DARK, Buffer.from(result.dark, "base64"));
  console.log(`svg ${(result.svg.length / 1e6).toFixed(2)} MB, png ${(png.length / 1e6).toFixed(2)} MB -> ${OUT_PNG}, ${OUT_WEB}`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
