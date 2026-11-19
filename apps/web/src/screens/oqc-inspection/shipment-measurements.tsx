import type { components } from '@omf-mes/api-client';
import { useEffect, useRef, useState } from 'react';

import { WebItemTable } from '../pqc-panel/web-item-table';
import { useRoundMeasurements } from '../pqc-panel/queries';
import {
  CODE_GROUPS as PQC_CODE_GROUPS,
  toCodeOptions as toItemCodeOptions,
} from '../pqc-inspection/code-options';
import {
  EMPTY_MEASUREMENT_DRAFT,
  hasValueError,
  toMeasurementDrafts,
  toMeasurementInputs,
  withJudgment,
  withMeasuredValue,
  type MeasurementDrafts,
} from '../pqc-inspection/measurement-draft';
import { toMeasurementRows } from '../pqc-inspection/measurement-rows';
import { useInspectionItemSpecs } from '../pqc-inspection/queries';
import { useCodeValues } from './queries';
import { useUomLookup } from './uom-lookup';

type MeasurementInput = components['schemas']['InspectionMeasurementInput'];

/**
 * 출하 OQC 새 흐름 결과의 검사 항목 측정(피처 010 T052 · FR-009 「검사 항목·측정은 지금처럼」 · 시안 W0403-After 「그대로」).
 * 지금 OQC 화면(#284)과 같은 부품을 쓴다 — 의뢰의 검사 기준 항목(`useInspectionItemSpecs`), 값·판정 규칙(`withMeasuredValue`·
 * `withJudgment`), 보내는 값(`toMeasurementInputs` — 판정한 줄만), 표(`WebItemTable`). 고치는 결과면 그 결과의 측정치를 되살린다.
 * ⛔ 판정·수량은 건드리지 않는다 — 결과 판정은 사람이 고른다(새 흐름은 수량이 없다).
 */
export const useShipmentMeasurements = ({
  planVersionId,
  resultId,
  resetKey,
}: {
  /** 의뢰의 검사 기준 버전 — 없으면 측정 칸을 두지 않는다. */
  planVersionId: number | null | undefined;
  /** 고치는 결과 — 새로 더하면 `null`(빈 칸에서 시작). */
  resultId: number | null;
  /** 이 값이 바뀌면 칸을 다시 연다(의뢰 · 결과 수가 바뀔 때). */
  resetKey: string;
}) => {
  const versionId = planVersionId ?? null;
  const specs = useInspectionItemSpecs(versionId);
  const saved = useRoundMeasurements(resultId);
  const rows = toMeasurementRows(specs.data ?? [], resultId === null ? [] : (saved.data ?? []));
  const judgmentOptions = toItemCodeOptions(
    useCodeValues(PQC_CODE_GROUPS.measurementJudgment).data ?? [],
  );
  const [drafts, setDrafts] = useState<MeasurementDrafts>({});

  /* 같은 결과 · 항목이면 한 번만 되살린다 — 재조회가 그 사이 친 값을 덮지 않게(지금 OQC 와 같다). */
  const ready = resultId === null || saved.isSuccess;
  const key = ready
    ? `${resetKey}#${rows.map((row) => row.key).join('|')}#${String(resultId)}`
    : null;
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (key === null || restored.current === key) return;
    restored.current = key;
    setDrafts(toMeasurementDrafts(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const rowOf = (rowKey: string) => rows.find((row) => row.key === rowKey);

  return {
    hasPlan: versionId !== null,
    rows,
    drafts,
    judgmentOptions,
    isLoading: specs.isLoading,
    hasError: hasValueError(rows, drafts),
    changeValue: (rowKey: string, value: string) =>
      setDrafts((current) => ({
        ...current,
        [rowKey]: withMeasuredValue(
          rowOf(rowKey),
          current[rowKey] ?? EMPTY_MEASUREMENT_DRAFT,
          value,
        ),
      })),
    changeJudgment: (rowKey: string, judgment: string) =>
      setDrafts((current) => ({
        ...current,
        [rowKey]: withJudgment(rowOf(rowKey), current[rowKey] ?? EMPTY_MEASUREMENT_DRAFT, judgment),
      })),
    /**
     * 보낼 측정치. 고칠 때 실으면 통째로 바뀌므로 확실할 때만 싣는다 — 검사 기준이 없거나, 항목·저장된 측정치를 아직(또는 못)
     * 읽었거나, 항목이 없으면 `undefined`(서버가 그대로 둔다). 못 읽은 채 빈 배열을 보내면 저장된 측정치가 지워진다.
     */
    inputs: (measuredAt: string): MeasurementInput[] | undefined =>
      versionId === null || !specs.isSuccess || !ready || rows.length === 0
        ? undefined
        : toMeasurementInputs(rows, drafts, measuredAt),
  };
};

export type ShipmentMeasurements = ReturnType<typeof useShipmentMeasurements>;

/** 측정 칸 — 관리웹 W-04-03 결과 서랍과 POP P-04-06 결과 입력이 함께 쓴다. 검사 기준이 없으면 그리지 않는다. */
export const ShipmentMeasurementSection = ({
  form,
  locked,
}: {
  form: ShipmentMeasurements;
  locked: boolean;
}) => {
  const uoms = useUomLookup();
  if (!form.hasPlan) return null;

  return (
    <div className="oqc-shipment-measurements">
      <WebItemTable
        rows={form.rows}
        drafts={form.drafts}
        onValueChange={form.changeValue}
        onJudgmentChange={form.changeJudgment}
        judgmentOptions={form.judgmentOptions}
        uomCodeOf={(uomId) => uoms.codeOf(uomId ?? undefined)}
        isLoading={form.isLoading}
        isLocked={locked}
      />
    </div>
  );
};
