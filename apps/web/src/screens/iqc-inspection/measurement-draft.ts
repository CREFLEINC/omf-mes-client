import type { components } from '@omf-mes/api-client';

import type { MeasurementRow } from './measurement-rows';

type MeasurementInput = components['schemas']['InspectionMeasurementInput'];

/**
 * 항목별 측정 입력 초안(omf-all-around#247) — 검사 기준(확정안)의 「항목 × 측정 회차」마다 값 하나와 판정 하나를 받는다.
 *
 * ⭐ 값 칸은 항목 자료형으로 갈린다 — 수치(`NUMERIC`)는 숫자, 글(`TEXT`)은 글, 예/아니오(`BOOLEAN`)는 양호 · 불량(`'true'` ·
 * `'false'`). 계약이 셋 중 하나만 채우게 한다.
 *
 * ⭐ 판정은 사람이 정한다. 수치 항목에 자동 판정이 켜져 있고 상·하한이 있으면 값으로 판정을 «채워 시작»하되 바꿀 수 있다
 * (계약 P-02-13 §5-11). ⛔ 종합 판정은 항목 판정으로 자동으로 내리지 않는다(계약 P-02-13 §6).
 */
export interface MeasureEntry {
  value: string;
  /** 측정치 판정 코드. 아직 고르지 않았으면 `''` */
  judgment: string;
  /** 값을 자동 판정으로 채웠는가 — 값을 고치면 판정을 다시 채운다. 사람이 고른 판정은 건드리지 않는다 */
  autoFilled: boolean;
  /** 서버에 남은 측정 시각 · 계측기 — 값을 고치지 않은 줄은 그대로 다시 싣는다 */
  measuredAt: string | null;
  inspectionEquipmentId: number | null;
}

export type MeasureDraft = Record<string, MeasureEntry>;

const ACCEPTED = 'ACCEPTED';
const REJECTED = 'REJECTED';

/** 수치 칸이 받는 모양 — 음수 · 소수 포함. */
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

const EMPTY_ENTRY: MeasureEntry = {
  value: '',
  judgment: '',
  autoFilled: false,
  measuredAt: null,
  inspectionEquipmentId: null,
};

export const entryOf = (draft: MeasureDraft, key: string): MeasureEntry =>
  draft[key] ?? EMPTY_ENTRY;

const valueTextOf = (row: MeasurementRow): string => {
  const measured = row.measured;
  if (measured === null) return '';
  if (measured.numericValue !== null) return String(measured.numericValue);
  if (measured.textValue !== null) return measured.textValue;
  if (measured.booleanValue !== null) return String(measured.booleanValue);
  return '';
};

/** 저장된 측정치로 초안을 만든다 — 재지 않은 줄은 빈 칸이다. */
export const measureDraftOf = (rows: readonly MeasurementRow[]): MeasureDraft =>
  Object.fromEntries(
    rows
      .filter((row) => row.measured !== null)
      .map((row) => [
        row.key,
        {
          value: valueTextOf(row),
          judgment: row.measured?.judgmentCode ?? '',
          autoFilled: false,
          measuredAt: row.measured?.measuredAt ?? null,
          inspectionEquipmentId: row.measured?.inspectionEquipmentId ?? null,
        },
      ]),
  );

/** 두 초안이 같은 값 · 판정인가 — 다르면 [임시 저장]이 켜진다. */
export const isSameMeasureDraft = (left: MeasureDraft, right: MeasureDraft): boolean => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => {
    const a = entryOf(left, key);
    const b = entryOf(right, key);
    return a.value.trim() === b.value.trim() && a.judgment === b.judgment;
  });
};

/** 값으로 채울 판정 — 자동 판정 · 수치 · 상·하한 중 하나 이상이 있을 때만. 값이 숫자가 아니면 `null`. */
export const autoJudgmentOf = (row: MeasurementRow, value: string): string | null => {
  if (!row.autoJudgment || row.dataType !== 'NUMERIC') return null;
  const { lower, upper } = row.spec;
  if (lower === null && upper === null) return null;
  const text = value.trim();
  if (!NUMBER_PATTERN.test(text)) return null;
  const number = Number(text);
  if (lower !== null && number < lower) return REJECTED;
  if (upper !== null && number > upper) return REJECTED;
  return ACCEPTED;
};

