import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopIdentityProvider, type PopIdentity } from '../pop-identity';
import { PopConsoleShell } from './console-shell';
import { usePopFeedback } from './feedback';

const IDENTITY: PopIdentity = {
  terminalId: 7,
  processes: [],
  equipment: { equipmentId: 3, equipmentCode: 'INJ-01', equipmentName: '사출 1호기' },
  workerNo: '20231234',
};

const WORK_ORDER = {
  workOrderId: 42,
  workOrderNo: 'WO-1023',
  productionPlanId: 1,
  routingOperationId: 1,
  routingOperationName: '사출',
  itemId: 9,
  itemCode: 'HOUSING-A',
  orderQty: 1000,
  uomId: 1,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 1,
  statusCode: 'IN_PROGRESS',
  progress: { goodQty: 640, defectQty: 12, achievementRate: 64 },
};

const SESSION = {
  workSessionId: 5,
  workOrderId: 42,
  sessionNo: 1,
  terminalId: 7,
  startedAt: '2026-10-20T08:00:00+09:00',
  statusCode: 'RUNNING',
};

const stub = (screenCodes: string[]) =>
  createStubFetch([
    {
      match: (request) => request.url.includes('/mdm/terminals/7/accessible-screens'),
      respond: () => jsonResponse({ terminalId: 7, screenCodes }),
    },
    {
      match: (request) => request.url.includes('/production/work-orders/42'),
      respond: () => jsonResponse(WORK_ORDER),
    },
    {
      match: (request) => request.url.includes('/production/work-sessions'),
      respond: () => jsonResponse({ items: [SESSION], page: { page: 1, size: 2, total: 1 } }),
    },
  ]);

/** 지금 주소 — 이동이 실제로 일어났는지 잰다. */
const Here = () => {
  const { pathname, search } = useLocation();

  return <p>지금: {`${pathname}${search}`}</p>;
};

/** 본문 자리에 서서 피드백 층을 부르는 화면. */
const ScanBody = () => {
  const feedback = usePopFeedback();

  return (
    <button
      type="button"
      onClick={() => {
        feedback.block('LOT-1 은(는) 검사 대기 상태라 투입할 수 없습니다.');
      }}
    >
      막힌 스캔
    </button>
  );
};

const renderShell = (route: string, screenCodes = ['P-02-01', 'P-02-03', 'P-02-10', 'P-05-02']) =>
  renderWithProviders(
    <PopIdentityProvider value={IDENTITY}>
      <Routes>
        <Route element={<PopConsoleShell />}>
          <Route path="/pop/work-start" element={<Here />} />
          <Route path="/pop/material-input" element={<ScanBody />} />
          <Route path="*" element={<Here />} />
        </Route>
      </Routes>
    </PopIdentityProvider>,
    { fetch: stub(screenCodes), route },
  );

describe('작업장 콘솔', () => {
  it('상태바가 설비·작업지시·사번·세션 상태를 한 줄에 보인다', async () => {
    renderShell('/pop/material-input?workOrderId=42');

    const bar = screen.getByRole('banner');

    expect(within(bar).getByText('INJ-01 사출 1호기')).toBeInTheDocument();
    expect(within(bar).getByText('사번 20231234')).toBeInTheDocument();
    expect(await within(bar).findByText('작업지시 WO-1023')).toBeInTheDocument();
    expect(await within(bar).findByText('가동 중')).toBeInTheDocument();
  });

  it('현재작업 패널이 목표·양품·불량과 달성률을 보인다', async () => {
    renderShell('/pop/material-input?workOrderId=42');

    const panel = screen.getByRole('complementary', { name: '현재 작업' });

    expect(await within(panel).findByText('1,000')).toBeInTheDocument();
    expect(within(panel).getByText('640')).toBeInTheDocument();
    expect(within(panel).getByText('12')).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
  });

  it('작업지시가 없으면 패널은 안내만 하고 투입·실적 단계는 잠긴다', () => {
    renderShell('/pop/work-start');

    expect(
      screen.getByText('작업지시를 고르면 목표·양품·불량이 여기에 보입니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /자재 투입/u })).toBeDisabled();
    expect(screen.getByRole('button', { name: /작업 시작/u })).toHaveAttribute(
      'aria-current',
      'step',
    );
    /* 다음 단계로 갈 수 없으면 「다음」 단추를 세우지 않는다. */
    expect(screen.queryByRole('button', { name: /^다음:/u })).not.toBeInTheDocument();
  });

  it('「다음」 단추가 작업지시를 실어 다음 단계로 보낸다', async () => {
    const user = userEvent.setup();

    renderShell('/pop/material-input?workOrderId=42');

    await user.click(screen.getByRole('button', { name: '다음: 생산 작업' }));

    expect(screen.getByText('지금: /pop/production-result?workOrderId=42')).toBeInTheDocument();
  });

  it('이상 보고 단추는 이 단말이 볼 수 있는 화면만 세운다', async () => {
    renderShell('/pop/material-input?workOrderId=42');

    const group = screen.getByRole('group', { name: '이상 보고' });

    expect(await within(group).findByRole('button', { name: '비가동 실적 입력' })).toBeVisible();
    expect(within(group).getByRole('button', { name: '작업 중단' })).toBeVisible();
    expect(within(group).queryByRole('button', { name: '자재 불량 등록' })).not.toBeInTheDocument();
  });

  it('작업 메뉴는 허용된 화면을 업무별로 묶어 보이고 누르면 간다', async () => {
    const user = userEvent.setup();

    renderShell('/pop/work-start');

    await user.click(screen.getByRole('button', { name: '작업 메뉴' }));

    const dialog = await screen.findByRole('dialog', { name: '작업 메뉴' });
    const production = await within(dialog).findByRole('region', { name: '생산' });
    const equipment = within(dialog).getByRole('region', { name: '설비' });

    expect(within(production).getByRole('button', { name: '작업 시작' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(equipment).getByRole('button', { name: '비가동 실적 입력' }));

    await waitFor(() => {
      expect(screen.getByText('지금: /pop/downtime')).toBeInTheDocument();
    });
  });

  it('막힌 스캔은 확인을 눌러야 닫히는 창으로 선다', async () => {
    const user = userEvent.setup();

    renderShell('/pop/material-input?workOrderId=42');

    await user.click(screen.getByRole('button', { name: '막힌 스캔' }));

    const dialog = await screen.findByRole('dialog', { name: '확인이 필요합니다' });

    expect(
      within(dialog).getByText('LOT-1 은(는) 검사 대기 상태라 투입할 수 없습니다.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
