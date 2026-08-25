import type { ApiError } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { isTransitionStale, transitionStaleMessage } from './transition-error';

const label = (code: string): string => ({ DEFECTIVE: '불량' })[code] ?? `${code} 상태`;

describe('LOT 전이 충돌 안내', () => {
  it.each<ApiError>([
    { kind: 'conflict', cause: 'user', message: '' },
    { kind: 'http', status: 409 },
    { kind: 'http', status: 412 },
  ])('재조회해야 하는 충돌을 판정한다', (error) => {
    expect(isTransitionStale(error)).toBe(true);
  });

  it('구조화된 현재 상태를 자유 문구보다 우선한다', () => {
    const error: ApiError = {
      kind: 'conflict',
      cause: 'user',
      currentLotStatusCode: 'DEFECTIVE',
      message: '파싱하거나 그대로 쓰면 안 되는 합성 문구',
    };

    expect(transitionStaleMessage(error, label)).toBe(
      'LOT 정보가 변경되었습니다. 현재 상태는 불량입니다. 최신 정보를 불러온 뒤 다시 확인하세요.',
    );
  });

  it('구조화 상태가 없을 때만 서버 문구와 fallback을 사용한다', () => {
    expect(
      transitionStaleMessage(
        { kind: 'http', status: 412, message: '잠금 토큰이 만료됐습니다.' },
        label,
      ),
    ).toBe('잠금 토큰이 만료됐습니다.');
    expect(transitionStaleMessage({ kind: 'http', status: 409, message: '' }, label)).toBe(
      'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.',
    );
  });
});
