import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiError } from '@omf-mes/api-client';
import { describe, expect, it, vi } from 'vitest';

import { RetryErrorBanner } from './retry-error-banner';

const renderBanner = (error: ApiError | null, lockedAt?: string | null) => {
  const onReload = vi.fn();
  render(<RetryErrorBanner error={error} onReload={onReload} lockedAt={lockedAt} />);

  return { onReload, user: userEvent.setup() };
};

const errorItem = (code: string, message: string) => ({
  scope: 'field' as const,
  field: '문자열',
  code,
  message,
});

describe('RetryErrorBanner — 충돌 3값', () => {
  it('워커가 잡고 있으면 잠시 뒤 다시 시도하라고 안내한다', () => {
    renderBanner({ kind: 'conflict', cause: 'workerLease', message: '' });

    expect(
      screen.getByText('이 건을 처리하는 작업이 진행 중입니다. 잠시 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });

  it('시작 시각을 알면 함께 밝힌다', () => {
    renderBanner(
      { kind: 'conflict', cause: 'workerLease', message: '' },
      '2026-08-06T11:20:00+09:00',
    );

    expect(
      screen.getByText('이 건을 처리하는 작업이 11:20부터 진행 중입니다. 잠시 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });

  it('시각이 없으면 시각 없이 안내한다 — 지어내지 않는다', () => {
    renderBanner({ kind: 'conflict', cause: 'workerLease', message: '' }, null);

    expect(
      screen.getByText('이 건을 처리하는 작업이 진행 중입니다. 잠시 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });

  it('다른 사용자가 먼저 처리한 것은 다른 문구로 낸다', () => {
    renderBanner({ kind: 'conflict', cause: 'user', message: '' });

    expect(
      screen.getByText(
        '다른 사용자가 이 건을 먼저 처리했습니다. 목록을 다시 조회해 상태를 확인하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('외부 시스템 동기화도 다른 문구로 낸다', () => {
    renderBanner({ kind: 'conflict', cause: 'erpSync', message: '' });

    expect(
      screen.getByText(
        '외부 시스템에서 이 건이 다시 동기화됐습니다. 목록을 다시 조회해 상태를 확인하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('충돌은 다시 조회하면 풀리므로 그 수단을 함께 낸다', async () => {
    const { onReload, user } = renderBanner({ kind: 'conflict', cause: 'user', message: '' });

    await user.click(screen.getByRole('button', { name: '다시 조회' }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('RetryErrorBanner — 400 검증 실패', () => {
  it('상태가 실패가 아니면 서버 문구가 비어도 안내가 남는다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('NOT_RETRYABLE', '')] });

    expect(
      screen.getByText(
        '지금 상태에서는 다시 보낼 수 없습니다. 목록을 다시 조회해 상태를 확인하세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });

  it('화면이 모르는 필드 이름이 와도 서버 문구를 삼키지 않는다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('STANDARD', '알 수 없는 항목입니다')] });

    expect(screen.getByText('알 수 없는 항목입니다')).toBeInTheDocument();
  });

  it('서버 문구가 전부 비어 있어도 빈 배너를 내지 않는다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('STANDARD', '')] });

    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('여러 사유는 목록으로 낸다', () => {
    renderBanner({
      kind: 'validation',
      errors: [
        errorItem('NOT_RETRYABLE', '상태가 맞지 않습니다'),
        errorItem('STANDARD', '다른 사유'),
      ],
    });

    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1);
  });
});

describe('RetryErrorBanner — 그 밖의 실패', () => {
  it('권한이 없으면 권한 안내를 내고 다시 조회를 권하지 않는다', () => {
    renderBanner({ kind: 'http', status: 403 });

    expect(
      screen.getByText('이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).not.toBeInTheDocument();
  });

  it('계약 형태가 아닌 응답(422 등)도 일반 안내로 낸다', () => {
    renderBanner({ kind: 'http', status: 422 });

    expect(
      screen.getByText('잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.'),
    ).toBeInTheDocument();
  });

  it('연결이 끊겼으면 연결을 확인하라고 안내한다', () => {
    renderBanner({ kind: 'network' });

    expect(
      screen.getByText('네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.'),
    ).toBeInTheDocument();
  });

  it('오류가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<RetryErrorBanner error={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
