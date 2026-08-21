import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { groupAssignmentNote, hierarchyText, type EquipmentHierarchy } from './hierarchy-text';

const make = (overrides: Partial<EquipmentHierarchy> = {}): EquipmentHierarchy => ({
  plantName: '제1공장',
  groupNames: ['프레스라인 A', '1구역'],
  equipmentName: '프레스 1호기',
  groupAssigned: true,
  ...overrides,
});

describe('hierarchyText', () => {
  it('공장부터 설비까지 차례로 잇는다', () => {
    expect(hierarchyText(make())).toBe('제1공장 > 프레스라인 A > 1구역 > 프레스 1호기');
  });

  it('그룹이 없으면 공장과 설비만 남는다', () => {
    expect(hierarchyText(make({ groupNames: [], groupAssigned: false }))).toBe(
      '제1공장 > 프레스 1호기',
    );
  });

  /*
   * ⛔ 잇기 «전에» 항목별로 거른다. 이어 붙인 뒤 검사하는 형태에서는 이음쇠만 남은 조각
   * (`제1공장 >  > 프레스 1호기`)이 그대로 그려진다 — 같은 구멍이 사본 열다섯 곳에 공유된
   * 적이 있다(client#192).
   */
  it('빈 이름이 섞여도 이음쇠만 남은 조각을 만들지 않는다', () => {
    expect(hierarchyText(make({ groupNames: ['', '1구역'] }))).toBe(
      '제1공장 > 1구역 > 프레스 1호기',
    );
  });

  it('공백만 있는 이름도 거른다', () => {
    expect(hierarchyText(make({ groupNames: ['   ', ' '] }))).not.toContain('>  >');
    expect(hierarchyText(make({ groupNames: ['   '] }))).toBe('제1공장 > 프레스 1호기');
  });

  it('이름이 전부 비어도 남은 것만 낸다', () => {
    expect(hierarchyText(make({ plantName: '', groupNames: [''], equipmentName: '프레스' }))).toBe(
      '프레스',
    );
  });
});

describe('groupAssignmentNote', () => {
  it('소속이 있으면 덧붙이지 않는다', () => {
    expect(groupAssignmentNote(make())).toBeNull();
  });

  /*
   * ⚠ 빈칸으로 두지 않는다(G-9). 알람 화면에서 위치가 공장으로만 나오면 찾아갈 수 없으므로
   * 여기서 비어 있음이 보여야 채운다.
   */
  it('소속이 없으면 그 사실을 밝힌다', () => {
    expect(groupAssignmentNote(make({ groupAssigned: false, groupNames: [] }))).toBe(
      messages.equipmentMaster.values.noGroupAssigned,
    );
  });

  /*
   * ⭐ 판정의 주인은 `groupAssigned` 다. 이름 목록이 비었는지로 세면, 소속은 있는데 이름을
   * 풀지 못한 경우와 소속이 아예 없는 경우가 같은 모양이 된다 — 다른 사실이다.
   */
  it('이름 목록이 비어도 소속이 있다고 하면 밝히지 않는다', () => {
    expect(groupAssignmentNote(make({ groupAssigned: true, groupNames: [] }))).toBeNull();
  });

  it('이름 목록이 있어도 소속이 없다고 하면 밝힌다', () => {
    expect(groupAssignmentNote(make({ groupAssigned: false, groupNames: ['프레스라인 A'] }))).toBe(
      messages.equipmentMaster.values.noGroupAssigned,
    );
  });
});
