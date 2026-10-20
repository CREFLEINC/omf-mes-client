import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearTrail } from '../../patterns/pop-console';
import { recordVisit } from '../../patterns/pop-console/nav-trail';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopHomeScreen } from './screen';

const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

const renderHome = (screenCodes: string[]) =>
  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7 }}>
      <PopHomeScreen />
      <Here />
    </PopIdentityProvider>,
    {
      route: '/pop/home',
      fetch: createStubFetch([
        {
          match: (request) => request.url.includes('/mdm/terminals/7/accessible-screens'),
          respond: () => jsonResponse({ terminalId: 7, screenCodes }),
        },
      ]),
    },
  );

beforeEach(() => {
  clearTrail();
});

describe('POP 홈', () => {
  it('품질 단말에는 품질 화면만 서고, 영역이 하나면 묶음 머리말을 세우지 않는다', async () => {
    renderHome(['P-02-13', 'P-02-14', 'P-04-06']);

    expect(await screen.findByRole('button', { name: 'PQC 제품 검사' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'OQC 출하검사 판정' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '작업 시작' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '품질' })).not.toBeInTheDocument();
  });

  it('여러 부서 화면이 허용되면 부서별로 묶어 보인다', async () => {
    renderHome(['P-02-01', 'P-02-13', 'P-01-01']);

    const production = await screen.findByRole('region', { name: '생산' });
    const material = screen.getByRole('region', { name: '구매·자재' });
    const quality = screen.getByRole('region', { name: '품질' });

    expect(within(production).getByRole('button', { name: '작업 시작' })).toBeVisible();
    expect(within(material).getByRole('button', { name: '자재LOT 등록·라벨 발행' })).toBeVisible();
    expect(within(quality).getByRole('button', { name: 'PQC 제품 검사' })).toBeVisible();
  });

  it('최근 화면으로 작업지시째 돌아간다', async () => {
    const user = userEvent.setup();

    recordVisit('/pop/material-input?workOrderId=42');
    recordVisit('/pop/home');
    renderHome(['P-02-01', 'P-02-03']);

    await user.click(screen.getByRole('button', { name: '자재 투입 · W/O #42' }));

    expect(screen.getByText('지금: /pop/material-input?workOrderId=42')).toBeInTheDocument();
  });

  it('갈 수 있는 화면을 확인하지 못하면 감추지 않고 사유를 적는다', async () => {
    renderHome([]);

    expect(await screen.findByText('이동할 수 있는 화면이 없습니다')).toBeVisible();
  });
});
