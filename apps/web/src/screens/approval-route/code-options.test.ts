import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  APPROVER_TYPE_CODES,
  ENABLED_APPROVER_TYPE_CODES,
  PLACEHOLDER_APPROVAL_TYPE_CODES,
  approverTypeNote,
  codeNote,
  codePlaceholder,
  toApprovalTypeOptions,
  toApproverTypeOptions,
} from './code-options';

const t = messages.approvalRoute;

/**
 * 승인 유형 자리표시.
 *
 * **값 목록이 확정되지 않았다는 사실을 지어낸 값으로 메우지 않는다.** 배열이 차는 순간
 * 선택칸이 저절로 살아나야 하며, 그 전환이 검사돼야 「배열만 채우면 된다」가 참이 된다.
 */

describe('PLACEHOLDER_APPROVAL_TYPE_CODES', () => {
  it('고정 OpenAPI의 승인 유형 9종을 담는다', () => {
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toHaveLength(9);
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toContain('PRODUCTION_RESULT_CORRECT');
  });
});

describe('toApprovalTypeOptions', () => {
  it('고정 목록은 9개 선택지가 된다', () => {
    expect(toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES)).toHaveLength(9);
  });

  it('값이 차면 코드값을 그대로 라벨로 쓴다', () => {
    // 사람이 읽을 이름을 주는 곳이 아직 없다 — 화면이 이름을 붙이면 그 뜻도 지어낸 것이 된다.
    expect(toApprovalTypeOptions(['GOODS_ISSUE_DISPOSAL', 'INVENTORY_ADJUSTMENT'])).toEqual([
      { value: 'GOODS_ISSUE_DISPOSAL', label: 'GOODS_ISSUE_DISPOSAL' },
      { value: 'INVENTORY_ADJUSTMENT', label: 'INVENTORY_ADJUSTMENT' },
    ]);
  });

  it('차례를 바꾸지 않는다', () => {
    // 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
    expect(
      toApprovalTypeOptions(['INVENTORY_ADJUSTMENT', 'GOODS_ISSUE_DISPOSAL']).map((o) => o.value),
    ).toEqual(['INVENTORY_ADJUSTMENT', 'GOODS_ISSUE_DISPOSAL']);
  });
});

/**
 * 승인자 구분.
 *
 * **승인 유형과 사정이 다르다.** 승인 유형은 값 목록 자체가 미확정이라 선택지가 비어 있지만,
 * 승인자 구분은 **계약이 셋을 못 박았고 그중 하나만 1차에 열린다**(`omf-mes#69`).
 * 그래서 감추지 않고 **보이되 잠그고 사유를 붙인다** — 감추면 없는 기능으로 읽힌다.
 */
describe('toApproverTypeOptions', () => {
  it('계약의 세 값을 모두 낸다 — 잠근 것을 감추지 않는다', () => {
    expect(
      toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES).map((option) => option.value),
    ).toEqual([...APPROVER_TYPE_CODES]);
  });

  it('1차에는 사용자만 열리고 역할·부서는 잠긴다', () => {
    const options = toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES);

    expect(options.find((option) => option.value === 'USER')?.disabled).toBe(false);
    expect(options.find((option) => option.value === 'ROLE')?.disabled).toBe(true);
    expect(options.find((option) => option.value === 'DEPARTMENT')?.disabled).toBe(true);
  });

  it('라벨은 계약 enum 값의 뜻이다', () => {
    const options = toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES);

    expect(options.map((option) => option.label)).toEqual([
      t.values.approverTypeUser,
      t.values.approverTypeRole,
      t.values.approverTypeDepartment,
    ]);
  });

  /**
   * **전환 감지기.** 열린 구분이 이 배열 하나에서 온다는 것을 값으로 못 박는다 —
   * `omf-mes#69`가 열리면 여기에 값을 더하는 것만으로 선택지가 살아나야 한다.
   * 잠금을 다른 자리에 상수로 굳히면 이 단언이 곧바로 깨진다.
   */
  it('열린 구분이 배열에서 오므로 값을 더하면 잠금이 풀린다', () => {
    const options = toApproverTypeOptions(['USER', 'ROLE']);

    expect(options.find((option) => option.value === 'ROLE')?.disabled).toBe(false);
    expect(options.find((option) => option.value === 'DEPARTMENT')?.disabled).toBe(true);
  });

  it('지금 열린 것은 사용자 하나뿐이다', () => {
    expect(ENABLED_APPROVER_TYPE_CODES).toEqual(['USER']);
  });
});

describe('approverTypeNote', () => {
  it('잠긴 선택지가 있으면 왜 잠겼는지 밝힌다', () => {
    expect(approverTypeNote(toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES))).toBe(
      t.notes.approverTypePending,
    );
  });

  it('전부 열리면 안내를 거둔다', () => {
    // 남으면 화면이 거짓말을 한다 — 승인 유형 안내와 같은 규율이다.
    expect(approverTypeNote(toApproverTypeOptions(APPROVER_TYPE_CODES))).toBeUndefined();
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비어 있으면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  it('선택지가 차면 안내를 거둔다', () => {
    // 남으면 화면이 거짓말을 한다.
    expect(codeNote(toApprovalTypeOptions(['GOODS_ISSUE_DISPOSAL']))).toBeUndefined();
  });
});
