import { describe, expect, it } from 'vitest';

import { PENDING_QUALIFICATION_TYPE, QUALIFICATION_TYPE_OPTIONS } from './qualification-options';

/*
 * 계약: `qualificationTypeCode`는 「공통코드 — 값 목록 미정 §8-5」다.
 * **값을 지어내지 않는다** — 자리표시 하나만 두고 화면이 「선택지 준비 중」을 밝힌다.
 */
describe('QUALIFICATION_TYPE_OPTIONS', () => {
  it('자리표시 하나뿐이다 — 값을 지어내지 않았다', () => {
    expect(QUALIFICATION_TYPE_OPTIONS).toHaveLength(1);
    expect(QUALIFICATION_TYPE_OPTIONS[0]?.value).toBe(PENDING_QUALIFICATION_TYPE);
  });

  it('자리표시 값이 업무 코드처럼 보이지 않는다', () => {
    expect(PENDING_QUALIFICATION_TYPE).toBe('PENDING');
  });

  it('자리표시 문구가 준비 중임을 밝힌다', () => {
    expect(QUALIFICATION_TYPE_OPTIONS[0]?.label).toBe('선택지 준비 중');
  });
});
