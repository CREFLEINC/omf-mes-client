import { describe, expect, it } from 'vitest';

import { flattenPermissionColumns, toPermissionGroups } from './permission-catalog';
import type { Permission } from './types';

const candidate = (code: string, name: string, groupCode?: string): Permission =>
  groupCode === undefined ? { code, name } : { code, name, groupCode };

describe('toPermissionGroups', () => {
  /**
   * ⭐ **열은 후보에서 나온다.** 부여분만 보면 아무것도 받지 않은 역할에 열이 하나도 서지
   * 않아 **권한을 새로 줄 수 없다** — 격자가 보기 전용으로 닫혀 있던 까닭이 그것이었다.
   */
  it('부여가 0건이어도 후보가 전부 열로 선다', () => {
    const groups = toPermissionGroups(
      [
        candidate('W-01-01', 'IQC 수입검사 판정', '01'),
        candidate('W-01-03', '초과 입하 분리', '01'),
      ],
      [],
    );

    expect(flattenPermissionColumns(groups).map((column) => column.code)).toEqual([
      'W-01-01',
      'W-01-03',
    ]);
    expect(flattenPermissionColumns(groups).every((column) => !column.isGranted)).toBe(true);
  });

  it('후보가 없으면 열도 없다 — 열 없는 격자를 그리지 않도록 화면이 이 값을 본다', () => {
    expect(toPermissionGroups([], [])).toEqual([]);
  });

  it('부여된 코드만 켜진 것으로 표시된다', () => {
    const groups = toPermissionGroups(
      [candidate('W-01-01', '가', '01'), candidate('W-01-03', '나', '01')],
      ['W-01-03'],
    );

    expect(
      flattenPermissionColumns(groups).map((column) => [column.code, column.isGranted]),
    ).toEqual([
      ['W-01-01', false],
      ['W-01-03', true],
    ]);
  });

  /** ⛔ **열 이름을 화면이 지어내지 않는다** — 서버가 준 `name` 을 그대로 쓴다. */
  it('열 이름은 후보가 준 이름이다', () => {
    const groups = toPermissionGroups([candidate('W-01-01', 'IQC 수입검사 판정', '01')], []);

    expect(flattenPermissionColumns(groups)[0]?.label).toBe('IQC 수입검사 판정');
  });

  it('받은 차례를 지킨다 — 화면이 다시 정렬하면 도메인 순이 사라진다', () => {
    const groups = toPermissionGroups(
      [candidate('W-06-07', '다', '06'), candidate('W-01-01', '가', '01')],
      [],
    );

    expect(groups.map((group) => group.key)).toEqual(['06', '01']);
  });

  it('같은 코드가 두 번 와도 열은 하나다', () => {
    const groups = toPermissionGroups(
      [candidate('W-01-01', '가', '01'), candidate('W-01-01', '가', '01')],
      [],
    );

    expect(flattenPermissionColumns(groups)).toHaveLength(1);
  });

  describe('묶음', () => {
    /** ⭐ 묶지 않으면 관리자가 열 백여 개를 옆으로 끝없이 스크롤한다. */
    it('`groupCode` 로 묶고 설계가 정한 축 이름을 붙인다', () => {
      const groups = toPermissionGroups(
        [
          candidate('W-01-01', '가', '01'),
          candidate('W-06-07', '다', '06'),
          candidate('W-01-03', '나', '01'),
        ],
        [],
      );

      expect(groups.map((group) => [group.key, group.label, group.columns.length])).toEqual([
        ['01', '자재·창고', 2],
        ['06', '기준정보', 1],
      ]);
    });

    /** ⛔ **모르는 축의 이름을 지어내지 않는다** — 그 묶음이 무엇인지 화면이 단정하게 된다. */
    it('모르는 축이 오면 코드를 그대로 낸다', () => {
      const groups = toPermissionGroups([candidate('W-09-01', '가', '09')], []);

      expect(groups[0]?.label).toBe('09');
    });

    /** 계약이 `groupCode` 를 선택으로 두었다. 빠진 것을 다른 묶음에 섞으면 그 묶음이 거짓이 된다. */
    it('묶음 코드가 없는 후보는 따로 선다', () => {
      const groups = toPermissionGroups(
        [candidate('W-01-01', '가', '01'), candidate('W-01-03', '나')],
        [],
      );

      expect(groups.map((group) => group.label)).toEqual(['자재·창고', '묶음 없음']);
    });
  });

  describe('후보에 없는 부여분', () => {
    /**
     * ⛔ **빼지 않는다.** 빼면 사용자가 실제로 가진 권한이 화면에서 사라지고, 그 상태로
     * 저장하면 **보여 준 적도 없는 부여가 조용히 회수된다.**
     */
    it('맨 뒤 묶음에 열로 서고 켜진 것으로 표시된다', () => {
      const groups = toPermissionGroups([candidate('W-01-01', '가', '01')], ['W-01-01', 'W-99-99']);

      expect(groups.map((group) => group.label)).toEqual(['자재·창고', '목록에 없는 권한']);

      const unlisted = groups[1]?.columns[0];

      expect(unlisted).toMatchObject({
        code: 'W-99-99',
        /* 후보에 없어 이름을 모른다 — 코드를 그대로 낸다. */
        label: 'W-99-99',
        isGranted: true,
        isUnlisted: true,
      });
    });

    it('후보에 있는 코드는 미등재로 표시되지 않는다', () => {
      const groups = toPermissionGroups([candidate('W-01-01', '가', '01')], ['W-01-01']);

      expect(groups).toHaveLength(1);
      expect(flattenPermissionColumns(groups)[0]?.isUnlisted).toBe(false);
    });
  });
});

describe('flattenPermissionColumns', () => {
  it('묶음을 가로질러 격자가 그리는 차례 그대로 편다', () => {
    const groups = toPermissionGroups(
      [
        candidate('W-01-01', '가', '01'),
        candidate('W-06-07', '다', '06'),
        candidate('W-01-03', '나', '01'),
      ],
      [],
    );

    expect(flattenPermissionColumns(groups).map((column) => column.code)).toEqual([
      'W-01-01',
      'W-01-03',
      'W-06-07',
    ]);
  });

  it('묶음이 없으면 빈 배열이다 — 빈 통과를 막는 기준값이다', () => {
    expect(flattenPermissionColumns([])).toEqual([]);
  });
});
