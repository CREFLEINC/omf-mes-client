import { messages } from '@omf-mes/i18n';

import type {
  AssignmentDraftRow,
  InspectionItemAssignment,
  InspectionItemAssignmentInput,
} from './types';

const t = messages.equipmentMaster.inspection;

/**
 * 점검 항목 **부여**를 다루는 일.
 *
 * ⭐ **마스터와 부여는 다른 것이다**(공유계약 B-6). 항목이 «무엇인가»는 마스터가 갖고,
 * 「이 그룹이 그 항목을 **얼마 만에** 도는가」는 부여가 갖는다. 그래서 주기는 여기 있고
 * 판정 방식·상하한은 저기 있다.
 *
 * ⛔ **부여는 묶음 통째로 교체된다**(계약의 `PUT … /inspection-items`). 한 줄만 고치는
 * 경로가 없으므로, 화면은 **지금 부여된 전부를 들고 있다가 전부를 되보낸다** — 들고 있지
 * 않은 줄은 지워진다.
 */

/** 부여받은 줄을 창이 다룰 모양으로. */
export const toDraftRow = (assignment: InspectionItemAssignment): AssignmentDraftRow => ({
  equipmentInspectionItemId: assignment.equipmentInspectionItemId,
  itemCode: assignment.itemCode,
  itemName: assignment.itemName,
  inspectionTypeCode: assignment.inspectionTypeCode,
  cycleTypeCode: assignment.cycleTypeCode,
  cycleInterval: String(assignment.cycleInterval),
  /* 기준일은 비울 수 있다 — 비면 부여일이 기준이 된다(계약). */
  cycleBaseDate: assignment.cycleBaseDate ?? '',
  isActive: assignment.isActive,
});

/**
 * 마스터에서 새로 고른 항목을 창의 한 줄로.
 *
 * ⛔ **주기를 지어내지 않는다** — 「1일」 같은 기본값을 넣으면 사용자가 정하지 않은 주기가
 * 정한 것처럼 저장된다. 비워 두고 필수로 잡는다.
 */
export const newDraftRow = (item: {
  equipmentInspectionItemId: number;
  itemCode: string;
  itemName: string;
  inspectionTypeCode: string;
}): AssignmentDraftRow => ({
  ...item,
  cycleTypeCode: '',
  cycleInterval: '',
  cycleBaseDate: '',
  isActive: true,
});

/** 창의 줄을 계약의 본문으로. 주기 간격은 여기서 수가 된다. */
export const toAssignmentInput = (row: AssignmentDraftRow): InspectionItemAssignmentInput => ({
  equipmentInspectionItemId: row.equipmentInspectionItemId,
  cycleTypeCode: row.cycleTypeCode,
  cycleInterval: Number(row.cycleInterval),
  /* 빈 기준일은 「없음」이다 — 빈 문자열을 날짜로 보내면 서버가 거절한다. */
  cycleBaseDate: row.cycleBaseDate === '' ? null : row.cycleBaseDate,
  isActive: row.isActive,
});

/** 한 줄의 오류. 칸 이름은 그 줄 안에서의 이름이다. */
export type RowErrors = Partial<Record<'cycleTypeCode' | 'cycleInterval', string>>;

/**
 * 한 줄을 잰다.
 *
 * ⛔ **간격은 «양의 정수»다.** 0이면 「0일마다」가 되어 뜻이 없고, 소수는 주기가 될 수 없다.
 * 서버도 거절하지만 **여기서 막아야 사용자가 어느 줄인지 안다** — 묶음 통째 교체라 서버
 * 오류는 어느 줄의 것인지 말해 주지 못한다.
 */
export const validateRow = (row: AssignmentDraftRow): RowErrors => {
  const errors: RowErrors = {};

  if (row.cycleTypeCode === '') errors.cycleTypeCode = t.validation.required;

  const interval = Number(row.cycleInterval);

  if (row.cycleInterval.trim() === '') {
    errors.cycleInterval = t.validation.required;
  } else if (!Number.isSafeInteger(interval) || interval <= 0) {
    errors.cycleInterval = t.validation.intervalPositive;
  }

  return errors;
};

/** 줄마다의 오류. 오류가 없는 줄은 담기지 않는다 — 있는 것만 세면 된다. */
export const validateRows = (rows: readonly AssignmentDraftRow[]): Map<number, RowErrors> => {
  const errors = new Map<number, RowErrors>();

  for (const row of rows) {
    const rowErrors = validateRow(row);

    if (Object.keys(rowErrors).length > 0) {
      errors.set(row.equipmentInspectionItemId, rowErrors);
    }
  }

  return errors;
};

/**
 * 주기를 한 줄로. **단위 이름을 모르면 코드를 그대로 쓴다**(G-9) — 시드가 아직 없을 수 있다.
 */
export const cycleText = (
  assignment: Pick<InspectionItemAssignment, 'cycleTypeCode' | 'cycleInterval'>,
  cycleLabels: ReadonlyMap<string, string>,
): string =>
  t.cycleText(
    assignment.cycleInterval,
    cycleLabels.get(assignment.cycleTypeCode) ?? assignment.cycleTypeCode,
  );

/**
 * 아직 부여되지 않은 마스터 항목만 고를 수 있다.
 *
 * ⛔ **같은 항목을 두 번 부여하지 않는다** — 묶음 통째 교체라 서버가 뒤엣것으로 덮고,
 * 사용자는 앞서 정한 주기가 어디로 갔는지 알 수 없다.
 */
export const selectableItems = <T extends { equipmentInspectionItemId: number }>(
  master: readonly T[],
  rows: readonly AssignmentDraftRow[],
): T[] => {
  const taken = new Set(rows.map((row) => row.equipmentInspectionItemId));

  return master.filter((item) => !taken.has(item.equipmentInspectionItemId));
};
