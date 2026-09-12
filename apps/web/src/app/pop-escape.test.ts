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
  it('라벨 모드가 액션 줄을 숨기지 않는다', () => {
    const hidesActions =
      /\.packing-shell--labels[^{]*\.packing-actions[^{]*\{[^}]*display:\s*none/u;

    expect(appCss).not.toMatch(hidesActions);
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
  it('라벨 모드가 셸의 행 수를 줄이지 않는다', () => {
    expect(appCss).not.toMatch(
      /\.packing-shell--labels\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s*;/u,
    );
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
});
