import { describe, expect, it } from 'vitest';

import type { InspectionItem } from './queries';
import {
  DAILY,
  MONTHLY,
  NG,
  OK,
  canSubmit,
  hasRange,
  itemsOfType,
  judgeMeasured,
  missingRequired,
  needsRemarks,
  resultOf,
  tally,
  toOutboxDraft,
  type Entry,
  type Submission,
} from './inspection';

const item = (overrides: Partial<InspectionItem> = {}): InspectionItem => ({
  equipmentInspectionItemId: 1,
  itemCode: 'CHK-01',
  itemName: '유압 압력',
  inspectionTypeCode: DAILY,
  judgmentMethodCode: 'MEASUREMENT',
  uomId: 9,
  lowerLimit: 12,
  upperLimit: 15,
  requiredFlag: true,
  sequenceNo: 1,
  cycleTypeCode: 'DAY',
  cycleInterval: 1,
  isActive: true,
  ...overrides,
});

const visual = (overrides: Partial<InspectionItem> = {}): InspectionItem =>
  item({
    equipmentInspectionItemId: 2,
    itemName: '벨트 장력',
    judgmentMethodCode: 'VISUAL',
    uomId: null,
    lowerLimit: null,
    upperLimit: null,
    sequenceNo: 2,
    ...overrides,
  });

describe('측정값 자동 판정', () => {
  it('상하한 안이면 합격, 밖이면 NG다', () => {
    expect(judgeMeasured(item(), '13.4')).toBe(OK);
    expect(judgeMeasured(item(), '11.9')).toBe(NG);
    expect(judgeMeasured(item(), '15.1')).toBe(NG);
  });

  it('경계값은 안쪽으로 본다', () => {
    expect(judgeMeasured(item(), '12')).toBe(OK);
    expect(judgeMeasured(item(), '15')).toBe(OK);
  });

  it('적지 않았거나 숫자가 아니면 판정하지 않는다', () => {
    expect(judgeMeasured(item(), '')).toBeNull();
    expect(judgeMeasured(item(), '  ')).toBeNull();
    expect(judgeMeasured(item(), '십삼')).toBeNull();
  });

  /* 기준이 비어 있으면 자동 판정이 설 수 없다. 육안으로 넘긴다. */
  it('상하한이 비어 있으면 자동 판정이 서지 않는다', () => {
    const noRange = item({ lowerLimit: null, upperLimit: null });

    expect(hasRange(noRange)).toBe(false);
    expect(judgeMeasured(noRange, '13.4')).toBeNull();
  });
});

describe('항목 판정', () => {
  /* 사람이 덮어쓸 수 있으면 기준이 뜻을 잃는다. */
  it('측정 항목은 사람이 고른 판정을 쓰지 않는다', () => {
    const entry: Entry = { measured: '20', judged: OK };

    expect(resultOf(item(), entry)).toBe(NG);
  });

  it('육안 항목은 사람이 고른 것을 쓴다', () => {
    expect(resultOf(visual(), { judged: NG })).toBe(NG);
    expect(resultOf(visual(), {})).toBeNull();
  });

  /* 기준이 없어 육안으로 넘어간 측정 항목도 사람이 고른 것을 쓴다. */
  it('기준 없는 측정 항목은 고른 판정을 쓴다', () => {
    const noRange = item({ lowerLimit: null, upperLimit: null });

    expect(resultOf(noRange, { judged: OK })).toBe(OK);
  });
});

describe('유형별 항목', () => {
  it('고른 유형의 항목만 순번대로 낸다', () => {
    const items = [
      item({ equipmentInspectionItemId: 3, sequenceNo: 5 }),
      item({ equipmentInspectionItemId: 4, sequenceNo: 1 }),
      item({ equipmentInspectionItemId: 5, inspectionTypeCode: MONTHLY, sequenceNo: 2 }),
    ];

    expect(itemsOfType(items, DAILY).map((each) => each.equipmentInspectionItemId)).toEqual([4, 3]);
    expect(itemsOfType(items, MONTHLY).map((each) => each.equipmentInspectionItemId)).toEqual([5]);
  });
});

