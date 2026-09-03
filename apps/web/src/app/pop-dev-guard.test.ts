import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 개발 전용 코드가 **제품 코드에서 갈린 채로 남아 있는지** 잰다.
 *
 * ⭐ **왜 파일을 읽어 재는가.** 이 저장소가 개발·시험 전용 코드를 배포 번들에서 빼는 방식은
 * 「제품 코드는 그 모듈을 참조하지 않는다」다(화면 슬라이스의 `fixtures.ts` · `screen-harness.tsx`
 * 30여 곳이 같은 문장을 적었다). 개발용 **화면 조작**은 그 방식이 성립하지 않는다 — 렌더되려면
 * 제품 코드가 불러야 한다. 그래서 대신 「부르되 빌드 시점 상수로 감싼다」로 갈랐다.
 *
 * ⛔ **그 가름은 게이트가 보지 못한다.** 시험은 `MODE === 'test'` 라 개발용 가지에 아예
 * 들어가지 않고, 번들에서 걷혔는지는 빌드 산출물을 봐야 안다. 감지기가 없으면 누군가 조건을
 * `DEV` 나 런타임 값으로 바꿔도 전부 초록인 채 지나가고, **현장 단말에 개발용 조작이 남는다.**
 * 같은 사정을 `pop-touch-sizes.test.ts` 가 먼저 만났고 같은 방법으로 풀었다.
 *
 * ⚠ 이 시험은 **가름이 있는지**만 본다. 실제로 걷히는지는 빌드 산출물 확인이 정본이다
 * (`build:pop` 후 산출물에 이 문구가 없음을 회차마다 확인했다).
 */

/** 기준은 vitest 루트(= `apps/web`)다. */
const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

/**
 * 개발 전용 모듈과, 그것을 부르는 제품 코드.
 *
 * ⛔ **개발 전용 모듈을 새로 만들면 여기 한 줄을 더한다.** 더하지 않으면 그 모듈은 아무
 * 감지기 없이 배포 번들로 갈 수 있다.
 */
const CALL_SITES = [
  'src/app/providers.tsx',
  'src/screens/worker-assignment/screen.tsx',
] as const;

/** 빌드 시점에 상수로 접히는 가름. **이 문자열이어야 접힌다.** */
const BUILD_TIME_GUARD = "import.meta.env.MODE === 'development'";

describe('개발 전용 코드는 빌드 시점 가름 뒤에 선다', () => {
  it.each(CALL_SITES)('%s 가 개발용 모듈을 가름 없이 부르지 않는다', (path) => {
    const source = readSource(path);

    /* 이 파일이 개발용 모듈을 부르지 않게 됐다면 지킬 것도 없다. */
    if (!source.includes('pop-dev-')) return;

    expect(source).toContain(BUILD_TIME_GUARD);
  });

  /*
   * ⛔ **`DEV` 는 쓰지 않는다.** 시험 실행에서도 참이라 개발용 대체물이 제품 시험 안으로
   * 들어와, 「이동 버튼이 있다」는 단언을 무너뜨린다(실측 3건).
   */
  it.each(CALL_SITES)('%s 가 `DEV` 축으로 가르지 않는다', (path) => {
    expect(readSource(path)).not.toContain('import.meta.env.DEV');
  });
});
