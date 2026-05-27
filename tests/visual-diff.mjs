#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function decodePng(filePath) {
  const input = fs.readFileSync(filePath);
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.subarray(offset + 4, offset + 8).toString("ascii");
    const data = input.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format in ${filePath}; expected 8-bit RGB/RGBA non-interlaced PNG`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);
  let inputOffset = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = Buffer.from(inflated.subarray(inputOffset, inputOffset + rowBytes));
    inputOffset += rowBytes;
    const reconstructed = Buffer.alloc(rowBytes);

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? reconstructed[x - channels] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= channels ? previous[x - channels] || 0 : 0;
      let predictor = 0;

      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter} in ${filePath}`);

      reconstructed[x] = (row[x] + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 4;
      rgba[targetIndex] = reconstructed[sourceIndex];
      rgba[targetIndex + 1] = reconstructed[sourceIndex + 1];
      rgba[targetIndex + 2] = reconstructed[sourceIndex + 2];
      rgba[targetIndex + 3] = channels === 4 ? reconstructed[sourceIndex + 3] : 255;
    }

    previous = reconstructed;
  }

  return { width, height, rgba };
}

function encodePng(filePath, width, height, rgba) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND"),
  ]);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, png);
}

function compareImages(baselinePath, currentPath, diffPath, options = {}) {
  const baseline = decodePng(baselinePath);
  const current = decodePng(currentPath);
  const threshold = Number(options.threshold ?? process.env.VISUAL_DIFF_THRESHOLD ?? "0.01");
  const pixelDelta = Number(options.pixelDelta ?? process.env.VISUAL_DIFF_PIXEL_DELTA ?? "16");

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image size mismatch: baseline ${baseline.width}x${baseline.height}, current ${current.width}x${current.height}`,
    );
  }

  const diff = Buffer.alloc(current.rgba.length);
  let changedPixels = 0;
  const totalPixels = current.width * current.height;

  for (let i = 0; i < current.rgba.length; i += 4) {
    const delta =
      Math.abs(baseline.rgba[i] - current.rgba[i]) +
      Math.abs(baseline.rgba[i + 1] - current.rgba[i + 1]) +
      Math.abs(baseline.rgba[i + 2] - current.rgba[i + 2]) +
      Math.abs(baseline.rgba[i + 3] - current.rgba[i + 3]);

    if (delta > pixelDelta) {
      changedPixels += 1;
      diff[i] = 239;
      diff[i + 1] = 68;
      diff[i + 2] = 68;
      diff[i + 3] = 255;
    } else {
      diff[i] = current.rgba[i];
      diff[i + 1] = current.rgba[i + 1];
      diff[i + 2] = current.rgba[i + 2];
      diff[i + 3] = 48;
    }
  }

  const ratio = changedPixels / totalPixels;
  encodePng(diffPath, current.width, current.height, diff);

  return {
    width: current.width,
    height: current.height,
    totalPixels,
    changedPixels,
    ratio,
    threshold,
    passed: ratio <= threshold,
  };
}

function createSolidPng(filePath, width, height, rgba) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  encodePng(filePath, width, height, data);
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "project-os-visual-diff-"));
  const a = path.join(dir, "a.png");
  const b = path.join(dir, "b.png");
  const c = path.join(dir, "c.png");
  const diff = path.join(dir, "diff.png");

  createSolidPng(a, 2, 2, [255, 255, 255, 255]);
  createSolidPng(b, 2, 2, [255, 255, 255, 255]);
  createSolidPng(c, 2, 2, [0, 0, 0, 255]);

  const same = compareImages(a, b, diff, { threshold: 0, pixelDelta: 0 });
  const different = compareImages(a, c, diff, { threshold: 0.5, pixelDelta: 0 });

  fs.rmSync(dir, { recursive: true, force: true });

  if (!same.passed || different.passed) {
    throw new Error("visual diff self-test failed");
  }

  console.log("[visual-diff] self-test passed");
}

if (process.argv[2] === "--self-test") {
  selfTest();
} else {
  const [, , baselinePath, currentPath, diffPath] = process.argv;
  if (!baselinePath || !currentPath || !diffPath) {
    console.error("Usage: node tests/visual-diff.mjs <baseline.png> <current.png> <diff.png>");
    console.error("       node tests/visual-diff.mjs --self-test");
    process.exit(2);
  }

  const result = compareImages(baselinePath, currentPath, diffPath);
  console.log(
    `[visual-diff] ${path.basename(currentPath)} changed=${result.changedPixels}/${result.totalPixels} ratio=${(
      result.ratio * 100
    ).toFixed(3)}% threshold=${(result.threshold * 100).toFixed(3)}% diff=${diffPath}`,
  );

  if (!result.passed) {
    process.exit(1);
  }
}
