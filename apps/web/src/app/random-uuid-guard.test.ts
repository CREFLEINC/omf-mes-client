import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 런타임 코드가 **`crypto.randomUUID` 를 직접 부르지 않는지** 잰다(#1034 · #1066).
 *
 * ⭐ **왜 파일을 읽어 재는가.** 그 함수는 보안 컨텍스트(HTTPS · localhost)에만 있는데 시험
 * 환경은 언제나 그것을 갖고 있어, **행동 시험은 이 결함을 보지 못한다.** 평문 HTTP 배포본에서만
 * 누르는 자리가 동기적으로 던지고 요청도 실패 알림도 남지 않는다. #1034 는 로그인만 고쳤고,
 * 같은 호출이 30여 곳 남아 로그아웃과 마스터 저장이 그대로 죽었다 — 부분 수정 뒤에 막아 주는
 * 감지기가 없었다.
 *
 * 대신 쓸 것: 서버로 가는 멱등 키는 `createIdempotencyKey()`(`@omf-mes/api-client`), 화면 안에서만
 * 쓰는 초안·목록 키는 `createLocalKey()`(`patterns/local-key`).
 *
 * ⛔ **주석을 걷어내고 잰다.** 이 저장소의 주석은 금지된 호출을 그대로 인용한다(이 파일도 그렇다).
 *
 * ⭐ **호출 형태가 아니라 이름을 찾는다.** `const { randomUUID } = crypto` 처럼 떼어 내도 평문에서
 * 똑같이 죽는다 — 이름이 남아 있는 한 잡힌다.
 */

/** 기준은 vitest 루트(= `apps/web`)다. `pnpm -r test` 도 패키지 디렉터리에서 돈다. */
const SOURCE_ROOT = resolve(process.cwd(), 'src');

/** 시험 도구 자리. 배포되지 않고, 평문 흉내를 내려면 이 이름을 불러야 한다. */
const TEST_SUPPORT_ROOT = join(SOURCE_ROOT, 'test');

const FORBIDDEN_NAME = /\brandomUUID\b/u;

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return path === TEST_SUPPORT_ROOT ? [] : listSourceFiles(path);
    if (!/\.tsx?$/u.test(entry.name)) return [];
    /* 시험·감지기 자신은 배포되지 않는다 — 이 규율의 대상이 아니다. */
    if (/\.test\.tsx?$/u.test(entry.name)) return [];

    return [path];
  });

/**
 * 주석을 지운 소스. **문자열 리터럴 안의 `//` 까지 지울 수 있다** — 지나치게 지우면 놓치는 쪽으로
 * 기울지만, 이름이 URL 뒤에 붙는 문자열에 들어갈 일은 없다.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

describe('crypto.randomUUID 직접 호출 금지', () => {
  it('훑을 소스를 찾는다 — 못 찾으면 아래 검사가 빈 목록으로 통과한다', () => {
    expect(listSourceFiles(SOURCE_ROOT).length).toBeGreaterThan(100);
  });

  it('런타임 코드는 crypto.randomUUID를 부르지 않는다', () => {
    const offenders = listSourceFiles(SOURCE_ROOT)
      .filter((path) => FORBIDDEN_NAME.test(withoutComments(readFileSync(path, 'utf8'))))
      .map((path) => relative(SOURCE_ROOT, path));

    expect(offenders).toEqual([]);
  });
});