describe('완료 조건', () => {
  const items = [item(), visual({ requiredFlag: false })];

  it('필수 항목이 남으면 완료할 수 없고 무엇이 남았는지 말한다', () => {
    expect(missingRequired(items, {})?.itemName).toBe('유압 압력');
    expect(canSubmit({ equipmentId: 1, type: DAILY, items, entries: {}, remarks: '' }, true)).toBe(
      false,
    );
  });

  it('필수를 다 판정하면 완료할 수 있다', () => {
    const entries = { 1: { measured: '13' } };

    expect(missingRequired(items, entries)).toBeNull();
    expect(canSubmit({ equipmentId: 1, type: DAILY, items, entries, remarks: '' }, true)).toBe(
      true,
    );
  });

  /* 누가 한 점검인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 완료할 수 없다', () => {
    const entries = { 1: { measured: '13' } };

    expect(canSubmit({ equipmentId: 1, type: DAILY, items, entries, remarks: '' }, false)).toBe(
      false,
    );
  });

  it('점검할 항목이 없으면 완료할 수 없다', () => {
    expect(
      canSubmit({ equipmentId: 1, type: DAILY, items: [], entries: {}, remarks: '' }, true),
    ).toBe(false);
  });

  /* NG 는 남이 읽고 무엇을 할지 정한다. 비고 없이 넘기면 그 판단 근거가 없다. */
  it('NG가 있으면 비고 없이 완료할 수 없다', () => {
    const entries = { 1: { measured: '20' } };

    expect(needsRemarks(tally(items, entries))).toBe(true);
    expect(canSubmit({ equipmentId: 1, type: DAILY, items, entries, remarks: '' }, true)).toBe(
      false,
    );
    expect(
      canSubmit({ equipmentId: 1, type: DAILY, items, entries, remarks: '누유 확인' }, true),
    ).toBe(true);
  });
});

describe('점검 초안', () => {
  const items = [item(), visual()];
  const entries: Record<number, Entry> = { 1: { measured: '13.4' }, 2: { judged: NG } };
  const submission: Submission = {
    equipmentId: 7,
    type: DAILY,
    items,
    entries,
    remarks: '누유 확인',
  };

  it('헤더와 라인을 한 건에 담는다', () => {
    const body = toOutboxDraft(submission, '2026-09-01T00:00:00.000Z', '900028').body as {
      equipmentId: number;
      inspectionTypeCode: string;
      inspectedAt: string;
      lines: unknown[];
    };

    expect(body.equipmentId).toBe(7);
    expect(body.inspectionTypeCode).toBe(DAILY);
    expect(body.inspectedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(body.lines).toEqual([
      { inspectionItemId: 1, resultCode: OK, measuredValue: 13.4, remarks: null },
      { inspectionItemId: 2, resultCode: NG, measuredValue: null, remarks: null },
    ]);
  });

  /* 서버가 라인에서 정해 얼려 둔다. 화면이 실으면 두 곳에 판정 규칙이 생긴다. */
  it('종합 판정을 싣지 않는다', () => {
    const body = toOutboxDraft(submission, '2026-09-01T00:00:00.000Z', '900028').body as Record<
      string,
      unknown
    >;

    expect(Object.keys(body)).toEqual([
      'equipmentId',
      'inspectionTypeCode',
      'inspectedAt',
      'remarks',
      'lines',
    ]);
  });

  it('판정하지 못한 항목은 라인으로 보내지 않는다', () => {
    const body = toOutboxDraft(
      { ...submission, entries: { 1: { measured: '13.4' } } },
      '2026-09-01T00:00:00.000Z',
      '900028',
    ).body as { lines: unknown[] };

    expect(body.lines).toHaveLength(1);
  });

  it('담을 때의 사번을 들고 있고 담긴 것을 확정으로 보지 않는다', () => {
    const draft = toOutboxDraft(submission, '2026-09-01T00:00:00.000Z', '900028');

    expect(draft.workerNo).toBe('900028');
    expect(draft.confirmation).toBe('pending');
  });
});
