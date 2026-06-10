#!/usr/bin/env node
// site-migrate :: manifest — state-machine CLI; everything reads/writes through it.
// Contract: ../references/implementation-plan.md § CLI contracts
import { existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, readJson, writeJsonAtomic, MANIFEST_PATH, CONFIG_PATH, die, summary,
} from './lib/project.mjs';

const STATUSES = [
  'pending', 'claimed', 'in_progress', 'built', 'parity_passed',
  'failed', 'needs_human', 'needs_reverify',
];

// Legal transitions. anything → needs_human is allowed separately.
const TRANSITIONS = {
  pending: ['claimed'],
  claimed: ['in_progress'],
  in_progress: ['built'],
  built: ['parity_passed', 'failed'],
  failed: ['claimed'],
  parity_passed: ['needs_reverify'],
  needs_reverify: ['claimed'],
  needs_human: [],
};

const SETTABLE_FIELDS = [
  'title', 'target_path', 'last_build_touch', 'built_at', 'captured_at',
  'compared_at', 'gaps', 'shared_deps',
];
const DATE_FIELDS = ['last_build_touch', 'built_at', 'captured_at', 'compared_at'];

const REQUIRED_ROW_FIELDS = ['id', 'locale', 'source_url', 'source_path', 'target_path', 'type'];
const ROW_DEFAULTS = {
  title: null, status: 'pending', attempts: 0, claimed_by: null, claimed_at: null,
  captured_at: null, built_at: null, compared_at: null, last_build_touch: null,
  shared_deps: [], notes: [], gaps: [],
};

const now = () => new Date().toISOString();

function readConfigLoose() {
  return readJson(CONFIG_PATH, {});
}

function attemptCap(config = readConfigLoose()) {
  return Number.isFinite(config.attempt_cap) ? config.attempt_cap : 3;
}

function loadManifest() {
  return readJson(MANIFEST_PATH); // dies if absent — run seed first
}

function findRow(manifest, id) {
  const row = manifest.pages.find((p) => p.id === id);
  if (!row) die(3, `no row with id "${id}" in ${MANIFEST_PATH}`);
  return row;
}

function isClaimable(row, cap) {
  if (row.status === 'pending' || row.status === 'needs_reverify') return true;
  if (row.status === 'failed' && row.attempts < cap) return true;
  return false;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Exclusive lockfile so concurrent mutations can't double-assign. Cleanup is
// also registered on process 'exit' because die() uses process.exit (finally
// blocks don't run on exit, exit handlers do).
function withLock(fn) {
  const lockPath = MANIFEST_PATH + '.lock';
  let fd = null;
  const deadline = Date.now() + 2000;
  for (;;) {
    try { fd = openSync(lockPath, 'wx'); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() > deadline) die(3, `manifest lock busy: ${lockPath} — another agent is writing; retry`);
      sleepSync(15);
    }
  }
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try { closeSync(fd); } catch {}
    try { unlinkSync(lockPath); } catch {}
  };
  process.once('exit', cleanup);
  try { return fn(); } finally { cleanup(); }
}

function parseArgs(args) {
  const flags = {}; const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') flags.json = true;
    else if (a.startsWith('--')) {
      const v = args[i + 1];
      if (v === undefined) die(3, `flag ${a} requires a value`);
      flags[a.slice(2)] = v; i++;
    } else pos.push(a);
  }
  return { flags, pos };
}

