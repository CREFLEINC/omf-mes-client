import { describe, expect, it } from 'vitest';

import { causeCodeFixtures, defectCodeFixtures } from './fixtures';
import { causeToHierarchyCode, defectToHierarchyCode } from './mappers';

describe('defectToHierarchyCode', () => {
  it('계약 필드 이름을 화면 표현으로 옮긴다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[1]!)).toEqual({
      id: 1002,
      code: 'DF-11',
      name: '스크래치',
      parentId: 1001,
      isActive: true,
    });
  });

  it('상위가 null이면 대분류다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[0]!).parentId).toBeNull();
  });

  it('상위 키가 아예 없어도 대분류로 다룬다', () => {
    const raw = { defectCodeId: 1, defectCode: 'A', defectName: '가', isActive: true };

    expect(defectToHierarchyCode(raw).parentId).toBeNull();
  });

  /*
   * 목 서버가 실제로 내려주는 모양이다. 부모-자식으로 세면 「하위가 있는데 열 수 없는」 행이 생긴다.
   */
  it('자기 자신을 상위로 가리키면 대분류로 접는다', () => {
    const folded = defectToHierarchyCode(defectCodeFixtures[3]!);

    expect(folded.id).toBe(1004);
    expect(folded.parentId).toBeNull();
  });

  it('상위가 목록에 없는 번호여도 그 번호를 그대로 들고 있는다 — 고아 판정은 목록이 한다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[6]!).parentId).toBe(1900);
  });

  it('미사용 여부를 그대로 옮긴다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[5]!).isActive).toBe(false);
  });
});

describe('causeToHierarchyCode', () => {
  it('원인 코드도 같은 화면 표현으로 옮긴다', () => {
    expect(causeToHierarchyCode(causeCodeFixtures[1]!)).toEqual({
      id: 2002,
      code: 'CS-11',
      name: '금형 마모',
      parentId: 2001,
      isActive: true,
    });
  });

  it('원인 코드도 자기참조를 대분류로 접는다', () => {
    const raw = {
      causeCodeId: 2009,
      causeCode: 'CS-99',
      causeName: '자기참조',
      parentCauseCodeId: 2009,
      isActive: true,
    };

    expect(causeToHierarchyCode(raw).parentId).toBeNull();
  });
});
