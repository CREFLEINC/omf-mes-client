import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearTrail } from '../../patterns/pop-console';
import { recordVisit } from '../../patterns/pop-console/nav-trail';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { PopRegistrationProvider } from '../../patterns/pop-registration';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopHomeScreen } from './screen';

const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

const renderHome = (screenCodes: string[], workerNo: string | null = '900028') =>
  renderWithProviders(
    <PopRegistrationProvider>
      <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, terminalId: 7, workerNo }}>
        <PopHomeScreen />
        <Here />
      </PopIdentityProvider>
    </PopRegistrationProvider>,
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

describe('POP 홈 — 부서 카드', () => {
  it('부서가 하나뿐인 단말은 카드를 거치지 않고 그 부서의 묶음과 타일을 바로 보인다', async () => {
    renderHome(['P-02-13', 'P-02-14', 'P-04-06']);

    const inspect = await screen.findByRole('region', { name: '검사' });

    expect(within(inspect).getByRole('button', { name: /^PQC 제품 검사/u })).toBeVisible();
    expect(within(inspect).getByRole('button', { name: /^OQC 출하검사 판정/u })).toBeVisible();
    expect(screen.getByRole('region', { name: '불량 등록' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '업무 영역' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^작업 시작/u })).not.toBeInTheDocument();
  });

  /* 홈에는 화면이 아니라 부서가 선다 — 화면 타일은 부서 화면에서 고른다. */
  it('여러 부서가 허용되면 부서 카드만 세우고, 누르면 그 부서 화면으로 간다', async () => {
    const user = userEvent.setup();

    renderHome(['P-02-01', 'P-02-03', 'P-02-13', 'P-01-01']);

    const areas = await screen.findByRole('region', { name: '업무 영역' });
    const cards = within(areas).getAllByRole('button');

    /* 부서 순서는 고정이다(`POP_AREAS`) — 단말이 바뀌어도 같은 부서가 같은 자리에 선다. */
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAccessibleName(/^생산/u);
    expect(cards[1]).toHaveAccessibleName(/^구매·자재/u);
    expect(cards[2]).toHaveAccessibleName(/^품질/u);
    expect(screen.queryByRole('button', { name: /^PQC 제품 검사/u })).not.toBeInTheDocument();

    await user.click(within(areas).getByRole('button', { name: /^품질/u }));

    expect(screen.getByText('지금: /pop/area/quality')).toBeInTheDocument();
  });

  /* 현장 단말 대다수가 생산이고, 가장 자주 하는 일이 작업 시작이다. */
  it('작업 시작이 허용된 단말은 맨 위에 작업 시작을 크게 세운다', async () => {
    const user = userEvent.setup();

    renderHome(['P-02-01', 'P-02-03', 'P-02-13']);

    await user.click(await screen.findByRole('button', { name: /^작업 시작/u }));

    expect(screen.getByText('지금: /pop/work-start')).toBeInTheDocument();
  });
});

describe('POP 홈 — 작업자·이어서 하기·이 단말', () => {
  it('사번이 없으면 작업자를 확인하라고 알린다', async () => {
    renderHome(['P-02-01'], null);

    expect(await screen.findByRole('region', { name: '작업자를 확인하세요' })).toBeVisible();
  });

  it('사번이 있으면 누구로 기록되는지 보인다', async () => {
    renderHome(['P-02-01']);

    const worker = await screen.findByRole('region', { name: '작업자' });

    expect(within(worker).getByText('사번 900028')).toBeVisible();
  });

  it('이어서 하기로 작업지시째 돌아간다', async () => {
    const user = userEvent.setup();

    recordVisit('/pop/material-input?workOrderId=42');
    recordVisit('/pop/home');
    renderHome(['P-02-01', 'P-02-03']);

    await user.click(screen.getByRole('button', { name: '자재 투입 · W/O #42' }));

    expect(screen.getByText('지금: /pop/material-input?workOrderId=42')).toBeInTheDocument();
  });

  it('연 화면이 없으면 이어서 하기 자리에 무엇이 쌓이는지 말한다', async () => {
    renderHome(['P-02-01']);

    const recent = await screen.findByRole('region', { name: '이어서 하기' });

    expect(within(recent).getByText(/아직 연 화면이 없습니다/u)).toBeVisible();
  });

  /* 등록 정보를 아직 받지 못했으면 지어내지 않는다. */
  it('이 단말 카드는 모르는 값을 「없음」으로 적는다', async () => {
    renderHome(['P-02-01']);

    const terminal = await screen.findByRole('region', { name: '이 단말' });

    expect(within(terminal).getByText('단말 코드')).toBeVisible();
    expect(within(terminal).getAllByText('없음')).toHaveLength(4);
  });

  it('갈 수 있는 화면을 확인하지 못하면 감추지 않고 사유를 적는다', async () => {
    renderHome([]);

    expect(await screen.findByText('이동할 수 있는 화면이 없습니다')).toBeVisible();
  });
});
