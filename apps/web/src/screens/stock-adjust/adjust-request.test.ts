import { describe, expect, it } from 'vitest';

import { summarizeAdjustLines, toInventoryAdjustmentCreate } from './adjust-request';
import { adjustLineDraft } from './fixtures';
import type { AdjustHeaderDraft, AdjustLineDraft } from './types';

/**
 * 등록 본문 조립 — **이 화면에서 되돌릴 수 없는 쓰기의 내용이 여기서 정해진다.**
 *
 * 재는 것은 넷이다: ① 차이 0인 줄이 빠진다 ② 라인 사유를 싣지 않는다 ③ 음수가 그대로 실린다
 * ④ 채워지지 않은 자리가 있으면 아예 만들지 않는다.
 */

const header: AdjustHeaderDraft = { reasonCode: 'SAMPLE_AR_A', sendToErp: true };

const build = (
  lines: readonly AdjustLineDraft[],
  overrides: {
    header?: Partial<AdjustHeaderDraft>;
    inventoryCountId?: number | null;
  } = {},
) =>
  toInventoryAdjustmentCreate({
    inventoryCountId: overrides.inventoryCountId ?? null,
    header: { ...header, ...overrides.header },
    lines,
  });

/** 본문이 만들어졌다는 것을 먼저 확인하고 그 안을 본다 — `null`에 대고 단언하면 늘 통과한다. */
const builtLines = (body: ReturnType<typeof build>) => {
  expect(body).not.toBeNull();

  return body?.lines ?? [];
};

describe('toInventoryAdjustmentCreate — 무엇이 실리는가', () => {
  it('헤더 사유와 ERP 송신 여부가 실린다', () => {
    const body = build([adjustLineDraft()]);

    expect(body?.reasonCode).toBe('SAMPLE_AR_A');
    expect(body?.sendToErp).toBe(true);
  });

  /** ⭐ **줄이는 조정이 정상 경로다**(조심 ② · D-4 · C21 · 뮤테이션 M-2). 절댓값을 씌우지 않는다. */
  it('차이가 음수면 음수 그대로 실린다', () => {
    const lines = builtLines(build([adjustLineDraft({ adjustmentQtyText: '-20' })]));

    expect(lines[0]?.adjustmentQty).toBe(-20);
  });

  /** 짝 방향 — 늘리는 조정도 그대로다. 「늘 음수로 만든다」로 통과하지 않게 한다. */
  it('차이가 양수면 양수 그대로 실린다', () => {
    const lines = builtLines(build([adjustLineDraft({ adjustmentQtyText: '20' })]));

    expect(lines[0]?.adjustmentQty).toBe(20);
  });

  it('소수점이 있는 차이도 그대로 실린다', () => {
    const lines = builtLines(build([adjustLineDraft({ adjustmentQtyText: '-2.5' })]));

    expect(lines[0]?.adjustmentQty).toBe(-2.5);
  });

  it('위치·품목·단위를 번호로 옮긴다', () => {
    const lines = builtLines(build([adjustLineDraft()]));

    expect(lines[0]).toMatchObject({ locationId: 9401, itemId: 9501, uomId: 9601 });
  });

  it('고른 자재 LOT을 싣는다', () => {
    const lines = builtLines(build([adjustLineDraft({ lotId: '9701' })]));

    expect(lines[0]?.lotId).toBe(9701);
  });

  /**
   * **LOT을 고르지 않은 것이 정상이다** — LOT 관리를 하지 않는 품목이 실재한다.
   *
   * 키 자체를 싣지 않는다: `null`을 실으면 「비웠다」는 뜻이 되어 서버가 지우는 동작으로 읽을 수 있다.
   */
  it('자재 LOT을 고르지 않은 줄은 그 키를 싣지 않는다', () => {
    const lines = builtLines(build([adjustLineDraft({ lotId: '' })]));

    expect(Object.keys(lines[0] ?? {})).not.toContain('lotId');
  });

  /**
   * **승계 근거가 줄에 남는다.** 계약이 「실사 차이에서 불러온 경우의 원천 라인」으로 그 자리를
   * 두었다 — 남기지 않으면 만들어진 조정이 어느 실사 줄에서 왔는지 서버가 잇지 못한다.
   */
  it('실사에서 승계한 줄은 원천 라인 번호를 싣는다', () => {
    const lines = builtLines(build([adjustLineDraft({ countLineId: 9111 })]));

    expect(lines[0]?.inventoryCountLineId).toBe(9111);
  });

  /** 짝 방향 — 직접 등록 줄에는 원천이 없다. 그 키를 싣지 않는다. */
  it('직접 등록 줄은 원천 라인 키를 싣지 않는다', () => {
    const lines = builtLines(build([adjustLineDraft({ countLineId: null })]));

    expect(Object.keys(lines[0] ?? {})).not.toContain('inventoryCountLineId');
  });

  /** 실사 차이에서 시작한 조정이면 그 실사가 헤더에 남는다. */
  it('실사에서 불러왔으면 대상 실사가 헤더에 실린다', () => {
    const body = build([adjustLineDraft()], { inventoryCountId: 9101 });

    expect(body?.inventoryCountId).toBe(9101);
  });

  /**
   * **실사 참조가 비어 있는 것이 정상이다**(조심 ⑤). 현장 실측·직접 등록은 실사를 거치지 않는다 —
   * `null`을 실으면 「비웠다」는 뜻이 되므로 키 자체를 싣지 않는다.
   */
  it('직접 등록이면 대상 실사 키가 없다', () => {
    const body = build([adjustLineDraft()], { inventoryCountId: null });

    expect(Object.keys(body ?? {})).not.toContain('inventoryCountId');
  });

  /** ERP 송신을 끄면 그 값이 그대로 간다 — 기본값에 기대지 않는다(D-11). */
  it('ERP 송신을 끄면 거짓이 실린다', () => {
    expect(build([adjustLineDraft()], { header: { sendToErp: false } })?.sendToErp).toBe(false);
  });
});

