import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';

/**
 * 배너 자체는 표현 전용이라 렌더 단언만 둔다.
 * 다만 `describeLoadError`는 **다섯 갈래로 갈리는 판정**이라 갈래마다 고정한다 —
 * 한 갈래로 뭉개면 사용자가 할 수 있는 조치가 원인과 어긋난다.
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

  /** 서버가 빈 문구를 주는 일이 실제로 있다 — 빈 배너가 되면 원인을 알 길이 없다. */
  it('서버 문구가 비었거나 없으면 기본 안내로 채운다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeLoadError({ kind: 'http', status: 500 })).toBe(messages.httpError.description);
  });

  /*
   * 잔액 조회는 조건이 잘못되면 400을 준다 — 계약이 200과 400만 두었다.
   * 그 문구가 그대로 배너에 실려야 사용자가 어느 조건을 고쳐야 하는지 안다.
   */
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

  it('항목은 있으나 문구가 모두 비면 기본 안내로 채운다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'REQUIRED', message: '' }],
      }),
    ).toBe(messages.httpError.description);
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

  /**
   * 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 하고,
   * 정작 해야 할 일(담당자 문의)을 가린다.
   */
  it('권한 없음에는 「다시 시도」를 내지 않는다', () => {
    renderBanner(new ApiRequestError({ kind: 'http', status: 403 }));

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 요청 경로 밖에서 생긴 값이 와도 배너가 비지 않아야 한다. */
  it('정규화되지 않은 값이 와도 기본 안내를 낸다', () => {
    renderBanner(new Error('알 수 없는 오류'));

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
  });
});
