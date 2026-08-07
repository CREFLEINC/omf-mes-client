import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';

describe('describeLoadError', () => {
  it('연결이 끊기면 연결을 확인하라고 한다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(
      '네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.',
    );
  });

  it('권한이 없으면 권한 문구를 낸다', () => {
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );
  });

  it('서버 문구가 있으면 그대로 낸다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버 점검 중입니다' })).toBe(
      '서버 점검 중입니다',
    );
  });

  /* 서버가 빈 문구를 주는 일이 실제로 있다 — 그대로 실으면 배너 본문이 지워진다. */
  it('서버 문구가 비어 있으면 일반 안내로 대신한다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      '잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.',
    );
  });

  it('검증 오류는 서버가 준 줄을 이어 낸다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [{ scope: 'field', code: 'X', message: '첫 줄' }],
      }),
    ).toBe('첫 줄');
  });
});

describe('LoadErrorBanner', () => {
  it('배너와 다시 시도를 낸다', async () => {
    const onRetry = vi.fn();
    render(<LoadErrorBanner error={new ApiRequestError({ kind: 'network' })} onRetry={onRetry} />);

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