describe('toInventoryAdjustmentCreate — 무엇이 실리지 않는가', () => {
  /**
   * **라인 사유를 싣지 않는다**(D-7 · 미결 #87 · C20).
   *
   * 계약에 자리가 있으나 저장 자리가 없어 만들지 않기로 했다 — 실사에서 실려 온 사유는 화면에
   * 보이기만 하고 나가지 않는다.
   */
  it('실사 사유가 있는 줄도 라인 사유 키를 싣지 않는다', () => {
    const lines = builtLines(build([adjustLineDraft({ countReasonCode: 'SAMPLE_VR_A' })]));

    /* 짝 양성 — 그 줄이 실제로 실렸다. 줄이 통째로 빠져서 통과하는 길을 막는다. */
    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0] ?? {})).not.toContain('reasonCode');
  });

  /** **서버가 정하는 값을 화면이 싣지 않는다** — 전표번호·상태·전기 시각은 서버 소관이다. */
  it('전표번호·상태·전기 시각을 싣지 않는다', () => {
    const keys = Object.keys(build([adjustLineDraft()]) ?? {});

    /* 짝 양성 — 본문이 실제로 만들어졌다. */
    expect(keys).toContain('reasonCode');
    expect(keys).not.toContain('inventoryAdjustmentNo');
    expect(keys).not.toContain('statusCode');
    expect(keys).not.toContain('adjustedAt');
  });

  /** 줄번호는 배열 순서로 서버가 부여한다(공유계약 A-5). */
  it('줄번호와 라인 번호를 싣지 않는다', () => {
    const keys = Object.keys(builtLines(build([adjustLineDraft({ countLineId: 9111 })]))[0] ?? {});

    expect(keys).not.toContain('lineNo');
    expect(keys).not.toContain('inventoryAdjustmentLineId');
  });
});

describe('toInventoryAdjustmentCreate — 차이 0인 줄은 빠진다', () => {
  /**
   * **오류가 아니라 제외다**(스펙 §6 · D-4 · C19).
   *
   * 실사 차이를 불러오면 차이 0인 줄이 함께 오는 일이 있다 — 그 줄을 사용자가 지우게 만들
   * 이유가 없고, 0을 그대로 보내면 아무것도 바꾸지 않는 줄이 전표에 남는다.
   */
  it('차이가 0인 줄이 본문에서 빠진다', () => {
    const lines = builtLines(
      build([
        adjustLineDraft({ key: 'a', adjustmentQtyText: '-20' }),
        adjustLineDraft({ key: 'b', adjustmentQtyText: '0' }),
        adjustLineDraft({ key: 'c', adjustmentQtyText: '5' }),
      ]),
    );

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.adjustmentQty)).toEqual([-20, 5]);
  });

  it('빈 글자로 적은 0도 같은 줄로 본다', () => {
    const lines = builtLines(
      build([
        adjustLineDraft({ key: 'a', adjustmentQtyText: '-20' }),
        adjustLineDraft({ key: 'b', adjustmentQtyText: ' 0 ' }),
      ]),
    );

    expect(lines).toHaveLength(1);
  });

  /** **한 줄도 남지 않으면 만들지 않는다** — 계약이 최소 1행을 요구한다. */
  it('모든 줄이 제외되면 본문을 만들지 않는다', () => {
    expect(build([adjustLineDraft({ adjustmentQtyText: '0' })])).toBeNull();
  });
});

