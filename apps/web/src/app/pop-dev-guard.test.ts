import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 개발 전용 코드가 **제품 코드에서 갈린 채로 남아 있는지** 잰다.
 *
 * ⭐ **왜 파일을 읽어 재는가.** 이 저장소가 개발·시험 전용 코드를 배포 번들에서 빼는 방식은
 * 「제품 코드는 그 모듈을 참조하지 않는다」다(화면 슬라이스의 `fixtures.ts` ·
 * `screen-harness.tsx` 30여 곳이 같은 문장을 적었다). 개발용 **화면 조작**은 그 방식이
 * 성립하지 않는다 — 렌더되려면 제품 코드가 불러야 한다. 그래서 대신 「부르되 빌드 시점
 * 상수로 감싼다」로 갈랐다.
 *
 * ⛔ **그 가름은 게이트가 보지 못한다.** 시험은 `MODE === 'test'` 라 개발용 가지에 아예
 * 들어가지 않고, 번들에서 걷혔는지는 빌드 산출물을 봐야 안다. 감지기가 없으면 누군가 조건을
 * 런타임 값으로 바꿔도 전부 초록인 채 지나가고, **현장 단말에 개발용 조작이 남는다.**
 * 같은 사정을 `pop-touch-sizes.test.ts` 가 먼저 만났고 같은 방법으로 풀었다.
 *
 * ⛔ **부르는 파일 목록을 손으로 적지 않는다.** 손목록은 제3의 파일이 개발용 모듈을 부를 때
 * 아무 말도 하지 않는다 — 목록을 갱신하는 규율을 강제하는 것이 없기 때문이다. 소스를 훑어
 * 「부르는 파일」을 찾아낸 뒤 그것들을 검사한다.
 *
 * ⛔ **주석을 걷어내고 잰다.** 조건을 런타임 값으로 바꾸고 설명 주석만 남겨도 문자열 검사는
 * 통과한다 — 이 저장소의 주석은 조건을 그대로 인용하는 일이 잦아 실제로 걸리는 함정이다.
 *
 * ⚠ **무엇을 못 잡는지 적어 둔다.** 이 시험은 「부르는 파일에 가름이 있는가」까지만 본다 —
 * 결함 주입으로 실측한 결과, 조건을 런타임 값으로 바꾸는 것과 목록 밖 제3의 파일이 부르는
 * 것은 잡지만, **같은 파일에 가름 없는 두 번째 사용처를 더하는 것은 잡지 못한다**(가름이
 * 한 번만 있으면 통과한다). 그것까지 재려면 구문 트리를 봐야 하고, 이 감지기가 막으려는
 * 것은 우회가 아니라 실수다.
 *
 * ⚠ 실제로 걷히는지는 빌드 산출물 확인이 정본이다 — `build:pop` 후 산출물에 개발용 문구가
 * 없음을 회차마다 확인한다.
 */

/** 기준은 vitest 루트(= `apps/web`)다. `pnpm -r test` 도 패키지 디렉터리에서 돈다. */
const SOURCE_ROOT = resolve(process.cwd(), 'src');

/** 개발 전용 모듈의 이름 규칙. 이 접두를 가진 모듈은 배포본에 서면 안 된다. */
const DEV_MODULE_PREFIX = 'pop-dev-';

/** 빌드 시점에 상수로 접히는 가름. **이 표기여야 접힌다.** */
const BUILD_TIME_GUARD = "import.meta.env.MODE === 'development'";

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return listSourceFiles(path);
    if (!/\.tsx?$/u.test(entry.name)) return [];
    /* 시험·감지기 자신은 배포되지 않는다 — 이 규율의 대상이 아니다. */
    if (/\.test\.tsx?$/u.test(entry.name)) return [];

    return [path];
  });

/**
 * 주석을 지운 소스. **문자열 리터럴 안의 `//` 까지 지울 수 있다** — 이 검사는 주석이 남아
 * 통과하는 쪽(거짓 통과)만 막으면 되므로, 지나치게 지우는 쪽으로 기울여도 안전하다.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

/**
 * 개발 전용 모듈을 import 하는 제품 파일. **찾아낸다 — 적어 두지 않는다.**
 *
 * ⚠ **찾는 단계에서도 주석을 먼저 걷는다.** 이 저장소의 주석은 모듈 경로를 그대로 인용하는
 * 일이 잦아, 걷지 않으면 «부르지도 않는 파일»이 대상으로 잡힌다(실측 — `worker-card.tsx`가
 * 설명 주석 한 줄 때문에 걸렸다).
 */
const callSites = listSourceFiles(SOURCE_ROOT).filter((path) => {
  if (path.includes(DEV_MODULE_PREFIX)) return false;

  return new RegExp(`^\\s*import[^;]*['"][^'"]*${DEV_MODULE_PREFIX}`, 'mu').test(
    withoutComments(readFileSync(path, 'utf8')),
  );
});

describe('개발 전용 코드는 빌드 시점 가름 뒤에 선다', () => {
  /*
   * ⛔ **부르는 곳이 하나도 없으면 이 감지기는 아무것도 재지 못한다.** 훑기가 조용히
   * 망가졌는지(경로가 바뀌었거나 정규식이 어긋났는지)와, 개발용 모듈이 통째로 걷혔는지를
   * 여기서 가른다 — 걷어냈다면 이 시험도 함께 지운다.
   */
  it('개발용 모듈을 부르는 제품 파일을 실제로 찾아낸다', () => {
    expect(callSites.length).toBeGreaterThan(0);
  });

  it.each(callSites)('%s 가 가름 없이 부르지 않는다', (path) => {
    expect(withoutComments(readFileSync(path, 'utf8'))).toContain(BUILD_TIME_GUARD);
  });

  /*
   * ⛔ **`DEV` 축으로 가르지 않는다.** 시험 실행에서도 참이라 개발용 대체물이 제품 시험
   * 안으로 들어와, 「이동 버튼이 있다」는 단언을 무너뜨린다(실측 3건).
   *
   * ⚠ 표기를 나눠 쓰면(`const env = import.meta.env`) 이 검사를 지나간다 — 이 검사가 막는
   * 것은 실수이지 우회다.
   */
  it.each(callSites)('%s 가 `DEV` 축으로 가르지 않는다', (path) => {
    expect(withoutComments(readFileSync(path, 'utf8'))).not.toContain('import.meta.env.DEV');
  });
});
