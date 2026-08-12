import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_APPROVAL_TYPE_CODES,
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
  it('비어 있는 것이 지금의 사실이다', () => {
    expect(PLACEHOLDER_APPROVAL_TYPE_CODES).toEqual([]);
  });
});

describe('toApprovalTypeOptions', () => {
  it('빈 값 목록은 빈 선택지가 된다', () => {
    expect(toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES)).toEqual([]);
  });

  it('값이 차면 코드값을 그대로 라벨로 쓴다', () => {
    // 사람이 읽을 이름을 주는 곳이 아직 없다 — 화면이 이름을 붙이면 그 뜻도 지어낸 것이 된다.
    expect(toApprovalTypeOptions(['SAMPLE-TYPE-A', 'SAMPLE-TYPE-B'])).toEqual([
      { value: 'SAMPLE-TYPE-A', label: 'SAMPLE-TYPE-A' },
      { value: 'SAMPLE-TYPE-B', label: 'SAMPLE-TYPE-B' },
    ]);
  });

  it('차례를 바꾸지 않는다', () => {
    // 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
    expect(toApprovalTypeOptions(['SAMPLE-TYPE-B', 'SAMPLE-TYPE-A']).map((o) => o.value)).toEqual([
      'SAMPLE-TYPE-B',
      'SAMPLE-TYPE-A',
    ]);
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비어 있으면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  it('선택지가 차면 안내를 거둔다', () => {
    // 남으면 화면이 거짓말을 한다.
    expect(codeNote(toApprovalTypeOptions(['SAMPLE-TYPE-A']))).toBeUndefined();
  });
});
