import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgentPluginManifest } from '../../agent-plugin-core/scripts/validate-agent-plugin.mjs';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const projectRoot = join(
  repoRoot,
  'dist/libs/integrations/cursor-leadtime-plugin',
);
const pluginRoot = projectRoot;
const errors = [];

function fail(message) {
  errors.push(message);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    fail(`${relative(repoRoot, path)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function isStrictSemver(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function isHttpsUrl(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

const marketplace = await readJson(
  join(projectRoot, '.cursor-plugin/marketplace.json'),
);
const manifest = await readJson(join(pluginRoot, '.cursor-plugin/plugin.json'));
let portableManifest = null;
let portableMcp = null;

try {
  const portable = await validateAgentPluginManifest(pluginRoot);
  portableManifest = portable.pluginManifest;
  portableMcp = portable.mcpManifest;
  errors.push(...portable.errors);
} catch (error) {
  fail(`Agent Plugins 1.0 validation failed: ${error.message}`);
}

if (marketplace) {
  if (marketplace.name !== 'leadtime')
    fail('Marketplace name must be "leadtime".');
  if (!marketplace.owner?.name) fail('Marketplace owner.name is required.');
  const entry = marketplace.plugins?.find(
    (plugin) => plugin.name === 'leadtime',
  );
  if (!entry) fail('Marketplace must include the leadtime plugin entry.');
  if (entry?.source !== './') fail('Marketplace source must be ./.');
  if (entry?.logo !== 'assets/leadtime.png')
    fail('Marketplace plugin logo path must be assets/leadtime.png.');
}

if (manifest) {
  if (manifest.name !== 'leadtime')
    fail('Plugin manifest name must be "leadtime".');
  if (manifest.displayName !== 'Leadtime')
    fail('Plugin displayName must be "Leadtime".');
  if (!isStrictSemver(manifest.version))
    fail('Plugin manifest version must be strict semver, e.g. 0.1.0.');
  if (manifest.skills !== './skills/')
    fail('Plugin manifest skills path must be ./skills/.');
  if (manifest.mcpServers !== './mcp.cursor.json')
    fail('Plugin manifest mcpServers path must be ./mcp.cursor.json.');
  if (manifest.logo !== 'assets/leadtime.png')
    fail('Plugin manifest logo path must be assets/leadtime.png.');
  if (manifest.author?.url)
    fail('Cursor plugin author schema does not allow author.url.');
  for (const field of ['homepage', 'repository']) {
    if (manifest[field] && !isHttpsUrl(manifest[field]))
      fail(`Plugin ${field} must be an https URL.`);
  }
}

if (portableManifest) {
  if (portableManifest.name !== 'leadtime')
    fail('Portable plugin manifest name must be "leadtime".');
  if (!isStrictSemver(portableManifest.version))
    fail('Portable plugin manifest version must be strict semver.');
  if (portableManifest.version !== manifest?.version)
    fail('Portable and Cursor-native plugin versions must match.');
  if (portableManifest.repository !== manifest?.repository)
    fail('Portable and Cursor-native repositories must match.');
}

const portableLeadtimeMcp = portableMcp?.mcpServers?.leadtime;
if (portableLeadtimeMcp?.type !== 'streamable-http') {
  fail('Portable Leadtime MCP type must be streamable-http.');
}
if (portableLeadtimeMcp?.url !== 'https://leadtime.app/api/mcp') {
  fail('Portable Leadtime MCP url must be https://leadtime.app/api/mcp.');
}

try {
  await access(join(pluginRoot, 'assets/leadtime.svg'));
} catch {
  fail('Plugin source mark assets/leadtime.svg does not exist.');
}

const logoPath = join(pluginRoot, 'assets/leadtime.png');
try {
  const logoBytes = await readFile(logoPath);
  if (
    logoBytes.length < 8 ||
    logoBytes[0] !== 0x89 ||
    logoBytes[1] !== 0x50 ||
    logoBytes[2] !== 0x4e ||
    logoBytes[3] !== 0x47
  ) {
    fail('Plugin logo asset assets/leadtime.png must be a PNG file.');
  }
} catch {
  fail('Plugin logo asset assets/leadtime.png does not exist.');
}

if (!manifest?.mcpServers) {
  fail('Plugin manifest must include bundled Leadtime MCP via mcpServers.');
} else {
  const mcpPath = join(pluginRoot, manifest.mcpServers);
  try {
    await access(mcpPath);
  } catch {
    fail('Plugin manifest mcpServers file does not exist.');
  }

  const mcpConfig = await readJson(mcpPath);
  const leadtimeMcp = mcpConfig?.mcpServers?.leadtime;
  if (leadtimeMcp?.type !== 'http')
    fail('Cursor-native Leadtime MCP type must be http.');
  if (leadtimeMcp?.url !== 'https://leadtime.app/api/mcp') {
    fail('Bundled Leadtime MCP url must be https://leadtime.app/api/mcp.');
  }
  if ('oauth' in leadtimeMcp) {
    fail(
      'Bundled Leadtime MCP must not set oauth; Cursor infers OAuth from the remote MCP server.',
    );
  }
}

const skillsRoot = join(pluginRoot, 'skills');
let skillDirs = [];
try {
  skillDirs = (await readdir(skillsRoot)).sort();
} catch {
  fail('Plugin must include a skills directory.');
}

for (const dir of skillDirs) {
  const skillPath = join(skillsRoot, dir);
  if (!(await stat(skillPath)).isDirectory()) continue;

  const skillFile = join(skillPath, 'SKILL.md');
  let content = '';
  try {
    content = await readFile(skillFile, 'utf8');
  } catch {
    fail(`Skill ${dir} is missing SKILL.md.`);
    continue;
  }

  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    fail(`Skill ${dir} is missing YAML frontmatter.`);
    continue;
  }

  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter[1]
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim();
  if (name !== dir)
    fail(`Skill ${dir} frontmatter name must match folder name.`);
  if (!description) fail(`Skill ${dir} must include a description.`);
  if (content.includes('[TODO'))
    fail(`Skill ${dir} contains a TODO placeholder.`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Leadtime Cursor Agent Plugin and marketplace validation passed.');
