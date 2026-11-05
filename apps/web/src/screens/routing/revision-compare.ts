import { messages } from '@omf-mes/i18n';

import { ratioToPercentText } from './operation-order';
import type { RoutingOperation } from './types';

const t = messages.routing;

export type OperationCompareStatus = 'added' | 'removed' | 'changed' | 'same';

/** 두 Rev 의 공정 한 줄 — 같은 공정끼리 짝지은 결과. 한쪽에만 있으면 추가 · 삭제다. */
export interface OperationCompareRow {
  key: string;
  processId: number;
  base: RoutingOperation | null;
  target: RoutingOperation | null;
  status: OperationCompareStatus;
  /** 바뀐 칸마다 이름 · 전 · 후. */
  changes: OperationFieldChange[];
}

/** 공정 한 줄에서 바뀐 칸 하나. */
export interface OperationFieldChange {
  label: string;
  before: string;
  after: string;
}

/** 「이름: 전 → 후」 한 줄 글 — 변경 칩에 마우스를 올리면 보이는 글(검사 기준 비교와 같다). */
export const changeText = (change: OperationFieldChange): string =>
  `${change.label}: ${change.before} → ${change.after}`;

const FLAG_KEYS = [
  'mesManaged',
  'materialInputManaged',
  'productionResultManaged',
  'inspectionManaged',
  'outputLotRequired',
  'equipmentRequired',
  'moldRequired',
] as const;

const show = (value: unknown): string =>
  value === null || value === undefined || value === '' ? t.values.empty : String(value);

/** 켜진 관리 항목 이름을 이어 낸다 — 표의 「관리 항목」 칸과 같은 말. */
const managedLabel = (operation: RoutingOperation): string => {
  const on = FLAG_KEYS.filter((key) => operation[key]).map((key) => t.operationFlags[key]);
  return on.length === 0 ? t.values.empty : on.join(', ');
};

/**
 * 공정 구성 비교(#231) — 서버에 비교 경로가 없어 두 Rev 의 공정 목록을 받아 화면이 견준다.
 *
 * 짝짓기 열쇠는 「공정 + 그 공정의 몇 번째 등장」이다. 공정 라인 식별자는 Rev 마다 새로 매겨져(신규 Rev 는 복사본)
 * 두 Rev 사이에 이어지지 않는다. 같은 공정이 두 번 들어가면 순서대로 짝짓는다. 순서는 기준 Rev 순서, 추가분은 뒤에.
 */
export const compareOperations = (
  base: readonly RoutingOperation[],
  target: readonly RoutingOperation[],
): OperationCompareRow[] => {
  const keyed = (rows: readonly RoutingOperation[]) => {
    const seen = new Map<number, number>();
    return [...rows]
      .sort((left, right) => left.operationSeq - right.operationSeq)
      .map((row, index) => {
        const nth = (seen.get(row.processId) ?? 0) + 1;
        seen.set(row.processId, nth);
        return { key: `${String(row.processId)}#${String(nth)}`, row, position: index + 1 };
      });
  };
  const baseRows = keyed(base);
  const targetRows = keyed(target);
  const targetByKey = new Map(targetRows.map((entry) => [entry.key, entry]));
  const baseKeys = new Set(baseRows.map((entry) => entry.key));

  const diff = (
    before: { row: RoutingOperation; position: number },
    after: { row: RoutingOperation; position: number },
  ): OperationFieldChange[] => {
    const changes: OperationFieldChange[] = [];
    const push = (label: string, from: unknown, to: unknown) => {
      if (show(from) !== show(to)) changes.push({ label, before: show(from), after: show(to) });
    };
    push(t.fields.operationNo, before.position, after.position);
    push(t.fields.operationName, before.row.operationName, after.row.operationName);
    push(t.fields.managedItems, managedLabel(before.row), managedLabel(after.row));
    push(
      t.fields.standardCycleTimeSec,
      before.row.standardCycleTimeSec,
      after.row.standardCycleTimeSec,
    );
    /* 서버 비율(0~1)을 화면과 같은 퍼센트로 보인다(#231). */
    const percent = (value: number | null | undefined): string | null =>
      value === null || value === undefined ? null : t.values.percent(ratioToPercentText(value));
    push(
      t.fields.standardYieldRate,
      percent(before.row.standardYieldRate),
      percent(after.row.standardYieldRate),
    );
    return changes;
  };

  const rows: OperationCompareRow[] = baseRows.map((entry) => {
    const match = targetByKey.get(entry.key);
    if (match === undefined) {
      return {
        key: entry.key,
        processId: entry.row.processId,
        base: entry.row,
        target: null,
        status: 'removed',
        changes: [],
      };
    }
    const changes = diff(entry, match);
    return {
      key: entry.key,
      processId: entry.row.processId,
      base: entry.row,
      target: match.row,
      status: changes.length === 0 ? 'same' : 'changed',
      changes,
    };
  });

  for (const entry of targetRows) {
    if (baseKeys.has(entry.key)) continue;
    rows.push({
      key: entry.key,
      processId: entry.row.processId,
      base: null,
      target: entry.row,
      status: 'added',
      changes: [],
    });
  }
  return rows;
};
