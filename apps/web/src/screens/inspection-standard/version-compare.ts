import { messages } from '@omf-mes/i18n';

import type { InspectionItemSpec, VersionFormValues } from './types';

const t = messages.inspectionStandard;

/** 코드 · id 를 사람이 읽는 이름으로 — 화면이 가진 선택 목록에서 찾는다. */
export interface CompareLabels {
  samplingMethod: (code: string) => string;
  inspectionFrequency: (code: string) => string;
  frequencyIntervalUom: (code: string) => string;
  dataType: (code: string) => string;
  uom: (uomId: string) => string;
  inspectionMethod: (code: string) => string;
  equipment: (equipmentId: string) => string;
}

export interface SettingRow {
  key: string;
  label: string;
  base: string;
  target: string;
  changed: boolean;
}

export type ItemCompareStatus = 'added' | 'removed' | 'changed' | 'same';

export interface ItemCompareRow {
  code: string;
  name: string;
  status: ItemCompareStatus;
  /** 바뀐 칸만 — 「이름: 전 → 후」 */
  changes: string[];
}

const EMPTY = t.values.empty;

const text = (value: string): string => (value === '' ? EMPTY : value);
const labelOrEmpty = (value: string, label: (value: string) => string): string =>
  value === '' ? EMPTY : label(value);

/** 버전 설정 칸마다 두 값을 나란히 — 다른 칸은 `changed` 로 표시한다. */
export const compareSettings = (
  base: VersionFormValues,
  target: VersionFormValues,
  labels: CompareLabels,
): SettingRow[] => {
  const fields: {
    key: keyof VersionFormValues;
    label: string;
    format: (value: string) => string;
  }[] = [
    { key: 'effectiveFrom', label: t.fields.effectiveFrom, format: text },
    { key: 'effectiveTo', label: t.fields.effectiveTo, format: text },
    {
      key: 'samplingMethodCode',
      label: t.fields.samplingMethod,
      format: (value) => labelOrEmpty(value, labels.samplingMethod),
    },
    { key: 'samplingRatio', label: t.fields.samplingRatio, format: text },
    { key: 'samplingQty', label: t.fields.samplingQty, format: text },
    { key: 'aqlValue', label: t.fields.aqlValue, format: text },
    { key: 'acceptanceNumber', label: t.fields.acceptanceNumber, format: text },
    { key: 'rejectionNumber', label: t.fields.rejectionNumber, format: text },
    {
      key: 'inspectionFrequencyCode',
      label: t.fields.inspectionFrequency,
      format: (value) => labelOrEmpty(value, labels.inspectionFrequency),
    },
    { key: 'frequencyIntervalValue', label: t.fields.frequencyIntervalValue, format: text },
    {
      key: 'frequencyIntervalUomCode',
      label: t.fields.frequencyIntervalUom,
      format: (value) => labelOrEmpty(value, labels.frequencyIntervalUom),
    },
  ];

  return fields.map(({ key, label, format }) => ({
    key,
    label,
    base: format(base[key]),
    target: format(target[key]),
    changed: base[key] !== target[key],
  }));
};

const numberText = (value: number | null | undefined): string =>
  value === null || value === undefined ? EMPTY : String(value);
const idText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);
const flagText = (value: boolean): string => (value ? t.compare.yes : t.compare.no);

/** 검사 항목 한 줄에서 견줄 칸 — 이름과 사람이 읽는 값. */
const itemFields = (
  spec: InspectionItemSpec,
  labels: CompareLabels,
): { label: string; value: string }[] => [
  { label: t.fields.inspectionItemName, value: spec.inspectionItemName },
  { label: t.fields.dataType, value: labelOrEmpty(spec.dataTypeCode, labels.dataType) },
  { label: t.fields.uom, value: labelOrEmpty(idText(spec.uomId), labels.uom) },
  { label: t.fields.targetValue, value: numberText(spec.targetValue) },
  { label: t.fields.lowerLimit, value: numberText(spec.lowerLimit) },
  { label: t.fields.upperLimit, value: numberText(spec.upperLimit) },
  { label: t.fields.measurementCount, value: String(spec.measurementCount) },
  {
    label: t.fields.inspectionMethod,
    value: labelOrEmpty(spec.inspectionMethodCode ?? '', labels.inspectionMethod),
  },
  {
    label: t.fields.defaultInspectionEquipment,
    value: labelOrEmpty(idText(spec.defaultInspectionEquipmentId), labels.equipment),
  },
  { label: t.dialog.requiredFlagLabel, value: flagText(spec.requiredFlag) },
  { label: t.dialog.automaticJudgmentLabel, value: flagText(spec.automaticJudgment) },
];

/**
 * 검사 항목을 **항목코드로 짝지어** 견준다 — 순서 값은 서버 채번이라 짝의 기준이 될 수 없다.
 * 비교 버전의 순서대로 놓고, 기준 버전에만 있는(삭제된) 항목은 뒤에 붙인다.
 */
export const compareItems = (
  base: readonly InspectionItemSpec[],
  target: readonly InspectionItemSpec[],
  labels: CompareLabels,
): ItemCompareRow[] => {
  const baseByCode = new Map(base.map((spec) => [spec.inspectionItemCode, spec]));
  const targetCodes = new Set(target.map((spec) => spec.inspectionItemCode));

  const rows: ItemCompareRow[] = target.map((spec) => {
    const before = baseByCode.get(spec.inspectionItemCode);
    if (before === undefined) {
      return {
        code: spec.inspectionItemCode,
        name: spec.inspectionItemName,
        status: 'added',
        changes: [],
      };
    }
    const beforeFields = itemFields(before, labels);
    const changes = itemFields(spec, labels).flatMap((field, index) => {
      const old = beforeFields[index]?.value ?? EMPTY;
      return old === field.value ? [] : [t.compare.change(field.label, old, field.value)];
    });
    return {
      code: spec.inspectionItemCode,
      name: spec.inspectionItemName,
      status: changes.length === 0 ? 'same' : 'changed',
      changes,
    };
  });

  for (const spec of base) {
    if (!targetCodes.has(spec.inspectionItemCode)) {
      rows.push({
        code: spec.inspectionItemCode,
        name: spec.inspectionItemName,
        status: 'removed',
        changes: [],
      });
    }
  }

  return rows;
};
