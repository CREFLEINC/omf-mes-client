import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChangeErrorBanner, toBannerContent } from './change-error-banner';
import type { ChangeOutcome } from './change-outcome';
import { currentMismatchBody, errorItemsBody, fieldErrorBody } from './fixtures';

const t = messages.passwordChange;

const renderBanner = (outcome: ChangeOutcome, onRetry = vi.fn()) => {
  const result = render(<ChangeErrorBanner outcome={outcome} onRetry={onRetry} />);

  return { ...result, onRetry };
};

const retryButton = () => screen.queryByRole('button', { name: messages.common.retry });

describe('ChangeErrorBanner — 배너가 서는 갈래와 서지 않는 갈래', () => {
  /**
   * ⛔ **현재 비밀번호 불일치는 배너를 세우지 않는다** — 그 갈래의 자리는 그 칸 옆이다.
   * 배너로도 함께 세우면 같은 말이 두 자리에 서서 어디를 고칠지 흐려진다.
   */
  it('현재 비밀번호 불일치에는 배너가 서지 않는다', () => {
    /* 양성 먼저 — 배너가 실제로 서는 갈래가 있음을 잡은 뒤 서지 않음을 잰다. */
    expect(toBannerContent({ kind: 'network' })).not.toBeNull();

    expect(toBannerContent({ kind: 'currentMismatch' })).toBeNull();

    const { container } = renderBanner({ kind: 'currentMismatch' });

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * ⭐ **통신 실패는 「바꾸지 못했다」고 단언하지 않는다.** 요청이 서버에 닿았을 수 있고 그렇다면
   * 비밀번호는 이미 바뀌었다 — 실패라고만 말하면 사용자가 옛 값으로 다음 로그인을 시도한다.
   */
  it('통신 실패는 이미 바뀌었을 수 있음을 알리고 다시 시도를 준다', () => {
    renderBanner({ kind: 'network' });

    expect(screen.getByText(t.banner.networkUnconfirmed)).toBeInTheDocument();
    expect(screen.getByText(t.banner.networkUnconfirmed).textContent).toContain(
      '이미 바뀌었을 수 있습니다',
    );
    expect(retryButton()).toBeInTheDocument();
  });

  it('다시 시도를 누르면 그 자리를 지나 되보낸다', async () => {
    const onRetry = vi.fn();

    renderBanner({ kind: 'network' }, onRetry);

    retryButton()?.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /** ⛔ 상태 코드는 그리지 않는다 — 사용자가 쓰지 않는 말이다. */
  it('가를 근거가 없으면 공용 안내와 다시 시도가 서고 상태 코드는 나오지 않는다', () => {
    const { container } = renderBanner({ kind: 'unknown', status: 500 });

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
    expect(retryButton()).toBeInTheDocument();
    expect(container.textContent).not.toContain('500');
  });
});

describe('ChangeErrorBanner — 서버가 준 검증 오류(400)', () => {
  /**
   * 인라인으로 다 내려간 오류는 배너를 세우지 않는다 — 같은 말을 두 자리에서 하지 않는다.
   */
  it('입력칸이 있는 이름뿐이면 배너가 서지 않는다', () => {
    expect(
      toBannerContent({ kind: 'invalid', errors: fieldErrorBody('newPassword').errors }),
    ).toBeNull();
  });

  /**
   * ⭐ **모르는 이름과 화면 수준 오류는 배너로 올라간다 — 어디에도 보이지 않는 경로를 남기지
   * 않는다.** 인라인으로 흘리면 대응하는 칸이 없어 그 문장이 사라진다.
   */
  it('모르는 이름과 화면 수준 오류는 배너에 선다', () => {
    renderBanner({
      kind: 'invalid',
      errors: errorItemsBody([
        {
          scope: 'field',
          field: 'unknownField',
          code: 'SYN_CODE_H',
          message: '합성 모르는 칸 문구입니다.',
        },
        ...currentMismatchBody().errors,
      ]).errors,
    });

    expect(screen.getByText(/합성 모르는 칸 문구입니다\./)).toBeInTheDocument();
    expect(screen.getByText(/합성 실패 문구입니다\./)).toBeInTheDocument();
  });

  /**
   * ⛔ **서버가 준 문구가 있을 때는 「다시 시도」를 두지 않는다** — 값을 고쳐야 풀리는 갈래라
   * 재시도가 헛돌고 정작 해야 할 일을 가린다(공유계약 G-23).
   */
  it('서버가 준 문구가 있으면 다시 시도를 두지 않는다', () => {
    renderBanner({ kind: 'invalid', errors: currentMismatchBody().errors });

    expect(screen.getByText(/합성 실패 문구입니다\./)).toBeInTheDocument();
    expect(retryButton()).toBeNull();
  });

  /**
   * ⭐ **문구가 하나도 남지 않으면 공용 안내로 떨어지고 그때 「다시 시도」가 함께 선다.**
   * 화면이 무엇을 고쳐야 하는지 말하지 못하는 상태에서 남는 조치는 다시 보내는 것뿐이다 —
   * 말과 컨트롤이 같은 곳을 가리켜야 한다.
   */
  it('빈 문구만 오면 공용 안내와 다시 시도가 선다', () => {
    renderBanner({
      kind: 'invalid',
      errors: errorItemsBody([
        { scope: 'field', field: 'newPassword', code: 'SYN_CODE_I', message: '   ' },
        { scope: 'screen', code: 'SYN_CODE_J', message: '' },
      ]).errors,
    });

    expect(screen.getByText(messages.httpError.description)).toBeInTheDocument();
    expect(retryButton()).toBeInTheDocument();
  });
});

describe('ChangeErrorBanner — 안내와 컨트롤이 같은 곳을 가리킨다', () => {
  const outcomes: [string, ChangeOutcome][] = [
    ['통신 실패', { kind: 'network' }],
    ['가를 근거 없음', { kind: 'unknown', status: 500 }],
    ['검증 실패(서버 문구)', { kind: 'invalid', errors: currentMismatchBody().errors }],
    [
      '검증 실패(빈 문구 폴백)',
      {
        kind: 'invalid',
        errors: errorItemsBody([{ scope: 'screen', code: 'SYN_CODE_K', message: ' ' }]).errors,
      },
    ],
  ];

  it.each(outcomes)('%s — 다시 시도를 권하는 문구와 버튼의 유무가 일치한다', (_label, outcome) => {
    renderBanner(outcome);

    const text = document.body.textContent ?? '';
    const advisesRetry = text.includes('다시 시도');
    const hasRetryButton = retryButton() !== null;

    expect(hasRetryButton).toBe(advisesRetry);
  });

  /** 짝 양성 — 위 시험이 「양쪽 다 없음」으로만 통과하지 않게, 두 갈래가 실제로 있음을 잰다. */
  it('권하는 갈래와 권하지 않는 갈래가 둘 다 있다', () => {
    expect(toBannerContent({ kind: 'network' })?.canRetry).toBe(true);
    expect(
      toBannerContent({ kind: 'invalid', errors: currentMismatchBody().errors })?.canRetry,
    ).toBe(false);
  });
});
