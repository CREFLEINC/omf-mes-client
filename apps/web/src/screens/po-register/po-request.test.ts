import { describe, expect, it } from 'vitest';

import { headerDraft, lineDraft } from './fixtures';
import { summarizeOrderedQty, toPurchaseOrderCreate, type PoRequestInput } from './po-request';

/** 넘어온 초과분이 있는 상태. **맥락이 있는 것이 정상 경로다.** */
const SOURCE = { inboundReceiptLineId: 9111 } as const;

const input = (overrides: Partial<PoRequestInput> = {}): PoRequestInput => ({
  source: SOURCE,
  header: headerDraft(),
  lines: [lineDraft()],
  ...overrides,
});

describe('toPurchaseOrderCreate — 보낼 수 있을 때만 만든다', () => {
  it('맥락과 값이 갖춰지면 본문을 만든다', () => {
    const body = toPurchaseOrderCreate(input());

    expect(body).not.toBeNull();
    expect(body?.supplierId).toBe(9301);
    expect(body?.businessUnitId).toBe(9201);
    expect(body?.plantId).toBe(9401);
    expect(body?.orderDate).toBe('2026-08-17');
    expect(body?.sourceInboundReceiptLineId).toBe(9111);
  });

  /**
   * **맥락이 없으면 만들지 않는다**(완료 조건 C18 · 계획 결정 3).
   *
   * 버튼 잠금이 이미 막은 길이지만 **여기가 마지막 겹이다** — 계약이 이 필드를 선택으로 두어
   * 서버가 막지 않으므로, 뚫리면 승계 근거가 없는 발주가 되돌릴 수 없이 남는다.
   */
  it('맥락이 없으면 만들지 않는다', () => {
    expect(toPurchaseOrderCreate(input({ source: null }))).toBeNull();
  });

  it('줄이 하나도 없으면 만들지 않는다', () => {
    expect(toPurchaseOrderCreate(input({ lines: [] }))).toBeNull();
  });

  /** 필수 넷은 **각각** 막는다 — 하나로 뭉개면 한 칸만 검사하는 코드가 통과한다. */
  it.each([
    ['supplierId', { supplierId: '' }],
    ['businessUnitId', { businessUnitId: '' }],
    ['plantId', { plantId: '' }],
    ['orderDate', { orderDate: '' }],
  ])('필수 값 %s가 비면 만들지 않는다', (_field, patch) => {
    expect(toPurchaseOrderCreate(input({ header: headerDraft(patch) }))).toBeNull();
  });

  /**
   * 번호로 읽을 수 없는 선택칸 값. `Number('')`은 0이고 `Number('9301x')`는 `NaN`이라
   * 그대로 옮기면 **0번 공급사**나 `null`(직렬화한 `NaN`)이 전표에 실린다.
   */
  it.each(['0', '9301x', '-1', ' '])('공급사 값이 %s면 만들지 않는다', (raw) => {
    expect(toPurchaseOrderCreate(input({ header: headerDraft({ supplierId: raw }) }))).toBeNull();
  });

  it.each(['', '0', 'x', '-3'])('발주수량이 %s인 줄이 있으면 만들지 않는다', (raw) => {
    expect(toPurchaseOrderCreate(input({ lines: [lineDraft({ orderedQty: raw })] }))).toBeNull();
  });

  it('품목이나 단위를 고르지 않은 줄이 있으면 만들지 않는다', () => {
    expect(toPurchaseOrderCreate(input({ lines: [lineDraft({ itemId: '' })] }))).toBeNull();
    expect(toPurchaseOrderCreate(input({ lines: [lineDraft({ uomId: '' })] }))).toBeNull();
  });

  /**
   * **한 줄만 잘못돼도 통째로 만들지 않는다.** 잘못된 줄을 빼고 보내면 사용자가 확인한 것보다
   * 적은 줄이 한 트랜잭션으로 저장되고, 그 전표는 이 화면에서 고칠 수 없다.
   */
  it('셋째 줄만 잘못돼도 만들지 않는다', () => {
    const lines = [lineDraft(), lineDraft(), lineDraft({ orderedQty: '' })];

    expect(toPurchaseOrderCreate(input({ lines }))).toBeNull();
  });

  /**
   * **하한은 여기서 보지 않는다.** 승계 수량 하한(계획 결정 5)의 판정은 `validation.ts`가
   * 소유하고 마지막 겹은 데이터 제약이다 — 조립에서 또 막으면 버튼은 열렸는데 요청이 나가지
   * 않는 침묵 실패가 생기고, 그때 화면에는 아무 사유도 서지 않는다.
   */
  it('하한에 미치지 못하는 수량도 본문은 만들어진다 — 판정은 검증이 소유한다', () => {
    const lines = [lineDraft({ sourceLineId: 9111, sourceQty: 12, orderedQty: '11' })];
    const body = toPurchaseOrderCreate(input({ lines }));

    expect(body?.lines[0]?.orderedQty).toBe(11);
  });
});

