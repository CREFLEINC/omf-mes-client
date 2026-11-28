import { messages, setLocale } from '@omf-mes/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import {
  doneOf,
  lookupMessageOf,
  reasonOf,
  qtyProblemOf,
  qtyReady,
  sendFailureOf,
  toReceiveBody,
  toReturnDraft,
  type ReturnLot,
} from './return';

/*
 * M-01-15 반납 입고의 판정(피처 019). 합성값만 쓴다.
 */

const LOT: ReturnLot = {
  lotId: 501,
  lotNo: 'SYN-M00000220261120000031',
  itemCode: 'SYN-A100',
  itemName: '합성 볼트',
  uomCode: 'EA',
  returnableQty: 100,
  issueWarehouseId: 31,
  issueWarehouseName: 'G 생산창고',
  pickedWorkOrderId: null,
};
const NOW = new Date('2026-11-28T02:10:00Z');

describe('M-01-15 반납 입고 판정', () => {
  it('US2-1 LOT → 수량 → 위치: 본문은 줄 하나에 위치를 싣고, W/O 는 싣지 않으며 끝은 그 위치다', () => {
    const target = { locationId: 812, locationCode: 'G-S-01-03', confirmUndesignated: false };
    const body = toReceiveBody(LOT, 20, target, NOW);

    expect(body).toEqual({
      businessDate: '2026-11-28',
      occurredAt: '2026-11-28T02:10:00.000Z',
      lines: [{ lotId: 501, returnQty: 20, destinationLocationId: 812 }],
    });
    expect(doneOf(LOT, 20, target, null)).toEqual({
      kind: 'located',
      lot: LOT,
      qty: 20,
      locationCode: 'G-S-01-03',
    });
  });

  it('US2-1 미지정 위치는 서버 409 를 확인으로 받고, 확인하면 표시를 싣는다', () => {
    expect(
      sendFailureOf({
        kind: 'validation',
        status: 409,
        errors: [
          {
            scope: 'field',
            field: 'lines[0].destinationLocationId',
            code: 'UNDESIGNATED_NEEDS_CONFIRM',
            message: '지정되지 않은 위치입니다',
          },
        ],
      }),
    ).toEqual({ kind: 'confirm' });
    const body = toReceiveBody(
      LOT,
      20,
      { locationId: 813, locationCode: 'G-S-05-02', confirmUndesignated: true },
      NOW,
    );
    expect(body.lines[0]).toMatchObject({ destinationLocationId: 813, confirmUndesignated: true });
  });

  it('US2-3 「지정 품목만 받기」 위치 거절은 판정 코드의 문구(적치와 같은 문구)', () => {
    expect(
      sendFailureOf({
        kind: 'validation',
        status: 400,
        errors: [
          {
            scope: 'field',
            field: 'lines[0].destinationLocationId',
            code: 'RESTRICTED_LOCATION',
            message: '이 위치는 지정 품목만 받습니다.',
          },
        ],
      }),
    ).toEqual({ kind: 'rejected', message: messages.putaway.direct.verdict.RESTRICTED_LOCATION });
  });

  it('US1-3 반납 가능 넘음은 서버가 준 그때의 반납 가능 양에 LOT 단위를 붙여 보인다', () => {
    expect(
      reasonOf(
        {
          kind: 'validation',
          status: 400,
          errors: [
            {
              scope: 'field',
              field: 'lines[0].returnQty',
              code: 'RANGE',
              message: '출고된 양보다 많이 반납할 수 없습니다 (반납 가능 36)',
            },
          ],
        },
        'EA',
      ),
    ).toBe(messages.materialReturn.reason.overReturnable('36 EA'));
  });

  it('모르는 코드는 서버 문구 그대로, 없는 LOT(404) · 연결 실패는 화면 문구에 맡긴다(null)', () => {
    expect(
      reasonOf({
        kind: 'validation',
        status: 400,
        errors: [{ scope: 'field', field: 'x', code: 'SOMETHING_NEW', message: '새 거절' }],
      }),
    ).toBe('새 거절');
    expect(
      lookupMessageOf({
        kind: 'validation',
        status: 404,
        errors: [{ scope: 'screen', code: 'NOT_FOUND', message: 'LOT 을 찾을 수 없습니다.' }],
      }),
    ).toBeNull();
    expect(lookupMessageOf({ kind: 'network' })).toBeNull();
  });

  it('US2-2 「적치 대기로 받기」는 위치 없이 보내고, 끝은 출고 생산창고 적치 대기다', () => {
    const body = toReceiveBody(LOT, 20, null, NOW);

    expect(body.lines).toEqual([{ lotId: 501, returnQty: 20 }]);
    expect(doneOf(LOT, 20, null, null)).toEqual({ kind: 'staged', lot: LOT, qty: 20 });
  });

  it('US4-4 W/O 로 찾은 LOT 은 고른 W/O 를 싣는다', () => {
    const body = toReceiveBody({ ...LOT, pickedWorkOrderId: 635 }, 40, null, NOW);

    expect(body.lines).toEqual([{ lotId: 501, returnQty: 40, workOrderId: 635 }]);
  });

  it('연결이 끊기거나 서버가 잠시 못 받으면 대기열 — 같은 키 · 본문으로 담는다', () => {
    expect(sendFailureOf({ kind: 'network' })).toEqual({ kind: 'queue' });
    expect(sendFailureOf({ kind: 'http', status: 503 })).toEqual({ kind: 'queue' });
    const body = toReceiveBody(LOT, 20, null, NOW);
    const draft = toReturnDraft(LOT, body, 'key-1', '900028');

    expect(draft).toMatchObject({
      idempotencyKey: 'key-1',
      method: 'POST',
      path: '/production/material-returns',
      body,
      occurredAt: body.occurredAt,
      workerNo: '900028',
    });
  });

  it('US1-3 수량은 빈칸에서 시작하고 0 < 수량 ≤ 반납 가능, EA 는 정수만', () => {
    expect(qtyReady('', LOT)).toBe(false);
    expect(qtyProblemOf('', LOT)).toBeNull();
    expect(qtyProblemOf('101', LOT)).toBe('range');
    expect(qtyProblemOf('0', LOT)).toBe('range');
    expect(qtyProblemOf('2.5', LOT)).toBe('integer');
    expect(qtyReady('100', LOT)).toBe(true);
    expect(qtyProblemOf('2.5', { ...LOT, uomCode: 'KG' })).toBeNull();
  });
});

describe('M-01-15 반납 입고 거절 문구 — 베트남어 단말(실제 앱 확인 F-03)', () => {
  afterEach(() => {
    setLocale('ko');
  });

  it('US1-3 반납 대상 아님 · 남은 양 없음은 서버 한국어 문구가 아니라 베트남어 문구다', () => {
    setLocale('vi');
    const reject = (code: string) =>
      lookupMessageOf({
        kind: 'validation',
        status: 400,
        errors: [
          { scope: 'field', field: 'lotNo', code, message: '반납할 수 있는 자재 LOT 이 아닙니다' },
        ],
      });

    expect(reject('NOT_RETURNABLE')).toBe(messages.materialReturn.reason.NOT_RETURNABLE);
    expect(reject('NOTHING_TO_RETURN')).toBe(messages.materialReturn.reason.NOTHING_TO_RETURN);
    expect(reject('NOT_RETURNABLE')).not.toMatch(/[가-힣]/u);
    expect(reject('NOTHING_TO_RETURN')).not.toMatch(/[가-힣]/u);
  });
});
