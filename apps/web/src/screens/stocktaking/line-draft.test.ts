import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { countLineResponse } from './fixtures';
import {
  EMPTY_LINE_DRAFTS,
  hasAnyLineDraftValue,
  parseCountedQty,
  parseVarianceReason,
  readDraftQty,
  readDraftReason,
  setDraftQty,
  setDraftReason,
  type LineDrafts,
} from './line-draft';
import { toCountLineView } from './types';
import { CODE_MAX } from './validation';

const t = messages.stocktaking;

const line = (overrides: Parameters<typeof countLineResponse>[0] = {}) =>
  toCountLineView(countLineResponse(overrides));

describe('parseCountedQty — 친 글자를 실물 수량으로 읽는다', () => {
  /*
   * **빈 칸은 오류가 아니라 「아직 안 셌다」다.** 오류로 뭉개면 위치를 여는 순간 전 줄이
   * 붉은 글씨가 되고, 사용자는 자기가 잘못한 줄 안다 — 그 사정은 저장 버튼의 사유가 맡는다.
   */
  it('빈 칸과 공백만은 미입력이다', () => {
    expect(parseCountedQty('')).toEqual({ kind: 'empty' });
    expect(parseCountedQty('   ')).toEqual({ kind: 'empty' });
  });

  /*
   * **0은 정상 값이다**(완료 조건 C37). 계약이 `minimum: 0`이라 「세어 보니 하나도 없었다」를
   * 넣을 수 있어야 한다 — W-01-03의 `exclusiveMinimum: 0`과 갈리는 자리라 여기서 못 박는다.
   */
  it('0을 수량으로 받는다', () => {
    expect(parseCountedQty('0')).toEqual({ kind: 'qty', value: 0 });
  });

  it('소수를 수량으로 받는다', () => {
    expect(parseCountedQty('12.5')).toEqual({ kind: 'qty', value: 12.5 });
  });

  /*
   * **「0.」은 아직 치는 중이다.** 숫자로 강제해 들고 있으면 이 글자가 화면에서 사라져
   * 사용자가 소수를 칠 수 없다 — 친 글자를 그대로 들고 있는 것이 그 이유다.
   */
  it('「0.」처럼 미완성인 입력도 수량으로 읽어 계속 칠 수 있게 둔다', () => {
    expect(parseCountedQty('0.')).toEqual({ kind: 'qty', value: 0 });
  });

  it('음수는 사유를 갈라 막는다', () => {
    expect(parseCountedQty('-1')).toEqual({ kind: 'invalid', message: t.errors.qtyNegative });
  });

  /*
   * `Number()`는 `Infinity`를 숫자로 읽는다 — 걸러 내지 않으면 요청 본문에 `Infinity`가 실리고
   * JSON 직렬화가 그것을 `null`로 바꿔 **화면이 보낸 적 없는 값**이 전표에 남는다.
   */
  it.each(['abc', 'Infinity', '.', '1,000'])('숫자가 아닌 「%s」는 형식 오류다', (raw) => {
    expect(parseCountedQty(raw)).toEqual({ kind: 'invalid', message: t.errors.qtyNotNumber });
  });
});

describe('parseVarianceReason — 고른 차이 사유를 읽는다', () => {
  it('빈 값과 공백만은 고르지 않은 것이다', () => {
    expect(parseVarianceReason('')).toEqual({ kind: 'none' });
    expect(parseVarianceReason('  ')).toEqual({ kind: 'none' });
  });

  it('고른 코드는 다듬어 담는다', () => {
    expect(parseVarianceReason(' SAMPLE_R ')).toEqual({ kind: 'code', value: 'SAMPLE_R' });
  });

  it(`${String(CODE_MAX)}자는 받는다`, () => {
    const code = 'A'.repeat(CODE_MAX);

    expect(parseVarianceReason(code)).toEqual({ kind: 'code', value: code });
  });

  /*
   * **완료 조건 C40** — 계약의 `maxLength: 50`을 화면이 잰다. 선택지에서 고른 값이라 길이
   * 오류가 날 리 없어 보이지만, 값 목록은 **서버가 내려주는 것**이라(공유계약 G-2) 51자짜리
   * 코드가 선택지에 실릴 수 있다. 그때 **버튼은 열려 있는데 보낼 수 없는 상태**가 되므로
   * 화면이 그 자리에서 막는다.
   */
  it(`${String(CODE_MAX + 1)}자는 형식 오류다`, () => {
    expect(parseVarianceReason('A'.repeat(CODE_MAX + 1))).toEqual({
      kind: 'invalid',
      message: t.errors.codeTooLong(CODE_MAX),
    });
  });

  /** 길이는 **보낼 값**으로 잰다 — 다듬은 뒤 50자면 보낼 수 있다. */
  it('앞뒤 공백을 뗀 길이로 잰다', () => {
    expect(parseVarianceReason(` ${'A'.repeat(CODE_MAX)} `).kind).toBe('code');
  });
});

