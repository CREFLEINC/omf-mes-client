import { messages } from '@omf-mes/i18n';

import { compareOperations } from './revision-compare';
import { resolveRoutingStatus } from './routing-status';
import type { RoutingOperation } from './types';

const t = messages.routing;

/** 서버 `AuditEvent` 가운데 이 화면이 쓰는 것. 전/후 값은 계약 필드 이름의 바뀐 키만 담긴다. */
export interface RoutingAuditEvent {
  auditEventId: number;
  occurredAt: string;
  eventTypeCode: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  performedBy: number | null;
}

/** 바뀐 칸 하나 — 이름과 전/후 값. 공정 추가 · 삭제는 값 대신 `note` 를 둔다(검사 기준 변경 이력과 같은 모양). */
export interface HistoryChange {
  label: string;
  before?: string;
  after?: string;
  note?: 'added' | 'removed';
}

export interface HistoryRow {
  id: number;
  occurredAt: string;
  performedBy: number | null;
  action: string;
  changes: HistoryChange[];
}

type Fields = Record<string, unknown>;

const EMPTY = t.values.empty;
const count = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

const plain = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value === 'boolean') return value ? t.history.yes : t.history.no;
  return String(value);
};

/** 칸 이름과 값 풀이 — 모르는 칸은 키 이름 그대로 낸다(지어내지 않는다). */
const FIELDS: Record<string, { label: string; format: (value: unknown) => string }> = {
  routingCode: { label: t.fields.routingCode, format: plain },
  routingVersion: {
    label: t.fields.revision,
    format: (value) => (typeof value === 'number' ? t.values.revision(value) : plain(value)),
  },
  statusCode: {
    label: t.fields.status,
    format: (value) =>
      typeof value === 'string' ? resolveRoutingStatus(value).label : plain(value),
  },
  isDefault: { label: t.fields.defaultRevision, format: plain },
  confirmedAt: { label: t.fields.confirmedAt, format: plain },
  copiedFromRoutingId: { label: t.history.copiedFrom, format: plain },
};

/** 이력 한 건의 구분 — 무엇이 바뀌었는지로 정한다(서버는 CREATE · UPDATE 만 적는다). */
const actionOf = (event: RoutingAuditEvent, before: Fields, after: Fields): string => {
  if (event.eventTypeCode === 'CREATE') {
    return 'copiedFromRoutingId' in after ? t.history.revised : t.history.created;
  }
  if ('statusCode' in after) {
    const status = resolveRoutingStatus(String(after.statusCode)).status;
    if (status === 'confirmed') return t.history.confirmed;
    if (status === 'obsolete') return t.history.obsoleted;
  }
  if ('isDefault' in after)
    return after.isDefault === true ? t.history.defaultSet : t.history.defaultUnset;
  if ('operations' in after || 'operations' in before) return t.history.operationsSaved;
  if ('dependencies' in after || 'dependencies' in before) return t.history.dependenciesSaved;
  if (Object.keys(after).length > 0) return t.history.headerSaved;
  return t.history.updated;
};

/** 공정 구성 저장 — 전/후 목록을 Rev 비교와 같은 방식으로 견줘 공정마다 한 줄(#231). */
const operationChanges = (
  before: unknown,
  after: unknown,
  processLabel: (processId: string) => string,
): HistoryChange[] => {
  const list = (value: unknown) => (Array.isArray(value) ? (value as RoutingOperation[]) : []);
  const lines = compareOperations(list(before), list(after))
    .filter((row) => row.status !== 'same')
    .flatMap((row): HistoryChange[] => {
      const name = processLabel(String(row.processId));
      if (row.status === 'added' || row.status === 'removed') {
        return [{ label: name, note: row.status }];
      }
      return row.changes.map((change) => ({
        label: t.history.operationField(name, change.label),
        before: change.before,
        after: change.after,
      }));
    });
  return lines.length > 0
    ? lines
    : [
        {
          label: t.history.operationCountLabel,
          before: t.history.countValue(count(before)),
          after: t.history.countValue(count(after)),
        },
      ];
};

export const toHistoryRow = (
  event: RoutingAuditEvent,
  processLabel: (processId: string) => string,
): HistoryRow => {
  const before = event.beforeValue ?? {};
  const after = event.afterValue ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  /* 등록 · 신규 Rev 발행은 바뀐 칸이 아니라 새로 생긴 것이라 변경 내용을 비운다(검사 기준 변경 이력과 같다). */
  const changes: HistoryChange[] =
    event.eventTypeCode === 'CREATE'
      ? []
      : keys.flatMap((key): HistoryChange[] => {
          if (key === 'operations') return operationChanges(before[key], after[key], processLabel);
          if (key === 'dependencies') {
            return [
              {
                label: t.history.dependencyCountLabel,
                before: t.history.dependencyCountValue(count(before[key])),
                after: t.history.dependencyCountValue(count(after[key])),
              },
            ];
          }
          const field = FIELDS[key] ?? { label: key, format: plain };
          return [
            {
              label: field.label,
              before: field.format(before[key]),
              after: field.format(after[key]),
            },
          ];
        });

  return {
    id: event.auditEventId,
    occurredAt: event.occurredAt,
    performedBy: event.performedBy,
    action: actionOf(event, before, after),
    changes,
  };
};