describe('toInventoryAdjustmentCreate — 만들지 않는 자리', () => {
  it('줄이 없으면 만들지 않는다', () => {
    expect(build([])).toBeNull();
  });

  it('헤더 사유가 비면 만들지 않는다', () => {
    expect(build([adjustLineDraft()], { header: { reasonCode: '' } })).toBeNull();
  });

  it('헤더 사유가 공백뿐이면 만들지 않는다', () => {
    expect(build([adjustLineDraft()], { header: { reasonCode: '   ' } })).toBeNull();
  });

  /**
   * **한 줄만 잘못돼도 통째로 만들지 않는다.** 잘못된 줄을 빼고 보내면 사용자가 확인한 것보다
   * 적은 줄이 한 트랜잭션으로 저장되고, 그 전표를 이 화면에서 고칠 길은 없다.
   */
  it.each([
    ['위치를 고르지 않은 줄', { locationId: '' }],
    ['품목을 고르지 않은 줄', { itemId: '' }],
    ['단위를 고르지 않은 줄', { uomId: '' }],
    ['차이를 치지 않은 줄', { adjustmentQtyText: '' }],
    ['차이를 수로 읽을 수 없는 줄', { adjustmentQtyText: '이십' }],
    ['차이가 「-」뿐인 줄', { adjustmentQtyText: '-' }],
  ])('%s가 하나라도 있으면 만들지 않는다', (_name, patch) => {
    expect(
      build([adjustLineDraft({ key: 'a' }), adjustLineDraft({ key: 'b', ...patch })]),
    ).toBeNull();
  });

  /**
   * `Number('')`는 0이고 `Number('9401x')`는 `NaN`이다 — 그대로 옮기면 **0번 위치**나
   * `null`(직렬화한 `NaN`)이 되돌릴 수 없는 전표에 실린다.
   */
  it.each(['0', '-1', '9401x', '1.5'])('번호로 읽을 수 없는 위치 %o은 만들지 않는다', (raw) => {
    expect(build([adjustLineDraft({ locationId: raw })])).toBeNull();
  });

  /** 자재 LOT은 **선택**이지만 값이 있는데 못 읽으면 지어내지 않는다. */
  it('자재 LOT을 번호로 읽을 수 없으면 만들지 않는다', () => {
    expect(build([adjustLineDraft({ lotId: '9701x' })])).toBeNull();
  });

  /**
   * `Infinity`는 `Number()`가 수로 읽지만 JSON에서는 `null`이 된다 — 되돌릴 수 없는 쓰기에
   * `null` 수량이 실리는 길을 막는다.
   */
  it('무한대는 수로 보지 않는다', () => {
    expect(build([adjustLineDraft({ adjustmentQtyText: 'Infinity' })])).toBeNull();
  });
});

/**
 * 확인 창이 보이는 수 — **본문을 만드는 자리와 같은 파일에 둔다**(전례 규율).
 *
 * 창이 따로 세면 「사용자가 확인한 줄 수」와 「요청에 실리는 줄 수」가 갈린다.
 */
describe('summarizeAdjustLines', () => {
  it('실릴 줄과 빠질 줄을 갈라 센다', () => {
    expect(
      summarizeAdjustLines([
        adjustLineDraft({ key: 'a', adjustmentQtyText: '-20' }),
        adjustLineDraft({ key: 'b', adjustmentQtyText: '0' }),
        adjustLineDraft({ key: 'c', adjustmentQtyText: '5' }),
      ]),
    ).toEqual({ includedCount: 2, excludedCount: 1 });
  });

  it('빠질 줄이 없으면 0이다', () => {
    expect(summarizeAdjustLines([adjustLineDraft()])).toEqual({
      includedCount: 1,
      excludedCount: 0,
    });
  });

  /**
   * **아직 치지 않은 줄은 제외가 아니다** — 그 줄은 오류가 막는다. 제외로 접으면 잘못 친 줄이
   * 조용히 사라져 사용자가 확인한 줄과 나간 줄이 갈린다.
   */
  it('비어 있는 줄은 제외로 세지 않는다', () => {
    expect(summarizeAdjustLines([adjustLineDraft({ adjustmentQtyText: '' })])).toEqual({
      includedCount: 1,
      excludedCount: 0,
    });
  });

  /** 본문을 만드는 판정과 **같은 값을 쓴다** — 확인 창이 말한 수와 실제로 나간 줄이 같아야 한다. */
  it('확인 창이 센 수와 본문의 줄 수가 같다', () => {
    const lines = [
      adjustLineDraft({ key: 'a', adjustmentQtyText: '-20' }),
      adjustLineDraft({ key: 'b', adjustmentQtyText: '0' }),
      adjustLineDraft({ key: 'c', adjustmentQtyText: '5' }),
    ];

    expect(builtLines(build(lines))).toHaveLength(summarizeAdjustLines(lines).includedCount);
  });
});
