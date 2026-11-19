import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { POP_DEV_SCREEN_NAV_LABEL, POP_DEV_SCREENS, PopDevScreenNav } from './pop-dev-screen-nav';
import { POP_HOME_PATH, POP_SCREENS } from './pop-screen-catalog';
import { renderWithProviders } from '../test/api-harness';

/** 이동 결과를 눈에 보이게 한다 — 라우트 표를 세우지 않으면 주소가 바뀌어도 그릴 것이 없다. */
const LocationProbe = () => {
  const { pathname, search } = useLocation();

  /* ⛔ 진입값만 내놓지 않는다 — 경로를 잘못 적어도 통과하는 시험이 된다. */
  return <output>{`${pathname}${search}`}</output>;
};

const renderNav = (disabled = false) =>
  renderWithProviders(
    <>
      <PopDevScreenNav disabled={disabled} />
      <LocationProbe />
    </>,
  );

const trigger = () => screen.getByRole('button', { name: POP_DEV_SCREEN_NAV_LABEL });

describe('PopDevScreenNav — 개발용 POP 화면 이동', () => {
  it('누르면 고르는 창 없이 바로 홈으로 간다', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(trigger());

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(POP_HOME_PATH));
  });

  it('G2 L22 P-01-01 항목은 화면 목록의 지금 이름 「자재 관리 LOT 라벨」을 쓴다', () => {
    const catalog = POP_SCREENS.find((each) => each.code === 'P-01-01');
    const entry = POP_DEV_SCREENS.find((each) => each.path === catalog?.path);

    expect(entry?.label).toBe(`P-01-01 ${catalog?.name ?? ''}`);
    expect(entry?.label).toBe('P-01-01 자재 관리 LOT 라벨');
  });

  it('작업자가 없으면 잠긴다', () => {
    renderNav(true);

    expect(trigger()).toBeDisabled();
  });
});
