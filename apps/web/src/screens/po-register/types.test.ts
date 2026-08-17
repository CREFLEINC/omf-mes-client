import { describe, expect, it } from 'vitest';

import {
  headerDraft,
  inboundReceiptResponse,
  inboundReceiptLineResponse,
  purchaseOrderDetailBody,
  purchaseOrderLineResponse,
} from './fixtures';
import {
  EMPTY_HEADER_DRAFT,
  headerSeed,
  isHeaderEdited,
  seedHeaderDraft,
  toPoDetailResult,
  toSourceLineView,
  toSourceReceiptView,
} from './types';

/**
 * 계약 응답을 화면 타입으로 옮기는 자리. **쓰는 값만 옮긴다** —
 * 자리를 두지 않으면 그 값이 화면으로 샐 경로도 없다(`omf-mes#44`).
 */

describe('toSourceReceiptView', () => {
  it('업무 번호·승계 원천·상태만 옮긴다', () => {
    const view = toSourceReceiptView(inboundReceiptResponse());

    expect(view).toEqual({
      inboundReceiptNo: 'SAMPLE-IR-9101',
      supplierId: 9301,
      plantId: 9401,
      statusCode: 'SAMPLE_IR_STATUS_A',
    });
  });

  it('내부 번호(FK)를 담을 자리가 없다', () => {
    expect(Object.keys(toSourceReceiptView(inboundReceiptResponse()))).not.toContain(
      'inboundReceiptId',
    );
  });
});

describe('toSourceLineView', () => {
  it('승계에 필요한 값만 옮긴다', () => {
    expect(toSourceLineView(inboundReceiptLineResponse())).toEqual({
      inboundReceiptLineId: 9111,
      lineNo: 1,
      itemId: 9501,
      receivedQty: 12,
      uomId: 9601,
    });
  });

  it('발주 라인 번호를 옮기지 않는다 — 「초과분인가」를 화면이 판정하지 않는다(계획 결정 3)', () => {
    const view = toSourceLineView(inboundReceiptLineResponse({ purchaseOrderLineId: 9701 }));

    expect(Object.keys(view)).not.toContain('purchaseOrderLineId');
  });
});

describe('seedHeaderDraft', () => {
  it('공급사·공장을 승계하고 나머지는 비운 채로 시작한다', () => {
    const receipt = toSourceReceiptView(inboundReceiptResponse());

    expect(seedHeaderDraft(receipt.supplierId, receipt.plantId)).toEqual({
      supplierId: '9301',
      businessUnitId: '',
      plantId: '9401',
      orderDate: '',
      expectedReceiptDate: '',
    });
  });

  it('사업부·발주일을 지어내지 않는다 — 넘어온 전표에 없는 값이다', () => {
    const seeded = seedHeaderDraft(9301, 9401);

    expect(seeded.businessUnitId).toBe(EMPTY_HEADER_DRAFT.businessUnitId);
    expect(seeded.orderDate).toBe(EMPTY_HEADER_DRAFT.orderDate);
  });
});

/**
 * **초안을 세우는 자리와 견주는 자리가 같은 함수를 쓴다.**
 *
 * 화면은 이 값으로 초안을 세우고(수명 표 1행), 「친 값이 있는가」도 이 값과 견줘 판정한다 —
 * 두 자리가 서로 다른 기준을 쓰면 아무것도 치지 않았는데 버리기 확인 창이 열리거나(반대로)
 * 친 값이 확인 없이 사라진다.
 */
describe('headerSeed', () => {
  it('승계 원천이 있으면 그 값으로 세운다', () => {
    expect(headerSeed(9301, 9401)).toEqual(seedHeaderDraft(9301, 9401));
  });

  it.each([
    [null, 9401],
    [9301, null],
    [null, null],
  ])('승계 원천이 반쪽이면(%s·%s) 빈 초안이다', (supplierId, plantId) => {
    expect(headerSeed(supplierId, plantId)).toEqual(EMPTY_HEADER_DRAFT);
  });
});

