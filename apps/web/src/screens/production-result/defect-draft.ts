import type { ProductionResultDefectInput, components } from '@omf-mes/api-client';

import { parseGoodQty } from './quantity-draft';

/**
 * 공정에 매핑된 불량 코드. 서버가 상세의 대분류 이름을 함께 싣거나 대분류 줄을 함께 내리는
 * 두 경우를 다 받는다.
 */
export type ProcessDefectCode = components['schemas']['DefectCode'] & {
  parentDefectCode?: string | null;
  parentDefectName?: string | null;
};

/** 불량 한 줄. 수량은 키패드 버퍼(문자열)다. */
export interface DefectRowDraft {
  key: string;
  defectCodeId: number | null;
  qty: string;
}

export interface DefectMajor {
  majorId: number;
  name: string;
  minors: ProcessDefectCode[];
}

/**
 * 고를 수 있는 코드를 대분류 → 상세 두 단으로 묶는다.
 *
 * ⚠ 저장은 상세만 받는다 — 대분류는 묶음 이름일 뿐이라, 상세가 없는 대분류는 내지 않는다.
 */
export const groupDefectCodes = (codes: readonly ProcessDefectCode[]): DefectMajor[] => {
  const majors = new Map<number, DefectMajor>();

  /* 대분류는 묶음 머리라 쓰지 않는 대분류여도 이름을 빌린다 — 고르는 것은 상세다. */
  for (const code of codes) {
    if (code.parentDefectCodeId == null && !majors.has(code.defectCodeId)) {
      majors.set(code.defectCodeId, {
        majorId: code.defectCodeId,
        name: code.defectName,
        minors: [],
      });
    }
  }
  for (const code of codes) {
    const parentId = code.parentDefectCodeId;
    if (parentId == null || !code.isActive) continue;
    const major = majors.get(parentId) ?? {
      majorId: parentId,
      name: code.parentDefectName ?? code.parentDefectCode ?? code.defectName,
      minors: [],
    };
    major.minors.push(code);
    majors.set(parentId, major);
  }

  return [...majors.values()].filter((major) => major.minors.length > 0);
};

/** 줄에 보일 유형 이름 — 상세면 「대분류 › 상세」. */
export const defectLabelOf = (
  majors: readonly DefectMajor[],
  defectCodeId: number | null,
): string | null => {
  if (defectCodeId === null) return null;
  for (const major of majors) {
    const minor = major.minors.find((code) => code.defectCodeId === defectCodeId);
    if (minor !== undefined) return `${major.name} › ${minor.defectName}`;
  }
  return null;
};

export interface DefectRowCheck {
  /** 같은 유형이 앞 줄에 이미 있다 */
  duplicate: boolean;
  /** 수량을 쳤는데 0 이하거나 숫자가 아니다 */
  qtyInvalid: boolean;
  complete: boolean;
}

export const checkDefectRows = (rows: readonly DefectRowDraft[]): Map<string, DefectRowCheck> => {
  const seen = new Set<number>();
  const checks = new Map<string, DefectRowCheck>();

  for (const row of rows) {
    const qty = parseGoodQty(row.qty);
    const duplicate = row.defectCodeId !== null && seen.has(row.defectCodeId);
    if (row.defectCodeId !== null) seen.add(row.defectCodeId);
    const qtyInvalid = row.qty !== '' && (qty === null || qty <= 0);
    checks.set(row.key, {
      duplicate,
      qtyInvalid,
      complete: row.defectCodeId !== null && qty !== null && qty > 0 && !duplicate,
    });
  }

  return checks;
};

/** 모든 줄이 다 찼는가. 줄이 없으면 참이다 — 불량이 없는 실적이다. */
export const areDefectRowsReady = (rows: readonly DefectRowDraft[]): boolean =>
  [...checkDefectRows(rows).values()].every((check) => check.complete);

export const toDefectInputs = (rows: readonly DefectRowDraft[]): ProductionResultDefectInput[] =>
  rows.flatMap((row) => {
    const qty = parseGoodQty(row.qty);
    return row.defectCodeId === null || qty === null || qty <= 0
      ? []
      : [{ defectCodeId: row.defectCodeId, qty }];
  });
