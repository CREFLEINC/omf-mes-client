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

const renderHome = (screenCodes: string[], workerNo: string | null = '900028') =>
  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7, workerNo }}>
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
  localStorage.clear();
});

describe('POP 홈 — 부서 탭과 업무 묶음', () => {
  it('품질 단말에는 품질 카드만 서고, 부서가 하나면 탭을 세우지 않는다', async () => {
    renderHome(['P-02-13', 'P-02-14', 'P-04-06']);

    const inspect = await screen.findByRole('region', { name: '검사' });

    expect(within(inspect).getByRole('button', { name: 'PQC 제품 검사' })).toBeVisible();
    expect(within(inspect).getByRole('button', { name: 'OQC 출하검사 판정' })).toBeVisible();
    expect(screen.getByRole('region', { name: '불량 등록' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '작업 시작' })).not.toBeInTheDocument();
  });

  it('여러 부서가 허용되면 탭으로 가르고, 고른 탭을 다음에도 연다', async () => {
    const user = userEvent.setup();

    const first = renderHome(['P-02-01', 'P-02-03', 'P-02-13', 'P-01-01']);

    const tabs = await screen.findByRole('tablist', { name: '업무 영역' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['생산', '구매·자재', '품질']);
    expect(within(tabs).getByRole('tab', { name: '생산' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(within(tabs).getByRole('tab', { name: '품질' }));
    expect(screen.getByRole('button', { name: 'PQC 제품 검사' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '작업 시작' })).not.toBeInTheDocument();

    first.unmount();
    renderHome(['P-02-01', 'P-02-03', 'P-02-13', 'P-01-01']);

    expect(await screen.findByRole('tab', { name: '품질' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /* 자재 투입은 작업지시를 고른 뒤 단계로 들어가는 화면이다 — 홈에 따로 세우면 막히는 단추가 된다. */
  it('생산 탭은 작업 시작을 크게 세우고 흐름 안의 화면은 감춘다', async () => {
    renderHome(['P-02-01', 'P-02-03', 'P-02-04', 'P-02-10']);

    const run = await screen.findByRole('region', { name: '작업 진행' });

    expect(within(run).getByRole('button', { name: '작업 시작' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '자재 투입' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '생산 작업' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '중단·교체' })).toBeInTheDocument();
  });
});

describe('POP 홈 — 작업자·이어서 하기', () => {
  it('사번이 없으면 작업자를 확인하라고 맨 위에 알린다', async () => {
    renderHome(['P-02-01'], null);

    expect(await screen.findByRole('region', { name: '작업자를 확인하세요' })).toBeVisible();
  });

  it('이어서 하기로 작업지시째 돌아간다', async () => {
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