describe('isHeaderEdited', () => {
  it('승계 상태 그대로면 친 값이 없다', () => {
    const seed = headerSeed(9301, 9401);

    expect(isHeaderEdited(seed, seed)).toBe(false);
  });

  /** 다섯 칸을 **각각** 본다 — 한 칸만 검사하는 코드가 통과하지 않게 한다. */
  it.each([
    ['supplierId', { supplierId: '9302' }],
    ['businessUnitId', { businessUnitId: '9201' }],
    ['plantId', { plantId: '9402' }],
    ['orderDate', { orderDate: '2026-08-17' }],
    ['expectedReceiptDate', { expectedReceiptDate: '2026-08-20' }],
  ])('%s를 고치면 친 값이 있다', (_field, patch) => {
    const seed = headerSeed(9301, 9401);

    expect(isHeaderEdited({ ...seed, ...patch }, seed)).toBe(true);
  });

  it('맥락이 없는 화면에서도 친 값을 알아본다', () => {
    expect(isHeaderEdited(headerDraft(), EMPTY_HEADER_DRAFT)).toBe(true);
    expect(isHeaderEdited(EMPTY_HEADER_DRAFT, EMPTY_HEADER_DRAFT)).toBe(false);
  });
});

/**
 * 등록 응답을 결과 구획의 타입으로 옮기는 자리.
 *
 * **내부 번호가 표시 타입 밖에 있다**(`omf-mes#44`) — 상신에 필요한 값이라 버리지는 않고,
 * 화면에 그리는 타입에는 자리를 두지 않는다.
 */
describe('toPoDetailResult', () => {
  it('전표번호·상태·ERP 번호·라인 수를 옮긴다', () => {
    const result = toPoDetailResult(purchaseOrderDetailBody());

    expect(result.created).toEqual({
      purchaseOrderNo: 'SAMPLE-PO-9001',
      statusCode: 'SAMPLE_PO_STATUS_A',
      erpPurchaseOrderNo: 'SAMPLE-EPO-9001',
      lineCount: 1,
    });
  });

  it('내부 번호는 표시 타입 밖에 둔다', () => {
    const result = toPoDetailResult(purchaseOrderDetailBody());

    expect(result.purchaseOrderId).toBe(9001);
    expect(Object.keys(result.created)).not.toContain('purchaseOrderId');
  });

  /**
   * **비어 있음의 네 모양을 한 값으로 접는다** — 계약이 이 필드를 `nullable`이고 선택으로 두어
   * 없음·`null`·빈 글자가 모두 오고, **공백만인 값**도 채워지지 않은 것이다(`isBlank`가 다듬는다).
   * 접지 않으면 결과 구획이 같은 사실을 네 갈래로 그린다.
   */
  it.each([
    ['없음', {}],
    ['null', { erpPurchaseOrderNo: null }],
    ['빈 글자', { erpPurchaseOrderNo: '' }],
    ['공백만', { erpPurchaseOrderNo: '   ' }],
  ])('ERP 발주번호가 %s면 미매칭이다', (_shape, patch) => {
    const body = purchaseOrderDetailBody({ erpPurchaseOrderNo: undefined, ...patch });

    expect(toPoDetailResult(body).created.erpPurchaseOrderNo).toBeNull();
  });

  /** **서버가 되돌려 준 줄을 센다** — 화면이 보낸 줄을 되비추면 무엇이 저장됐는지가 아니다. */
  it('서버가 되돌려 준 줄 수를 센다', () => {
    const body = purchaseOrderDetailBody({}, [
      purchaseOrderLineResponse(),
      purchaseOrderLineResponse({ purchaseOrderLineId: 9702, lineNo: 2 }),
      purchaseOrderLineResponse({ purchaseOrderLineId: 9703, lineNo: 3 }),
    ]);

    expect(toPoDetailResult(body).created.lineCount).toBe(3);
  });
});
