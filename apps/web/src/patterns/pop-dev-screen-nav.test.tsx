import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { POP_DEV_SCREEN_NAV_LABEL, PopDevScreenNav } from './pop-dev-screen-nav';
import { renderWithProviders } from '../test/api-harness';

/** 이동 결과를 눈에 보이게 한다 — 라우트 표를 세우지 않으면 주소가 바뀌어도 그릴 것이 없다. */
const LocationProbe = () => <output>{useLocation().pathname}</output>;

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
    await userEvent.click(screen.getByRole('option', { name: 'P-02-13 PQC 제품 검사' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('/pop/pqc-inspection');
    });
  });

  /* 대체하는 버튼과 같은 조건으로 잠긴다 — 작업자가 정해지기 전에는 넘어가지 않는다. */
  it('작업자가 없으면 잠긴다', () => {
    renderNav(true);

    expect(trigger()).toBeDisabled();
  });
});
