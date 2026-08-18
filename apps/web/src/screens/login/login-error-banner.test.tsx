import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fieldErrorResponseBody } from './fixtures';
import {
  describeLockWarning,
  LoginErrorBanner,
  LOCK_THRESHOLD_ATTEMPTS,
  type LoginErrorBannerProps,
} from './login-error-banner';

const t = messages.login;

const renderBanner = (overrides: Partial<LoginErrorBannerProps> = {}) => {
  const props: LoginErrorBannerProps = {
    outcome: { kind: 'mismatch' },
    onRetry: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();

  render(<LoginErrorBanner {...props} />);

  return { user, ...props };
};

const banner = (): HTMLElement => screen.getByRole('alert');
const retryButton = (): HTMLElement => screen.getByRole('button', { name: messages.common.retry });

describe('LOCK_THRESHOLD_ATTEMPTS', () => {
  it('착수 시점의 자리표시 값 5를 든다', () => {
    expect(LOCK_THRESHOLD_ATTEMPTS).toBe(5);
  });
});

describe('describeLockWarning — 남은 시도 횟수', () => {
  /**
   * ⭐ **없는 값을 지어내지 않는다.** 계약이 `remainingAttempts`를 선택 필드로 두고
   * **없는 계정에는 오지 않는다**고 적었다 — 그것이 계정 존재를 드러내지 않으려는 설계다.
   * 화면이 여기서 기본값을 메우면 그 설계가 무너진다.
   */
  it('값이 없으면 안내가 없다', () => {
    expect(describeLockWarning(undefined)).toBeUndefined();
  });

  it('임계값 안이면 누적을 함께 말한다', () => {
    expect(describeLockWarning(3)).toBe(t.banner.lockWarning(2, LOCK_THRESHOLD_ATTEMPTS));
    expect(describeLockWarning(3)).toContain('2/5');
  });

  it('한 번 남았으면 누적이 임계값 직전이다', () => {
    expect(describeLockWarning(1)).toContain('4/5');
  });

  /**
   * ⭐ **자리표시 상수가 서버와 어긋날 때의 되물림**(완료 조건 T3-3).
   *
   * 누적은 `임계값 − 남은 횟수`로 만든다. 서버 임계값이 5가 아니면 이 셈이 0 이하가 되고,
   * 그대로 그리면 **「(0/5)」·「(-4/5)」** 같은 표시가 사용자에게 간다. 그때는 임계값을 아예
   * 말하지 않고 **남은 횟수만** 말한다 — 이 되물림이 자리표시 상수가 만드는 위험의 실감지기다.
   */
  it.each([
    ['임계값과 같으면', LOCK_THRESHOLD_ATTEMPTS],
    ['임계값보다 크면', 9],
  ])('%s 임계값을 말하지 않고 남은 횟수만 말한다', (_label, remaining) => {
    const text = describeLockWarning(remaining);

    expect(text).toBe(t.banner.lockWarningWithoutThreshold(remaining));
    expect(text).toContain(String(remaining));
    expect(text).not.toContain(`/${String(LOCK_THRESHOLD_ATTEMPTS)}`);
  });

  it('되물림 문장에 음수나 0 누적이 나오지 않는다', () => {
    for (const remaining of [LOCK_THRESHOLD_ATTEMPTS, 6, 9, 100]) {
      const text = describeLockWarning(remaining) ?? '';

      expect(text).not.toContain('-');
      expect(text).not.toContain('(0/');
    }
  });

  /**
   * 0 이하는 이 갈래에서 뜻이 성립하지 않는다 — 잠겼다면 401이 아니라 423이 온다.
   * **지어내지 않고 말하지 않는다.**
   */
  it.each([[0], [-1]])('남은 횟수가 %s이면 안내가 없다', (remaining) => {
    expect(describeLockWarning(remaining)).toBeUndefined();
  });
});

describe('LoginErrorBanner — 자격 불일치', () => {
  it('뭉뚱그린 문구를 낸다', () => {
    renderBanner({ outcome: { kind: 'mismatch' } });

    expect(banner()).toHaveTextContent(t.banner.failureTitle);
    expect(banner()).toHaveTextContent(t.banner.mismatch);
  });

  it('남은 횟수가 오면 둘째 줄이 함께 선다', () => {
    renderBanner({ outcome: { kind: 'mismatch', remainingAttempts: 3 } });

    expect(banner()).toHaveTextContent(t.banner.mismatch);
    expect(banner()).toHaveTextContent(t.banner.lockWarning(2, LOCK_THRESHOLD_ATTEMPTS));
  });

  /**
   * ⭐ **없는 계정에는 남은 횟수가 오지 않는다** — 그때 화면이 숫자를 지어내면 계정 존재를
   * 흘리지 않으려던 설계가 무너진다.
   *
   * 음성 단언이므로 **뭉뚱그린 문구를 잡은 뒤**에 잰다.
   */
  it('남은 횟수가 없으면 둘째 줄이 보이지 않는다', () => {
    renderBanner({ outcome: { kind: 'mismatch' } });

    expect(banner()).toHaveTextContent(t.banner.mismatch);

    expect(banner().textContent).not.toMatch(/\d/);

    /*
     * ⭐ **빈 줄도 「말한 것」이 된다** — 없는 둘째 줄을 빈 글자로 밀어 넣으면 이음쇠 공백이
     * 하나 남고, 줄을 요소로 쪼개는 날에는 그것이 **빈 문단 한 줄**로 실체화된다.
     * 공백을 정규화하지 않고 재야 「줄을 만들지 않았다」가 잡힌다.
     */
    expect(
      within(banner()).getByText(t.banner.mismatch, { normalizer: (text) => text }),
    ).toBeInTheDocument();
  });

  it('불일치에는 「다시 시도」를 두지 않는다', () => {
    renderBanner({ outcome: { kind: 'mismatch', remainingAttempts: 3 } });

    expect(banner()).toHaveTextContent(t.banner.mismatch);

    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
  });
});

describe('LoginErrorBanner — 잠긴 계정', () => {
  it('해결 경로를 말한다', () => {
    renderBanner({ outcome: { kind: 'locked' } });

    expect(banner()).toHaveTextContent(t.banner.locked);
    expect(t.banner.locked).toContain('관리자');
  });

  /**
   * ⛔ **「다시 시도」를 붙이지 않는다.** 같은 자격으로 다시 불러도 같은 답이 온다 —
   * 누를 수 있는 조치를 주면 사용자를 헛돌게 하고, 정작 해야 할 일(관리자 요청)을 가린다.
   */
  it('「다시 시도」를 두지 않는다', () => {
    renderBanner({ outcome: { kind: 'locked' } });

    expect(banner()).toHaveTextContent(t.banner.locked);

    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
  });

  /**
   * ⭐ **수치를 보이지 않는다**(완료 조건 T3-5). 실패 횟수·임계값을 잠긴 화면에 남기면
   * 「몇 번 만에 잠겼는가」가 드러나 잠금 정책을 밖에서 셀 수 있게 된다.
   *
   * 음성 단언이라 **문구를 잡은 뒤**에 잰다.
   */
  it('실패 횟수나 임계값이 보이지 않는다', () => {
    renderBanner({ outcome: { kind: 'locked' } });

    expect(banner()).toHaveTextContent(t.banner.locked);

    expect(banner().textContent).not.toMatch(/\d/);
  });
});

describe('LoginErrorBanner — 통신 실패', () => {
  it('연결을 확인하라고 말하고 「다시 시도」를 낸다', () => {
    renderBanner({ outcome: { kind: 'network' } });

    expect(banner()).toHaveTextContent(messages.httpError.offline);
    expect(retryButton()).toBeInTheDocument();
  });

  it('「다시 시도」를 누르면 되먹임이 온다', async () => {
    const onRetry = vi.fn();
    const { user } = renderBanner({ outcome: { kind: 'network' }, onRetry });

    await user.click(retryButton());

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('LoginErrorBanner — 검증 실패', () => {
  /**
   * 서버가 준 문구를 그대로 낸다. **코드로 분기하지 않는다** — 계약이 이 자리의 실패를
   * 문장으로만 설명하고 코드 enum을 두지 않았다.
   */
  it('서버가 준 문구를 배너에 낸다', () => {
    const body = fieldErrorResponseBody();

    renderBanner({ outcome: { kind: 'invalid', errors: body.errors } });

    expect(banner()).toHaveTextContent(body.errors[0]?.message ?? '');
  });

  it('오류가 여럿이면 모두 낸다', () => {
    renderBanner({
      outcome: {
        kind: 'invalid',
        errors: [
          { scope: 'field', field: 'loginId', code: 'SYN_CODE_B', message: '합성 문구 가.' },
          { scope: 'screen', code: 'SYN_CODE_C', message: '합성 문구 나.' },
        ],
      },
    });

    expect(banner()).toHaveTextContent('합성 문구 가.');
    expect(banner()).toHaveTextContent('합성 문구 나.');
  });

  it('검증 실패에는 「다시 시도」를 두지 않는다', () => {
    const body = fieldErrorResponseBody();

    renderBanner({ outcome: { kind: 'invalid', errors: body.errors } });

    expect(banner()).toHaveTextContent(body.errors[0]?.message ?? '');

    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
  });

  /**
   * ⭐ **서버가 빈 문구를 주는 일이 실제로 있다** — 전례(`approval-inbox/load-error-banner.tsx`)가
   * 관측된 사실로 적어 둔 자리이고, 형제 슬라이스들이 전부 이 경우를 잰다.
   *
   * 걸러 내지 않으면 **제목만 남고 본문이 빈 배너**가 선다. 「실패했다」는 알겠는데 무엇을
   * 해야 하는지가 0이고, 갈래를 나눠 각각 알린다는 이 화면의 목적이 그 갈래에서만 무너진다.
   *
   * 세 모양을 함께 잰다 — 빈 글자 · 공백만 · 항목 자체가 없음.
   */
  it.each([
    ['빈 글자', [{ scope: 'screen' as const, code: 'SYN_CODE_D', message: '' }]],
    ['공백만', [{ scope: 'screen' as const, code: 'SYN_CODE_D', message: '   ' }]],
    [
      '빈 글자 여럿',
      [
        { scope: 'screen' as const, code: 'SYN_CODE_D', message: '' },
        { scope: 'field' as const, field: 'password', code: 'SYN_CODE_E', message: '' },
      ],
    ],
    ['항목 없음', []],
  ])('서버가 %s를 주면 공용 안내로 떨어진다', (_label, errors) => {
    renderBanner({ outcome: { kind: 'invalid', errors } });

    expect(banner()).toHaveTextContent(messages.httpError.description);
  });

  /** 빈 항목이 섞여도 **말할 것이 있으면** 그것을 낸다 — 통째로 버리지 않는다. */
  it('빈 문구가 섞여 있으면 남은 문구만 낸다', () => {
    renderBanner({
      outcome: {
        kind: 'invalid',
        errors: [
          { scope: 'screen', code: 'SYN_CODE_D', message: '' },
          { scope: 'screen', code: 'SYN_CODE_E', message: '합성 문구 다.' },
        ],
      },
    });

    expect(banner()).toHaveTextContent('합성 문구 다.');

    expect(screen.queryByText(messages.httpError.description)).toBeNull();
  });
});

describe('LoginErrorBanner — 가를 근거가 없는 응답', () => {
  /**
   * ⛔ **자격이 틀렸다고 말하지 않는다.** 서버 장애나 권한 문제에 그 문장을 붙이면 사용자가
   * 맞는 자격을 의심하며 시도를 되풀이하다 계정을 잠근다.
   *
   * **그렇다고 침묵하지도 않는다** — 눌렀는데 아무 일도 없는 화면은 사용자가 무엇을 해야 할지
   * 알 수 없게 만든다. 공용 문구로 「지금은 처리하지 못했다」만 말한다.
   */
  it('자격 문구 없이 공용 안내를 낸다', () => {
    renderBanner({ outcome: { kind: 'unknown', status: 500 } });

    expect(banner()).toHaveTextContent(messages.httpError.description);

    expect(screen.queryByText(t.banner.mismatch)).toBeNull();
  });

  /** ⛔ 상태 코드를 사용자에게 보이지 않는다 — 사용자가 쓰지 않는 말이다. */
  it('상태 코드가 화면에 나오지 않는다', () => {
    renderBanner({ outcome: { kind: 'unknown', status: 500 } });

    expect(banner()).toHaveTextContent(messages.httpError.description);

    expect(banner().textContent).not.toContain('500');
  });

  /**
   * ⭐ **하라고 말했으면 할 수 있어야 한다.** 이 갈래의 문구가 「잠시 뒤 다시 시도하세요」로
   * 끝나는데 누를 자리가 없으면 안내와 컨트롤이 반대를 가리킨다 — 공유계약 G-23의 취지가
   * 역방향으로도 성립하는 자리다.
   *
   * 기준에도 그대로 들어맞는다 — 고칠 값이 없고 서버 사정은 다시 보내면 달라질 수 있다.
   */
  it('「다시 시도」를 낸다', () => {
    renderBanner({ outcome: { kind: 'unknown', status: 500 } });

    expect(retryButton()).toBeInTheDocument();
  });

  it('「다시 시도」를 누르면 되먹임이 온다', async () => {
    const onRetry = vi.fn();
    const { user } = renderBanner({ outcome: { kind: 'unknown', status: 503 }, onRetry });

    await user.click(retryButton());

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
