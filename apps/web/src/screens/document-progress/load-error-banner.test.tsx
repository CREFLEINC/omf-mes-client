import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from './load-error-banner';

const t = messages.documentProgress;

const httpError = (status: number, message?: string): ApiRequestError =>
  new ApiRequestError({ kind: 'http', status, ...(message === undefined ? {} : { message }) });

const validationError = (code: string, message: string): ApiRequestError =>
  new ApiRequestError({ kind: 'validation', errors: [{ scope: 'screen', code, message }] });

const renderBanner = (error: unknown) => {
  const onRetry = vi.fn();

  render(<LoadErrorBanner error={error} onRetry={onRetry} />);

  return { onRetry, user: userEvent.setup() };
};

describe('describeLoadError', () => {
  it('연결이 끊긴 실패와 서버가 거부한 실패를 가른다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
  });

  /* 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다. */
  it('서버가 빈 문구를 주면 기본 안내로 채운다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
  });

  it('서버 문구가 있으면 그대로 낸다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버 점검 중입니다' })).toBe(
      '서버 점검 중입니다',
    );
  });
});

describe('LoadErrorBanner — 일반 조회 실패', () => {
  it('실패 사실과 「다시 시도」를 함께 낸다', async () => {
    const { onRetry, user } = renderBanner(httpError(500, '일시적인 오류입니다'));

    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByText('일시적인 오류입니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /* 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 한다. */
  it('권한 없음에는 「다시 시도」를 내지 않는다', () => {
    renderBanner(httpError(403));

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('LoadErrorBanner — 덮지 않는 문서 유형(400)', () => {
  /*
   * ⭐ 계약이 이 조회의 실패를 400 하나로 두고 「덮지 않는 문서 유형이면 여기로 온다」라고 적었다.
   * 일반 실패 문면으로 뭉개면 사용자가 「다시 시도」를 되풀이하는데 몇 번을 눌러도 같은 답이 온다.
   */
  it('일반 조회 실패와 다른 문면을 낸다', () => {
    renderBanner(httpError(400, '지원하지 않는 유형'));

    expect(screen.getByText(t.errors.unsupportedTitle)).toBeInTheDocument();
    expect(screen.getByText(t.errors.unsupportedDescription)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  it('문면이 일반 조회 실패 문면과 같지 않다', () => {
    expect(t.errors.unsupportedTitle).not.toBe(messages.httpError.loadTitle);
    expect(t.errors.unsupportedDescription).not.toBe(messages.httpError.description);
  });

  /* 유형을 바꾸기 전에는 몇 번을 눌러도 같은 답이 온다. */
  it('「다시 시도」를 내지 않는다', () => {
    renderBanner(httpError(400, '지원하지 않는 유형'));

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /*
   * 400이 두 모양으로 정규화된다 — `errors` 배열이 실려 오면 `validation`, `message`만 오면
   * `http`(400). 한쪽만 보면 서버가 본문 모양을 바꾸는 순간 이 안내가 조용히 사라진다.
   */
  it('오류 항목 배열로 온 400도 같은 갈래로 받는다', () => {
    renderBanner(validationError('UNSUPPORTED_DOCUMENT_TYPE', '지원하지 않는 유형'));

    expect(screen.getByText(t.errors.unsupportedTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
