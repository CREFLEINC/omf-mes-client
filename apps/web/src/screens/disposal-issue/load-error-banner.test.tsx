import { NETWORK_ERROR } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from './load-error-banner';

const httpError = (status: number, message?: string): unknown =>
  new ApiRequestError({ kind: 'http', status, ...(message === undefined ? {} : { message }) });

describe('describeLoadError', () => {
  it('갈래마다 다른 사유를 낸다', () => {
    expect(describeLoadError({ kind: 'network' })).toBe(messages.httpError.offline);
    expect(describeLoadError({ kind: 'http', status: 403 })).toBe(messages.httpError.forbidden);
    expect(describeLoadError({ kind: 'http', status: 500, message: '서버가 준 사유' })).toBe(
      '서버가 준 사유',
    );
  });

  /* 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다. */
  it('서버가 빈 문구를 주면 공통 안내로 메운다', () => {
    expect(describeLoadError({ kind: 'http', status: 500, message: '' })).toBe(
      messages.httpError.description,
    );
    expect(describeLoadError({ kind: 'http', status: 500 })).toBe(messages.httpError.description);
  });

  it('검증·잠금 갈래는 항목 사유를 이어 붙인다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [
          { scope: 'screen', code: 'SAMPLE_A', message: '앞 사유' },
          { scope: 'screen', code: 'SAMPLE_B', message: '뒤 사유' },
        ],
      }),
    ).toBe('앞 사유 뒤 사유');
    expect(describeLoadError({ kind: 'validation', errors: [] })).toBe(
      messages.httpError.description,
    );
  });

  /*
   * client#192 — `join(' ')` 뒤에 `=== ''` 로 검사하면 공백만 있는 문구는 공백 하나로,
   * 빈 문구 여럿은 이음쇠 공백으로 남아 검사를 통과한다. 잇기 **전에** 항목별로 걸러야 한다.
   */
  it('공백만 있는 문구는 공통 안내로 메운다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'SAMPLE_A', message: '   ' }],
      }),
    ).toBe(messages.httpError.description);
  });

  it('빈 문구 여럿도 공통 안내로 메운다', () => {
    expect(
      describeLoadError({
        kind: 'validation',
        errors: [
          { scope: 'screen', code: 'SAMPLE_A', message: '' },
          { scope: 'screen', code: 'SAMPLE_B', message: '' },
        ],
      }),
    ).toBe(messages.httpError.description);
  });
});

describe('LoadErrorBanner', () => {
  /* **실패를 빈 상태로 보이지 않는다** — 「없습니다」로 내면 자료가 없는 줄 알고 조건을 넓힌다. */
  it('실패 제목과 다시 시도를 함께 낸다', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<LoadErrorBanner error={httpError(500, '')} onRetry={onRetry} />);

    expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /**
   * **권한 없음에는 「다시 시도」를 내지 않는다.** 같은 권한으로 다시 불러도 같은 답이 오므로
   * 누를 수 있는 조치를 주면 사용자를 헛돌게 하고 무엇을 해야 하는지를 가린다.
   */
  it('권한 없음에는 다시 시도가 없다', () => {
    render(<LoadErrorBanner error={httpError(403)} onRetry={vi.fn()} />);

    expect(screen.getByText(messages.httpError.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('응답이 없는 실패도 배너로 낸다', () => {
    render(<LoadErrorBanner error={new ApiRequestError(NETWORK_ERROR)} onRetry={vi.fn()} />);

    expect(screen.getByText(messages.httpError.offline)).toBeInTheDocument();
  });
});
