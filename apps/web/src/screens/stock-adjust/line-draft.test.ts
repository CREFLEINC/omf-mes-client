import { describe, expect, it } from 'vitest';

import { countVarianceLineView } from './fixtures';
import {
  addLineDraft,
  createInheritedLineDrafts,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';

/**
 * 조정 라인 초안 — **아직 보내지 않은 입력**이다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`-1` → `-` → `-2`)에
 * 값이 튀고, 「-」처럼 아직 완성되지 않은 입력이 사라진다. 음수가 정상 경로인 이 화면에서
 * 그 자리는 특히 자주 지난다.
 *
 * **줄마다 안정 키를 만든다**(사본 체크리스트 2번). 표의 `getRowId`가 이 키를 쓰므로,
 * 가운데 줄을 지워도 남은 줄의 DOM 노드가 살아남아 치던 값과 포커스가 그 자리에 남는다.
 */

describe('createInheritedLineDrafts', () => {
  it('실사 라인의 위치·품목·LOT·단위를 그대로 이어받는다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView()], 1);

    expect(draft?.locationId).toBe('9401');
    expect(draft?.itemId).toBe('9501');
    expect(draft?.lotId).toBe('9701');
    expect(draft?.uomId).toBe('9601');
  });

  it('차이 수량 기본값이 실사가 계산한 차이다 — 화면이 다시 빼지 않는다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView({ varianceQty: -2 })], 1);

    expect(draft?.adjustmentQtyText).toBe('-2');
  });

  it('실사가 준 장부 수량을 줄이 들고 있다 — 잔액 조회 없이 장부가 선다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView({ systemQty: 100 })], 1);

    expect(draft?.countSystemQty).toBe(100);
  });

  /** 승계 근거. 이 값이 있는 줄만 「실사 승계」로 읽히고 위치·품목을 고칠 수 없다. */
  it('원천 실사 라인 번호를 줄이 들고 있다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView()], 1);

    expect(draft?.countLineId).toBe(9111);
  });

  /**
   * 실사에서 적은 사유는 **보이기만 한다**(D-7). 고칠 수 없고 보내지도 않지만,
   * 못 보면 무엇을 조정하는지 판단이 서지 않는다.
   */
  it('실사에서 적은 사유를 읽기 전용으로 들고 온다', () => {
    const [draft] = createInheritedLineDrafts(
      [countVarianceLineView({ varianceReasonCode: 'SAMPLE_VR_A' })],
      1,
    );

    expect(draft?.countReasonCode).toBe('SAMPLE_VR_A');
  });

  it('LOT이 없는 실사 라인은 LOT을 비운 채 승계한다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView({ lotId: null })], 1);

    expect(draft?.lotId).toBe('');
  });

  it('줄마다 서로 다른 키를 준다', () => {
    const drafts = createInheritedLineDrafts(
      [countVarianceLineView(), countVarianceLineView({ inventoryCountLineId: 9112 })],
      1,
    );

    expect(new Set(drafts.map((draft) => draft.key)).size).toBe(2);
  });

  /**
   * **실사 라인 번호를 키로 삼지 않는다.** 같은 실사를 두 번 불러오는 경로가 실재해
   * (원천을 바꿨다 되돌리기) 그 번호를 키로 삼으면 옛 줄과 새 줄이 같은 키를 갖는 순간이 생긴다.
   */
  it('같은 실사 라인을 두 번 승계해도 키가 겹치지 않는다', () => {
    const [first] = createInheritedLineDrafts([countVarianceLineView()], 1);
    const [second] = createInheritedLineDrafts([countVarianceLineView()], 2);

    expect(first?.key).not.toBe(second?.key);
  });

  /** 초안 세션이 키에 남아 있어야 어느 초안의 줄인지 키만 보고도 갈린다(D-15). */
  it('초안 세션이 키에 담긴다', () => {
    const [draft] = createInheritedLineDrafts([countVarianceLineView()], 7);

    expect(draft?.key.startsWith('s7:')).toBe(true);
  });
});

describe('addLineDraft', () => {
  it('빈 줄을 뒤에 더한다 — 값을 지어내지 않는다', () => {
    const [draft] = addLineDraft([], 1);

    expect(draft).toMatchObject({
      countLineId: null,
      countSystemQty: null,
      countReasonCode: null,
      locationId: '',
      itemId: '',
      lotId: '',
      uomId: '',
      adjustmentQtyText: '',
    });
  });

  it('앞 줄을 그대로 두고 뒤에 붙인다', () => {
    const first = addLineDraft([], 1);
    const second = addLineDraft(first, 1);

    expect(second).toHaveLength(2);
    expect(second[0]).toBe(first[0]);
  });

  it('더한 줄마다 키가 다르다', () => {
    const lines = addLineDraft(addLineDraft([], 1), 1);

    expect(new Set(lines.map((line) => line.key)).size).toBe(2);
  });
});

describe('removeLineDraft', () => {
  it('그 줄만 뺀다 — 남은 줄의 키가 그대로다', () => {
    const lines = addLineDraft(addLineDraft(addLineDraft([], 1), 1), 1);
    const middleKey = lines[1]?.key ?? '';
    const next = removeLineDraft(lines, middleKey);

    expect(next).toHaveLength(2);
    expect(next[0]?.key).toBe(lines[0]?.key);
    expect(next[1]?.key).toBe(lines[2]?.key);
  });

  it('없는 키는 그냥 지나간다', () => {
    const lines = addLineDraft([], 1);

    expect(removeLineDraft(lines, 'none')).toHaveLength(1);
  });
});

describe('patchLineDraft', () => {
  it('그 줄의 값만 바꾼다', () => {
    const lines = addLineDraft(addLineDraft([], 1), 1);
    const next = patchLineDraft(lines, lines[0]?.key ?? '', { adjustmentQtyText: '-20' });

    expect(next[0]?.adjustmentQtyText).toBe('-20');
    expect(next[1]?.adjustmentQtyText).toBe('');
  });

  it('앞 초안을 고치지 않는다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다', () => {
    const lines = addLineDraft([], 1);

    patchLineDraft(lines, lines[0]?.key ?? '', { adjustmentQtyText: '-20' });

    expect(lines[0]?.adjustmentQtyText).toBe('');
  });

  /** 지운 줄의 입력이 뒤늦게 도착하는 경로가 있다 — 그때 없는 줄을 되살리면 안 된다. */
  it('없는 키는 줄을 되살리지 않는다', () => {
    const lines = addLineDraft([], 1);

    expect(patchLineDraft(lines, 'none', { adjustmentQtyText: '-20' })).toHaveLength(1);
  });
});
