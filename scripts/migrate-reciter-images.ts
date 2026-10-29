/**
 * migrate-reciter-images.ts
 *
 * Gives reciters a server photo in the current format: a 512 px and a 160 px
 * WebP plus a ThumbHash placeholder, uploaded through the backend's photo
 * upload (POST /admin/uploads/reciter-image, then /complete). Needs only the
 * admin login, no R2 keys.
 *
 * Usage:
 *   npx tsx scripts/migrate-reciter-images.ts --only slug-a,slug-b [--dry-run]
 *   npx tsx scripts/migrate-reciter-images.ts --no-bundled [--dry-run]
 *   npx tsx scripts/migrate-reciter-images.ts --all [--dry-run]
 *
 * Which reciters (pick exactly one):
 *   --only <slugs>   these reciters
 *   --no-bundled     reciters the app has no bundled photo for
 *   --all            everyone (only once the app that reads `photo` is out:
 *                    older versions stop using their bundled photo as soon as
 *                    image_url is set, and show the plain icon offline)
 *
 * Options:
 *   --source-dir <dir>  new photos named <slug>.<jpg|jpeg|png|webp>; they win
 *                       over every other source
 *   --dry-run           write the files and a contact sheet to --out, change nothing
 *   --out <dir>         where dry-run output goes (default .reciter-photos-out)
 *   --force             also redo reciters that already have a placeholder
 *
 * Source for each reciter: --source-dir, then the current image_url, then the
 * bundled photo. A reciter that already has a placeholder is skipped (so a
 * rerun after a failure only does what is left), and a stamped WebP made by
 * an earlier run is never used as a source, since encoding it again only
 * loses quality.
 *
 * Env: BAYAAN_ADMIN_URL plus BAYAAN_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD.
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import {makeVariants, THUMB_SIZE, type PhotoVariants} from './lib/reciterPhoto';

const ADMIN_URL =
  process.env.BAYAAN_ADMIN_URL ||
  process.env.BAYAAN_API_URL ||
  process.env.EXPO_PUBLIC_BAYAAN_API_URL;
let ADMIN_TOKEN = process.env.BAYAAN_ADMIN_TOKEN;
const {ADMIN_EMAIL, ADMIN_PASSWORD} = process.env;

const BUNDLED_DIR = path.resolve(__dirname, '..', 'assets', 'reciter-images');
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
// Same as utils/reciterImageLookup.ts, for display names that don't match
// their photo's file name
const BUNDLED_ALIASES: Record<string, string> = {
  'mahmood-alsheimy': 'mahmoud-el-sheimy',
};

interface Args {
  only: string[] | null;
  noBundled: boolean;
  all: boolean;
  sourceDir: string | null;
  dryRun: boolean;
  out: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const only = value('--only');
  const args: Args = {
    only: only
      ? only
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : null,
    noBundled: argv.includes('--no-bundled'),
    all: argv.includes('--all'),
    sourceDir: value('--source-dir') ?? null,
    dryRun: argv.includes('--dry-run'),
    out: value('--out') ?? '.reciter-photos-out',
    force: argv.includes('--force'),
  };
  const groups = [args.only, args.noBundled || null, args.all || null].filter(
    Boolean,
  );
  if (groups.length !== 1)
    throw new Error(
      'Pick exactly one of --only <slugs>, --no-bundled or --all.',
    );
  return args;
}

// ── admin API ────────────────────────────────────────────────────────────────

interface Reciter {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  image_placeholder: string | null;
}

async function api<T>(
  method: string,
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${ADMIN_URL}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      ...(body ? {'Content-Type': 'application/json'} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(`${method} ${route} ${res.status}: ${await res.text()}`);
  return ((await res.json()) as {data: T}).data;
}

async function login() {
  if (ADMIN_TOKEN) return;
  const res = await fetch(`${ADMIN_URL}/admin/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
  });
  if (!res.ok)
    throw new Error(`admin login ${res.status}: ${await res.text()}`);
  ADMIN_TOKEN = ((await res.json()) as {data: {token: string}}).data.token;
}

async function listReciters(): Promise<Reciter[]> {
  const all: Reciter[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${ADMIN_URL}/admin/reciters?page=${page}&limit=200`,
      {
        headers: {Authorization: `Bearer ${ADMIN_TOKEN}`},
      },
    );
    if (!res.ok) throw new Error(`list reciters ${res.status}`);
    const json = (await res.json()) as {
      data: Reciter[];
      meta: {total_pages: number};
    };
    all.push(...json.data);
    if (page >= json.meta.total_pages) return all;
  }
}

interface UploadTarget {
  key: string;
  upload_url: string;
}

async function upload(reciter: Reciter, v: PhotoVariants) {
  const start = await api<
    UploadTarget & {headers: Record<string, string>; thumb: UploadTarget}
  >('POST', '/admin/uploads/reciter-image', {reciter_id: reciter.id});
  for (const [target, body] of [
    [start, v.full],
    [start.thumb, v.thumb],
  ] as const) {
    const res = await fetch(target.upload_url, {
      method: 'PUT',
      headers: start.headers,
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`PUT ${target.key} ${res.status}`);
  }
  await api('POST', '/admin/uploads/reciter-image/complete', {
    reciter_id: reciter.id,
    key: start.key,
    placeholder: v.placeholder,
  });
}

// ── sources ──────────────────────────────────────────────────────────────────

/** Same key rule as scripts/generateReciterImages.ts. */
function imageKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function filesByKey(
  dir: string,
  keyOf: (base: string) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    const {name, ext} = path.parse(file);
    if (IMAGE_EXTS.includes(ext.toLowerCase()))
      map.set(keyOf(name), path.join(dir, file));
  }
  return map;
}

