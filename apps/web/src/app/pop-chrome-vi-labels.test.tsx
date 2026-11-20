import { LOCALES, setLocale } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';

/**
 * POP 공통 조작 문구가 **고른 언어를 따르는지**를 베트남어로 잰다.
 *
 * 한국어 회차로는 문구를 코드에 박아 두어도 초록이다 — 실제로 `화면 이동`(#291 부터 공통 이동 메뉴)·`사용자 전환`·
 * `선택`·`○시간 ○분` 이 베트남어 단말에서 한국어로 나왔다(2026-09-14). 그래서 베트남어로
 * 세우고, 한국어로는 찾히지 않는지 뒤집어 확인한다.
 */

/** ⚠ `vi` 는 vitest 의 이름이다 — 문구 쪽은 다른 이름으로 받는다. */
const viMessages = LOCALES.vi;

/* ⭐ 부품 모듈은 언어를 고른 «뒤에» 싣는다 — 모듈 최상위에서 문구를 붙잡는 자리가 있다. */
let PopSelect: typeof import('../patterns/pop-select').PopSelect;
let PopScreenNav: typeof import('../patterns/pop-screen-nav').PopScreenNav;
let toDurationLabel: typeof import('../screens/downtime-register/formatting').toDurationLabel;

beforeAll(async () => {
  setLocale('vi');
  ({ PopSelect } = await import('../patterns/pop-select'));
  ({ PopScreenNav } = await import('../patterns/pop-screen-nav'));
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
  it('공통 이동 메뉴(#291)의 홈·남은 작업·로그인이 베트남어로 선다', async () => {
    renderWithProviders(<PopScreenNav terminalCode="POP-01" />, {
      route: '/pop/work-start',
      fetch: createStubFetch([
        {
          match: (request: Request) => request.url.endsWith('/app/sessions/current'),
          respond: () => jsonResponse({ userId: 1, permissions: ['P-02-01', 'P-05-02'] }),
        },
      ]),
    });

    expect(
      await screen.findByRole('button', { name: viMessages.popChrome.nav.home }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: viMessages.popChrome.remaining.buttonLabel(0) }),
    ).toHaveTextContent(viMessages.popChrome.remaining.button);
    expect(
      /* 사번이 없으면 사번 칩은 「사번 미입력 | 로그인」(#334). */
      screen.getByRole('button', { name: new RegExp(`^${viMessages.popChrome.login}`, 'u') }),
    ).toHaveTextContent(viMessages.popChrome.login);
    expect(screen.queryByText('홈')).not.toBeInTheDocument();
    expect(screen.queryByText('남은 작업')).not.toBeInTheDocument();
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
    /* 쪽 넘김은 POP 공통 쪽 넘김(「총 N건 ‹ 1 / 2 ›」 · #295). */
    expect(
      screen.getByRole('button', { name: viMessages.popUniform.pager.next }),
    ).toBeInTheDocument();
    expect(screen.getByText(viMessages.popUniform.pager.total(7))).toBeInTheDocument();
    expect(screen.queryByText(/다음|총 7건/u)).not.toBeInTheDocument();

    /* 검색어 지우기 X 는 검색어가 있을 때 선다(#295 시안). */
    await user.type(
      screen.getByRole('searchbox', { name: viMessages.popChrome.selectDialog.searchLabel }),
      '1',
    );
    expect(
      screen.getByRole('button', { name: viMessages.popChrome.selectDialog.clearSearch }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
  });

  it('비가동 시간 표시가 베트남어 단위로 선다', () => {
    expect(toDurationLabel(32)).toBe('32 phút');
    expect(toDurationLabel(95)).toBe('1 giờ 35 phút');
  });
});
