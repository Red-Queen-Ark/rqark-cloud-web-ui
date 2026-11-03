/* eslint-disable no-console -- build script, its output is the progress report */
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Replaces the artwork in every iOS launch image with the app's own
 * background colour.
 *
 * iOS uses a launch image only when a media query describes the device
 * exactly, and otherwise stretches whichever image it holds. In a resized
 * window — Stage Manager, Split View, Slide Over — no fixed size ever matches,
 * so the artwork arrives squashed: a landscape window gets the portrait
 * artwork widened, which is the distortion this exists to stop.
 *
 * A flat colour cannot look stretched, and the app paints its own splash from
 * index.html in the first frame it controls, at the mark's true aspect ratio.
 * So a launch image's only job here is to make the gap before that a dark,
 * neutral background instead of a white flash.
 */

const ROOT = new URL('../public/apple-splash/v3/', import.meta.url);
const BACKGROUND = '#141414';

let flattened = 0;
for (const orientation of ['landscape', 'portrait']) {
  const dir = new URL(`${orientation}/`, ROOT);
  let names;
  try {
    names = await readdir(dir);
  } catch {
    continue;
  }
  for (const name of names.filter((candidate) => candidate.endsWith('.png'))) {
    const file = join(dir.pathname, name);
    const { width, height } = await sharp(file).metadata();
    if (!width || !height) {
      continue;
    }
    const temp = `${file}.flat.png`;
    await sharp({ create: { width, height, channels: 4, background: BACKGROUND } })
      .png({ compressionLevel: 9 })
      .toFile(temp);
    await rm(file);
    await sharp(temp).toFile(file);
    await rm(temp);
    flattened += 1;
  }
}
console.log(`${flattened} launch image(s) flattened to ${BACKGROUND}`);
