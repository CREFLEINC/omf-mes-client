import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * POP 탈출 경로 감지기 — **화면에 들어간 작업자가 나올 수 있는가**를 본다.
 *
 * ⛔ **렌더 테스트로는 잡히지 않는다.** `vitest.config.ts` 가 `css: false` 라 스타일이
 * 테스트에 도달하지 않는다 — 단추는 DOM 에 있고 눌리기까지 하므로 게이트가 전부 초록인 채로
 * **단말에서만 보이지 않는다.** 그래서 원문을 읽어 규칙 자체를 겨눈다(`pop-spacing.test.ts`
 * 와 같은 방식).
 *
 * 실측으로 겪은 것: 출하 실적의 라벨 모드가 액션 줄을 통째로 `display: none` 으로 숨겼는데
 * **되돌아가는 단추가 그 안에 있었다.** 개발용 브라우저는 새로고침으로 빠져나오지만 현장
 * 단말은 주소창이 없어 작업자가 갇힌다(88단계 2회차 · #1092).
 */
const read = (file: string): string =>
  readFileSync(resolve(process.cwd(), file), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');

const appCss = read('src/app/app.css');
const popCss = read('src/app/pop.css');

describe('POP 라벨 모드 — 돌아갈 길을 숨기지 않는다', () => {
  /*
   * ⛔ 액션 줄을 숨기는 규칙이 아예 없어야 한다. 「본문만 숨긴다」로 좁혀 두었고, 여기에
   * `.packing-actions` 가 다시 들어오면 그 순간 탈출 경로가 사라진다.
   */
  /*
   * ⛔ **`display: none` 한 가지만 막지 않는다.** `visibility: hidden` · `height: 0` 으로도
   * 같은 일이 일어나고, 선택자를 따로 떼어 써도 마찬가지다(리뷰 실측).
   */
  it('라벨 모드가 액션 줄을 숨기지 않는다', () => {
    const bodies = [...appCss.matchAll(/([^{}]*)\{([^}]*)\}/gu)]
      .filter(
        (match) =>
          (match[1] ?? '').includes('.packing-shell--labels') &&
          (match[1] ?? '').includes('.packing-actions'),
      )
      .map((match) => match[2] ?? '');

    for (const body of bodies) {
      expect(body).not.toMatch(/display:\s*none/u);
      expect(body).not.toMatch(/visibility:\s*hidden/u);
      expect(body).not.toMatch(/(?:max-)?height:\s*0/u);
    }
  });

  /* 본문을 숨기는 것은 맞다 — 라벨 모드에서 그릴 것이 아니다. */
  it('라벨 모드는 본문만 숨긴다', () => {
    expect(appCss).toMatch(
      /\.packing-shell--labels\s*>\s*\.packing-body\s*\{[^}]*display:\s*none/u,
    );
  });

  /*
   * ⛔ **행 수를 줄이지 않는다.** 헤더·본문·액션바 셋을 유지해야 액션 줄이 설 자리가 있다
   * (E-4 — 공통 헤더와 주 액션을 화면 «안»에 유지한다). 두 행으로 줄이면 줄이 사라진다.
   */
  /*
   * ⛔ **리터럴 한 모양을 겨누지 않는다.** 한때 `auto minmax(0, 1fr);` 만 막았는데,
   * `auto 1fr` 로 적거나 마지막 선언이라 세미콜론이 없으면 **그대로 통과했다**(리뷰 실측).
   * 「행이 몇 개인가」를 센다.
   */
  it('라벨 모드가 셸의 행 수를 줄이지 않는다', () => {
    const rule = /\.packing-shell--labels\s*\{([^}]*)\}/u.exec(appCss)?.[1];
    const rows = rule === undefined ? undefined : /grid-template-rows:([^;}]*)/u.exec(rule)?.[1];

    /* 규칙이 없거나 행을 다시 적지 않으면 기본 셋(`.packing-shell`)을 그대로 쓴다 — 통과다. */
    if (rows === undefined) return;

    /* `minmax(0, 1fr)` 안의 쉼표를 칸 구분으로 세지 않는다. */
    const tracks = rows
      .replace(/\([^)]*\)/gu, 'x')
      .trim()
      .split(/\s+/u);

    expect(tracks).toHaveLength(3);
  });
});

