import type {
  ApiError,
  InspectionRequestEventForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';
import { messages, vi as viMessages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { eventDetailOf } from './inbound-history';
import { isOverride, lotJudgmentsOf, overriddenLotsOf, splitRuleErrors } from './lot-judgment';

/**
 * 005 판정 규칙 변경(T135 · 2026-11-12 · FR-021 · FR-023 · FR-023a) — 화면이 미리 계산하는 몫. 지어낸 값만 쓴다.
 */

const lot = (lotId: number) => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  statusCode: 'INSPECTION_PENDING',
  goodsReceived: false,
});

const result = (
  seqNo: number,
  judgment: string | null,
  matchedLotIds: number[],
): InspectionResultSummaryForward => ({
  inspectionResultId: 700 + seqNo,
  inspectionResultNo: `TST-IR-${String(seqNo)}`,
  seqNo,
  overallJudgmentCode: judgment,
  inspectedQty: 200,
  rejectedQty: 0,
  defectNames: [],
  matchedLotIds,
  inspectorName: null,
  inspectedAt: '2099-11-11T01:00:00Z',
  statusCode: 'DRAFT',
  confirmCycle: null,
  acceptedQty: 0,
  heldQty: 0,
  matchedLotNos: [],
  reinspectionReasonCode: null,
  reinspectionReasonName: null,
  versionNo: 1,
});

describe('판정 규칙 — 재검 사유가 필요한가(FR-023a)', () => {
  it('불합격 → 보류 · 합격, 보류 → 합격만 덮기다', () => {
    expect(isOverride('REJECTED', 'HELD')).toBe(true);
    expect(isOverride('REJECTED', 'ACCEPTED')).toBe(true);
    expect(isOverride('HELD', 'ACCEPTED')).toBe(true);
    expect(isOverride('HELD', 'REJECTED')).toBe(false);
    expect(isOverride('ACCEPTED', 'REJECTED')).toBe(false);
    expect(isOverride('REJECTED', 'REJECTED')).toBe(false);
    expect(isOverride('REJECTED', null)).toBe(false);
  });

  it('US3-8 새 결과는 매칭 LOT 마다 그 LOT 의 마지막 결과와 견준다', () => {
    const results = [result(1, 'REJECTED', [1, 2]), result(2, 'ACCEPTED', [1])];
    const of = (matchedLotIds: number[], judgmentCode: string) =>
      overriddenLotsOf({ results, editingResultId: null, seqNo: 3, matchedLotIds, judgmentCode });

    expect(of([1, 2], 'ACCEPTED')).toEqual([
      { lotId: 2, previousSeqNo: 1, previousJudgmentCode: 'REJECTED' },
    ]);
    expect(of([1], 'ACCEPTED')).toEqual([]);
    expect(of([1, 2], 'REJECTED')).toEqual([]);
  });

  it('결과 수정은 그 결과를 빼고, 그 결과 순번보다 앞선 결과와 견준다(순번은 고쳐도 바뀌지 않는다)', () => {
    const results = [
      result(1, 'HELD', [1]),
      result(2, 'ACCEPTED', [1]),
      result(3, 'REJECTED', [1]),
    ];

    expect(
      overriddenLotsOf({
        results,
        editingResultId: 702,
        seqNo: 2,
        matchedLotIds: [1],
        judgmentCode: 'ACCEPTED',
      }),
    ).toEqual([{ lotId: 1, previousSeqNo: 1, previousJudgmentCode: 'HELD' }]);
  });

  it('판정을 아직 고르지 않았으면 묻지 않는다', () => {
    expect(
      overriddenLotsOf({
        results: [result(1, 'REJECTED', [1])],
        editingResultId: null,
        seqNo: 2,
        matchedLotIds: [1],
        judgmentCode: null,
      }),
    ).toEqual([]);
  });
});

