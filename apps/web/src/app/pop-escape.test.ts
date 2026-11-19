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
 * 현장에서 GS1 스캔값이 그대로 들어오면 LOT 이 32자를 넘는다. 공통 표(`pu-table`)는 짧은 칸을 글자만큼(`fit`)
 * 두는 자동 배치라, 번호 칸을 `fit` 으로 두려면 상한(`max-width`)을 못박아야 그 칸이 남의 폭을 가져가지 않는다.
 */
describe('POP 표 — 긴 번호가 다른 열을 밀어내지 않는다', () => {
  /*
   * 통일 본문(#295)의 표는 화면 CSS(`screens/<화면>/uniform.css`)가 번호 칸 상한을 못박는다. 옛 `pop.css` 규칙
   * (`.pop-repack-contents` · `.pop-split-row` · `.pop-slabel-table`)은 화면과 함께 걷었다. 구획 안
   * 스크롤 대신 표 높이에 맞춘 쪽 넘김을 쓰므로 「표가 0 으로 깔림」 감지는 쪽 크기(`useFitTableRows`, 최소 1)가 맡는다.
   */
  const cappedColumn = (scope: string, column: string): RegExp =>
    new RegExp(`\\.${scope}\\s+\\.pu-table\\s+td\\.${column}\\s*\\{[^}]*max-width:\\s*\\d+px`, 'u');

  it('재구성 신규 라벨의 라벨 표가 번호 칸 폭을 못박는다', () => {
    expect(read('src/screens/repack-label-issue/uniform.css')).toMatch(
      cappedColumn('rpk-table', 'rpk-no'),
    );
  });

  it('분할 LOT 표가 LOT 번호 칸 폭을 못박는다 — 긴 번호가 끝 열을 밀어내지 않는다', () => {
    expect(read('src/screens/goods-issue-qr/uniform.css')).toMatch(
      cappedColumn('giq-table', 'giq-lotcol'),
    );
  });

  it('자재 관리 LOT 표 · 적재 위치 표도 번호(코드) 칸 폭을 못박는다', () => {
    // 자재 관리 LOT 표는 칸마다 값 하나(#295) — 번호 칸 머리에 폭(px)을 주고, 값 칸은 공통 표의
    // `max-width: 0` 말줄임을 그대로 받는다(풀어 버리면 긴 LOT 번호가 다른 칸을 밀어낸다).
    const mllCss = read('src/screens/pop-material-lot-label/uniform.css');
    expect(mllCss).toMatch(
      /\.mll-table\s+\.pu-table\s+th\.mll-lotcol\s*\{[^}]*(?<![-\w])width:\s*\d+px/u,
    );
    expect(mllCss).not.toMatch(/td\.mll-lotcol[^{]*\{[^}]*max-width:\s*none/u);
    expect(read('src/app/pop-uniform.css')).toMatch(/\.pu-table\s+td\s*\{[^}]*max-width:\s*0/u);
    expect(read('src/screens/pop-location-label/uniform.css')).toMatch(
      cappedColumn('ll-table', 'll-code'),
    );
  });
});
