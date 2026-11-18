import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { mergeSpecs } from './merge-spec.mjs';
import { format } from 'prettier';

const [source, commit] = process.argv.slice(2);
if (!source || !/^[a-f0-9]{40}$/.test(commit ?? ''))
  throw new Error('Usage: node tools/gen-release-materials.mjs <server-repository> <full-commit>');
const git = (args) =>
  execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
git(['merge-base', '--is-ancestor', commit, 'origin/main']);
const cache = path.resolve('node_modules/.cache/release-materials', commit);
mkdirSync(cache, { recursive: true });
const priority = [
  'mdm-기준정보.json',
  'logistics-01자재창고.json',
  'app-공통.json',
  'production-02생산실행.json',
  'quality-03품질.json',
  'shipment-04제품출하.json',
  'equipment-05설비툴.json',
];
const files = git(['ls-tree', '-rz', '--name-only', commit, '--', 'contracts'])
  .split('\0')
  .filter((name) => /^contracts\/[^/]+\.json$/.test(name))
  .sort((a, b) => {
    const rank = (n) => {
      const at = priority.indexOf(path.basename(n));
      return at < 0 ? priority.length : at;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
const snapshots = files.map((name) => {
  const target = path.join(cache, path.basename(name));
  writeFileSync(target, git(['show', `${commit}:${name}`]));
  return target;
});
const { document: merged } = mergeSpecs(snapshots);
const selectedPaths = [
  '/production/work-orders/{workOrderId}/material-requirements',
  '/production/work-orders/{workOrderId}:release',
  '/logistics/material-issue-requests/shortage',
];
const selected = {
  openapi: merged.openapi,
  info: merged.info,
  paths: Object.fromEntries(
    selectedPaths.map((endpoint) => {
      if (!merged.paths[endpoint]) throw new Error(`Missing pinned endpoint: ${endpoint}`);
      return [endpoint, merged.paths[endpoint]];
    }),
  ),
  components: {},
};
const seen = new Set();
const visit = (value) => {
  if (!value || typeof value !== 'object') return;
  if (value.$ref) {
    const ref = value.$ref;
    if (!ref.startsWith('#/components/')) throw new Error(`Unsupported reference: ${ref}`);
    if (!seen.has(ref)) {
      seen.add(ref);
      const [, , group, key] = ref.split('/');
      const entry = merged.components[group]?.[key];
      if (!entry) throw new Error(`Missing reference ${ref}`);
      (selected.components[group] ??= {})[key] = entry;
      visit(entry);
    }
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (typeof child === 'object') visit(child);
  }
};
visit(selected.paths);
const spec = path.join(cache, 'release-materials.json');
writeFileSync(spec, JSON.stringify(selected));
const output = 'packages/api-client/src/generated/release-materials.d.ts';
execFileSync(process.execPath, [
  'node_modules/openapi-typescript/bin/cli.js',
  spec,
  '--default-non-nullable',
  'false',
  '-o',
  output,
]);
writeFileSync(
  output,
  await format(
    `// Server contract: CREFLEINC/omf-mes-server@${commit}\n// Generated material requirements, release and shortage projection.\n${readFileSync(output, 'utf8')}`,
    { parser: 'typescript', singleQuote: true, printWidth: 100 },
  ),
);
console.log(`Generated release materials from ${commit}: ${seen.size} referenced components.`);
