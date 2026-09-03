import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { POP_DEV_SCREEN_NAV_LABEL, PopDevScreenNav } from './pop-dev-screen-nav';
import { renderWithProviders } from '../test/api-harness';

/** 이동 결과를 눈에 보이게 한다 — 라우트 표를 세우지 않으면 주소가 바뀌어도 그릴 것이 없다. */
const LocationProbe = () => {
  const { pathname, search } = useLocation();

  return <output>{search === '' ? pathname : search}</output>;
};

const renderNav = (disabled = false) =>
  renderWithProviders(
    <>
      <PopDevScreenNav disabled={disabled} />
      <LocationProbe />
    </>,
  );

const trigger = () => screen.getByRole('combobox', { name: POP_DEV_SCREEN_NAV_LABEL });

describe('PopDevScreenNav — 개발용 POP 화면 이동', () => {
  it('고른 화면의 주소로 이동한다', async () => {
    renderNav();

    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: 'P-02-01 작업 시작' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('/pop/work-start');
    });
  });

  /*
   * ⭐ **진입값을 실어 보낸다.** 값이 빠지면 그 화면은 「대상이 없습니다」로 막힌 채 떠서,
   * 시연 중에 화면이 고장난 것처럼 보인다 — 실제로 그렇게 보였다.
   */
  it('진입값이 필요한 화면은 값을 실은 주소로 이동한다', async () => {
    renderNav();

    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: 'P-02-13 PQC 제품 검사' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('?ir=1001');
    });
  });

  /* 대체하는 버튼과 같은 조건으로 잠긴다 — 작업자가 정해지기 전에는 넘어가지 않는다. */
  it('작업자가 없으면 잠긴다', () => {
    renderNav(true);

    expect(trigger()).toBeDisabled();
  });
});
