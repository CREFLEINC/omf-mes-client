import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../test/api-harness';
import { PopScreenNav } from './pop-screen-nav';

const LocationProbe = () => {
  const { pathname } = useLocation();

  return <output>{pathname}</output>;
};

describe('PopScreenNav — G-34 화면 이동', () => {
  it('공통 헤더에서 고른 활성 화면으로 즉시 이동한다', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <PopScreenNav />
        <LocationProbe />
      </>,
      { route: '/pop/work-start' },
    );

    await user.click(screen.getByRole('combobox', { name: '화면 이동' }));
    await user.type(screen.getByRole('searchbox', { name: '목록 검색' }), '비가동');
    await user.click(screen.getByRole('option', { name: 'P-05-02 비가동 등록' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('/pop/downtime');
    });
  });

  it('현재 화면을 닫힌 상태의 선택값으로 보인다', () => {
    renderWithProviders(<PopScreenNav />, { route: '/pop/work-start' });

    expect(screen.getByText('P-02-01 작업 시작')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '화면 이동' })).toHaveTextContent('화면 이동');
  });
});
