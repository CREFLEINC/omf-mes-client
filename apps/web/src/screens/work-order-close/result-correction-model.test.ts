import { describe, expect, it } from 'vitest';

import {
  createProductionResultCorrectionDraft,
  formatProductionResultAt,
  toProductionResultCorrect,
  type ProductionResultRow,
} from './result-correction-model';

const original: ProductionResultRow = {
  productionResultId: 1001,
  resultSequence: 3,
  correctsProductionResultId: null,
  goodQty: 90,
  defectQty: 10,
  holdQty: 0,
  scrapQty: 0,
  reworkQty: 0,
  occurredAt: '2026-08-31T14:20:00+09:00',
  recordedAt: null,
  workerId: 2001,
};

describe('생산실적 정정 본문', () => {
  it('등급 없이 바뀐 수량과 사유만 계약 본문으로 옮긴다', () => {
    const draft = createProductionResultCorrectionDraft(original);
    draft.reasonCode = 'RECOUNT';
    draft.goodQty = '80';
    draft.defectQty = '20';

    expect(toProductionResultCorrect(original, draft)).toEqual({
      body: { reasonCode: 'RECOUNT', goodQty: 80, defectQty: 20 },
      fieldErrors: {},
    });
  });

  it('사유만 있는 정정도 서버 판정에 맡긴다', () => {
    const draft = createProductionResultCorrectionDraft(original);
    draft.reasonCode = 'LATE_REVIEW';
    draft.note = '교대 후 재확인';

    expect(toProductionResultCorrect(original, draft).body).toEqual({
      reasonCode: 'LATE_REVIEW',
      note: '교대 후 재확인',
    });
  });

  it('빈 사유와 음수·비수량은 요청 전에 막는다', () => {
    const draft = createProductionResultCorrectionDraft(original);
    draft.goodQty = '-1';
    draft.scrapQty = 'not-a-number';

    const result = toProductionResultCorrect(original, draft);
    expect(result.body).toBeNull();
    expect(result.fieldErrors).toMatchObject({
      reasonCode: expect.any(String),
      goodQty: expect.any(String),
      scrapQty: expect.any(String),
    });
  });
});

it('서버가 보낸 벽시계 시각을 시간대 변환 없이 표시한다', () => {
  expect(formatProductionResultAt(original.occurredAt)).toBe('2026-08-31 14:20');
});
