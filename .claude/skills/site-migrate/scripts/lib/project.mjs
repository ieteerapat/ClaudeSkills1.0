// site-migrate :: lib/project — shared resolution + IO for all harness scripts.
// Scripts live in the global skill dir; dependencies and all state live in the
// project repo (cwd). Everything here resolves from PROJECT_ROOT, never SKILL_DIR.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function projectRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export const ROOT = projectRoot();

const projectRequire = createRequire(join(ROOT, 'package.json'));

// CJS deps (sharp, playwright). For ESM-only deps use importFromProject.
export function requireFromProject(name) {
  try {
    return projectRequire(name);
  } catch (e) {
    die(3, `dependency "${name}" not installed in ${ROOT} — run: npm i -D ${name}`);
  }
}

export async function importFromProject(name) {
  let entry;
  try {
    entry = projectRequire.resolve(name);
  } catch (e) {
    die(3, `dependency "${name}" not installed in ${ROOT} — run: npm i -D ${name}`);
  }
  return import(pathToFileURL(entry).href);
}

export function readJson(path, fallback = undefined) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    die(3, `missing required file: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    die(3, `unparseable JSON: ${path} — ${e.message}`);
  }
}

export function writeJsonAtomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, path);
}

export const CONFIG_PATH = join(ROOT, 'migration.config.json');
export const MANIFEST_PATH = join(ROOT, 'migration-manifest.json');

export function readConfig() {
  return readJson(CONFIG_PATH); // dies with exit 3 if absent — run intake first
}

// exit contract: 0 ok/pass, 1 verdict-fail, 2 needs_human, 3 harness/env error
export function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

// every script prints a short stdout summary; details belong on disk
export function summary(lines) {
  for (const line of [].concat(lines).slice(0, 20)) console.log(line);
}