function claimableSorted(manifest, config) {
  const cap = attemptCap(config);
  const pilot = Array.isArray(config.pilot_pages) ? config.pilot_pages : [];
  return manifest.pages
    .filter((p) => isClaimable(p, cap))
    .sort((a, b) => {
      const pa = pilot.includes(a.id) ? 0 : 1;
      const pb = pilot.includes(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

// ---- estimate math (shared by `status` and `estimate`) ----
function round2(n) { return n === null ? null : Math.round(n * 100) / 100; }

function computeEstimates(manifest) {
  const passed = manifest.pages.filter((p) => p.status === 'parity_passed');
  if (passed.length === 0) return null;
  const types = [...new Set(manifest.pages.map((p) => p.type))].sort();
  const perType = [];
  let total = 0;
  for (const type of types) {
    const samples = passed.filter((p) => p.type === type);
    const remaining = manifest.pages.filter((p) => p.type === type && p.status !== 'parity_passed').length;
    if (samples.length === 0) {
      perType.push({ type, samples: 0, remaining });
      continue;
    }
    const avgAttempts = samples.reduce((s, p) => s + (p.attempts || 0), 0) / samples.length;
    const timed = samples.filter((p) => p.claimed_at && p.compared_at);
    const avgSecs = timed.length
      ? timed.reduce((s, p) => s + (Date.parse(p.compared_at) - Date.parse(p.claimed_at)) / 1000, 0) / timed.length
      : null;
    const projectedSecs = avgSecs === null ? null : avgSecs * remaining;
    if (projectedSecs !== null) total += projectedSecs;
    perType.push({
      type, samples: samples.length, remaining,
      avg_attempts: round2(avgAttempts), avg_secs: round2(avgSecs),
      projected_secs: round2(projectedSecs),
    });
  }
  return { types: perType, total_projected_secs: round2(total) };
}

// ---- subcommands ----
function cmdStatus(flags) {
  const manifest = loadManifest();
  const counts = {};
  for (const s of STATUSES) counts[s] = 0;
  for (const p of manifest.pages) counts[p.status] = (counts[p.status] || 0) + 1;
  const total = manifest.pages.length;
  let hint;
  if (total === 0) hint = 'manifest empty → run seed';
  else if (counts.pending === total) hint = 'all pending → run pilot';
  else if (counts.needs_human > 0) hint = `${counts.needs_human} needs_human → human review required`;
  else if (counts.parity_passed === total) hint = 'all parity_passed → migration complete';
  else hint = `${counts.parity_passed}/${total} parity_passed → continue loop`;
  const estimates = computeEstimates(manifest);
  if (flags.json) {
    console.log(JSON.stringify({ counts, total, hint, estimates }, null, 2));
    return;
  }
  const lines = [`total: ${total}`];
  for (const s of STATUSES) if (counts[s] > 0) lines.push(`  ${s}: ${counts[s]}`);
  lines.push(`hint: ${hint}`);
  if (estimates) {
    for (const t of estimates.types) {
      lines.push(t.samples === 0
        ? `est ${t.type}: no pilot data (${t.remaining} remaining)`
        : `est ${t.type}: avg ${t.avg_secs}s × ${t.remaining} remaining ≈ ${t.projected_secs}s (avg attempts ${t.avg_attempts})`);
    }
    lines.push(`est total: ≈ ${estimates.total_projected_secs}s`);
  }
  summary(lines);
}

function cmdNext(flags) {
  const manifest = loadManifest();
  const config = readConfigLoose();
  const [next] = claimableSorted(manifest, config);
  if (!next) { console.log('no claimable rows'); return; }
  if (flags.json) console.log(JSON.stringify(next, null, 2));
  else summary([`${next.id}\t${next.status}\t${next.type}\t${next.target_path}\tattempts=${next.attempts}`]);
}

function cmdGet(id) {
  if (!id) die(3, 'usage: manifest.mjs get <id>');
  const row = findRow(loadManifest(), id);
  console.log(JSON.stringify(row, null, 2));
}

function cmdClaim(id, flags) {
  if (!id || !flags.by) die(3, 'usage: manifest.mjs claim <id> --by <agent>');
  withLock(() => {
    const manifest = loadManifest(); // re-read under lock
    const row = findRow(manifest, id);
    const cap = attemptCap();
    if (row.status === 'claimed' || row.status === 'in_progress') {
      die(3, `cannot claim ${id}: already claimed by ${row.claimed_by} (status ${row.status})`);
    }
    if (!isClaimable(row, cap)) {
      die(3, `cannot claim ${id}: status ${row.status} (attempts ${row.attempts}/${cap}) is not claimable`);
    }
    row.status = 'claimed';
    row.claimed_by = flags.by;
    row.claimed_at = now();
    writeJsonAtomic(MANIFEST_PATH, manifest);
    summary([`claimed ${id} by ${flags.by} at ${row.claimed_at}`]);
  });
}

function assertTransition(from, to, id) {
  if (to === 'needs_human') return; // anything → needs_human
  if (!STATUSES.includes(to)) die(3, `unknown status "${to}"`);
  if (!(TRANSITIONS[from] || []).includes(to)) {
    die(3, `illegal transition for ${id}: ${from} → ${to}`);
  }
}

function gateParityPassed(row) {
  const reportPath = join(ROOT, 'reports', row.id, 'parity-report.json');
  if (!existsSync(reportPath)) {
    die(3, `REFUSED: parity_passed for ${row.id} requires ${reportPath} — run compare.mjs; do NOT set this status by hand`);
  }
  const report = readJson(reportPath);
  if (report.verdict !== 'pass') {
    die(3, `REFUSED: parity_passed for ${row.id} — report verdict is "${report.verdict}", not "pass"`);
  }
  const cmp = Date.parse(report.compared_at ?? '');
  const touch = row.last_build_touch ? Date.parse(row.last_build_touch) : 0;
  if (!(cmp > touch)) {
    die(3, `REFUSED: parity_passed for ${row.id} — report compared_at (${report.compared_at}) is not newer than last_build_touch (${row.last_build_touch}); re-run compare.mjs`);
  }
  return report;
}

function cmdSet(id, field, value) {
  if (!id || !field || value === undefined) die(3, 'usage: manifest.mjs set <id> <field> <value>');
  withLock(() => {
    const manifest = loadManifest();
    const row = findRow(manifest, id);
    const lines = [];

    if (field === 'status') {
      assertTransition(row.status, value, id);
      if (value === 'parity_passed') {
        const report = gateParityPassed(row);
        row.status = 'parity_passed';
        row.compared_at = report.compared_at;
        lines.push(`${id}: status → parity_passed (report verdict pass, compared_at ${report.compared_at})`);
      } else if (value === 'failed') {
        row.attempts += 1;
        const cap = attemptCap();
        if (row.attempts >= cap) {
          row.status = 'needs_human';
          lines.push(`${id}: attempt cap reached (${row.attempts}/${cap}) → needs_human instead of failed`);
        } else {
          row.status = 'failed';
          lines.push(`${id}: status → failed (attempts ${row.attempts}/${cap})`);
        }
      } else {
        row.status = value;
        lines.push(`${id}: status → ${value}`);
      }
    } else if (field === 'note') {
      row.notes.push(`${now()} ${value}`);
      lines.push(`${id}: note appended (${row.notes.length} total)`);
    } else if (SETTABLE_FIELDS.includes(field)) {
      if (field === 'gaps' || field === 'shared_deps') {
        let parsed;
        try { parsed = JSON.parse(value); } catch (e) { die(3, `${field} must be a JSON array: ${e.message}`); }
        if (!Array.isArray(parsed)) die(3, `${field} must be a JSON array`);
        row[field] = parsed;
      } else if (DATE_FIELDS.includes(field)) {
        if (Number.isNaN(Date.parse(value))) die(3, `${field} must be an ISO date, got "${value}"`);
        row[field] = value;
      } else {
        row[field] = value;
      }
      lines.push(`${id}: ${field} set`);
    } else {
      die(3, `field "${field}" is not settable (allowed: status, note, ${SETTABLE_FIELDS.join(', ')})`);
    }

    writeJsonAtomic(MANIFEST_PATH, manifest);
    summary(lines);
  });
}

function cmdAddRows(flags) {
  if (!flags.file) die(3, 'usage: manifest.mjs add-rows --file <json>');
  const input = readJson(flags.file);
  const rows = Array.isArray(input) ? input : input.pages;
  if (!Array.isArray(rows)) die(3, `${flags.file} must be a JSON array of rows (or {pages:[...]})`);
  withLock(() => {
    const config = readConfigLoose();
    const manifest = readJson(MANIFEST_PATH, {
      version: 1, generated_at: now(), source_url: config.source_url ?? null, pages: [],
    });
    const seen = new Set(manifest.pages.map((p) => p.id));
    const added = [];
    for (const raw of rows) {
      for (const f of REQUIRED_ROW_FIELDS) {
        if (typeof raw[f] !== 'string' || raw[f] === '') {
          die(3, `invalid row ${JSON.stringify(raw.id ?? raw)}: missing/invalid field "${f}"`);
        }
      }
      if (seen.has(raw.id)) die(3, `duplicate id "${raw.id}" — refusing to add any rows`);
      seen.add(raw.id);
      const row = { ...ROW_DEFAULTS, ...raw };
      if (!STATUSES.includes(row.status)) die(3, `invalid row ${raw.id}: unknown status "${row.status}"`);
      added.push(row);
    }
    manifest.pages.push(...added);
    writeJsonAtomic(MANIFEST_PATH, manifest);
    summary([`added ${added.length} rows (total ${manifest.pages.length})`]);
  });
}

function cmdMarkStale(flags) {
  if (!flags.touching) die(3, 'usage: manifest.mjs mark-stale --touching <comma-separated-paths>');
  const paths = flags.touching.split(',').map((s) => s.trim()).filter(Boolean);
  withLock(() => {
    const manifest = loadManifest();
    const flipped = [];
    for (const row of manifest.pages) {
      if (row.status !== 'parity_passed') continue;
      if ((row.shared_deps || []).some((d) => paths.includes(d))) {
        row.status = 'needs_reverify';
        flipped.push(row.id);
      }
    }
    if (flipped.length) writeJsonAtomic(MANIFEST_PATH, manifest);
    summary([
      `marked ${flipped.length} rows needs_reverify`,
      ...flipped.map((id) => `  ${id}`),
    ]);
  });
}

function cmdEstimate(flags) {
  const manifest = loadManifest();
  const est = computeEstimates(manifest);
  if (!est) die(3, 'no parity_passed rows yet — run the pilot first, then estimate');
  if (flags.json) { console.log(JSON.stringify(est, null, 2)); return; }
  const lines = [];
  for (const t of est.types) {
    lines.push(t.samples === 0
      ? `${t.type}: no pilot data (${t.remaining} remaining)`
      : `${t.type}: ${t.samples} samples, avg ${t.avg_secs}s, avg attempts ${t.avg_attempts}, ${t.remaining} remaining → ≈ ${t.projected_secs}s`);
  }
  lines.push(`total: ≈ ${est.total_projected_secs}s`);
  summary(lines);
}

// ---- dispatch ----
const [cmd, ...rest] = process.argv.slice(2);
const { flags, pos } = parseArgs(rest);

switch (cmd) {
  case 'status': cmdStatus(flags); break;
  case 'next': cmdNext(flags); break;
  case 'get': cmdGet(pos[0]); break;
  case 'claim': cmdClaim(pos[0], flags); break;
  case 'set': cmdSet(pos[0], pos[1], pos[2]); break;
  case 'add-rows': cmdAddRows(flags); break;
  case 'mark-stale': cmdMarkStale(flags); break;
  case 'estimate': cmdEstimate(flags); break;
  default:
    die(3, 'usage: manifest.mjs <status|next|get|claim|set|add-rows|mark-stale|estimate> [...]');
}
