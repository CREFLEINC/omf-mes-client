import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import type { InspectionItem } from './queries';

export const DAILY = 'DAILY';
export const MONTHLY = 'MONTHLY';

export const OK = 'OK';
export const NG = 'NG';

/** 측정값으로 판정하는 항목. 그 밖은 사람이 합격·NG 를 고른다. */
export const MEASUREMENT = 'MEASUREMENT';

export type InspectionType = typeof DAILY | typeof MONTHLY;
export type Result = typeof OK | typeof NG;

/** 항목 하나에 사람이 넣은 것. 측정 방식이면 값이, 육안이면 고른 판정이 온다. */
export interface Entry {
  measured?: string;
  judged?: Result;
  remarks?: string;
}

export const isMeasurement = (item: InspectionItem): boolean =>
  item.judgmentMethodCode === MEASUREMENT;

/**
 * 자동 판정이 설 수 있는 항목인가.
 *
 * 측정 방식이어도 상하한이 비어 있으면 판정이 서지 않는다. 그때는 감추지 않고 육안으로 넘긴다.
 */
export const hasRange = (item: InspectionItem): boolean =>
  isMeasurement(item) && item.lowerLimit != null && item.upperLimit != null;

/**
 * 측정값을 상하한으로 판정한다.
 *
 * 사람이 덮어쓸 수 없다. 범위 밖인데 합격시킬 수 있으면 기준이 뜻을 잃는다 - 그렇게 해야 하는
 * 경우는 점검이 아니라 특채·한도승인이고 그 경로는 품질이 갖는다.
 */
export const judgeMeasured = (item: InspectionItem, measured: string): Result | null => {
  const value = Number(measured);

  if (measured.trim() === '' || Number.isNaN(value)) {
    return null;
  }

  if (!hasRange(item)) {
    return null;
  }

  return value >= (item.lowerLimit ?? 0) && value <= (item.upperLimit ?? 0) ? OK : NG;
};

/** 이 항목의 판정. 측정 방식이면 자동 판정이고, 그 밖은 사람이 고른 것이다. */
export const resultOf = (item: InspectionItem, entry: Entry | undefined): Result | null => {
  if (entry === undefined) {
    return null;
  }

  return hasRange(item) ? judgeMeasured(item, entry.measured ?? '') : (entry.judged ?? null);
};

/** 고른 유형의 항목만 점검한다. 일상 점검에 정기 항목이 섞이면 매일 하지 않을 것을 매일 묻는다. */
export const itemsOfType = (items: InspectionItem[], type: InspectionType): InspectionItem[] =>
  items
    .filter((item) => item.inspectionTypeCode === type)
    .sort((left, right) => left.sequenceNo - right.sequenceNo);

/** 아직 판정되지 않은 필수 항목. 하나라도 남으면 완료할 수 없다. */
export const missingRequired = (
  items: InspectionItem[],
  entries: Record<number, Entry>,
): InspectionItem | null =>
  items.find(
    (item) => item.requiredFlag && resultOf(item, entries[item.equipmentInspectionItemId]) === null,
  ) ?? null;

export interface Tally {
  ok: number;
  ng: number;
  judged: number;
}

export const tally = (items: InspectionItem[], entries: Record<number, Entry>): Tally =>
  items.reduce<Tally>(
    (total, item) => {
      const result = resultOf(item, entries[item.equipmentInspectionItemId]);

      if (result === null) {
        return total;
      }

      return {
        ok: total.ok + (result === OK ? 1 : 0),
        ng: total.ng + (result === NG ? 1 : 0),
        judged: total.judged + 1,
      };
    },
    { ok: 0, ng: 0, judged: 0 },
  );

/** NG 가 하나라도 있으면 비고를 받는다. 남이 읽고 무엇을 할지 정하는 자유 텍스트다. */
export const needsRemarks = (counts: Tally): boolean => counts.ng > 0;

/* 적힌 값이 없으면 싣지 않는다. 기준이 없어 육안으로 넘어간 측정 항목이 그 자리다. */
const measuredValueOf = (entry: Entry | undefined): number | null => {
  const measured = entry?.measured?.trim() ?? '';

  return measured === '' || Number.isNaN(Number(measured)) ? null : Number(measured);
};

export interface Submission {
  equipmentId: number;
  type: InspectionType;
  items: InspectionItem[];
  entries: Record<number, Entry>;
  remarks: string;
}

export const canSubmit = (submission: Submission, hasWorker: boolean): boolean => {
  if (!hasWorker || submission.items.length === 0) {
    return false;
  }

  if (missingRequired(submission.items, submission.entries) !== null) {
    return false;
  }

  return (
    !needsRemarks(tally(submission.items, submission.entries)) || submission.remarks.trim() !== ''
  );
};

/**
 * 점검을 큐에 담을 형태로 만든다.
 *
 * 종합 판정을 싣지 않는다 - 계약이 받지 않고 서버가 라인에서 정해 얼려 둔다. 판정하지 못한
 * 항목은 라인으로 보내지 않는다.
 */
export const toOutboxDraft = (
  submission: Submission,
  occurredAt: string,
  workerNo: string,
): OutboxDraft => ({
  label: messages.equipmentInspection.record,
  workerNo,
  idempotencyKey: createIdempotencyKey(),
  method: 'POST',
  path: '/maintenance/inspections',
  body: {
    equipmentId: submission.equipmentId,
    inspectionTypeCode: submission.type,
    inspectedAt: occurredAt,
    remarks: submission.remarks.trim() === '' ? null : submission.remarks.trim(),
    lines: submission.items.flatMap((item) => {
      const entry = submission.entries[item.equipmentInspectionItemId];
      const result = resultOf(item, entry);

      if (result === null) {
        return [];
      }

      return [
        {
          inspectionItemId: item.equipmentInspectionItemId,
          resultCode: result,
          measuredValue: measuredValueOf(entry),
          remarks: entry?.remarks?.trim() === '' ? null : (entry?.remarks ?? null),
        },
      ];
    }),
  },
  occurredAt,
  /* 이 기록이 남의 판정 근거라, 담긴 것만으로 점검됐다고 할 수 없다. */
  confirmation: 'pending',
});
