import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_LINE_DRAFT,
  hasAnyLineDraftValue,
  isLineSelected,
  parseDisposalQty,
  readDraftQty,
  setDraftQty,
  toggleLineSelection,
} from './line-draft';

const t = messages.disposalIssue;

const LINE_A = 9401;
const LINE_B = 9402;

describe('parseDisposalQty', () => {
  /**
   * **빈 칸은 오류가 아니다** — 「이 줄은 폐기하지 않는다」는 뜻이다. 미입력을 오류와 뭉개면
   * 전표를 여는 순간 전 줄이 붉은 글씨가 된다.
   */
  it.each(['', '   ', '\t'])('빈 칸·공백만은 미입력이다 (%j)', (raw) => {
    expect(parseDisposalQty(raw)).toEqual({ kind: 'empty' });
  });

  it.each([
    ['1', 1],
    ['100', 100],
    ['0.5', 0.5],
    ['  12  ', 12],
    ['1e3', 1000],
  ])('숫자를 읽는다 (%j)', (raw, value) => {
    expect(parseDisposalQty(raw)).toEqual({ kind: 'qty', value });
  });

  /**
   * **0을 막는다.** 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두었고 목이 0을 400으로
   * 되돌린다(실측) — 재고실사(`minimum: 0`)와 **반대**인 자리다.
   */
  it.each(['0', '0.0', '-1', '-0.5'])('0과 음수를 막는다 (%j)', (raw) => {
    expect(parseDisposalQty(raw)).toEqual({
      kind: 'invalid',
      message: t.errors.qtyNotPositive,
    });
  });

  /**
   * `Number()`는 `Infinity`를 숫자로 읽는다 — 걸러 내지 않으면 직렬화한 `null`이 요청 본문에
   * 실린다. 숫자가 아닌 글자도 같은 갈래다.
   */
  it.each(['Infinity', '-Infinity', '가나다', '1개', 'NaN'])(
    '숫자가 아닌 값을 막는다 (%j)',
    (raw) => {
      expect(parseDisposalQty(raw)).toEqual({
        kind: 'invalid',
        message: t.errors.qtyNotNumber,
      });
    },
  );
});

describe('readDraftQty', () => {
  /**
   * **이 자리가 「빈 칸으로 시작한다」를 지키는 곳이다**(완료 조건 C26 · 감지기 M26).
   * 입고 수량으로 되돌리려면 이 함수를 고쳐야 하고, 그러면 전량 폐기가 기본값처럼 보인다.
   */
  it('초안에 없는 줄은 빈 칸이다', () => {
    expect(readDraftQty(EMPTY_LINE_DRAFT, LINE_A)).toBe('');
  });

  /** **친 글자를 그대로 들고 있는다** — 숫자로 강제하면 「0.」처럼 아직 완성되지 않은 입력이 사라진다. */
  it('친 글자를 그대로 낸다', () => {
    expect(readDraftQty(setDraftQty(EMPTY_LINE_DRAFT, LINE_A, '0.'), LINE_A)).toBe('0.');
  });
});

describe('setDraftQty', () => {
  it('앞 초안을 고치지 않고 새 초안을 만든다', () => {
    const first = setDraftQty(EMPTY_LINE_DRAFT, LINE_A, '5');
    const second = setDraftQty(first, LINE_B, '7');

    expect(readDraftQty(first, LINE_B)).toBe('');
    expect(readDraftQty(second, LINE_A)).toBe('5');
    expect(second).not.toBe(first);
  });
});

describe('toggleLineSelection', () => {
  it('고르고 다시 누르면 풀린다', () => {
    const picked = toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A);

    expect(isLineSelected(picked, LINE_A)).toBe(true);
    expect(isLineSelected(toggleLineSelection(picked, LINE_A), LINE_A)).toBe(false);
  });

  /**
   * **선택을 풀어도 그 줄에 친 수량은 지우지 않는다.** 잘못 눌러 풀렸을 때 값까지 사라지면
   * 처음부터 다시 친다 — 무엇이 나갈지는 요약(고른 줄 수·합계)이 밝히므로 남은 값이 조용히
   * 나가는 일은 없다.
   */
  it('선택을 풀어도 친 수량은 남는다', () => {
    const draft = toggleLineSelection(setDraftQty(EMPTY_LINE_DRAFT, LINE_A, '5'), LINE_A);

    expect(readDraftQty(toggleLineSelection(draft, LINE_A), LINE_A)).toBe('5');
  });

  it('앞 초안을 고치지 않는다', () => {
    const picked = toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A);

    expect(isLineSelected(EMPTY_LINE_DRAFT, LINE_A)).toBe(false);
    expect(picked).not.toBe(EMPTY_LINE_DRAFT);
  });
});

describe('hasAnyLineDraftValue', () => {
  it('빈 초안에는 버릴 것이 없다', () => {
    expect(hasAnyLineDraftValue(EMPTY_LINE_DRAFT)).toBe(false);
  });

  /**
   * **고른 줄과 친 글자를 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
   * 고른 줄이 0이어도 수량이 남아 있으면 「지울 것이 있다」이다.
   */
  it('고른 줄만 있어도, 친 수량만 있어도 버릴 것이 있다', () => {
    expect(hasAnyLineDraftValue(toggleLineSelection(EMPTY_LINE_DRAFT, LINE_A))).toBe(true);
    expect(hasAnyLineDraftValue(setDraftQty(EMPTY_LINE_DRAFT, LINE_A, '5'))).toBe(true);
  });

  /** 빈 글자로 되돌린 칸은 버릴 것이 아니다 — 지운 칸까지 세면 파기 확인 창이 늘 뜬다. */
  it('빈 글자로 되돌린 칸은 세지 않는다', () => {
    expect(hasAnyLineDraftValue(setDraftQty(EMPTY_LINE_DRAFT, LINE_A, ''))).toBe(false);
  });
});
