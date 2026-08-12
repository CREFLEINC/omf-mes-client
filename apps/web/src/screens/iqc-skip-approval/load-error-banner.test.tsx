import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';

const renderBanner = (error: unknown) => {
  const onRetry = vi.fn();
  render(<LoadErrorBanner error={error} onRetry={onRetry} />);

  return { onRetry, user: userEvent.setup() };
};

const httpError = (status: number, message?: string): unknown =>
  new ApiRequestError({ kind: 'http', status, message });

describe('describeLoadError', () => {
  it('갈래마다 다른 사유를 낸다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버 오류' })).toBe(
      '서버 오류',
    );
  });

  it('서버가 준 메시지를 화면 낱말로 바꾸지 않는다', () => {
    /* 계약이 오류 코드를 enum으로 두지 않았다 — 코드로 분기하면 지어낸 문구가 된다. */
    expect(
      describeLoadError({ kind: 'http', status: 400, message: '조건이 올바르지 않습니다' }),
    ).toBe('조건이 올바르지 않습니다');
  });

  it('서버가 빈 문구를 주면 본문을 지우지 않는다', () => {
    // `??`는 빈 문자열을 통과시켜 배너 본문을 비운다 — 사유 없는 배너가 된다.
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeLoadError({ kind: 'validation', errors: [] })).toBe(
      messages.httpError.description,
    );
  });
});

describe('LoadErrorBanner', () => {
  it('다시 시도를 누르면 그 사실을 알린다', async () => {
    const { onRetry, user } = renderBanner(httpError(500, '서버 오류'));

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /** M12 — 모든 실패에 재시도를 붙이면 여기서 걸린다. */
  it('권한 없음에는 다시 시도를 내지 않는다', () => {
    renderBanner(httpError(403));

    // 선행 단언 — 사유는 보여야 「버튼이 없다」가 뜻을 갖는다.
    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
