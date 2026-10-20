import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopAreaScreen } from './screen';

const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

const renderArea = (route: string, screenCodes: string[]) =>
  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7 }}>
      <Routes>
        <Route path="/pop/area/:area" element={<PopAreaScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Here />
    </PopIdentityProvider>,
    {
      route,
      fetch: createStubFetch([
        {
          match: (request) => request.url.includes('/mdm/terminals/7/accessible-screens'),
          respond: () => jsonResponse({ terminalId: 7, screenCodes }),
        },
      ]),
    },
  );

describe('POP 부서 화면', () => {
  /* 자재 투입·생산 작업은 작업지시를 고른 뒤 단계로 들어가는 화면이다 — 타일로 세우면 막히는 단추가 된다. */
  it('생산은 작업 시작을 크게 세우고 흐름 안의 화면은 감춘다', async () => {
    renderArea('/pop/area/production', ['P-02-01', 'P-02-03', 'P-02-04', 'P-02-10', 'P-02-13']);

    expect(await screen.findByRole('heading', { level: 1, name: '생산' })).toBeVisible();

    const run = await screen.findByRole('region', { name: '작업 진행' });

    expect(within(run).getByRole('button', { name: /^작업 시작/u })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^자재 투입/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^생산 작업/u })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '중단·교체' })).toBeInTheDocument();
    /* 다른 부서의 화면은 서지 않는다. */
    expect(screen.queryByRole('button', { name: /^PQC 제품 검사/u })).not.toBeInTheDocument();
  });

  it('타일은 이름과 한 줄 설명을 함께 보이고 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup();

    renderArea('/pop/area/quality', ['P-02-13', 'P-04-06']);

    const tile = await screen.findByRole('button', { name: /^PQC 제품 검사/u });

    expect(tile).toHaveTextContent('공정 중 제품을 검사하고 판정합니다');

    await user.click(tile);

    expect(screen.getByText('지금: /pop/pqc-inspection')).toBeInTheDocument();
  });

  it('이 단말이 열 수 있는 화면이 없는 부서는 감추지 않고 사유를 적는다', async () => {
    renderArea('/pop/area/shipping', ['P-02-13']);

    expect(
      await screen.findByText('이 단말에서 열 수 있는 이 부서 화면이 없습니다.'),
    ).toBeVisible();
  });

  it('모르는 부서 주소는 홈으로 돌린다', () => {
    renderArea('/pop/area/unknown', ['P-02-13']);

    expect(screen.getByText('지금: /pop/home')).toBeInTheDocument();
  });
});
