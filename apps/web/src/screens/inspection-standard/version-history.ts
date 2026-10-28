import { messages } from '@omf-mes/i18n';

import type { CompareLabels } from './version-compare';

const t = messages.inspectionStandard;

/** 서버 `AuditEvent` 가운데 이 화면이 쓰는 것. 전/후 값은 계약 필드 이름의 바뀐 키만 담긴다. */
export interface VersionAuditEvent {
  auditEventId: number;
  occurredAt: string;
  eventTypeCode: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  performedBy: number | null;
}

export interface HistoryRow {
  id: number;
  occurredAt: string;
  performedBy: number | null;
  action: string;
  changes: string[];
}

type Fields = Record<string, unknown>;

const EMPTY = t.values.empty;

const raw = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value === 'boolean') return value ? t.compare.yes : t.compare.no;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** 버전 칸 이름과 값 풀이 — 코드는 화면이 가진 선택 목록으로 이름을 찾는다. */
const versionFields = (
  labels: CompareLabels,
): Record<string, { label: string; format: (value: unknown) => string }> => {
  const code = (find: (value: string) => string) => (value: unknown) =>
    value === null || value === undefined || value === '' ? EMPTY : find(String(value));
  return {
    effectiveFrom: { label: t.fields.effectiveFrom, format: raw },
    effectiveTo: { label: t.fields.effectiveTo, format: raw },
    samplingMethodCode: { label: t.fields.samplingMethod, format: code(labels.samplingMethod) },
    samplingRatio: { label: t.fields.samplingRatio, format: raw },
    samplingQty: { label: t.fields.samplingQty, format: raw },
    aqlValue: { label: t.fields.aqlValue, format: raw },
    acceptanceNumber: { label: t.fields.acceptanceNumber, format: raw },
    rejectionNumber: { label: t.fields.rejectionNumber, format: raw },
    inspectionFrequencyCode: {
      label: t.fields.inspectionFrequency,
      format: code(labels.inspectionFrequency),
    },
    frequencyIntervalValue: { label: t.fields.frequencyIntervalValue, format: raw },
    frequencyIntervalUomCode: {
      label: t.fields.frequencyIntervalUom,
      format: code(labels.frequencyIntervalUom),
    },
    planVersion: { label: t.fields.planVersion, format: raw },
    statusCode: { label: t.fields.status, format: raw },
  };
};

const itemFields = (
  labels: CompareLabels,
): Record<string, { label: string; format: (value: unknown) => string }> => {
  const code = (find: (value: string) => string) => (value: unknown) =>
    value === null || value === undefined || value === '' ? EMPTY : find(String(value));
  return {
    inspectionItemName: { label: t.fields.inspectionItemName, format: raw },
    dataTypeCode: { label: t.fields.dataType, format: code(labels.dataType) },
    uomId: { label: t.fields.uom, format: code(labels.uom) },
    targetValue: { label: t.fields.targetValue, format: raw },
    lowerLimit: { label: t.fields.lowerLimit, format: raw },
    upperLimit: { label: t.fields.upperLimit, format: raw },
    measurementCount: { label: t.fields.measurementCount, format: raw },
    inspectionMethodCode: {
      label: t.fields.inspectionMethod,
      format: code(labels.inspectionMethod),
    },
    defaultInspectionEquipmentId: {
      label: t.fields.defaultInspectionEquipment,
      format: code(labels.equipment),
    },
    requiredFlag: { label: t.dialog.requiredFlagLabel, format: raw },
    automaticJudgment: { label: t.dialog.automaticJudgmentLabel, format: raw },
    sequenceNo: { label: t.fields.sequence, format: raw },
  };
};

/** 서버가 남긴 전/후 값으로 무슨 일이었는지 가른다 — 이벤트 유형은 생성 · 수정 · 삭제 셋뿐이다. */
const actionOf = (event: VersionAuditEvent): string => {
  const before = event.beforeValue ?? {};
  const after = event.afterValue ?? {};
  if (event.eventTypeCode === 'DELETE') return t.history.discarded;
  if (event.eventTypeCode === 'CREATE') {
    return Object.keys(after).length <= 2 && 'planVersion' in after
      ? t.history.revised
      : t.history.created;
  }
  if ('items' in before || 'items' in after) return t.history.itemsSaved;
  if (after.statusCode === 'CONFIRMED') return t.history.confirmed;
  if (after.statusCode === 'OBSOLETE') return t.history.obsoleted;
  if (Object.keys(after).length > 0 || Object.keys(before).length > 0)
    return t.history.settingsSaved;
  return t.history.updated;
};

const itemLines = (before: Fields, after: Fields, labels: CompareLabels): string[] => {
  const fields = itemFields(labels);
  const asList = (value: unknown): Fields[] =>
    Array.isArray(value)
      ? value.filter((item): item is Fields => typeof item === 'object' && item !== null)
      : [];
  const beforeItems = asList(before.items);
  const afterItems = asList(after.items);
  const codeOf = (item: Fields): string => raw(item.inspectionItemCode);
  const beforeByCode = new Map(beforeItems.map((item) => [codeOf(item), item]));
  const afterCodes = new Set(afterItems.map(codeOf));
  const lines: string[] = [];

  for (const item of afterItems) {
    const old = beforeByCode.get(codeOf(item));
    if (old === undefined) {
      lines.push(t.history.itemAdded(codeOf(item)));
      continue;
    }
    for (const key of Object.keys(item)) {
      if (key === 'inspectionItemCode') continue;
      const field = fields[key];
      const format = field?.format ?? raw;
      lines.push(
        t.history.itemChanged(
          codeOf(item),
          field?.label ?? key,
          format(old[key]),
          format(item[key]),
        ),
      );
    }
  }
  for (const item of beforeItems) {
    if (!afterCodes.has(codeOf(item))) lines.push(t.history.itemRemoved(codeOf(item)));
  }
  return lines;
};

/** 이벤트 하나를 표 한 줄로 — 바뀐 칸마다 「이름: 전 → 후」. 모르는 키도 원문 그대로 보인다. */
export const toHistoryRow = (event: VersionAuditEvent, labels: CompareLabels): HistoryRow => {
  const before = event.beforeValue ?? {};
  const after = event.afterValue ?? {};
  const fields = versionFields(labels);

  let changes: string[];
  if ('items' in before || 'items' in after) {
    changes = itemLines(before, after, labels);
  } else if (event.eventTypeCode === 'CREATE' || event.eventTypeCode === 'DELETE') {
    changes = [];
  } else {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (key) => key !== 'statusCode',
    );
    changes = keys.map((key) => {
      const field = fields[key];
      const format = field?.format ?? raw;
      return t.compare.change(field?.label ?? key, format(before[key]), format(after[key]));
    });
  }

  return {
    id: event.auditEventId,
    occurredAt: event.occurredAt,
    performedBy: event.performedBy,
    action: actionOf(event),
    changes,
  };
};
