import { describe, expect, it } from 'vitest';

import { toBusinessDate, toCompleteRequest, toOccurredAt } from './complete-request';

/** 시각을 고정해 둔다 — 「지금」을 쓰면 자정 근처에서만 깨지는 시험이 된다. */
const at = new Date(2026, 8, 2, 10, 22, 5);

describe('toCompleteRequest', () => {
  it('완료 처리는 업무 일자와 발생 시각만 싣는다', () => {
    const body = toCompleteRequest({ under: false, reasonCode: null, at });

    expect(body).toEqual({
      businessDate: '2026-09-02',
      occurredAt: toOccurredAt(at),
    });
  });

  /** ⛔ 목표를 채운 LOT 에 미달 사유가 붙으면 달성분이 미달로 집계된다. */
  it('완료 처리에는 사유를 싣지 않는다 — 골라 두었더라도', () => {
    const body = toCompleteRequest({ under: false, reasonCode: 'MATERIAL_SHORTAGE', at });

    expect(body).not.toHaveProperty('completionVarianceReasonCode');
  });

  it('미달 마감은 사유를 싣는다', () => {
    const body = toCompleteRequest({ under: true, reasonCode: 'MATERIAL_SHORTAGE', at });

    expect(body?.completionVarianceReasonCode).toBe('MATERIAL_SHORTAGE');
  });

  /** 서버도 400 으로 막지만, 화면이 먼저 막아야 사용자가 보내기 전에 안다. */
  it('미달인데 사유가 없으면 본문을 만들지 않는다', () => {
    expect(toCompleteRequest({ under: true, reasonCode: null, at })).toBeNull();
    expect(toCompleteRequest({ under: true, reasonCode: '  ', at })).toBeNull();
  });

  it('사유의 앞뒤 공백을 떼고 싣는다', () => {
    const body = toCompleteRequest({ under: true, reasonCode: ' SHORT ', at });

    expect(body?.completionVarianceReasonCode).toBe('SHORT');
  });
});

describe('업무 일자·발생 시각', () => {
  it('업무 일자는 단말이 선 날짜다', () => {
    expect(toBusinessDate(at)).toBe('2026-09-02');
  });

  /** ⛔ 오프셋이 빠지면 서버가 다른 날로 읽는다 — 야간조가 자정을 넘길 때 하루가 밀린다(C-8). */
  it('발생 시각에 초와 시간대 오프셋이 붙는다', () => {
    expect(toOccurredAt(at)).toMatch(/^2026-09-02T10:22:05[+-]\d{2}:\d{2}$/);
  });
});
