import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const standard = JSON.parse(await readFile('manifest.json', 'utf8'));
const lite = JSON.parse(await readFile('editions/lite/manifest.json', 'utf8'));
const standardPermissions = ['activeTab', 'scripting', 'storage', 'commands', 'contextMenus'];
const providerOrigins = [
  'https://api.openai.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.anthropic.com/*',
  'https://api.deepseek.com/*',
  'https://ai.api.cloud.yandex.net/*'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every(value => actual.includes(value));
}

assert(standard.manifest_version === 3 && lite.manifest_version === 3, 'Both editions must use Manifest V3.');
assert(sameMembers(standard.permissions, standardPermissions), 'Standard permissions changed; review before adding any new permission.');
assert(sameMembers(lite.permissions, standardPermissions), 'Lite permissions changed; review before adding any new permission.');
assert(sameMembers(standard.optional_host_permissions, providerOrigins), 'Standard optional host permissions changed; review them.');
assert(!lite.optional_host_permissions, 'Lite must not request provider host permissions.');
assert(standard.commands?.['ask-hint'] && lite.commands?.['ask-hint'], 'Both editions need the ask shortcut.');

const liteBackground = await readFile('editions/lite/background-lite.js', 'utf8');
assert(!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.deepseek\.com|ai\.api\.cloud\.yandex\.net|\bfetch\s*\(/i.test(liteBackground), 'Lite background must remain cloud-free.');

async function collectJs(directory = '.') {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', 'dist', 'node_modules'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectJs(path));
    else if (entry.isFile() && path.endsWith('.js')) found.push(path);
  }
  return found;
}

for (const path of await collectJs()) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert(result.status === 0, `JavaScript syntax failed in ${relative('.', path)}: ${result.stderr || result.stdout}`);
}

console.log(`Validated both manifests, permission allowlists, Lite network isolation, and ${ (await collectJs()).length } JavaScript files.`);
