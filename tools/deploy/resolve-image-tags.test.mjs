import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.resolve(import.meta.dirname, 'resolve-image-tags.sh');
const workflow = readFileSync(
  path.resolve(import.meta.dirname, '../../.github/workflows/front-image.yml'),
  'utf8',
);
const repository = 'registry.example.com/group/front';
const revision = 'd41f261abc1234567890';

test('front image workflow subscribes only to web release tags', () => {
  const tagPatterns = workflow.match(/tags:\n((?:\s+- .+\n)+)/)?.[1]?.trim();

  assert.equal(tagPatterns, "- 'web-v*.*.*'");
});

test('front image workflow treats cache export failures as non-fatal', () => {
  assert.match(workflow, /cache-to: type=gha,mode=max,ignore-error=true/);
});

function resolveTags({ eventName, ref, refName, registryHost = 'registry.example.com' }) {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), 'omf-front-tags-'));
  const output = path.join(outputDirectory, 'github-output');
  const result = spawnSync(script, [], {
    encoding: 'utf8',
    env: {
      ...process.env,
      IMAGE_REPOSITORY: repository,
      REGISTRY_HOST: registryHost,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_REF: ref,
      GITHUB_REF_NAME: refName,
      GITHUB_SHA: revision,
      GITHUB_OUTPUT: output,
    },
  });
  return {
    result,
    output: result.status === 0 ? readFileSync(output, 'utf8') : '',
  };
}

test('main pushes cannot publish images', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/heads/main',
    refName: 'main',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Only web release tag pushes/);
});

test('web release tag pushes publish version, stable and immutable SHA tags', () => {
  const { result, output } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/web-v1.2.3',
    refName: 'web-v1.2.3',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(output, /front:sha-d41f261/);
  assert.match(output, /front:web-v1\.2\.3/);
  assert.match(output, /front:stable/);
});

test('manual runs cannot publish images', () => {
  const { result } = resolveTags({
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/feature/example',
    refName: 'feature/example',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Only web release tag pushes/);
});

test('non-SemVer release tags are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/web-v1.2',
    refName: 'web-v1.2',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /web-vMAJOR\.MINOR\.PATCH/);
});

test('prerelease tags are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/web-v1.2.3-rc.1',
    refName: 'web-v1.2.3-rc.1',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /web-vMAJOR\.MINOR\.PATCH/);
});

test('other platform and legacy unprefixed release tags are rejected', () => {
  for (const refName of ['mobile-v1.2.3', 'desktop-v1.2.3', 'v1.2.3']) {
    const { result } = resolveTags({
      eventName: 'push',
      ref: `refs/tags/${refName}`,
      refName,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /web-vMAJOR\.MINOR\.PATCH/);
  }
});

test('image repositories outside the configured registry are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/web-v1.2.3',
    refName: 'web-v1.2.3',
    registryHost: 'other.example.com',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must belong to REGISTRY_HOST/);
});