describe('readDraftQty · readDraftReason — 칸에 처음 보이는 글자', () => {
  /*
   * **M32 · 완료 조건 C35** — 서버가 준 `countedQty`로 미리 채우지 않는다.
   * 미실사 줄도 계약상 `countedQty`가 필수라 **0으로 내려오며**, 채워 두면 사용자가 그대로
   * 저장하는 순간 **세지 않은 줄이 「0개를 셌다」로 바뀐다.** 화면은 그 둘을 구분할 수 없다.
   */
  it('초안에 없는 줄의 실물 수량 칸은 빈 칸이다', () => {
    const target = line({ countedQty: 98 });

    /* 짝 방향 — 채울 값이 실제로 있는 줄이다(그런데도 비어 있어야 한다). */
    expect(target.countedQty).toBe(98);
    expect(readDraftQty(EMPTY_LINE_DRAFTS, target)).toBe('');
  });

  /*
   * 사유도 같다. 수량을 다시 치는데 앞서 저장된 사유만 남으면 **지금 친 수량에 대한 사유**로
   * 읽힌다 — 두 칸이 한 줄의 짝이라 한쪽만 물려받으면 뜻이 어긋난다.
   */
  it('초안에 없는 줄의 차이 사유 칸은 빈 칸이다', () => {
    const target = line({ varianceReasonCode: 'SAMPLE_VARIANCE_REASON_A' });

    expect(target.varianceReasonCode).toBe('SAMPLE_VARIANCE_REASON_A');
    expect(readDraftReason(EMPTY_LINE_DRAFTS, target)).toBe('');
  });

  it('친 글자를 그대로 돌려준다', () => {
    const target = line();
    const drafts = setDraftReason(
      setDraftQty(EMPTY_LINE_DRAFTS, target.inventoryCountLineId, '0.'),
      target.inventoryCountLineId,
      'SAMPLE_R',
    );

    expect(readDraftQty(drafts, target)).toBe('0.');
    expect(readDraftReason(drafts, target)).toBe('SAMPLE_R');
  });
});

describe('setDraftQty · setDraftReason — 한 줄만 고친다', () => {
  it('앞 초안을 고치지 않고 새 참조를 만든다', () => {
    const before: LineDrafts = setDraftQty(EMPTY_LINE_DRAFTS, 9401, '10');
    const after = setDraftQty(before, 9402, '20');

    expect(after).not.toBe(before);
    expect(before[9402]).toBeUndefined();
    expect(after[9401]?.countedQty).toBe('10');
    expect(after[9402]?.countedQty).toBe('20');
  });

  /** 두 칸이 한 줄의 짝이다 — 한쪽을 고치면 다른 쪽이 사라지는 일이 없어야 한다. */
  it('수량을 고쳐도 같은 줄의 사유가 남는다', () => {
    const drafts = setDraftQty(setDraftReason(EMPTY_LINE_DRAFTS, 9401, 'SAMPLE_R'), 9401, '10');

    expect(drafts[9401]).toEqual({ countedQty: '10', varianceReason: 'SAMPLE_R' });
  });
});

describe('hasAnyLineDraftValue — 버릴 것이 있는가', () => {
  it('아무것도 치지 않았으면 거짓이다', () => {
    expect(hasAnyLineDraftValue(EMPTY_LINE_DRAFTS)).toBe(false);
  });

  /** 잘못 친 값도 **사용자가 친 값**이다 — 확인 없이 버리면 무엇을 잃었는지도 모른다. */
  it('형식이 잘못된 수량도 버릴 값이다', () => {
    expect(hasAnyLineDraftValue(setDraftQty(EMPTY_LINE_DRAFTS, 9401, 'abc'))).toBe(true);
  });

  it('사유만 골라도 버릴 값이다', () => {
    expect(hasAnyLineDraftValue(setDraftReason(EMPTY_LINE_DRAFTS, 9401, 'SAMPLE_R'))).toBe(true);
  });

  it('공백만 친 칸은 버릴 값이 아니다', () => {
    expect(hasAnyLineDraftValue(setDraftQty(EMPTY_LINE_DRAFTS, 9401, '   '))).toBe(false);
  });
});