// A WebP this script uploaded earlier: <slug>-<stamp>.webp on the CDN
const OWN_OUTPUT = /\/assets\/reciter-images\/[^/]+-[a-z0-9]+(-160)?\.webp$/;

type Source = {kind: 'source-dir' | 'image_url' | 'bundled'; where: string};

function findSource(
  r: Reciter,
  picked: Map<string, string>,
  bundled: Map<string, string>,
): Source | null {
  const pickedFile = picked.get(r.slug);
  if (pickedFile) return {kind: 'source-dir', where: pickedFile};
  if (r.image_url && !OWN_OUTPUT.test(r.image_url))
    return {kind: 'image_url', where: r.image_url};
  const key = imageKey(r.name);
  const bundledFile = bundled.get(BUNDLED_ALIASES[key] ?? key);
  return bundledFile ? {kind: 'bundled', where: bundledFile} : null;
}

async function readSource(src: Source): Promise<Buffer> {
  if (src.kind !== 'image_url') return fs.promises.readFile(src.where);
  const res = await fetch(src.where);
  if (!res.ok) throw new Error(`GET ${src.where} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── dry-run output ───────────────────────────────────────────────────────────

async function writeContactSheet(
  out: string,
  entries: Array<{slug: string; thumb: Buffer}>,
) {
  if (entries.length === 0) return;
  const cols = 8;
  const rows = Math.ceil(entries.length / cols);
  const tiles = entries.map((e, i) => ({
    input: e.thumb,
    left: (i % cols) * THUMB_SIZE,
    top: Math.floor(i / cols) * THUMB_SIZE,
  }));
  await sharp({
    create: {
      width: cols * THUMB_SIZE,
      height: rows * THUMB_SIZE,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(tiles)
    .jpeg({quality: 85})
    .toFile(path.join(out, '_contact-sheet.jpg'));
  fs.writeFileSync(
    path.join(out, '_contact-sheet.txt'),
    entries.map((e, i) => `${i + 1}\t${e.slug}`).join('\n'),
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!ADMIN_URL || (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD))) {
    throw new Error(
      'Set BAYAAN_ADMIN_URL plus BAYAAN_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD.',
    );
  }
  await login();

  const bundled = filesByKey(BUNDLED_DIR, imageKey);
  const picked = args.sourceDir
    ? filesByKey(args.sourceDir, base => base)
    : new Map<string, string>();
  const reciters = await listReciters();

  let selected = reciters;
  if (args.only) {
    const wanted = new Set(args.only);
    selected = reciters.filter(r => wanted.has(r.slug));
    const missing = args.only.filter(s => !selected.some(r => r.slug === s));
    if (missing.length) throw new Error(`Unknown slugs: ${missing.join(', ')}`);
  } else if (args.noBundled) {
    selected = reciters.filter(r => {
      const key = imageKey(r.name);
      return !bundled.has(BUNDLED_ALIASES[key] ?? key);
    });
  }

  if (args.dryRun) fs.mkdirSync(args.out, {recursive: true});
  const report = {
    updated: [] as string[],
    skipped: [] as string[],
    noSource: [] as string[],
    failed: [] as string[],
  };
  const sheet: Array<{slug: string; thumb: Buffer}> = [];

  for (const r of selected) {
    if (r.image_placeholder && !args.force) {
      report.skipped.push(r.slug);
      continue;
    }
    const src = findSource(r, picked, bundled);
    if (!src) {
      report.noSource.push(r.slug);
      continue;
    }
    try {
      const variants = await makeVariants(await readSource(src));
      if (args.dryRun) {
        fs.writeFileSync(path.join(args.out, `${r.slug}.webp`), variants.full);
        sheet.push({slug: r.slug, thumb: variants.thumb});
        console.log(
          `DRY ${r.slug} from ${src.kind}: ${src.where} (placeholder ${variants.placeholder.length} chars)`,
        );
      } else {
        await upload(r, variants);
        console.log(`OK  ${r.slug} from ${src.kind}`);
      }
      report.updated.push(r.slug);
    } catch (err) {
      console.error(`ERR ${r.slug}: ${(err as Error).message}`);
      report.failed.push(r.slug);
    }
  }

  if (args.dryRun) await writeContactSheet(args.out, sheet);
  console.log(
    `\n${args.dryRun ? 'Would update' : 'Updated'} ${report.updated.length}, ` +
      `skipped ${report.skipped.length} (already done), no source ${report.noSource.length}, ` +
      `failed ${report.failed.length}`,
  );
  if (report.noSource.length)
    console.log(`No photo for: ${report.noSource.join(', ')}`);
  if (report.failed.length) {
    console.log(`Failed: ${report.failed.join(', ')}`);
    process.exitCode = 1;
  }
  if (args.dryRun)
    console.log(
      `Files and _contact-sheet.jpg are in ${path.resolve(args.out)}`,
    );
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
