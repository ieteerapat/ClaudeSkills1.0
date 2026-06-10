// Tests for manifest.mjs — drives the CLI as a subprocess against a fresh
// temp project dir (with .git/ so projectRoot resolves there) per test.
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../manifest.mjs', import.meta.url));
const pexec = promisify(execFile);

function run(cwd, ...args) {
  return pexec(process.execPath, [SCRIPT, ...args], { cwd });
}

async function runFail(cwd, ...args) {
  let err;
  try { await run(cwd, ...args); } catch (e) { err = e; }
  expect(err, `expected nonzero exit for: ${args.join(' ')}`).toBeTruthy();
  return err;
}

function row(id, overrides = {}) {
  return {
    id, locale: 'en',
    source_url: `https://old.example.com/${id}`,
    source_path: `/${id}`,
    target_path: `/app/${id}/page.tsx`,
    type: 'page', title: null, status: 'pending', attempts: 0,
    claimed_by: null, claimed_at: null, captured_at: null, built_at: null,
    compared_at: null, last_build_touch: null,
    shared_deps: [], notes: [], gaps: [],
    ...overrides,
  };
}

function makeProject(pages, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'site-migrate-test-'));
  mkdirSync(join(dir, '.git'));
  writeFileSync(join(dir, 'migration.config.json'),
    JSON.stringify({ attempt_cap: 2, ...config }, null, 2));
  writeFileSync(join(dir, 'migration-manifest.json'), JSON.stringify({
    version: 1,
    generated_at: '2026-06-01T00:00:00.000Z',
    source_url: 'https://old.example.com',
    pages,
  }, null, 2));
  return dir;
}

function readManifest(dir) {
  return JSON.parse(readFileSync(join(dir, 'migration-manifest.json'), 'utf8'));
}

function writeReport(dir, id, report) {
  mkdirSync(join(dir, 'reports', id), { recursive: true });
  writeFileSync(join(dir, 'reports', id, 'parity-report.json'), JSON.stringify(report));
}

describe('status', () => {
  it('counts rows by status and totals', async () => {
    const dir = makeProject([
      row('a'), row('b'),
      row('c', { status: 'built' }),
      row('d', { status: 'needs_human' }),
    ]);
    const { stdout } = await run(dir, 'status', '--json');
    const out = JSON.parse(stdout);
    expect(out.total).toBe(4);
    expect(out.counts.pending).toBe(2);
    expect(out.counts.built).toBe(1);
    expect(out.counts.needs_human).toBe(1);
    expect(out.hint).toContain('needs_human');
  });

  it('hints to run the pilot when all rows are pending', async () => {
    const dir = makeProject([row('a'), row('b')]);
    const { stdout } = await run(dir, 'status', '--json');
    expect(JSON.parse(stdout).hint).toBe('all pending → run pilot');
  });
});

describe('next', () => {
  it('returns pilot pages first, then by id', async () => {
    const dir = makeProject(
      [row('apple'), row('banana'), row('zebra')],
      { pilot_pages: ['zebra'] },
    );
    const first = JSON.parse((await run(dir, 'next', '--json')).stdout);
    expect(first.id).toBe('zebra');

    await run(dir, 'claim', 'zebra', '--by', 'agent-1');
    const second = JSON.parse((await run(dir, 'next', '--json')).stdout);
    expect(second.id).toBe('apple');
  });

  it('skips failed rows at the attempt cap', async () => {
    const dir = makeProject([
      row('a', { status: 'failed', attempts: 2 }), // cap is 2 → not claimable
      row('b', { status: 'failed', attempts: 1 }),
    ]);
    const next = JSON.parse((await run(dir, 'next', '--json')).stdout);
    expect(next.id).toBe('b');
  });
});

