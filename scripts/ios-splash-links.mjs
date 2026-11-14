/* eslint-disable no-console -- build script, its output is the progress report */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Adds the landscape links a second time with `device-width` and `device-height`
 * swapped.
 *
 * iOS matches a launch image only against a media query that describes the
 * device exactly, and picks nothing when the two disagree - then it stretches
 * whichever image it has, most visibly turning the portrait artwork into a
 * squashed splash on a landscape iPad. iPadOS has shipped builds that report
 * the screen's width under `device-width` in both orientations, so both
 * orderings are declared and whichever one the device agrees with wins.
 *
 * Run by `bun run generate-assets`, after the generator rewrites the links.
 */

const INDEX = resolve(import.meta.dirname, '../index.html');
const LANDSCAPE_LINK = /^(\s*)<link rel="apple-touch-startup-image" media="screen and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\) and \(orientation: landscape\)" href="([^"]+)" \/>$/gm;

const html = readFileSync(INDEX, 'utf8');
const swappedFor = new Map();

for (const match of html.matchAll(LANDSCAPE_LINK)) {
  const [, indent, width, height, ratio, href] = match;
  const swapped = `${indent}<link rel="apple-touch-startup-image" media="screen and (device-width: ${height}px) and (device-height: ${width}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: landscape)" href="${href}" />`;
  swappedFor.set(match[0], swapped);
}

let next = html;
let added = 0;
for (const [original, swapped] of swappedFor) {
  if (next.includes(swapped)) {
    continue;
  }
  next = next.replace(original, `${original}\n${swapped}`);
  added += 1;
}

if (added > 0) {
  writeFileSync(INDEX, next);
}
console.log(`${added} swapped landscape link(s) added, ${swappedFor.size} total`);
