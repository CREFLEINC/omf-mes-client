import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const deployScript = path.join(repositoryRoot, 'deploy/install-deploy.sh');

function testEnvironment({ healthy = true, pullFails = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omf-front-deploy-'));
  const installDirectory = path.join(root, 'install');
  const binaryDirectory = path.join(root, 'bin');
  const dockerLog = path.join(root, 'docker.log');
  mkdirSync(binaryDirectory);

  const docker = path.join(binaryDirectory, 'docker');
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"\${DOCKER_LOG}"
if [[ "\${DOCKER_PULL_FAIL:-0}" == '1' && "\${*: -1}" == 'pull' ]]; then exit 1; fi
exit 0
`,
  );
  chmodSync(docker, 0o755);

  const curl = path.join(binaryDirectory, 'curl');
  writeFileSync(
    curl,
    healthy ? "#!/usr/bin/env bash\nprintf 'ok\\n'\n" : '#!/usr/bin/env bash\nexit 1\n',
  );
  chmodSync(curl, 0o755);

  return {
    root,
    installDirectory,
    dockerLog,
    env: {
      ...process.env,
      PATH: `${binaryDirectory}:${process.env.PATH ?? ''}`,
      DOCKER_LOG: dockerLog,
      DOCKER_PULL_FAIL: pullFails ? '1' : '0',
      HEALTHCHECK_ATTEMPTS: '1',
      HEALTHCHECK_INTERVAL_SECONDS: '0',
    },
  };
}

function runDeploy(environment, overrides = []) {
  const result = spawnSync(
    deployScript,
    [
      '--non-interactive',
      '--version',
      'v1.2.3',
      '--bind-ip',
      '10.0.0.20',
      '--port',
      '8080',
      '--api-upstream',
      'http://10.0.0.30:3100',
      '--image-repository',
      'registry.example.com/group/front',
      '--install-dir',
      environment.installDirectory,
      ...overrides,
    ],
    { encoding: 'utf8', env: environment.env },
  );
  return {
    envFile: path.join(environment.installDirectory, '.env'),
    composeFile: path.join(environment.installDirectory, 'compose.yaml'),
    result,
  };
}

test('a single script configures, starts, and health-checks the selected release', () => {
  const environment = testEnvironment();
  const { envFile, composeFile, result } = runDeploy(environment);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(envFile, 'utf8'),
    [
      'FRONT_BIND_IP=10.0.0.20',
      'FRONT_PORT=8080',
      'API_UPSTREAM=http://10.0.0.30:3100',
      'IMAGE_REPOSITORY=registry.example.com/group/front',
      'IMAGE_TAG=v1.2.3',
      '',
    ].join('\n'),
  );
  assert.match(readFileSync(composeFile, 'utf8'), /IMAGE_REPOSITORY/);
  assert.equal(statSync(envFile).mode & 0o777, 0o600);

  const dockerCalls = readFileSync(environment.dockerLog, 'utf8');
  assert.match(dockerCalls, /config --quiet/);
  assert.match(dockerCalls, /pull/);
  assert.match(dockerCalls, /up -d --remove-orphans/);
  assert.match(dockerCalls, /ps/);
  assert.match(result.stdout, /배포가 완료되었습니다/);
});

test('interactive deployment accepts version and environment values in prompt order', () => {
  const environment = testEnvironment();
  const result = spawnSync(deployScript, ['--install-dir', environment.installDirectory], {
    encoding: 'utf8',
    env: environment.env,
    input: [
      'v2.0.1',
      '10.0.0.20',
      '8080',
      'http://10.0.0.30:3100',
      'registry.example.com/group/front',
      '',
    ].join('\n'),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    readFileSync(path.join(environment.installDirectory, '.env'), 'utf8'),
    /IMAGE_TAG=v2\.0\.1/,
  );
});

test('non-release image versions are rejected', () => {
  const environment = testEnvironment();
  const { result } = runDeploy(environment, ['--version', 'stable']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /vMAJOR\.MINOR\.PATCH/);
});

test('invalid ports fail before deployment files are installed', () => {
  const environment = testEnvironment();
  const { result } = runDeploy(environment, ['--port', '70000']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /1~65535/);
});

test('API upstream paths are rejected to prevent duplicated API prefixes', () => {
  const environment = testEnvironment();
  const { result } = runDeploy(environment, ['--api-upstream', 'http://10.0.0.30:3100/api']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /경로 없는 http\(s\) URL/);
});

test('failed image pulls preserve the previously installed configuration', () => {
  const environment = testEnvironment({ pullFails: true });
  mkdirSync(environment.installDirectory);
  const existingEnv = path.join(environment.installDirectory, '.env');
  writeFileSync(existingEnv, 'IMAGE_TAG=v1.0.0\n');

  const { result } = runDeploy(environment);

  assert.equal(result.status, 1);
  assert.equal(readFileSync(existingEnv, 'utf8'), 'IMAGE_TAG=v1.0.0\n');
});

test('an unhealthy service fails deployment and prints diagnostic commands', () => {
  const environment = testEnvironment({ healthy: false });
  const { result } = runDeploy(environment);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /헬스 체크에 실패/);
  const dockerCalls = readFileSync(environment.dockerLog, 'utf8');
  assert.match(dockerCalls, /ps/);
  assert.match(dockerCalls, /logs --tail=100 front/);
});
