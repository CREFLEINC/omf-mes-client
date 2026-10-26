import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { plantToday } from '../../patterns/plant-time';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { defaultPeriod } from './period';
import { LotTraceScreen } from './screen';
import {
  backwardChain,
  backwardRow,
  forwardChain,
  forwardRow,
  inputMaterial,
  productionLot,
  traceRoutes,
  workOrder,
  type TraceStubData,
} from './trace-fixtures';

const MAT = 'ITEM-A|500|261023|SUP-A|0001';
const PROD = 'P-SYN-0001';

const setup = (route: string, data: TraceStubData, permissions?: string[]) => {
  const calls: URL[] = [];
  renderWithProviders(
    <SessionProvider>
      <LotTraceScreen />
    </SessionProvider>,
    {
      session: { ...SYNTHETIC_SESSION, ...(permissions === undefined ? {} : { permissions }) },
      route,
      fetch: createStubFetch([
        ...traceRoutes(data, calls),
        {
          match: (request) => new URL(request.url).pathname === '/mdm/code-values',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
      ]),
    },
  );
  return { calls };
};

const lists = (calls: URL[], path: string) => calls.filter((url) => url.pathname === path);

describe('W-02-09 LOT 추적: 정방향 추적 탭', () => {
  it('처음 열면 정방향 탭이고, 기본 기간 30일을 채우고 진입점이 없으면 부르지 않고 [조회]를 사유와 함께 잠근다', async () => {
    const { calls } = setup('/production/lot-trace', {});

    expect(
      await screen.findByRole('tab', { name: '정방향 추적', selected: true }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('품목이나 LOT 번호로 찾으세요. 입하번호로도 찾을 수 있습니다'),
    ).toBeInTheDocument();
    const search = screen.getByRole('button', { name: '조회' });
    expect(search).toBeDisabled();
    expect(search).toHaveAccessibleDescription('품목이나 LOT 번호를 넣으세요');
    const expected = defaultPeriod(plantToday(), 30);
    expect(screen.getByLabelText('입고 기간')).toHaveTextContent(
      `${expected.from} ~ ${expected.to}`,
    );
    expect(calls).toHaveLength(0);
  });

  it('LOT 번호로 찾으면 목록과 단계 칩(단계별 LOT 수)을 보이고, 칩을 누르면 그 단계로 거른다', async () => {
    const user = userEvent.setup();
    const { calls } = setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [
        forwardRow(101, MAT),
        forwardRow(102, 'ITEM-A|500|261023|SUP-A|0002', {
          currentStageCode: 'RECEIVED',
          consumedQty: 0,
        }),
      ],
    });

    expect(await screen.findByText(MAT)).toBeInTheDocument();
    const first = lists(calls, '/trace/material-lot-flows')[0];
    expect(first?.searchParams.get('q')).toBe('ITEM-A');
    expect(first?.searchParams.get('receiptDateFrom')).toBe('2026-10-01');
    const chips = screen.getByRole('group', { name: '진행' });
    expect(within(chips).getByRole('button', { name: '전체 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(chips).getByRole('button', { name: '투입 1' })).toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: '투입 1' }));
    await waitFor(() =>
      expect(
        lists(calls, '/trace/material-lot-flows').at(-1)?.searchParams.get('currentStageCode'),
      ).toBe('CONSUMED'),
    );
  });

  it('서버가 진입점 칸 오류(400)를 돌려주면 LOT 번호 칸 아래에 화면 문구로 보인다', async () => {
    setup('/production/lot-trace?q=X&from=2026-10-01', {
      listStatus: 400,
      listErrors: {
        errors: [
          { scope: 'field', field: 'itemId', code: 'REQUIRED', message: '내부 문구(itemId)' },
        ],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('품목이나 LOT 번호를 넣으세요');
    expect(screen.queryByText(/itemId/)).toBeNull();
  });

  it('사슬 드로어: 투입만, 연결된 생산 LOT 없음, 포장 중, 출하별 취급 단위 묶음, 단계 줄과 영향 요약', async () => {
    const shipped = productionLot(201, PROD, {
      packages: [
        {
          handlingUnitId: 1,
          handlingUnitNo: 'HU-0001',
          handlingUnitTypeCode: 'BOX',
          statusCode: 'PACKED',
          qty: 50,
          shippingUnit: null,
        },
        {
          handlingUnitId: 2,
          handlingUnitNo: 'HU-0002',
          handlingUnitTypeCode: 'BOX',
          statusCode: 'OPEN',
          qty: 10,
          shippingUnit: null,
        },
      ],
      shipments: [
        {
          shipmentId: 31,
          shipmentNo: 'SH-SYN-0031',
          shippedAt: '2026-10-24T02:00:00Z',
          statusCode: 'CONFIRMED',
          customer: { id: 5, code: 'CUS-A', name: '고객 A' },
          qty: 30,
          handlingUnitNo: 'HU-0001',
        },
        {
          shipmentId: 31,
          shipmentNo: 'SH-SYN-0031',
          shippedAt: '2026-10-24T02:00:00Z',
          statusCode: 'CONFIRMED',
          customer: { id: 5, code: 'CUS-A', name: '고객 A' },
          qty: 20,
          handlingUnitNo: 'HU-0003',
        },
      ],
    });
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [
          workOrder(1, [], null),
          workOrder(2, []),
          workOrder(3, [shipped]),
        ]),
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(
      await within(drawer).findByText('영향 요약: 생산 LOT 1, 출하 1건, 고객 1곳'),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('투입만')).toBeInTheDocument();
    expect(within(drawer).getByText('연결된 생산 LOT이 없습니다')).toBeInTheDocument();
    expect(within(drawer).getByText('포장 중')).toBeInTheDocument();
    /* 출하 한 건 아래 취급 단위 둘 — 출하 번호는 한 번만 선다. */
    expect(within(drawer).getAllByText('SH-SYN-0031')).toHaveLength(1);
    expect(within(drawer).getByText('HU-0003')).toBeInTheDocument();
    const stages = within(drawer).getByRole('list', { name: '단계' });
    /* 포장은 확정(PACKED)만 센다. */
    expect(within(stages).getByRole('button', { name: /포장\s*1건/ })).toBeInTheDocument();
    expect(within(stages).getByRole('listitem', { current: 'step' })).toHaveTextContent('출하');
    expect(
      within(drawer).getByText('일부 연결은 추정입니다. 칩에 마우스를 올리면 근거가 보입니다'),
    ).toBeInTheDocument();
  });

  it('아직 투입되지 않은 LOT은 「아직 투입된 기록이 없습니다」', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, []) },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(await within(drawer).findByText('아직 투입된 기록이 없습니다')).toBeInTheDocument();
  });

  it('반제품은 한 단씩 펼치고, 지나온 LOT으로 돌아오면 다시 펼치지 않는다', async () => {
    const user = userEvent.setup();
    const semi = productionLot(201, PROD, { consumedFurther: 1 });
    const back = productionLot(101, MAT, { consumedFurther: 1 });
    const { calls } = setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [workOrder(3, [semi])]),
        201: forwardChain(201, PROD, [workOrder(4, [back])], 'PRODUCTION'),
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    await user.click(
      await within(drawer).findByRole('button', { name: `${PROD} 다음 단계 펼치기` }),
    );

    expect(await within(drawer).findByText('WO-SYN-0004')).toBeInTheDocument();
    expect(calls.some((url) => url.pathname === '/trace/lots/201/forward-flow')).toBe(true);
    expect(within(drawer).getByText('지나온 LOT')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: `${MAT} 다음 단계 펼치기` })).toBeNull();
  });

  it('[역방향 추적]은 역방향 탭으로 바꾸고 경로 줄을 남긴다. 경로를 누르면 돌아간다', async () => {
    const user = userEvent.setup();
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      backwardRows: [backwardRow(201, PROD)],
      forwardChains: { 101: forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]) },
      backwardChains: { 201: backwardChain(201, PROD, [inputMaterial(101, MAT)]) },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    await user.click(await within(drawer).findByRole('button', { name: `${PROD} 역방향 추적` }));

    expect(
      await screen.findByRole('tab', { name: '역방향 추적', selected: true }),
    ).toBeInTheDocument();
    const next = await screen.findByRole('dialog', { name: PROD });
    const path = await within(next).findByRole('navigation', { name: '경로' });
    expect(path).toHaveTextContent(`자재 LOT ${MAT}`);
    expect(path).toHaveTextContent(`생산 LOT ${PROD}`);

    await user.click(within(path).getByRole('button', { name: `${MAT} 다시 열기` }));
    expect(
      await screen.findByRole('tab', { name: '정방향 추적', selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: MAT })).toBeInTheDocument();
  });

  it('W-03-01 권한이 있으면 [LOT 상태 보기]를 둔다', async () => {
    setup(
      `/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09', 'W-03-01'],
    );
    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(
      await within(drawer).findByRole('button', { name: 'LOT 상태 보기' }),
    ).toBeInTheDocument();
  });

  it('W-03-01 권한이 없으면 [LOT 상태 보기]를 두지 않는다', async () => {
    setup(
      `/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09'],
    );
    const drawer = await screen.findByRole('dialog', { name: MAT });
    await within(drawer).findByText('아직 투입된 기록이 없습니다');
    expect(within(drawer).queryByRole('button', { name: 'LOT 상태 보기' })).toBeNull();
  });
});

