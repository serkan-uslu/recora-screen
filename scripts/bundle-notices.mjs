import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const licenseName = /^(licen[cs]e|copying|copyright|notice|unlicense|third[_-]?party[_-]?notices?)([._-].*)?$/i;
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const sections = [];
const missing = [];

// Keep the original license contents. Never substitute an SPDX identifier for text.
async function licenseFiles(directory, declaredFile) {
  const result = new Map();
  async function scan(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name);
      if (entry.isFile() && licenseName.test(entry.name) && !/\.(rs|js|ts|json)$/i.test(entry.name)) {
        result.set(relative, await readFile(path.join(dir, entry.name), 'utf8'));
      } else if (entry.isDirectory() && /^(licenses?|licences?|legal|third[-_]?party[-_]?licenses)$/i.test(entry.name)) {
        await scan(path.join(dir, entry.name), relative);
      }
    }
  }
  await scan(directory);
  if (declaredFile) result.set(path.basename(declaredFile), await readFile(path.resolve(directory, declaredFile), 'utf8'));
  return result;
}

function section(title, details, files) {
  if (!files.size || [...files.values()].every(text => !text.trim())) {
    missing.push(title);
    return;
  }
  sections.push([
    '='.repeat(80), title, ...details.filter(Boolean), '='.repeat(80), '',
    ...[...files].sort(([a], [b]) => a.localeCompare(b)).flatMap(([name, text]) => [
      `--- ${name} ---`, text, '',
    ]),
  ].join('\n'));
}

async function npmNotices() {
  const lock = await json(path.join(root, 'package-lock.json'));
  let count = 0;
  for (const [location, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!location || info.dev) continue;
    const dir = path.join(root, location);
    let pkg;
    try { pkg = await json(path.join(dir, 'package.json')); }
    catch (error) {
      // Platform-specific optional packages not installed are not shipped.
      if (info.optional && error.code === 'ENOENT') continue;
      missing.push(`npm ${location.replace(/.*node_modules\//, '')}@${info.version} (package unavailable)`);
      continue;
    }
    count++;
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    section(`npm: ${pkg.name}@${pkg.version}`, [
      `Declared license: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? 'unspecified')}`,
      repository ? `Upstream: ${repository}` : '',
      info.resolved ? `Package source: ${info.resolved}` : '',
    ], await licenseFiles(dir));
  }
  return count;
}

async function rustNotices() {
  let cargoHome = process.env.CARGO_HOME || path.join(homedir(), '.cargo');
  try { await access(cargoHome, constants.W_OK); }
  catch { cargoHome = path.join(root, '.cache', 'cargo'); }
  const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)?.[1];
  if (!host) throw new Error('Could not determine the Rust host platform.');
  const target = process.env.CARGO_BUILD_TARGET || host;
  const metadata = JSON.parse(execFileSync('cargo', [
    'metadata', '--manifest-path', path.join(root, 'src-tauri', 'Cargo.toml'),
    '--format-version', '1', '--locked', '--filter-platform', target,
    '--features', 'custom-protocol',
  ], { env: { ...process.env, CARGO_HOME: cargoHome }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]));
  const included = new Set();
  function visit(id) {
    if (included.has(id)) return;
    included.add(id);
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (dep.dep_kinds.some(kind => kind.kind !== 'dev')) visit(dep.pkg);
    }
  }
  visit(metadata.resolve.root);
  const packages = metadata.packages.filter(pkg => included.has(pkg.id) && pkg.id !== metadata.resolve.root)
    .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
  for (const pkg of packages) {
    const dir = path.dirname(pkg.manifest_path);
    const files = await licenseFiles(dir, pkg.license_file);
    const details = [`Declared license: ${pkg.license ?? 'see license file'}`, pkg.repository ? `Upstream: ${pkg.repository}` : ''];
    if (pkg.source?.startsWith('registry+')) details.push(`Source code: https://crates.io/api/v1/crates/${pkg.name}/${pkg.version}/download`);
    const overrideDir = path.join(root, 'third-party-licenses', 'rust', `${pkg.name}@${pkg.version}`);
    let provenance;
    try { provenance = await json(path.join(overrideDir, 'SOURCE.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (provenance) {
      const vcs = await json(path.join(dir, '.cargo_vcs_info.json'));
      if (provenance.package !== pkg.name || provenance.version !== pkg.version || provenance.revision !== vcs.git.sha1) {
        throw new Error(`Upstream notice revision mismatch for ${pkg.name}@${pkg.version}`);
      }
      details.push(`Upstream revision: ${provenance.revision}`);
      for (const source of provenance.files) {
        if (path.basename(source.file) !== source.file) throw new Error('Invalid notice filename.');
        const text = await readFile(path.join(overrideDir, source.file), 'utf8');
        if (sha256(text) !== source.sha256) throw new Error(`Notice checksum mismatch for ${pkg.name}@${pkg.version}: ${source.file}`);
        files.set(source.file, text);
        details.push(`Notice source (${source.file}): ${source.url}`);
        if (source.note) details.push(source.note);
      }
    }
    section(`Rust: ${pkg.name}@${pkg.version}`, details, files);
  }
  return { count: packages.length, target };
}

async function main() {
  section('Screen Recorder', [], new Map([
    ['LICENSE', await readFile(path.join(root, 'LICENSE'), 'utf8')],
    ['THIRD_PARTY_NOTICES.md', await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8')],
  ]));
  for (const [name, file, versionFile] of [
    ['Node.js runtime and its bundled components', 'NODE-LICENSE', 'node-version'],
    ['whisper.cpp runtime', 'WHISPER-LICENSE', 'whisper-version'],
  ]) {
    section(name, [`Bundled version/revision: ${(await readFile(path.join(root, 'resources', 'bin', versionFile), 'utf8')).trim()}`],
      new Map([[file, await readFile(path.join(root, 'resources', 'bin', file), 'utf8')]]));
  }
  const npmCount = await npmNotices();
  const rust = await rustNotices();
  if (missing.length) throw new Error(`Missing license text; packaging stopped:\n${missing.map(name => `- ${name}`).join('\n')}`);
  const output = [
    'Screen Recorder — Third-party license and copyright notices',
    '',
    `Includes ${npmCount} installed production npm packages and ${rust.count} resolved Rust dependencies for ${rust.target}.`,
    'Rust dependencies include build helpers; development-only dependencies are excluded.',
    'Source code download links identify the unmodified upstream crate releases.',
    'Original notices follow. License alternatives and upstream declarations are preserved.',
    '', ...sections, '',
  ].join('\n');
  const destination = path.join(root, 'resources', 'THIRD_PARTY_NOTICES.txt');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(`${destination}.tmp`, output);
  await rename(`${destination}.tmp`, destination);
  console.log(`Bundled notices: ${npmCount} npm packages, ${rust.count} Rust dependencies; ${Buffer.byteLength(output)} bytes.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
