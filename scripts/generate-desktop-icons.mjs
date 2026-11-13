import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { sharpsToIco } from 'sharp-ico';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'public/logo.svg');
const CONFIG = resolve(ROOT, 'build/config.yml');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

const ICNS_TYPES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

function render(size) {
  return sharp(SOURCE, { density: 600 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function writeIco() {
  const out = resolve(ROOT, 'build/windows/icon.ico');
  await mkdir(dirname(out), { recursive: true });
  await sharpsToIco([sharp(SOURCE, { density: 600 })], out, { sizes: ICO_SIZES });
  console.log(`build/windows/icon.ico (${ICO_SIZES.join(', ')})`);
}

async function writeIcns() {
  const elements = await Promise.all(
    ICNS_TYPES.map(async ([type, size]) => {
      const png = await render(size);
      const header = Buffer.alloc(8);
      header.write(type, 0, 'ascii');
      header.writeUInt32BE(png.length + 8, 4);
      return Buffer.concat([header, png]);
    }),
  );

  const body = Buffer.concat(elements);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);

  const out = resolve(ROOT, 'build/darwin/icon.icns');
  await writeFile(out, Buffer.concat([header, body]));
  console.log(`build/darwin/icon.icns (${ICNS_TYPES.map(([, size]) => size).join(', ')})`);
}

async function writeWindowsVersionInfo() {
  const config = parseYaml(await readFile(CONFIG, 'utf8'));
  const info = config?.info ?? {};

  // Windows reads the properties dialog from this block. Explorer hides the
  // whole page when the text is filed under the neutral language, so it is
  // filed under en-US (0409), the same choice the Wails generator makes.
  const json = {
    fixed: { file_version: info.version },
    info: {
      '0409': {
        ProductVersion: info.version,
        CompanyName: info.companyName,
        FileDescription: info.description,
        LegalCopyright: info.copyright,
        ProductName: info.productName,
        Comments: info.comments,
      },
    },
  };

  const out = resolve(ROOT, 'build/windows/info.json');
  await writeFile(out, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`build/windows/info.json (${info.companyName})`);
}

await writeIco();
await writeIcns();
await writeWindowsVersionInfo();
