import type { ApiError, ErrorItem } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { isSuccessorBlocked, SUCCESSOR_EXISTS_CODE } from './cancel-error';

const item = (code: string, message = '서버가 준 문구'): ErrorItem => ({
  scope: 'screen',
  code,
  message,
});

describe('SUCCESSOR_EXISTS_CODE', () => {
  /** 계약이 400 설명에 **직접 적은** 코드다 — 이 화면이 견주는 유일한 오류 코드다. */
  it('계약이 적은 코드 문자열과 같다', () => {
    expect(SUCCESSOR_EXISTS_CODE).toBe('SUCCESSOR_EXISTS');
  });
});

describe('isSuccessorBlocked', () => {
  it('후속 코드가 실려 오면 참이다', () => {
    expect(isSuccessorBlocked({ kind: 'validation', errors: [item(SUCCESSOR_EXISTS_CODE)] })).toBe(
      true,
    );
  });

  /**
   * ⭐ **다른 사유의 400에는 후속 문면을 붙이지 않는다**(계획 위험 R3의 반대 방향). 계약이 이
   * 400에 네 사유를 함께 적었고, 코드가 붙은 것은 후속 하나뿐이다.
   */
  it('다른 코드의 400은 거짓이다', () => {
    expect(isSuccessorBlocked({ kind: 'validation', errors: [item('ALREADY_CANCELLED')] })).toBe(
      false,
    );
  });

  /**
   * ⭐ **두 사유가 함께 실려 오는 갈래가 실재한다.** 정규화는 항목 중 `STATE_LOCKED`가 하나라도
   * 있으면 통째로 `stateLocked`로 옮기므로, `validation`만 보는 판정은 그때 후속 사유를 놓치고
   * 사용자는 「후속을 먼저 취소하라」는 유일한 실마리를 못 받는다.
   */
  it('상태 잠김으로 옮겨진 응답에서도 후속 코드를 읽는다', () => {
    expect(
      isSuccessorBlocked({
        kind: 'stateLocked',
        errors: [item('STATE_LOCKED'), item(SUCCESSOR_EXISTS_CODE)],
      }),
    ).toBe(true);
  });

  /* 짝 방향 — 상태 잠김이기만 하면 거짓이다(앞 단언이 갈래 이름만 보고 참이 되지 않는다). */
  it('후속 코드가 없는 상태 잠김은 거짓이다', () => {
    expect(isSuccessorBlocked({ kind: 'stateLocked', errors: [item('STATE_LOCKED')] })).toBe(false);
  });

  /* 항목이 없는 갈래에는 볼 코드가 없다 — 서버 문구를 그대로 내는 쪽으로 간다. */
  it.each<[string, ApiError]>([
    ['권한·서버 오류', { kind: 'http', status: 403 }],
    ['연결 실패', { kind: 'network' }],
    ['저장 충돌', { kind: 'conflict', cause: 'user', message: '' }],
  ])('%s는 후속 갈래가 아니다', (_label, error) => {
    expect(isSuccessorBlocked(error)).toBe(false);
  });

  /* 빈 배열도 마찬가지다 — 견줄 코드가 없다. */
  it('항목이 비어 있으면 거짓이다', () => {
    expect(isSuccessorBlocked({ kind: 'validation', errors: [] })).toBe(false);
  });
});
