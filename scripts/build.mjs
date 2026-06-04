import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const projectRoot = join(repoRoot, 'libs/integrations/cursor-leadtime-plugin');
const outputRoot = join(
  repoRoot,
  'dist/libs/integrations/cursor-leadtime-plugin',
);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const entry of [
  '.cursor-plugin',
  'plugins',
  'scripts',
  'README.md',
  'LICENSE',
]) {
  await cp(join(projectRoot, entry), join(outputRoot, entry), {
    recursive: true,
    force: true,
  });
}

await writeFile(
  join(outputRoot, '.generated-from'),
  [
    'Generated from Leadtime monorepo.',
    `Source project: libs/integrations/cursor-leadtime-plugin`,
    `Generated at: ${new Date().toISOString()}`,
    '',
  ].join('\n'),
);

console.log(`Built Cursor plugin marketplace at ${outputRoot}`);
