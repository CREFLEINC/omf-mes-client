import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from './load-error-banner';

const renderBanner = (error: unknown) => {
  const onRetry = vi.fn<() => void>();

  render(<LoadErrorBanner error={error} onRetry={onRetry} />);

  return { onRetry, user: userEvent.setup() };
};

const apiError = (error: ApiError): unknown => new ApiRequestError(error);

describe('describeLoadError — 실패 사유를 한 줄로 옮긴다', () => {
  it('연결이 끊긴 것과 서버가 답한 것을 가른다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버가 준 문구' })).toBe(
      '서버가 준 문구',
    );
  });

  it('권한 없음은 따로 안내한다', () => {
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
  });

  /* 서버가 빈 문구를 주는 일이 실제로 있다 — 그대로 쓰면 배너 본문이 사라진다. */
  it('서버 문구가 비어 있으면 공통 안내로 채운다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeLoadError({ kind: 'validation', errors: [] })).toBe(
      messages.httpError.description,
    );
  });

  it('검증 실패는 서버가 준 항목 문구를 이어 붙인다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [
          { scope: 'screen', code: 'SAMPLE_CODE_A', message: '앞 문구' },
          { scope: 'screen', code: 'SAMPLE_CODE_B', message: '뒤 문구' },
        ],
      }),
    ).toBe('앞 문구 뒤 문구');
  });
});

describe('LoadErrorBanner — 조회 실패 배너', () => {
  it('실패 안내와 다시 시도를 함께 낸다', async () => {
    const { onRetry, user } = renderBanner(apiError({ kind: 'http', status: 500, message: '' }));

    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /*
   * **권한 없음에는 「다시 시도」를 내지 않는다.** 같은 권한으로 다시 불러도 같은 답이 온다 —
   * 누를 수 있는 조치를 주면 사용자를 헛돌게 하고 무엇을 해야 하는지를 가린다.
   */
  it('권한이 없으면 다시 시도를 내지 않는다', () => {
    renderBanner(apiError({ kind: 'http', status: 403 }));

    // 짝 방향 — 안내 자체는 나온다(아무것도 안 그려도 통과하지 않게 한다).
    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* 요청 경로 밖에서 생긴 오류를 연결 문제로 오인시키면 사용자가 할 수 없는 조치를 하게 된다. */
  it('정규화되지 않은 오류도 배너로 낸다', () => {
    renderBanner(new Error('알 수 없는 오류'));

    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.offline)).not.toBeInTheDocument();
  });
});
