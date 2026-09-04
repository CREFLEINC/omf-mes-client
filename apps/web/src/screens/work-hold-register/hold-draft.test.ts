import { describe, expect, it } from 'vitest';

import { EMPTY_HOLD_DRAFT, validateHoldDraft } from './hold-draft';

/**
 * 사유는 ⓐ 차단이다(스펙 §6 · 2026-08-23 변경).
 *
 * ⚠ 이 판정이 뒤집힌 적이 있다 — 저장 측이 `reason_code` 를 nullable 로 둔 것을 근거로
 * 「막지 않는다」로 적었다가 공유계약 `A-9` 로 되돌렸다. 그래서 여기에 감지기를 둔다.
 */
describe('중단 등록 입력 검증', () => {
  it('사유를 고르지 않으면 막는다', () => {
    expect(validateHoldDraft(EMPTY_HOLD_DRAFT)).toBe('reasonRequired');
  });

  it('빈 문자열도 고르지 않은 것으로 다룬다', () => {
    expect(validateHoldDraft({ reasonCode: '', remarks: '' })).toBe('reasonRequired');
  });

  it('목록에 없는 사유는 막는다 — 서버가 모르는 코드가 기록에 남지 않게', () => {
    expect(validateHoldDraft({ reasonCode: 'NOT_A_REASON', remarks: '' })).toBe('reasonUnknown');
  });

  it('목록의 사유를 고르면 통과한다', () => {
    expect(validateHoldDraft({ reasonCode: 'MOLD_CHANGE', remarks: '' })).toBeNull();
  });

  it('「기타」가 목록에 있어 차단해도 고를 것이 남는다', () => {
    expect(validateHoldDraft({ reasonCode: 'OTHER', remarks: '' })).toBeNull();
  });
});