/*
 * ⛔ **긴 LOT 번호가 다른 열을 밀어내면 값이 화면 밖으로 나간다**(#1092).
 *
 * 이것도 렌더 테스트로는 잡히지 않는다 — 값은 DOM 에 다 있고 표도 멀쩡히 뜬다. 폭이 실제로
 * 어떻게 나뉘는지는 브라우저가 정하므로, 폭을 «못박았는지»를 원문으로 겨눈다.
 *
 * 현장에서 GS1 스캔값이 그대로 들어오면 LOT 이 32자를 넘는다. `table-layout` 이 기본값이면
 * 열의 `width` 는 희망값에 그쳐, 그 칸이 남의 폭을 가져간다.
 */
describe('POP 표 — 긴 번호가 다른 열을 밀어내지 않는다', () => {
  const fixedLayout = (selector: string): RegExp =>
    new RegExp(`\\.pop-ui\\s+\\.${selector}\\s*\\{[^}]*table-layout:\\s*fixed`, 'u');

  it('출고 QR 의 출고 라인 표가 폭을 못박는다', () => {
    expect(popCss).toMatch(fixedLayout('pop-giqr-lines'));
  });

  it('포장 라벨 재출력의 내용물 표가 폭을 못박는다', () => {
    expect(popCss).toMatch(fixedLayout('pop-reprint-contents'));
  });

  /* 같은 사유·같은 처리 — 셋째 표를 빠뜨렸던 자리다(리뷰 지적). */
  it('재구성 라벨 발행의 내용물 표가 폭을 못박는다', () => {
    expect(popCss).toMatch(fixedLayout('pop-repack-contents'));
  });

  /*
   * ⚠ **줄이지 않고 접는다.** 꼬리를 잘라 감추면 어느 자리에서 끊을지를 정해야 하는데, 그것은
   * 제품 LOT 번호 체계가 정할 일이다(E-2 는 자재 LOT 전용이고 다른 체계에 쓰지 말라고 단서를
   * 달았다). 접으면 아무것도 감추지 않는다.
   */
  it('긴 번호를 감추지 않고 접는다', () => {
    expect(popCss).toMatch(/\.pop-ui\s+\.pop-giqr-lines\s+td\s*\{[^}]*overflow-wrap:\s*anywhere/u);
    expect(popCss).toMatch(
      /\.pop-ui\s+\.pop-reprint-contents\s+td\s*\{[^}]*overflow-wrap:\s*anywhere/u,
    );
  });

  /* 발행 칩도 좁은 칸 안에서 접힌다 — 한 줄로 두면 칸 밖으로 잘린다(#1150). */
  it('출고 QR 발행 칩이 칸 안에서 접힌다', () => {
    expect(popCss).toMatch(
      /\.pop-ui\s+\.pop-giqr-lines\s+td:last-child\s*>\s*\*\s*\{[^}]*white-space:\s*normal/u,
    );
  });
});

/*
 * ⛔ **남는 높이를 받는 구획이 0 으로 깔리지 않는다**(#1092).
 *
 * `flex: 1 1 auto` 에 `min-height: 0` 만 두면, 형제들이 높이를 다 쓴 순간 그 구획이 **통째로
 * 사라진다** — 스크롤도 생기지 않아 「없는 것」이 된다. 라벨 모드의 「대상」 표가 실제로 그렇게
 * 0 이 됐고 현장에서 라벨을 뽑을 수 없었다(88단계 2회차 실측).
 *
 * ⚠ 렌더 시험으로는 잡히지 않는다(`css: false`) — 표는 DOM 에 멀쩡히 있다.
 */
describe('POP 목록 — 남는 높이를 받는 표에 바닥이 있다', () => {
  it('라벨 모드의 「대상」 표가 0 으로 깔리지 않는다', () => {
    const rule = /\.pop-ui\s+\.pop-slabel-table\s*\{([^}]*)\}/u.exec(popCss)?.[1] ?? '';

    expect(rule).toMatch(/flex:\s*1\s+1\s+auto/u);
    /*
     * ⛔ **값을 «수»로 견준다.** 한때 `(?!0\b)\d+px` 로 적었는데 `0px` 는 `0` 과 `p` 사이에
     * 단어 경계가 없어 부정 선읽기가 성립하지 않는다 — **`min-height: 0px` 가 그대로
     * 합격했다**(리뷰 실측). 정규식으로 「0 이 아님」을 쓰려다 아무것도 지키지 못했다.
     */
    const floor = Number(/min-height:\s*(\d+)px/u.exec(rule)?.[1] ?? '0');

    /* 세 줄이 보일 만큼 — 한 줄만 보이면 고를 수가 없다. */
    expect(floor).toBeGreaterThanOrEqual(96);
  });
});
