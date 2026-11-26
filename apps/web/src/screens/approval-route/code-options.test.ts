import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_APPROVAL_TYPE_CODES,
  approvalTypeLabelOf,
  codeNote,
  codePlaceholder,
  toApprovalTypeOptions,
} from './code-options';

/**
 * 승인 유형 자리표시.
 *
 * **값 목록이 확정되지 않았다는 사실을 지어낸 값으로 메우지 않는다.** 배열이 차는 순간
 * 선택칸이 저절로 살아나야 하며, 그 전환이 검사돼야 「배열만 채우면 된다」가 참이 된다.
 */

describe('PLACEHOLDER_APPROVAL_TYPE_CODES', () => {
  it('고정 OpenAPI의 승인 유형에서 IQC 생략(#353 폐지)을 뺀 8종을 담는다', () => {
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toHaveLength(8);
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toContain('PRODUCTION_RESULT_CORRECT');
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).not.toContain('IQC_SKIP');
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).not.toContain('PQC_SKIP');
  });
});

describe('toApprovalTypeOptions', () => {
  it('고정 목록은 8개 선택지가 된다', () => {
    expect(toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES)).toHaveLength(8);
  });

  it('값은 코드 그대로, 라벨은 사람이 읽는 이름이다(#353)', () => {
    expect(toApprovalTypeOptions(['GOODS_ISSUE_DISPOSAL', 'INVENTORY_ADJUSTMENT'])).toEqual([
      { value: 'GOODS_ISSUE_DISPOSAL', label: '폐기 출고' },
      { value: 'INVENTORY_ADJUSTMENT', label: '재고 조정' },
    ]);
  });

  it('이름이 없는 코드는 코드 그대로 보인다', () => {
    expect(approvalTypeLabelOf('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
    expect(approvalTypeLabelOf('PURCHASE_ORDER')).toBe('P/O');
  });

  it('차례를 바꾸지 않는다', () => {
    // 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
    expect(
      toApprovalTypeOptions(['INVENTORY_ADJUSTMENT', 'GOODS_ISSUE_DISPOSAL']).map((o) => o.value),
    ).toEqual(['INVENTORY_ADJUSTMENT', 'GOODS_ISSUE_DISPOSAL']);
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
