import { describe, expect, it } from 'vitest';

import { messages } from '@omf-mes/i18n';
import { EMPTY_DRAFT, toCreateBody, validateDraft } from './form';

const t = messages.stockReinstatement;

describe('재고 재등록 본문', () => {
  it('LOT 토큰과 사유 두 축을 구분하고 빈 선택값은 싣지 않는다', () => {
    const body = toCreateBody({
      draft: {
        ...EMPTY_DRAFT,
        toWarehouseId: '202',
        lotHoldId: '71001',
        qty: '80',
        releaseReasonCode: 'RETEST_PASS',
      },
      dispositionDecisionId: 3101,
      lotId: 6101,
      versionNo: 7,
      uomId: 7101,
      now: new Date('2026-09-05T10:20:30+09:00'),
    });

    expect(body).toMatchObject({
      dispositionDecisionId: 3101,
      lot: { lotId: 6101, versionNo: 7 },
      lotHoldId: 71001,
      toWarehouseId: 202,
      qty: 80,
      uomId: 7101,
      releaseReasonCode: 'RETEST_PASS',
      businessDate: '2026-09-05',
    });
    expect(body).not.toHaveProperty('toLocationId');
    expect(body).not.toHaveProperty('reasonCode');
    expect(body).not.toHaveProperty('remarks');
  });

  it('위치 관리 창고와 수량 상한, 필수 해제 사유를 함께 검증한다', () => {
    expect(
      validateDraft({
        draft: { ...EMPTY_DRAFT, toWarehouseId: '202', lotHoldId: '71001', qty: '201' },
        maxQty: 200,
        locationRequired: true,
        releaseReasonsReady: true,
        text: t.form,
      }),
    ).toEqual({
      toLocationId: t.form.locationRequired,
      qty: t.form.qtyExceeded(200),
      releaseReasonCode: t.form.releaseReasonRequired,
    });
  });
});