describe('claim', () => {
  it('is atomic: two concurrent claims — exactly one wins', async () => {
    const dir = makeProject([row('p1')]);
    const results = await Promise.allSettled([
      run(dir, 'claim', 'p1', '--by', 'agent-1'),
      run(dir, 'claim', 'p1', '--by', 'agent-2'),
    ]);
    const wins = results.filter((r) => r.status === 'fulfilled');
    const losses = results.filter((r) => r.status === 'rejected');
    expect(wins.length).toBe(1);
    expect(losses.length).toBe(1);
    expect(losses[0].reason.code).toBe(3);

    const m = readManifest(dir);
    expect(m.pages[0].status).toBe('claimed');
    expect(['agent-1', 'agent-2']).toContain(m.pages[0].claimed_by);
    expect(m.pages[0].claimed_at).toBeTruthy();
    expect(existsSync(join(dir, 'migration-manifest.json.lock'))).toBe(false);
  });

  it('rejects claiming a non-claimable row', async () => {
    const dir = makeProject([row('p1', { status: 'built' })]);
    const err = await runFail(dir, 'claim', 'p1', '--by', 'agent-1');
    expect(err.code).toBe(3);
  });
});

describe('set status', () => {
  it('rejects illegal transitions', async () => {
    const dir = makeProject([row('p1')]); // pending
    const err = await runFail(dir, 'set', 'p1', 'status', 'built');
    expect(err.code).toBe(3);
    expect(err.stderr).toContain('illegal transition');
    expect(readManifest(dir).pages[0].status).toBe('pending');
  });

  it('refuses parity_passed without a parity report', async () => {
    const dir = makeProject([row('p1', { status: 'built' })]);
    const err = await runFail(dir, 'set', 'p1', 'status', 'parity_passed');
    expect(err.code).toBe(3);
    expect(err.stderr).toContain('REFUSED');
    expect(readManifest(dir).pages[0].status).toBe('built');
  });

  it('refuses parity_passed when the report is stale (compared_at <= last_build_touch)', async () => {
    const dir = makeProject([row('p1', {
      status: 'built',
      last_build_touch: '2026-06-05T12:00:00.000Z',
    })]);
    writeReport(dir, 'p1', { verdict: 'pass', compared_at: '2026-06-05T11:00:00.000Z' });
    const err = await runFail(dir, 'set', 'p1', 'status', 'parity_passed');
    expect(err.code).toBe(3);
    expect(err.stderr).toContain('REFUSED');
    expect(readManifest(dir).pages[0].status).toBe('built');
  });

  it('refuses parity_passed when the report verdict is not pass', async () => {
    const dir = makeProject([row('p1', { status: 'built' })]);
    writeReport(dir, 'p1', { verdict: 'fail', compared_at: '2026-06-05T12:00:00.000Z' });
    const err = await runFail(dir, 'set', 'p1', 'status', 'parity_passed');
    expect(err.code).toBe(3);
  });

  it('accepts parity_passed with a fresh passing report', async () => {
    const dir = makeProject([row('p1', {
      status: 'built',
      last_build_touch: '2026-06-05T11:00:00.000Z',
    })]);
    writeReport(dir, 'p1', { verdict: 'pass', compared_at: '2026-06-05T12:00:00.000Z' });
    await run(dir, 'set', 'p1', 'status', 'parity_passed');
    expect(readManifest(dir).pages[0].status).toBe('parity_passed');
  });

  it('failed increments attempts', async () => {
    const dir = makeProject([row('p1', { status: 'built', attempts: 0 })]);
    await run(dir, 'set', 'p1', 'status', 'failed');
    const r = readManifest(dir).pages[0];
    expect(r.status).toBe('failed');
    expect(r.attempts).toBe(1);
  });

  it('flips to needs_human at the attempt cap', async () => {
    const dir = makeProject([row('p1', { status: 'built', attempts: 1 })]); // cap 2
    const { stdout } = await run(dir, 'set', 'p1', 'status', 'failed');
    expect(stdout).toContain('needs_human');
    const r = readManifest(dir).pages[0];
    expect(r.status).toBe('needs_human');
    expect(r.attempts).toBe(2);
  });

  it('appends timestamped notes and sets whitelisted fields', async () => {
    const dir = makeProject([row('p1')]);
    await run(dir, 'set', 'p1', 'note', 'hello world');
    await run(dir, 'set', 'p1', 'shared_deps', '["components/Header.tsx"]');
    const r = readManifest(dir).pages[0];
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toContain('hello world');
    expect(r.shared_deps).toEqual(['components/Header.tsx']);
    const err = await runFail(dir, 'set', 'p1', 'attempts', '99'); // not settable
    expect(err.code).toBe(3);
  });
});

