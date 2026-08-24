import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  cycleText,
  newDraftRow,
  selectableItems,
  toAssignmentInput,
  toDraftRow,
  validateRow,
  validateRows,
} from './inspection-assignment';
import type { AssignmentDraftRow, InspectionItemAssignment } from './types';

const t = messages.equipmentMaster.inspection;

const assignment = (
  overrides: Partial<InspectionItemAssignment> = {},
): InspectionItemAssignment => ({
  equipmentInspectionItemId: 4001,
  itemCode: 'INS-01',
  itemName: '벨트 장력',
  inspectionTypeCode: 'DAILY',
  judgmentMethodCode: 'VISUAL',
  requiredFlag: true,
  sequenceNo: 1,
  isActive: true,
  cycleTypeCode: 'DAY',
  cycleInterval: 3,
  ...overrides,
});

const row = (overrides: Partial<AssignmentDraftRow> = {}): AssignmentDraftRow => ({
  ...toDraftRow(assignment()),
  ...overrides,
});

describe('부여받은 줄을 창의 모양으로', () => {
  /** ⭐ 사용자가 치는 칸이라 문자열이다 — 수로 들면 「3」으로 가는 도중이 표현되지 않는다. */
  it('주기 간격을 문자열로 든다', () => {
    expect(toDraftRow(assignment({ cycleInterval: 12 })).cycleInterval).toBe('12');
  });

  /** ⭐ 비면 부여일이 기준이다(계약) — 빈 칸이 「안 정했다」가 아니라 값이다. */
  it('기준일이 오지 않으면 빈 칸이다', () => {
    expect(toDraftRow(assignment()).cycleBaseDate).toBe('');
  });

  it('온 기준일은 그대로 든다', () => {
    expect(toDraftRow(assignment({ cycleBaseDate: '2026-03-01' })).cycleBaseDate).toBe(
      '2026-03-01',
    );
  });
});

describe('마스터에서 새로 고른 줄', () => {
  /**
   * ⛔ **주기를 지어내지 않는다** — 「1일」 같은 기본값을 넣으면 사용자가 정하지 않은 주기가
   * 정한 것처럼 저장된다.
   */
  it('주기가 비어 있다', () => {
    const fresh = newDraftRow({
      equipmentInspectionItemId: 4002,
      itemCode: 'INS-02',
      itemName: '오일 레벨',
      inspectionTypeCode: 'MONTHLY',
    });

    expect(fresh.cycleTypeCode).toBe('');
    expect(fresh.cycleInterval).toBe('');
  });

  it('새로 더한 줄은 쓰는 상태로 시작한다', () => {
    const fresh = newDraftRow({
      equipmentInspectionItemId: 4002,
      itemCode: 'INS-02',
      itemName: '오일 레벨',
      inspectionTypeCode: 'MONTHLY',
    });

    expect(fresh.isActive).toBe(true);
  });
});

describe('창의 줄을 계약의 본문으로', () => {
  it('주기 간격이 수가 된다', () => {
    expect(toAssignmentInput(row({ cycleInterval: '7' })).cycleInterval).toBe(7);
  });

  /** ⛔ 빈 문자열을 날짜로 보내면 서버가 거절한다 — 「없음」은 `null` 이다. */
  it('빈 기준일은 null 이 된다', () => {
    expect(toAssignmentInput(row({ cycleBaseDate: '' })).cycleBaseDate).toBeNull();
  });

  it('적은 기준일은 그대로 나간다', () => {
    expect(toAssignmentInput(row({ cycleBaseDate: '2026-03-01' })).cycleBaseDate).toBe(
      '2026-03-01',
    );
  });
});

describe('한 줄을 잰다', () => {
  it('다 채우면 오류가 없다', () => {
    expect(validateRow(row())).toEqual({});
  });

  it('주기 단위를 고르지 않으면 묻는다', () => {
    expect(validateRow(row({ cycleTypeCode: '' })).cycleTypeCode).toBe(t.validation.required);
  });

  it('간격이 비면 묻는다', () => {
    expect(validateRow(row({ cycleInterval: '' })).cycleInterval).toBe(t.validation.required);
  });

  /** ⛔ 「0일마다」는 뜻이 없고, 소수는 주기가 될 수 없다. */
  it('0과 음수와 소수는 간격이 아니다', () => {
    expect(validateRow(row({ cycleInterval: '0' })).cycleInterval).toBe(
      t.validation.intervalPositive,
    );
    expect(validateRow(row({ cycleInterval: '-1' })).cycleInterval).toBe(
      t.validation.intervalPositive,
    );
    expect(validateRow(row({ cycleInterval: '1.5' })).cycleInterval).toBe(
      t.validation.intervalPositive,
    );
  });

  /** ⛔ 수가 아닌 것을 「비었다」로 접지 않는다 — 사용자는 무언가 적었다. */
  it('수가 아닌 것은 「비었다」가 아니라 「수가 아니다」다', () => {
    expect(validateRow(row({ cycleInterval: '삼' })).cycleInterval).toBe(
      t.validation.intervalPositive,
    );
  });

  it('공백만 친 것은 빈 것으로 본다', () => {
    expect(validateRow(row({ cycleInterval: '   ' })).cycleInterval).toBe(t.validation.required);
  });
});

describe('줄마다의 오류', () => {
  it('오류가 있는 줄만 담는다', () => {
    const errors = validateRows([
      row(),
      row({ equipmentInspectionItemId: 4002, cycleInterval: '' }),
    ]);

    expect(errors.size).toBe(1);
    expect(errors.get(4002)?.cycleInterval).toBe(t.validation.required);
  });

  it('모두 멀쩡하면 비어 있다', () => {
    expect(validateRows([row()]).size).toBe(0);
  });
});

describe('주기를 한 줄로', () => {
  it('수와 단위 이름을 붙여 읽는다', () => {
    expect(
      cycleText(assignment({ cycleInterval: 3, cycleTypeCode: 'DAY' }), new Map([['DAY', '일']])),
    ).toBe(t.cycleText(3, '일'));
  });

  /** ⛔ 이름을 모르면 코드를 그대로 쓴다 — 지어내지 않는다(G-9). 시드가 아직 없을 수 있다. */
  it('단위 이름을 모르면 코드를 그대로 쓴다', () => {
    expect(cycleText(assignment({ cycleTypeCode: 'DAY' }), new Map())).toBe(t.cycleText(3, 'DAY'));
  });
});

describe('고를 수 있는 마스터 항목', () => {
  const master = [
    { equipmentInspectionItemId: 4001 },
    { equipmentInspectionItemId: 4002 },
    { equipmentInspectionItemId: 4003 },
  ];

  /** ⛔ 묶음 통째 교체라 같은 항목이 둘 서면 뒤엣것이 앞엣것을 덮는다. */
  it('이미 부여한 것은 고를 수 없다', () => {
    expect(selectableItems(master, [row({ equipmentInspectionItemId: 4002 })])).toEqual([
      { equipmentInspectionItemId: 4001 },
      { equipmentInspectionItemId: 4003 },
    ]);
  });

  it('아무것도 부여하지 않았으면 전부 고를 수 있다', () => {
    expect(selectableItems(master, [])).toHaveLength(3);
  });
});