describe('판정 규칙 — 자재 관리 LOT 별 판정(FR-023)', () => {
  const lots = [lot(1), lot(2), lot(3)];

  it('US3-8 LOT 마다 매칭한 결과 중 순번이 가장 큰 결과, 대체된 앞 결과를 남긴다, 매칭 없는 LOT 은 뺀다', () => {
    const judged = lotJudgmentsOf({
      lots,
      results: [result(2, 'ACCEPTED', [1]), result(1, 'REJECTED', [1, 2])],
    });

    expect(judged.map((each) => [each.lotId, each.judgmentCode, each.resultSeqNo])).toEqual([
      [1, 'ACCEPTED', 2],
      [2, 'REJECTED', 1],
    ]);
    expect(judged[0]?.superseded).toEqual([
      { resultId: 701, resultSeqNo: 1, judgmentCode: 'REJECTED' },
    ]);
  });

  it('US3-10 결과 3을 지우면 LOT 1 은 결과 2(합격), LOT 2 는 결과 1(불합격)로 다시 판정된다', () => {
    const before = [
      result(1, 'REJECTED', [1, 2]),
      result(2, 'ACCEPTED', [1]),
      result(3, 'ACCEPTED', [1, 2]),
    ];
    const codes = (results: InspectionResultSummaryForward[]) =>
      lotJudgmentsOf({ lots, results }).map((each) => [each.lotId, each.judgmentCode]);

    expect(codes(before)).toEqual([
      [1, 'ACCEPTED'],
      [2, 'ACCEPTED'],
    ]);
    expect(codes(before.slice(0, 2))).toEqual([
      [1, 'ACCEPTED'],
      [2, 'REJECTED'],
    ]);
  });

  it('서버 lotJudgments 가 있으면 그것을 LOT 표 순서로 쓴다', () => {
    const judged = lotJudgmentsOf({
      lots,
      results: [],
      lotJudgments: [
        {
          lotId: 3,
          lotNo: lot(3).lotNo,
          judgmentCode: 'HELD',
          resultId: 1,
          resultSeqNo: 1,
          superseded: [],
          reinspectionReasonCode: null,
          reinspectionReasonName: null,
        },
        {
          lotId: 1,
          lotNo: lot(1).lotNo,
          judgmentCode: 'HELD',
          resultId: 1,
          resultSeqNo: 1,
          superseded: [],
          reinspectionReasonCode: null,
          reinspectionReasonName: null,
        },
      ],
    });

    expect(judged.map((each) => each.lotId)).toEqual([1, 3]);
  });
});

describe('판정 규칙의 서버 400 코드', () => {
  it('US3-4 · US3-9 MATCHED_LOT_REQUIRED · REINSPECTION_REASON_REQUIRED 는 떼어 제 문구로, 나머지는 저장 오류 띠로', () => {
    const error: ApiError = {
      kind: 'validation',
      status: 400,
      errors: [
        { code: 'MATCHED_LOT_REQUIRED', message: 'server text', field: 'matchedLotIds' },
        { code: 'REINSPECTION_REASON_REQUIRED', message: 'server text' },
        { code: 'OTHER', message: '다른 오류' },
      ],
    } as ApiError;

    const split = splitRuleErrors(error);
    expect(split.codes).toEqual(['MATCHED_LOT_REQUIRED', 'REINSPECTION_REASON_REQUIRED']);
    expect(split.rest).toMatchObject({ kind: 'validation', errors: [{ code: 'OTHER' }] });
    expect(splitRuleErrors({ kind: 'http', status: 400, code: 'MATCHED_LOT_REQUIRED' })).toEqual({
      codes: ['MATCHED_LOT_REQUIRED'],
      rest: null,
    });
    expect(splitRuleErrors({ kind: 'network' })).toEqual({ codes: [], rest: { kind: 'network' } });
  });

  it('두 코드 모두 한국어 · 베트남어 문구가 있다', () => {
    for (const code of ['MATCHED_LOT_REQUIRED', 'REINSPECTION_REASON_REQUIRED'] as const) {
      expect(messages.iqcInboundLot.drawer.ruleErrors[code]).not.toBe('');
      expect(viMessages.iqcInboundLot.drawer.ruleErrors[code]).not.toBe('');
    }
  });
});