describe('add-rows', () => {
  it('appends valid rows and rejects duplicate ids', async () => {
    const dir = makeProject([row('a')]);
    const file = join(dir, 'new-rows.json');
    writeFileSync(file, JSON.stringify([
      { id: 'b', locale: 'en', source_url: 'https://old.example.com/b', source_path: '/b', target_path: '/app/b/page.tsx', type: 'post' },
    ]));
    await run(dir, 'add-rows', '--file', file);
    const m = readManifest(dir);
    expect(m.pages).toHaveLength(2);
    expect(m.pages[1]).toMatchObject({ id: 'b', status: 'pending', attempts: 0, notes: [] });

    writeFileSync(file, JSON.stringify([
      { id: 'a', locale: 'en', source_url: 'x', source_path: '/a', target_path: '/a', type: 'page' },
    ]));
    const err = await runFail(dir, 'add-rows', '--file', file);
    expect(err.code).toBe(3);
    expect(err.stderr).toContain('duplicate');
    expect(readManifest(dir).pages).toHaveLength(2);
  });
});

describe('mark-stale', () => {
  it('flips parity_passed rows whose shared_deps intersect the touched paths', async () => {
    const dir = makeProject([
      row('a', { status: 'parity_passed', shared_deps: ['components/Header.tsx', 'lib/seo.ts'] }),
      row('b', { status: 'parity_passed', shared_deps: ['lib/util.ts'] }),
      row('c', { status: 'pending', shared_deps: ['components/Header.tsx'] }),
    ]);
    const { stdout } = await run(dir, 'mark-stale', '--touching', 'components/Header.tsx,components/Footer.tsx');
    expect(stdout).toContain('a');
    const m = readManifest(dir);
    expect(m.pages.find((p) => p.id === 'a').status).toBe('needs_reverify');
    expect(m.pages.find((p) => p.id === 'b').status).toBe('parity_passed');
    expect(m.pages.find((p) => p.id === 'c').status).toBe('pending');
  });
});

describe('estimate', () => {
  it('exits 3 when no parity_passed rows exist', async () => {
    const dir = makeProject([row('a'), row('b')]);
    const err = await runFail(dir, 'estimate');
    expect(err.code).toBe(3);
    expect(err.stderr).toContain('no parity_passed');
  });

  it('projects per-type averages over remaining rows', async () => {
    const dir = makeProject([
      // two parity_passed "page" samples: 100s and 200s wall clock, attempts 1 and 3
      row('p1', {
        status: 'parity_passed', attempts: 1,
        claimed_at: '2026-06-05T10:00:00.000Z', compared_at: '2026-06-05T10:01:40.000Z',
      }),
      row('p2', {
        status: 'parity_passed', attempts: 3,
        claimed_at: '2026-06-05T11:00:00.000Z', compared_at: '2026-06-05T11:03:20.000Z',
      }),
      row('p3'), row('p4'), // 2 remaining pages
      row('q1', { type: 'post' }), // no samples for "post"
    ]);
    const { stdout } = await run(dir, 'estimate', '--json');
    const est = JSON.parse(stdout);
    const page = est.types.find((t) => t.type === 'page');
    expect(page.samples).toBe(2);
    expect(page.avg_attempts).toBe(2);
    expect(page.avg_secs).toBe(150);
    expect(page.remaining).toBe(2);
    expect(page.projected_secs).toBe(300);
    const post = est.types.find((t) => t.type === 'post');
    expect(post.samples).toBe(0);
    expect(post.remaining).toBe(1);
    expect(est.total_projected_secs).toBe(300);
  });
});
