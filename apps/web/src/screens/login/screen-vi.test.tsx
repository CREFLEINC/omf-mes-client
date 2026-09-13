import { LOCALES, setLocale } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { SessionProvider } from '../../patterns/session';

/**
 * 로그인 화면을 **베트남어로** 세워 잰다(#1126).
 *
 * ⭐ **이 화면이 관문이다.** 다른 70화면은 이미 들어온 사람이 보는 것이고, 언어를 잘못 만난
 * 사람이 처음 만나는 벽은 여기다. 그래서 이 화면만은 「고른 언어로 정말 서는가」를 따로 잰다.
 *
 * ⭐ **각 이름을 베트남어로 찾은 뒤 한국어로는 찾히지 않는지 뒤집어 확인한다.** 앞만 재면
 * 두 언어가 함께 선 화면(반쯤 바뀐 화면)도 통과한다 — 그것이 안 바뀐 화면보다 나쁘다.
 */

/** ⚠ `vi` 는 vitest 의 이름이다 — 문구 쪽은 다른 이름으로 받는다. */
const viMessages = LOCALES.vi;

/**
 * ⭐ **화면 모듈은 언어를 고른 «뒤에» 싣는다.** 화면이 `const t = messages.login` 으로 문구를
 * 모듈 최상위에서 붙잡으므로, 먼저 실으면 그 회차는 한국어로 굳는다(`app/main.tsx` 가 앱에서
 * `routes` 를 동적으로 싣는 이유도 같다).
 */
let LoginScreen: typeof import('./screen').LoginScreen;

beforeAll(async () => {
  setLocale('vi');
  ({ LoginScreen } = await import('./screen'));
});

/** ⚠ 고른 언어는 모듈 하나가 든 전역이다 — 두고 나가면 뒤에 도는 것이 베트남어로 선다. */
afterAll(() => {
  setLocale('ko');
});

const renderScreen = (): void => {
  renderWithProviders(
    <SessionProvider>
      <LoginScreen />
    </SessionProvider>,
    { route: '/login', session: null },
  );
};

describe('로그인 화면 — 베트남어', () => {
  it('언어 칸의 이름이 베트남어로 선다', () => {
    renderScreen();

    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '언어' })).not.toBeInTheDocument();
  });

  /**
   * 칸은 있어도 **고를 것이 제 언어로 적혀 있지 않으면** 무엇을 고를지 알 수 없다. 그 이름들은
   * 옮기지 않는 것이 규칙이라(`patterns/locale-select.tsx`) 두 언어 회차에서 같아야 한다.
   */
  it('고를 언어의 이름은 옮기지 않아 그대로 선다', () => {
    renderScreen();

    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveTextContent('Tiếng Việt');
  });

  /** 표제와 칸 이름이 베트남어로 선다 — 언어 칸만 옮겨지고 화면은 한국어로 남는 일을 막는다. */
  it('표제와 입력 칸이 베트남어로 선다', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: viMessages.login.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(viMessages.login.fields.loginId)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: LOCALES.ko.login.title })).toBeNull();
  });
});
