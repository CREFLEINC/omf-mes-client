import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';

/**
 * 이 부품은 W-01-07의 같은 이름 부품을 그대로 옮겼다 — 판정 로직이 같으므로 검사도 같다.
 * 배너 자체는 표현 전용이라 렌더 단언만 두고, `describeLoadError`는 다섯 갈래로 갈리는
 * 판정이라 갈래마다 고정한다.
 */
describe('describeLoadError', () => {
  it('연결이 끊긴 경우는 연결을 확인하라고 안내한다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
  });

  it('권한 없음은 담당자 문의로 안내한다 — 재시도로 풀리지 않는다', () => {
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
  });

  it('서버 문구가 있으면 그대로 낸다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버 안내 문구.' })).toBe(
      '서버 안내 문구.',
    );
  });

  it('서버 문구가 비었거나 없으면 기본 안내로 채운다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeLoadError({ kind: 'http', status: 500 })).toBe(messages.httpError.description);
  });

  it('검증 실패는 서버가 준 항목을 이어 붙인다', () => {
    const items = [
      { scope: 'screen' as const, code: 'REQUIRED', message: '첫째 사유.' },
      { scope: 'screen' as const, code: 'REQUIRED', message: '둘째 사유.' },
    ];

    expect(describeLoadError({ kind: 'validation', errors: items })).toBe('첫째 사유. 둘째 사유.');
    expect(describeLoadError({ kind: 'stateLocked', errors: items })).toBe('첫째 사유. 둘째 사유.');
  });

  it('충돌은 서버 문구를 그대로 내되 빈 문구는 기본 안내로 채운다', () => {
    const conflict = (message: string): ApiError => ({ kind: 'conflict', cause: 'user', message });

    expect(describeLoadError(conflict('먼저 저장됐습니다.'))).toBe('먼저 저장됐습니다.');
    expect(describeLoadError(conflict(''))).toBe(messages.httpError.description);
  });
});

describe('LoadErrorBanner', () => {
  const renderBanner = (error: unknown) => {
    const onRetry = vi.fn<() => void>();

    render(<LoadErrorBanner error={error} onRetry={onRetry} />);

    return { onRetry, user: userEvent.setup() };
  };

  it('실패 제목과 원인을 함께 낸다', () => {
    renderBanner(new ApiRequestError({ kind: 'http', status: 500, message: '서버 안내 문구.' }));

    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByText('서버 안내 문구.')).toBeInTheDocument();
  });

  it('「다시 시도」를 누르면 상위에 알린다', async () => {
    const { onRetry, user } = renderBanner(new ApiRequestError({ kind: 'http', status: 500 }));

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('권한 없음에는 「다시 시도」를 내지 않는다', () => {
    renderBanner(new ApiRequestError({ kind: 'http', status: 403 }));

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('정규화되지 않은 값이 와도 기본 안내를 낸다', () => {
    renderBanner(new Error('알 수 없는 오류'));

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
  });
});
