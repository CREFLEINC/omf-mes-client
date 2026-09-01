import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { LoadErrorBanner, describeLoadError } from './load-error';

const httpError = (status: number, message?: string): ApiRequestError =>
  new ApiRequestError({ kind: 'http', status, ...(message === undefined ? {} : { message }) });

const retry = (): HTMLElement => screen.getByRole('button', { name: messages.common.retry });

describe('describeLoadError', () => {
  it('연결이 끊겼으면 연결을 확인하라고 한다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
  });

  it('권한이 없으면 담당자에게 문의하라고 한다', () => {
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
  });

  it('서버가 문구를 주면 그것을 쓴다 — 사용자에게 남은 유일한 단서다', () => {
    expect(
      describeLoadError({ kind: 'http', status: 409, message: '이미 종결된 부적합입니다' }),
    ).toBe('이미 종결된 부적합입니다');
  });

  it('서버 문구가 비면 일반 안내로 대신한다 — 빈 줄을 내지 않는다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
  });

  it('검증 오류는 항목 문구를 이어 붙인다 — 삼키면 어디에도 안 보인다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [
          { scope: 'field', code: 'A', message: '첫째' },
          { scope: 'screen', code: 'B', message: '둘째' },
        ],
      }),
    ).toBe('첫째 둘째');
  });

  it('충돌 문구가 비면 일반 안내로 대신한다', () => {
    expect(describeLoadError({ kind: 'conflict', cause: 'user', message: '' })).toBe(
      messages.httpError.description,
    );
  });
});

describe('LoadErrorBanner', () => {
  it('오류가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<LoadErrorBanner error={null} onRetry={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('조회 실패는 다시 시도를 낸다', async () => {
    const onRetry = vi.fn();
    render(<LoadErrorBanner error={httpError(500)} onRetry={onRetry} />);

    await userEvent.setup().click(retry());

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
  });

  it('⭐ 권한이 없으면 다시 시도를 내지 않는다 — 눌러도 풀리지 않는다', () => {
    render(<LoadErrorBanner error={httpError(403)} onRetry={vi.fn()} />);

    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
  });

  it('상세를 부르다 실패하면 제목을 바꾼다 — 「목록을 불러오지 못했습니다」가 아니다', () => {
    render(<LoadErrorBanner error={httpError(500)} isDetail onRetry={vi.fn()} />);

    expect(screen.getByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).toBeNull();
  });

  it('연결이 끊긴 실패도 다시 시도를 낸다 — 연결이 돌아오면 풀린다', () => {
    render(<LoadErrorBanner error={new ApiRequestError({ kind: 'network' })} onRetry={vi.fn()} />);

    expect(retry()).toBeInTheDocument();
  });
});
