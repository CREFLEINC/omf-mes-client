import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.resolve(import.meta.dirname, 'resolve-image-tags.sh');
const repository = 'registry.example.com/group/front';
const revision = 'd41f261abc1234567890';

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
  assert.match(result.stderr, /Only release tag pushes/);
});

test('release tag pushes publish version, stable and immutable SHA tags', () => {
  const { result, output } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/v1.2.3',
    refName: 'v1.2.3',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(output, /front:sha-d41f261/);
  assert.match(output, /front:v1\.2\.3/);
  assert.match(output, /front:stable/);
});

test('manual runs cannot publish images', () => {
  const { result } = resolveTags({
    eventName: 'workflow_dispatch',
    ref: 'refs/heads/feature/example',
    refName: 'feature/example',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Only release tag pushes/);
});

test('non-SemVer release tags are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/v1.2',
    refName: 'v1.2',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /vMAJOR\.MINOR\.PATCH/);
});

test('prerelease tags are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/v1.2.3-rc.1',
    refName: 'v1.2.3-rc.1',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /vMAJOR\.MINOR\.PATCH/);
});

test('image repositories outside the configured registry are rejected', () => {
  const { result } = resolveTags({
    eventName: 'push',
    ref: 'refs/tags/v1.2.3',
    refName: 'v1.2.3',
    registryHost: 'other.example.com',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must belong to REGISTRY_HOST/);
});
