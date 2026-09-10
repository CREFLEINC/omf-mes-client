import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginErrorBanner, type LoginErrorBannerProps } from './login-error-banner';

const t = messages.login;

const renderBanner = (overrides: Partial<LoginErrorBannerProps> = {}) => {
  const props: LoginErrorBannerProps = {
    outcome: { kind: 'credentials' },
    onRetry: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();

  render(<LoginErrorBanner {...props} />);

  return { user, ...props };
};

const banner = (): HTMLElement => screen.getByRole('alert');
const queryRetry = (): HTMLElement | null =>
  screen.queryByRole('button', { name: messages.common.retry });

/**
 * 배너가 말하는 것은 **셋뿐이다**(#1034) — 로그인 정보 오류 · 계정 잠김 · 서버 오류.
 *
 * 이 파일이 지키는 것은 문구가 아니라 **세 갈래가 서로 다른 말을 한다**는 사실과, 「다시 시도」가
 * **다시 시도해서 달라지는 쪽에만** 선다는 규율이다.
 */
describe('LoginErrorBanner', () => {
  it('로그인 정보 오류는 자격을 확인하라고 말한다', () => {
    renderBanner({ outcome: { kind: 'credentials' } });

    expect(banner()).toHaveTextContent(t.banner.credentialsTitle);
    expect(banner()).toHaveTextContent(t.banner.credentials);
  });

  /**
   * 잠긴 계정은 **스스로 풀 수 없다** — 그래서 문구가 해결 경로(관리자 요청)를 가리킨다.
   * 자격 문구가 섞이면 잠긴 사람이 맞는 자격을 계속 다시 친다.
   */
  it('계정 잠김은 관리자 요청을 가리킨다', () => {
    renderBanner({ outcome: { kind: 'locked' } });

    expect(banner()).toHaveTextContent(t.banner.lockedTitle);
    expect(banner()).toHaveTextContent(t.banner.locked);
    expect(banner()).not.toHaveTextContent(t.banner.credentials);
  });

  /** ⛔ 잠긴 화면에 수치를 남기면 잠금 정책을 밖에서 셀 수 있다. */
  it('계정 잠김 배너에 실패 횟수나 임계값이 보이지 않는다', () => {
    renderBanner({ outcome: { kind: 'locked' } });

    expect(banner().textContent).not.toMatch(/\d/);
  });

  it('서버 오류는 자격이 틀렸다고 말하지 않는다', () => {
    renderBanner({ outcome: { kind: 'server' } });

    expect(banner()).toHaveTextContent(t.banner.serverTitle);
    expect(banner()).toHaveTextContent(t.banner.server);
    expect(banner()).not.toHaveTextContent(t.banner.credentials);
  });

  /**
   * ⭐ **세 갈래가 서로 다른 제목을 든다.** 제목이 겹치면 갈래를 나눈 뜻이 사라진다 —
   * 사용자는 제목으로 「내가 무엇을 해야 하는가」를 먼저 가른다.
   */
  it('세 갈래의 제목이 서로 겹치지 않는다', () => {
    const titles = [t.banner.credentialsTitle, t.banner.lockedTitle, t.banner.serverTitle];

    expect(new Set(titles).size).toBe(titles.length);
  });

  /**
   * ⛔ **누를 수 있는데 아무 일도 없는 컨트롤을 두지 않는다**(공유계약 G-23).
   * 로그인 정보 오류는 **값을 고쳐야** 풀리고, 잠긴 계정은 몇 번을 보내도 같은 답이 온다.
   */
  it.each([
    ['로그인 정보 오류', 'credentials' as const],
    ['계정 잠김', 'locked' as const],
  ])('%s에는 「다시 시도」가 서지 않는다', (_label, kind) => {
    renderBanner({ outcome: { kind } });

    expect(queryRetry()).toBeNull();
  });

  /**
   * 역방향도 함께 못 박는다 — 문구가 「잠시 뒤 다시 시도하세요」라고 말하는데 누를 자리가
   * 없으면 **하라고 한 일을 할 수 없다.**
   */
  it('서버 오류에는 「다시 시도」가 서고, 누르면 되먹임이 돈다', async () => {
    const { user, onRetry } = renderBanner({ outcome: { kind: 'server' } });

    const retry = queryRetry();

    expect(retry).not.toBeNull();

    await user.click(retry as HTMLElement);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /**
   * ⭐ **잡은 원인을 그리지 않는다.** `server` 갈래는 이 앱의 코드가 던진 값을 안고 올 수 있다
   * (`queries.ts`의 성공 되먹임). 그것이 화면에 새면 내부 사정이 사용자에게 간다.
   */
  it('갈래가 안고 온 원인이 화면에 새지 않는다', () => {
    const secret = 'SYN-INTERNAL-CAUSE-01';

    renderBanner({ outcome: { kind: 'server', cause: new Error(secret) } });

    expect(banner()).not.toHaveTextContent(secret);
  });

  /**
   * 규범 6 — 화면이 직접 배치하는 배너는 이음매를 **스스로** 갖는다. 소비하는 화면이 붙일
   * 것을 잊을 수 없게 한다.
   */
  it('배너가 이음매를 스스로 갖는다', () => {
    const { container } = render(
      <LoginErrorBanner outcome={{ kind: 'server' }} onRetry={vi.fn()} />,
    );

    expect(container.querySelector('.banner-slot')).not.toBeNull();
  });
});