describe('W-01-01 변경 이력 「내용」(G2 M4 · T139)', () => {
  const h = messages.iqcInboundLot.history;
  /* 요약 칸은 계약이 모양을 적지 않은 JSON 이라(생성 타입은 빈 객체) 서버 모양 그대로 싣고 줄 하나로 맞춘다. */
  const event = (over: Record<string, unknown>): InspectionRequestEventForward =>
    ({
      occurredAt: '2099-11-11T01:00:00Z',
      eventCode: 'CONFIRMED',
      actorName: null,
      detail: null,
      inspectionResultId: null,
      summaryBefore: null,
      summaryAfter: null,
      reason: null,
      ...over,
    }) as InspectionRequestEventForward;
  const context = (refs: Record<number, { no: string; lots: [number, string][] }> = {}) => ({
    reasonNameOf: (code: string) => (code === 'TST-REMEASURE' ? '합성 재측정' : code),
    inboundLotOf: (id: number) => {
      const ref = refs[id];
      return ref === undefined ? undefined : { inboundLotNo: ref.no, lotNoOf: new Map(ref.lots) };
    },
  });
  const summary = (over: Record<string, unknown>) => ({
    inspectionRound: 2,
    overallJudgmentCode: 'REJECTED',
    inspectedQty: 200,
    matchedLotNos: ['SYN|0001', 'SYN|0002'],
    reinspectionReasonCode: null,
    ...over,
  });

  it('서버 한 줄이 있으면 그대로, 없으면 사유, 그것도 없으면 빈 칸 대신 「—」', () => {
    expect(eventDetailOf(event({ detail: '합성 한 줄' }), context())).toBe('합성 한 줄');
    expect(
      eventDetailOf(event({ eventCode: 'CONFIRM_CANCELLED', reason: '합성 취소 사유' }), context()),
    ).toBe('합성 취소 사유');
    expect(eventDetailOf(event({}), context())).toBe('—');
  });

  it('T139 결과 수정은 「결과 N 수정 — {전} → {후}」(재검 사유는 이름으로)', () => {
    const row = event({
      eventCode: 'RESULT_UPDATED',
      detail: '서버 한 줄',
      summaryBefore: summary({}),
      summaryAfter: summary({
        overallJudgmentCode: 'ACCEPTED',
        matchedLotNos: ['SYN|0001'],
        reinspectionReasonCode: 'TST-REMEASURE',
      }),
    });

    expect(eventDetailOf(row, context())).toBe(
      h.resultUpdated(
        2,
        `불합격 · ${h.inspected('200')} · ${h.matched(['0001', '0002'])}`,
        `합격 · ${h.inspected('200')} · ${h.matched(['0001'])} · ${h.reinspectionReason('합성 재측정')}`,
      ),
    );
  });

  it('T142 결과 요약에 합격 · 불합격 · 보류 수량이 있으면 「전 → 후」에 보인다(0 은 뺀다)', () => {
    const row = event({
      eventCode: 'RESULT_UPDATED',
      summaryBefore: summary({ matchedLotNos: [], acceptedQty: 0, rejectedQty: 200, heldQty: 0 }),
      summaryAfter: summary({
        overallJudgmentCode: 'ACCEPTED',
        matchedLotNos: [],
        acceptedQty: 150,
        rejectedQty: 50,
        heldQty: 0,
      }),
    });

    expect(eventDetailOf(row, context())).toBe(
      h.resultUpdated(
        2,
        `불합격 · ${h.inspected('200')} · ${h.judgedQty('불합격', '200')}`,
        `합격 · ${h.inspected('200')} · ${h.judgedQty('합격', '150')} · ${h.judgedQty('불합격', '50')}`,
      ),
    );
  });

  it('T142 「검사 의뢰 생김」 줄은 서버 한 줄을 그대로', () => {
    expect(
      eventDetailOf(event({ eventCode: 'REQUESTED', detail: '합성 입하 마감 한 줄' }), context()),
    ).toBe('합성 입하 마감 한 줄');
  });

  it('T139 분리는 떠난 쪽 「옮긴 LOT → 새 입하 LOT」, 생긴 쪽 「원래 입하 LOT 에서 n개」', () => {
    const refs = {
      7002: { no: 'IL-20991231-0004', lots: [[9003, 'SYN|0003']] as [number, string][] },
      7001: { no: 'IL-20991231-0003', lots: [] },
    };
    const out = event({
      eventCode: 'SPLIT_OUT',
      summaryAfter: { newInspectionRequestId: 502, newInboundLotId: 7002, movedLotIds: [9003] },
    });
    const into = event({
      eventCode: 'SPLIT_IN',
      summaryAfter: { fromInspectionRequestId: 501, fromInboundLotId: 7001, movedLotIds: [9003] },
    });

    expect(eventDetailOf(out, context(refs))).toBe(h.splitOut(['0003'], 1, 'IL-20991231-0004'));
    expect(eventDetailOf(into, context(refs))).toBe(h.splitIn('IL-20991231-0003', 1));
    /* 상대 입하 LOT 을 못 읽으면 개수로 보인다. */
    expect(eventDetailOf(out, context())).toBe(h.splitOut(null, 1, null));
  });
});