describe('toPurchaseOrderCreate — 본문에 무엇이 실리는가', () => {
  /** **서버가 정하는 값을 화면이 싣지 않는다**(완료 조건 C16 · 계획 결정 6·7). */
  it('전표번호·상태·ERP 발주번호가 본문에 없다', () => {
    const body = toPurchaseOrderCreate(input());
    const keys = Object.keys(body ?? {});

    expect(keys).toContain('supplierId');
    expect(keys).not.toContain('purchaseOrderNo');
    expect(keys).not.toContain('statusCode');
    expect(keys).not.toContain('erpPurchaseOrderNo');
  });

  /**
   * **라인 전체가 한 본문에 실린다**(완료 조건 C17 · 착수 이슈 §6 ⑤ · 뮤테이션 M-2).
   *
   * 첫 줄만 싣거나 줄마다 요청을 나누면 서버의 한 트랜잭션 약속이 깨진다 —
   * 순서까지 함께 재는 이유는 줄번호를 **배열 순서로** 서버가 부여하기 때문이다(공유계약 A-5).
   */
  it('세 줄이면 세 줄이 순서대로 실린다', () => {
    const lines = [
      lineDraft({ orderedQty: '12' }),
      lineDraft({ orderedQty: '7', itemId: '9503' }),
      lineDraft({ orderedQty: '5', itemId: '9501' }),
    ];
    const body = toPurchaseOrderCreate(input({ lines }));

    expect(body?.lines).toHaveLength(3);
    expect(body?.lines.map((line) => line.orderedQty)).toEqual([12, 7, 5]);
    expect(body?.lines[1]?.itemId).toBe(9503);
  });

  /** **줄번호를 화면이 매기지 않는다**(공유계약 A-5). 치환 키도 신규 행이라 싣지 않는다. */
  it('줄에 줄번호와 라인 식별자를 싣지 않는다', () => {
    const body = toPurchaseOrderCreate(input());
    const keys = Object.keys(body?.lines[0] ?? {});

    expect(keys).toEqual([
      'itemId',
      'orderedQty',
      'uomId',
      'toleranceOverQty',
      'toleranceUnderQty',
    ]);
  });

  /** 비운 칸은 **키 자체를 싣지 않는다** — 빈 글자를 보내면 「빈 값을 넣었다」로 전표에 남는다. */
  it('입고 예정일이 비면 그 키가 없다', () => {
    const body = toPurchaseOrderCreate(input());

    expect(Object.keys(body ?? {})).not.toContain('expectedReceiptDate');
  });

  it('입고 예정일을 고르면 그 값이 실린다', () => {
    const body = toPurchaseOrderCreate(
      input({ header: headerDraft({ expectedReceiptDate: '2026-08-20' }) }),
    );

    expect(body?.expectedReceiptDate).toBe('2026-08-20');
  });

  /**
   * 허용치의 빈 칸은 **0으로 싣는다.** 화면 검증이 빈 칸을 0으로 판정하므로(오류가 아니다)
   * 같은 판정을 본문에도 싣는다 — 키를 빼고 서버 기본값에 기대면 화면이 확인한 값과 저장된
   * 값이 조용히 갈릴 수 있다.
   */
  it('허용치가 비면 0으로 실린다', () => {
    const lines = [lineDraft({ toleranceOverQty: '', toleranceUnderQty: ' ' })];
    const body = toPurchaseOrderCreate(input({ lines }));

    expect(body?.lines[0]?.toleranceOverQty).toBe(0);
    expect(body?.lines[0]?.toleranceUnderQty).toBe(0);
  });

  it('허용치에 넣은 수가 그대로 실린다', () => {
    const lines = [lineDraft({ toleranceOverQty: '5', toleranceUnderQty: '2.5' })];
    const body = toPurchaseOrderCreate(input({ lines }));

    expect(body?.lines[0]?.toleranceOverQty).toBe(5);
    expect(body?.lines[0]?.toleranceUnderQty).toBe(2.5);
  });

  it('허용치를 읽을 수 없으면 만들지 않는다', () => {
    const lines = [lineDraft({ toleranceOverQty: 'x' })];

    expect(toPurchaseOrderCreate(input({ lines }))).toBeNull();
  });

  it('음수 허용치는 만들지 않는다', () => {
    const lines = [lineDraft({ toleranceUnderQty: '-1' })];

    expect(toPurchaseOrderCreate(input({ lines }))).toBeNull();
  });
});

/**
 * 확인 창이 보이는 합계 — **본문을 만드는 자리와 같은 파일에 둔다**(전례 규율).
 *
 * 창이 따로 셈하면 「사용자가 확인한 수량」과 「요청에 실리는 수량」이 갈린다.
 */
describe('summarizeOrderedQty — 확인 창의 합계', () => {
  it('한 단위로만 채운 줄들은 합계가 선다', () => {
    const summary = summarizeOrderedQty([
      lineDraft({ orderedQty: '12' }),
      lineDraft({ orderedQty: '3.5' }),
    ]);

    expect(summary).toEqual({ total: 15.5, hasMixedUom: false });
  });

  /** 단위가 갈리면 **합계는 내되 한 단위의 수량이 아니라는 사실**을 함께 든다. */
  it('단위가 갈리면 그 사실을 함께 든다', () => {
    const summary = summarizeOrderedQty([
      lineDraft({ orderedQty: '12', uomId: '9601' }),
      lineDraft({ orderedQty: '4', uomId: '9602' }),
    ]);

    expect(summary).toEqual({ total: 16, hasMixedUom: true });
  });

  /** 읽을 수 없는 수량이 섞이면 **0으로 접지 않는다** — 합계를 낼 수 없다는 사실이 남는다. */
  it('읽을 수 없는 수량이 섞이면 합계가 없다', () => {
    const summary = summarizeOrderedQty([
      lineDraft({ orderedQty: '12' }),
      lineDraft({ orderedQty: '' }),
    ]);

    expect(summary.total).toBeNull();
  });

  it('줄이 없으면 합계가 없다', () => {
    expect(summarizeOrderedQty([]).total).toBeNull();
  });
});
