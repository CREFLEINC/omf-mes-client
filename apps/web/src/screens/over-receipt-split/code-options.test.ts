import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EXCESS_INSPECTION_NOTE,
  PLACEHOLDER_EXCEPTION_TYPE_CODES,
  exceptionTypeNote,
  exceptionTypeOptions,
  exceptionTypePlaceholder,
} from './code-options';

/**
 * 자리표시 상수 — **값을 지어내지 않는다는 약속을 값으로 고정한다.**
 *
 * 예시 코드값을 하나라도 채우면 화면은 「고를 수 있다」고 말하는데 그 값은 서버가 모르는
 * 문자열이라, 사용자가 고른 순간 등록이 서버에서 막힌다. 지금은 **비어 있고 그 사실을 밝히는 것**이
 * 옳은 상태다.
 */
describe('예외 유형 자리표시', () => {
  /* **M33** — 예시 코드값을 채우는 변경이 여기서 잡힌다. */
  it('코드 목록이 비어 있다', () => {
    expect(PLACEHOLDER_EXCEPTION_TYPE_CODES).toHaveLength(0);
  });

  it('선택지도 비어 있다', () => {
    expect(exceptionTypeOptions()).toHaveLength(0);
  });

  /*
   * **짝 방향** — 「비어 있다」만 단언하면 안내까지 함께 지운 변경이 통과한다.
   * 선택지가 없다는 사실은 화면에서 읽혀야 한다.
   */
  it('선택지가 없다는 사실을 안내와 자리표시 문구로 밝힌다', () => {
    expect(exceptionTypeNote()).toBe(messages.pendingCode.note);
    expect(exceptionTypePlaceholder()).toBe(messages.pendingCode.placeholder);
  });
});

/**
 * 초과분의 수입검사 승계 — **보낼 자리가 요청에 없다.**
 *
 * 계약의 분리 등록 요청에는 검사 관련 필드가 하나도 없어 「정량분 값을 그대로 승계해 보낸다」가
 * 성립하지 않는다. 보내는 것 없이 안내만 남기고, 그 안내가 실제로 있다는 것을 값으로 고정한다.
 */
describe('초과분 수입검사 안내', () => {
  it('안내 문구가 한 곳에 있고 비어 있지 않다', () => {
    expect(EXCESS_INSPECTION_NOTE).toBe(messages.overReceiptSplit.notes.excessInspection);
    expect(EXCESS_INSPECTION_NOTE).not.toBe('');
  });
});
