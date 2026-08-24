import { describe, expect, it } from 'vitest';

import { toWorkOrderCloseRequest } from './close-request';

const ERP_ITEMS = ['PRODUCTION_RESULT', 'MATERIAL_CONSUMPTION'] as const;

describe('toWorkOrderCloseRequest', () => {
  it('미달은 잔량 처분과 다듬은 사유를 함께 싣는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'UNDER',
        remainderDispositionCode: 'CARRY_OVER',
        reasonCode: '  SYN_SHORTFALL  ',
        erpSendItems: ERP_ITEMS,
      }),
    ).toEqual({
      remainderDispositionCode: 'CARRY_OVER',
      reasonCode: 'SYN_SHORTFALL',
      erpSendItems: ERP_ITEMS,
    });
  });

  it.each([
    ['잔량 처분이 없을 때', null, 'SYN_SHORTFALL'],
    ['사유가 공백일 때', 'WRITE_OFF' as const, '   '],
  ])('미달에서 %s 요청을 만들지 않는다', (_label, remainderDispositionCode, reasonCode) => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'UNDER',
        remainderDispositionCode,
        reasonCode,
        erpSendItems: ERP_ITEMS,
      }),
    ).toBeNull();
  });

  it('초과는 다듬은 사유만 싣고 남아 있던 잔량 처분을 버린다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'OVER',
        remainderDispositionCode: 'WRITE_OFF',
        reasonCode: '  SYN_EXCESS  ',
        erpSendItems: ERP_ITEMS,
      }),
    ).toEqual({ reasonCode: 'SYN_EXCESS', erpSendItems: ERP_ITEMS });
  });

  it('초과에서 사유가 공백이면 요청을 만들지 않는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'OVER',
        remainderDispositionCode: null,
        reasonCode: '\t',
        erpSendItems: ERP_ITEMS,
      }),
    ).toBeNull();
  });

  it('정상은 남아 있던 조건부 입력을 모두 버린다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'NORMAL',
        remainderDispositionCode: 'CARRY_OVER',
        reasonCode: 'SYN_STALE_REASON',
        erpSendItems: ERP_ITEMS,
      }),
    ).toEqual({ erpSendItems: ERP_ITEMS });
  });

  it('ERP 항목 순서를 보존한 새 배열을 만들고 입력 배열을 바꾸지 않는다', () => {
    const erpSendItems = Object.freeze(['SECOND', 'FIRST']);
    const request = toWorkOrderCloseRequest({
      completionJudgmentCode: 'NORMAL',
      remainderDispositionCode: null,
      reasonCode: '',
      erpSendItems,
    });

    expect(request?.erpSendItems).toEqual(['SECOND', 'FIRST']);
    expect(request?.erpSendItems).not.toBe(erpSendItems);
    expect(erpSendItems).toEqual(['SECOND', 'FIRST']);
  });
});
