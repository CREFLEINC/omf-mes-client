import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { QueueLoadErrorBanner } from './load-error-banner';

/**
 * ⭐ **부품과 함께 옮겨 온 시험이다.** `load-error-banner.tsx` 의 주석이 「빈 문구 여럿에서
 * 공백만 그린 배너」 결함(client#192)을 막는다고 말하는데, 그 말을 지키는 시험이 이 슬라이스에
 * 없었다 — 주석만 옮기고 감지기는 두고 온 꼴이었다.
 *
 * 서버 오류 항목 하나. **문구만 바뀌는 시험이라 나머지는 고정한다** — `scope`·`code` 는
 * 계약이 필수로 두었고 이 배너의 판정에 쓰이지 않는다(문구만 본다).
 */
const errorItem = (message: string) => ({ scope: 'screen' as const, code: 'E_TEST', message });

const renderBanner = (error: ApiError, onRetry = vi.fn()) => {
  renderWithProviders(<QueueLoadErrorBanner error={error} onRetry={onRetry} />);
  return onRetry;
};

const retryButton = () => screen.queryByRole('button', { name: messages.common.retry });

describe('QueueLoadErrorBanner', () => {
  it('연결이 끊기면 연결을 확인하라고 말하고 다시 시도할 자리를 둔다', async () => {
    const onRetry = renderBanner({ kind: 'network' });

    expect(screen.getByText(messages.httpError.offline)).toBeInTheDocument();

    const button = retryButton();
    expect(button).not.toBeNull();

    await userEvent.click(button as HTMLElement);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('권한이 없으면 다시 시도할 자리를 두지 않는다 — 눌러도 같은 답이 온다', () => {
    renderBanner({ kind: 'http', status: 403 });

    expect(screen.getByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(retryButton()).toBeNull();
  });

  it('서버가 문구를 주면 그대로 낸다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('조회 조건이 올바르지 않습니다.')] });

    expect(screen.getByText('조회 조건이 올바르지 않습니다.')).toBeInTheDocument();
  });

  /*
   * 아래 둘이 client#192 가 전수 확인한 결함의 입력이다. 사본 열아홉 곳은 잇고 나서 검사해
   * 이 두 갈래에서 **공백만 그린 배너**를 만든다. 여기서는 잇기 전에 걸러 공용 안내로 떨어진다.
   */
  it('서버 문구가 공백뿐이면 공용 안내로 떨어진다 — 제목만 있고 본문이 빈 배너를 만들지 않는다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('   ')] });

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
  });

  it('빈 문구가 여럿이어도 공용 안내로 떨어진다 — 이어 붙이면 이음쇠 공백이 남아 빠져나간다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem(''), errorItem('')] });

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
  });

  it('공용 안내로 떨어지면 다시 시도할 자리가 함께 선다 — 하라고 한 일을 할 수 있어야 한다', () => {
    renderBanner({ kind: 'validation', errors: [errorItem('  ')] });

    expect(retryButton()).not.toBeNull();
  });

  it('쓸 수 있는 문구와 빈 문구가 섞이면 쓸 수 있는 것만 낸다', () => {
    renderBanner({
      kind: 'validation',
      errors: [errorItem(''), errorItem('조건을 확인하세요.'), errorItem('   ')],
    });

    expect(screen.getByText('조건을 확인하세요.')).toBeInTheDocument();
    expect(retryButton()).toBeNull();
  });

  it('그 밖의 서버 오류는 잠시 뒤 다시 시도하라고 말하고 누를 자리를 둔다', () => {
    renderBanner({ kind: 'http', status: 500 });

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
    expect(retryButton()).not.toBeNull();
  });
});