describe('W-02-09 LOT 추적: 역방향 추적 탭', () => {
  it('W/O 번호 진입점으로 부른다(기간 없이)', async () => {
    const { calls } = setup('/production/lot-trace?tab=backward&wo=WO-SYN-0001', {
      backwardRows: [backwardRow(201, PROD)],
    });

    expect(await screen.findByText(PROD)).toBeInTheDocument();
    const list = lists(calls, '/trace/product-lot-flows')[0];
    expect(list?.searchParams.get('workOrderNo')).toBe('WO-SYN-0001');
    expect(list?.searchParams.has('dateFrom')).toBe(false);
  });

  it('투입 자재가 없으면 「투입 자재가 없습니다」, 출하가 없으면 「아직 출하되지 않았습니다」', async () => {
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, [], false) },
    });

    const drawer = await screen.findByRole('dialog', { name: PROD });
    expect(await within(drawer).findByText('투입 자재가 없습니다')).toBeInTheDocument();
    expect(within(drawer).getByText('아직 출하되지 않았습니다')).toBeInTheDocument();
    expect(within(drawer).getByText('투입 자재 LOT 0, 공급사 0곳')).toBeInTheDocument();
  });

  it('반제품 투입 LOT은 [이 LOT 기준으로]로 같은 방향의 기준을 바꾸고 경로에 남긴다', async () => {
    const user = userEvent.setup();
    const semi = inputMaterial(301, 'SF-SYN-0001', {
      lotTypeCode: 'PRODUCTION',
      producedBy: { workOrderId: 80, workOrderNo: 'WO-SYN-0080' },
    });
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: {
        201: backwardChain(201, PROD, [semi, inputMaterial(101, MAT)]),
        301: backwardChain(301, 'SF-SYN-0001', [inputMaterial(102, 'ITEM-A|20|261023|SUP-A|0002')]),
      },
    });

    const drawer = await screen.findByRole('dialog', { name: PROD });
    expect(await within(drawer).findByText('투입 자재 LOT 2, 공급사 1곳')).toBeInTheDocument();
    expect(within(drawer).getAllByText('SL-0001')).toHaveLength(2);
    await user.click(within(drawer).getByRole('button', { name: 'SF-SYN-0001 이 LOT 기준으로' }));

    const next = await screen.findByRole('dialog', { name: 'SF-SYN-0001' });
    expect(await within(next).findByRole('navigation', { name: '경로' })).toHaveTextContent(
      `생산 LOT ${PROD}`,
    );
    expect(await within(next).findByText('ITEM-A|20|261023|SUP-A|0002')).toBeInTheDocument();
  });
});
