import { LOCALES, setLocale } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';

/**
 * POP 공통 조작 문구가 **고른 언어를 따르는지**를 베트남어로 잰다.
 *
 * 한국어 회차로는 문구를 코드에 박아 두어도 초록이다 — 실제로 `화면 이동`·`사용자 전환`·
 * `선택`·`○시간 ○분` 이 베트남어 단말에서 한국어로 나왔다(2026-09-14). 그래서 베트남어로
 * 세우고, 한국어로는 찾히지 않는지 뒤집어 확인한다.
 */

/** ⚠ `vi` 는 vitest 의 이름이다 — 문구 쪽은 다른 이름으로 받는다. */
const viMessages = LOCALES.vi;

/* ⭐ 부품 모듈은 언어를 고른 «뒤에» 싣는다 — 모듈 최상위에서 문구를 붙잡는 자리가 있다. */
let PopSelect: typeof import('../patterns/pop-select').PopSelect;
let PopScreenNavButton: typeof import('../patterns/pop-screen-nav').PopScreenNavButton;
let PopLogoutButton: typeof import('../patterns/pop-logout').PopLogoutButton;
let toDurationLabel: typeof import('../screens/downtime-register/formatting').toDurationLabel;

beforeAll(async () => {
  setLocale('vi');
  ({ PopSelect } = await import('../patterns/pop-select'));
  ({ PopScreenNavButton } = await import('../patterns/pop-screen-nav'));
  ({ PopLogoutButton } = await import('../patterns/pop-logout'));
  ({ toDurationLabel } = await import('../screens/downtime-register/formatting'));
});

/** ⚠ 고른 언어는 모듈 하나가 든 전역이다 — 두고 나가면 뒤에 도는 것이 베트남어로 선다. */
afterAll(() => {
  setLocale('ko');
});

const OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: `v-${String(index + 1)}`,
  label: `Mục ${String(index + 1)}`,
}));

describe('POP 공통 조작 문구 — 베트남어', () => {
  it('머리줄의 화면 이동·사용자 전환 단추가 베트남어로 선다', async () => {
    renderWithProviders(
      <>
        <PopScreenNavButton />
        <PopLogoutButton />
      </>,
      {
        route: '/pop/work-start',
        fetch: createStubFetch([
          {
            match: (request: Request) => request.url.endsWith('/app/sessions/current'),
            respond: () => jsonResponse({ userId: 1, permissions: ['P-02-01', 'P-05-02'] }),
          },
        ]),
      },
    );

    expect(
      await screen.findByRole('combobox', { name: viMessages.popChrome.screenNav }),
    ).toHaveTextContent(viMessages.popChrome.screenNav);
    expect(
      screen.getByRole('button', { name: viMessages.popChrome.userSwitch }),
    ).toBeInTheDocument();
    expect(screen.queryByText('화면 이동')).not.toBeInTheDocument();
    expect(screen.queryByText('사용자 전환')).not.toBeInTheDocument();
  });

  it('선택 단추와 선택 팝업의 문구가 베트남어로 선다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="Lý do" options={OPTIONS} value={null} />);

    const trigger = screen.getByRole('combobox', { name: 'Lý do' });
    expect(trigger).toHaveTextContent(viMessages.popChrome.select);

    await user.click(trigger);

    expect(
      screen.getByRole('searchbox', { name: viMessages.popChrome.selectDialog.searchLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: viMessages.popChrome.selectDialog.clearSearch }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: viMessages.popPageNav.pageDown }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(viMessages.popChrome.selectDialog.position(1, 2, 7)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/검색어 지우기|페이지 아래|전체 7건/u)).not.toBeInTheDocument();
  });

  it('비가동 시간 표시가 베트남어 단위로 선다', () => {
    expect(toDurationLabel(32)).toBe('32 phút');
    expect(toDurationLabel(95)).toBe('1 giờ 35 phút');
  });
});