/** 값을 고친다 — 자동 판정이 서는 줄은 판정을 다시 채우고, 사람이 고른 판정은 그대로 둔다. */
export const withValue = (
  draft: MeasureDraft,
  row: MeasurementRow,
  value: string,
): MeasureDraft => {
  const entry = entryOf(draft, row.key);
  const auto = autoJudgmentOf(row, value);
  const keepJudgment = entry.judgment !== '' && !entry.autoFilled;
  return {
    ...draft,
    [row.key]: {
      ...entry,
      value,
      judgment: keepJudgment ? entry.judgment : (auto ?? ''),
      autoFilled: !keepJudgment && auto !== null,
      measuredAt: null,
    },
  };
};

export const withJudgment = (
  draft: MeasureDraft,
  row: MeasurementRow,
  judgment: string,
): MeasureDraft => ({
  ...draft,
  [row.key]: { ...entryOf(draft, row.key), judgment, autoFilled: false },
});

/** 수치 칸에 숫자가 아닌 값이 있는가. */
export const isInvalidValue = (row: MeasurementRow, entry: MeasureEntry): boolean =>
  row.dataType === 'NUMERIC' &&
  entry.value.trim() !== '' &&
  !NUMBER_PATTERN.test(entry.value.trim());

const hasValue = (entry: MeasureEntry): boolean => entry.value.trim() !== '';

/**
 * 저장을 막는 사유 — 숫자가 아닌 수치 값 · 값과 판정 중 하나만 적은 줄. 다 비운 줄은 재지 않은 것이라 막지 않는다.
 * ⛔ 반쯤 적은 줄을 빼고 보내지 않는다 — 계약이 측정치를 통째로 갈아 끼워, 빼면 저장 뒤 그 줄이 사라진다.
 */
export const measureSaveBlockOf = (
  rows: readonly MeasurementRow[],
  draft: MeasureDraft,
): 'invalid' | 'incomplete' | null => {
  const entries = rows.map((row) => ({ row, entry: entryOf(draft, row.key) }));
  if (entries.some(({ row, entry }) => isInvalidValue(row, entry))) return 'invalid';
  if (entries.some(({ entry }) => hasValue(entry) !== (entry.judgment !== ''))) return 'incomplete';
  return null;
};

/** 필수 항목 중 아직 재지 않은 줄이 있는가 — 확정만 막는다(임시 저장은 된다). */
export const hasMissingRequired = (rows: readonly MeasurementRow[], draft: MeasureDraft): boolean =>
  rows.some((row) => {
    const entry = entryOf(draft, row.key);
    return row.required && (!hasValue(entry) || entry.judgment === '');
  });

const valueFieldOf = (
  row: MeasurementRow,
  text: string,
): Pick<MeasurementInput, 'numericValue' | 'textValue' | 'booleanValue'> => {
  if (row.dataType === 'NUMERIC') return { numericValue: Number(text) };
  if (row.dataType === 'BOOLEAN') return { booleanValue: text === 'true' };
  return { textValue: text };
};

/** 요청에 실을 측정치 — 값과 판정을 다 적은 줄만. 고치지 않은 줄은 서버의 측정 시각 · 계측기를 그대로 싣는다. */
export const toMeasurementInputs = (
  rows: readonly MeasurementRow[],
  draft: MeasureDraft,
  now: string,
): MeasurementInput[] =>
  rows.flatMap((row) => {
    const entry = entryOf(draft, row.key);
    if (!hasValue(entry) || entry.judgment === '') return [];
    return [
      {
        inspectionItemSpecId: row.inspectionItemSpecId,
        sampleNo: row.sampleNo,
        ...valueFieldOf(row, entry.value.trim()),
        judgmentCode: entry.judgment,
        measuredAt: entry.measuredAt ?? now,
        ...(entry.inspectionEquipmentId === null
          ? {}
          : { inspectionEquipmentId: entry.inspectionEquipmentId }),
      },
    ];
  });
