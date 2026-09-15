import { LOCALES, setLocale } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../patterns/session';
import { renderWithProviders } from '../test/api-harness';

/**
 * 셸 뼈대의 이름이 **고른 언어를 따르는지**를 베트남어로 잰다(#1131).
 *
 * `@crefle/web-ui` 는 본문·건너뛰기·사이드바·지우기의 이름을 **한국어 기본값**으로 들고 있고,
 * 우리가 넘기는 한국어는 그 기본값과 글자까지 같다(한국어 화면을 하나도 바꾸지 않으려고
 * 일부러 그렇게 두었다). 그래서 **한국어 회차로는 프롭을 지워도 초록이다** — 다른 언어로
 * 세워야 넘겼는지가 드러난다.
 *
 * ⭐ **각 이름을 베트남어로 찾은 뒤, 한국어로는 찾히지 않는지 뒤집어 확인한다.** 앞만 재면
 * 부품이 두 이름을 동시에 들고 있는 경우(예: 접근명 하나를 두 자리에 거는 부품)를 못 가른다.
 */

/** ⚠ `vi` 는 vitest 의 이름이다 — 문구 쪽은 다른 이름으로 받는다. */
const viMessages = LOCALES.vi;

/**
 * ⭐ **화면 모듈은 언어를 고른 «뒤에» 싣는다.** 화면이 `const t = messages.…` 로 문구를
 * 모듈 최상위에서 붙잡으므로, 먼저 실으면 그 회차는 한국어로 굳는다(`app/main.tsx` 가 앱에서
 * `routes` 를 동적으로 싣는 이유도 같다).
 */
let AppLayout: typeof import('./layout').AppLayout;

beforeAll(async () => {
  setLocale('vi');
  ({ AppLayout } = await import('./layout'));
});

/** ⚠ 고른 언어는 모듈 하나가 든 전역이다 — 두고 나가면 뒤에 도는 것이 베트남어로 선다. */
afterAll(() => {
  setLocale('ko');
});

const renderShell = (): void => {
  renderWithProviders(
    <SessionProvider>
      <AppLayout>{'Nội dung thử'}</AppLayout>
    </SessionProvider>,
    { session: null },
  );
};

describe('셸 뼈대의 이름 — 베트남어', () => {
  it('본문 랜드마크의 이름이 베트남어로 선다', () => {
    renderShell();

    expect(screen.getByRole('main', { name: viMessages.common.shell.main })).toBeInTheDocument();
    expect(
      screen.queryByRole('main', { name: LOCALES.ko.common.shell.main }),
    ).not.toBeInTheDocument();
  });

  it('본문으로 건너뛰기 링크가 베트남어로 선다', () => {
    renderShell();

    expect(
      screen.getByRole('link', { name: viMessages.common.shell.skipToMain }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: LOCALES.ko.common.shell.skipToMain }),
    ).not.toBeInTheDocument();
  });

  it('사이드바의 이름이 베트남어로 선다', () => {
    renderShell();

    expect(
      screen.getByRole('navigation', { name: viMessages.common.shell.mainMenu }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주 메뉴' })).not.toBeInTheDocument();
  });

  /**
   * 지우기 단추는 **검색칸에 글자가 있을 때만** 선다 — 비운 채로 찾으면 없는 것이 규범인지
   * 이름이 어긋난 것인지 구별되지 않으므로, 먼저 적어 넣는다.
   */
  it('사이드바 검색칸의 지우기 단추 이름이 베트남어로 선다', async () => {
    const user = userEvent.setup();

    renderShell();

    const sidebar = screen.getByRole('navigation', { name: viMessages.common.shell.mainMenu });

    await user.type(
      within(sidebar).getByRole('searchbox', { name: viMessages.shellNav.search.label }),
      'kho',
    );

    expect(
      within(sidebar).getByRole('button', { name: viMessages.common.clear }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole('button', { name: LOCALES.ko.common.clear }),
    ).not.toBeInTheDocument();
  });
});

describe('사이드바 버전 표기 — 베트남어', () => {
  it('릴리스 태그가 없는 빌드의 표기가 베트남어로 선다', () => {
    vi.stubEnv('VITE_APP_VERSION', '');

    try {
      renderShell();

      expect(screen.getByText(viMessages.shellNav.version.dev)).toBeInTheDocument();
      expect(screen.queryByText(LOCALES.ko.shellNav.version.dev)).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
