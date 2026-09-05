import { describe, expect, it } from 'vitest';

import { toWorkOrderCloseRequest } from './close-request';

describe('toWorkOrderCloseRequest', () => {
  it('미달·이월은 잔량 처분과 다듬은 사유를 싣고 비고는 싣지 않는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'UNDER',
        remainderDispositionCode: 'CARRY_OVER',
        reasonCode: '  SYN_SHORTFALL  ',
        remarks: '이월인데 적어 둔 말',
      }),
    ).toEqual({ remainderDispositionCode: 'CARRY_OVER', reasonCode: 'SYN_SHORTFALL' });
  });

  /* 소멸은 아무 자원도 만들지 않는다 — 고른 이유는 remarks 와 처분 코드에만 남는다. */
  it('미달·소멸은 다듬은 비고를 함께 싣고, 비면 칸을 내지 않는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'UNDER',
        remainderDispositionCode: 'WRITE_OFF',
        reasonCode: 'SYN_SHORTFALL',
        remarks: '  잔량 12 EA 는 규격 변경으로 쓸 수 없음  ',
      }),
    ).toEqual({
      remainderDispositionCode: 'WRITE_OFF',
      reasonCode: 'SYN_SHORTFALL',
      remarks: '잔량 12 EA 는 규격 변경으로 쓸 수 없음',
    });
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'UNDER',
        remainderDispositionCode: 'WRITE_OFF',
        reasonCode: 'SYN_SHORTFALL',
        remarks: '   ',
      }),
    ).toEqual({ remainderDispositionCode: 'WRITE_OFF', reasonCode: 'SYN_SHORTFALL' });
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
        remarks: '',
      }),
    ).toBeNull();
  });

  it('초과는 다듬은 사유만 싣고 남아 있던 잔량 처분·비고를 버린다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'OVER',
        remainderDispositionCode: 'WRITE_OFF',
        reasonCode: '  SYN_EXCESS  ',
        remarks: '낡은 비고',
      }),
    ).toEqual({ reasonCode: 'SYN_EXCESS' });
  });

  it('초과에서 사유가 공백이면 요청을 만들지 않는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'OVER',
        remainderDispositionCode: null,
        reasonCode: '\t',
        remarks: '',
      }),
    ).toBeNull();
  });

  it('정상은 남아 있던 조건부 입력을 모두 버린 빈 본문이다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'NORMAL',
        remainderDispositionCode: 'CARRY_OVER',
        reasonCode: 'SYN_STALE_REASON',
        remarks: '낡은 비고',
      }),
    ).toEqual({});
  });

  /* 부속 항목 코드가 정해지기 전에는 그 칸을 만들지 않는다 — 최상위 송신 항목 코드를 대신 싣지 않는다. */
  it('erpSendItems 를 만들지 않는다', () => {
    expect(
      toWorkOrderCloseRequest({
        completionJudgmentCode: 'NORMAL',
        remainderDispositionCode: null,
        reasonCode: '',
        remarks: '',
      }),
    ).not.toHaveProperty('erpSendItems');
  });
});
