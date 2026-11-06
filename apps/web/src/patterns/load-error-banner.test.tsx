import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoadErrorAlert, LoadErrorBanner, describeLoadError } from './load-error-banner';
import { ApiRequestError } from './request';

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
      '잠시 뒤 재시도하세요. 지속적인 요청 불가 시 담당자에게 문의하세요.',
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

  /* client#192 — 잇고 나서 검사하면 공백만 남은 본문이 선다. */
  it('공백만 있거나 빈 줄은 거르고, 남는 것이 없으면 일반 안내로 대신한다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [
          { scope: 'field', code: 'X', message: '   ' },
          { scope: 'field', code: 'Y', message: '' },
        ],
      }),
    ).toBe('잠시 뒤 재시도하세요. 지속적인 요청 불가 시 담당자에게 문의하세요.');
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

  /* omf-all-around#187 — 권한 없음을 일시 장애처럼 보이면 사용자가 다시 시도를 되풀이한다. */
  it('권한 없음(403)이면 권한 문구를 보이고 다시 시도를 두지 않는다', () => {
    render(
      <LoadErrorBanner
        error={new ApiRequestError({ kind: 'http', status: 403 })}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('요청을 처리하지 못했습니다')).toBeInTheDocument();
    expect(
      screen.getByText('이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('목록을 불러오지 못했습니다')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  /* 실제 서버는 403 을 오류 봉투에 담아 보내 정규화가 validation 으로 접는다. */
  it('오류 봉투에 담긴 403 도 권한 없음으로 보이고 다시 시도를 두지 않는다', () => {
    render(
      <LoadErrorBanner
        error={
          new ApiRequestError(
            {
              kind: 'validation',
              status: 403,
              errors: [
                {
                  scope: 'screen',
                  code: 'PERMISSION_DENIED',
                  message: '이 기능을 쓸 권한이 없습니다.',
                },
              ],
            },
            { httpStatus: 403 },
          )
        }
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('요청을 처리하지 못했습니다')).toBeInTheDocument();
    expect(
      screen.getByText('이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('서버 오류(5xx)는 지금처럼 조회 실패와 다시 시도를 낸다', () => {
    render(
      <LoadErrorBanner
        error={new ApiRequestError({ kind: 'http', status: 503 })}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});

describe('LoadErrorAlert', () => {
  it('배너 자리 없이 같은 알림을 그린다', () => {
    const { container } = render(
      <LoadErrorAlert
        error={new ApiRequestError({ kind: 'http', status: 403 })}
        onRetry={vi.fn()}
      />,
    );

    expect(container.querySelector('.banner-slot')).toBeNull();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
