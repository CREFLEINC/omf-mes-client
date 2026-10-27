import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
      <LotTraceScreen permissionMenuPath="합성 묶음 › 합성 메뉴" />
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

const NOTICE = '일부 연결은 추정입니다. 칩에 마우스를 올리면 근거가 보입니다';
const TIP_LOT = '투입 시각과 생산 LOT의 작업 시간을 맞춰 이은 연결입니다';
const TIP_WO =
  '같은 W/O의 투입과 생산을 이은 연결입니다. 어느 생산 LOT에 들어갔는지는 알 수 없습니다';

/** 목록 줄의 「추정 포함」 칩 — 초점을 두는 칩 자리의 aria-label에 근거 한 문장이 실린다. */
const estimatedChip = (lotNo: string): HTMLElement | null => {
  const row = screen.getByText(lotNo).closest('tr');
  if (row === null) throw new Error(`${lotNo} 줄이 없습니다`);
  return within(row).queryByLabelText(/^추정 포함\. /);
};

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

  it('목록: 서버 basis가 있으면 진행 칩 옆에 「추정 포함」 칩과 근거 한 문장, null이면 칩이 없다', async () => {
    const wo = 'ITEM-A|500|261023|SUP-A|0002';
    const none = 'ITEM-A|500|261023|SUP-A|0003';
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [
        forwardRow(101, MAT),
        forwardRow(102, wo, { basis: 'WORK_ORDER_ESTIMATE' }),
        forwardRow(103, none, { basis: null, currentStageCode: 'RECEIVED', consumedQty: 0 }),
      ],
    });

    expect(await screen.findByText(MAT)).toBeInTheDocument();
    expect(estimatedChip(MAT)).toHaveAccessibleName(`추정 포함. ${TIP_LOT}`);
    expect(estimatedChip(wo)).toHaveAccessibleName(`추정 포함. ${TIP_WO}`);
    expect(estimatedChip(none)).toBeNull();
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
    /* 출하 아래 줄은 그 출하에 실린 포장이다. 다른 줄처럼 머리 이름을 단다. */
    expect(within(drawer).getByText('HU-0003').closest('li')).toHaveTextContent(/^출하 포장/);
    const stages = within(drawer).getByRole('list', { name: '단계' });
    /* 포장은 확정(PACKED)만 센다. */
    expect(within(stages).getByRole('button', { name: /포장\s*1건/ })).toBeInTheDocument();
    expect(within(stages).getByRole('listitem', { current: 'step' })).toHaveTextContent('출하');
    expect(within(drawer).getByText(NOTICE)).toBeInTheDocument();
  });

  it('아직 투입되지 않은 LOT은 「아직 투입된 기록이 없습니다」', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, []) },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(await within(drawer).findByText('아직 투입된 기록이 없습니다')).toBeInTheDocument();
    /* 이어진 생산 LOT이 없으면 서버 basis가 null이고 추정 안내를 두지 않는다. */
    expect(within(drawer).queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('드로어의 추정 안내는 서버 최상위 basis로만 정한다(null이면 생산 LOT이 있어도 두지 않는다)', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: { ...forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]), basis: null },
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(await within(drawer).findByText(PROD)).toBeInTheDocument();
    expect(within(drawer).queryByText(NOTICE)).not.toBeInTheDocument();
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

  it('목록: 서버 basis가 있으면 「추정 포함」 칩, null이면 칩이 없다', async () => {
    const none = 'P-SYN-0002';
    setup('/production/lot-trace?tab=backward&wo=WO-SYN-0001', {
      backwardRows: [backwardRow(201, PROD), backwardRow(202, none, { basis: null })],
    });

    expect(await screen.findByText(PROD)).toBeInTheDocument();
    expect(estimatedChip(PROD)).toHaveAccessibleName(`추정 포함. ${TIP_LOT}`);
    expect(estimatedChip(none)).toBeNull();
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
    expect(within(drawer).queryByText(NOTICE)).not.toBeInTheDocument();
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
    /* W/O 줄의 실적은 이 LOT이 아니라 W/O 전체다. */
    expect(
      within(drawer).getByText('W/O 전체: 실적 2건, 양품 120 EA, 불량 5 EA'),
    ).toBeInTheDocument();
    expect(within(drawer).getAllByText('SL-0001')).toHaveLength(2);
    expect(within(drawer).getByText(NOTICE)).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'SF-SYN-0001 이 LOT 기준으로' }));

    const next = await screen.findByRole('dialog', { name: 'SF-SYN-0001' });
    expect(await within(next).findByRole('navigation', { name: '경로' })).toHaveTextContent(
      `생산 LOT ${PROD}`,
    );
    expect(await within(next).findByText('ITEM-A|20|261023|SUP-A|0002')).toBeInTheDocument();
  });
});

const FORBIDDEN_TITLE = 'LOT 추적 권한이 없습니다';
const PERMISSION_DENIED = {
  errors: [
    { scope: 'screen', code: 'PERMISSION_DENIED', message: '이 기능을 쓸 권한이 없습니다.' },
  ],
};

describe('W-02-09 LOT 추적: 권한 없음과 없는 LOT', () => {
  it.each([
    ['오류 봉투', PERMISSION_DENIED],
    ['빈 본문', null],
  ])('목록이 403(%s)이면 권한 안내를 보이고 [다시 조회]를 두지 않는다', async (_label, body) => {
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01', { listStatus: 403, listErrors: body });

    expect(await screen.findByText(FORBIDDEN_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/「합성 묶음 › 합성 메뉴」 메뉴에서/)).toBeInTheDocument();
    expect(screen.getByText(/관리자에게 권한을 요청하세요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 조회' })).toBeNull();
    expect(screen.queryByText('추적 정보를 불러오지 못했습니다')).toBeNull();
  });

  it('사슬이 403이면 드로어에 권한 안내를 보이고 머리는 「LOT 사슬」이다', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 403 },
    });

    const drawer = await screen.findByRole('dialog', { name: 'LOT 사슬' });
    expect(await within(drawer).findByText(FORBIDDEN_TITLE)).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('주소의 LOT이 없으면(404) 「LOT을 찾을 수 없습니다」이고 [다시 조회]를 두지 않는다', async () => {
    setup('/production/lot-trace?tab=backward&lot=P-SYN-9999&selected=999', {
      backwardRows: [],
    });

    const drawer = await screen.findByRole('dialog', { name: 'LOT 사슬' });
    expect(await within(drawer).findByText('LOT을 찾을 수 없습니다')).toBeInTheDocument();
    expect(within(drawer).getByText('목록에서 LOT을 다시 고르세요.')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('그 밖의 실패(500)는 [다시 조회]를 둔다', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 500 },
    });

    const drawer = await screen.findByRole('dialog', { name: 'LOT 사슬' });
    expect(await within(drawer).findByText('추적 정보를 불러오지 못했습니다')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });
});

describe('W-02-09 LOT 추적: 반제품 펼치기 실패', () => {
  it('정방향: 펼친 단을 받지 못하면 그 줄에 사유와 [다시 조회], 그동안 [사슬 내보내기]를 잠근다', async () => {
    const user = userEvent.setup();
    const data: TraceStubData = {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [
          workOrder(3, [productionLot(201, PROD, { consumedFurther: 1 })]),
        ]),
        201: forwardChain(201, PROD, [workOrder(4, [])], 'PRODUCTION'),
      },
      chainFailures: { 'forward-201': 500 },
    };
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, data);

    const drawer = await screen.findByRole('dialog', { name: MAT });
    await user.click(
      await within(drawer).findByRole('button', { name: `${PROD} 다음 단계 펼치기` }),
    );

    expect(await within(drawer).findByText('다음 단계를 불러오지 못했습니다')).toBeInTheDocument();
    const exportButton = within(drawer).getByRole('button', { name: '사슬 내보내기' });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAccessibleDescription(
      '불러오지 못한 단계가 있습니다. 모든 단계를 불러와야 사슬을 내보낼 수 있습니다.',
    );

    delete data.chainFailures?.['forward-201'];
    await user.click(within(drawer).getByRole('button', { name: `${PROD} 다시 조회` }));

    expect(await within(drawer).findByText('WO-SYN-0004')).toBeInTheDocument();
    expect(within(drawer).queryByText('다음 단계를 불러오지 못했습니다')).toBeNull();
    expect(within(drawer).getByRole('button', { name: '사슬 내보내기' })).toBeEnabled();
  });

  it('역방향: 펼친 단을 받지 못하면 자리 표시가 돌지 않고 사유와 [다시 조회]를 보인다', async () => {
    const user = userEvent.setup();
    const semi = inputMaterial(301, 'SF-SYN-0001', {
      lotTypeCode: 'PRODUCTION',
      producedBy: { workOrderId: 80, workOrderNo: 'WO-SYN-0080' },
    });
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, [semi]) },
      chainFailures: { 'backward-301': 500 },
    });

    const drawer = await screen.findByRole('dialog', { name: PROD });
    await user.click(
      await within(drawer).findByRole('button', { name: 'SF-SYN-0001 다음 단계 펼치기' }),
    );

    expect(await within(drawer).findByText('다음 단계를 불러오지 못했습니다')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: 'SF-SYN-0001 다시 조회' }),
    ).toBeInTheDocument();
  });
});

describe('W-02-09 LOT 추적: 사슬 모양', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('순환(cyclic)으로 표시된 LOT은 「지나온 LOT」 칩을 달고 펼치지 않는다', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [
          workOrder(3, [productionLot(201, PROD, { consumedFurther: 2, cyclic: true })]),
        ]),
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(await within(drawer).findByText('지나온 LOT')).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: `${PROD} 다음 단계 펼치기` })).toBeNull();
  });

  it('생산 LOT이 잘린 큰 사슬은 안내를 두고 생산 LOT 아래 문서를 접은 채 시작한다', async () => {
    const user = userEvent.setup();
    const lot = productionLot(201, PROD, {
      productionReceipts: [
        {
          goodsReceiptId: 41,
          goodsReceiptNo: 'GR-SYN-0041',
          receiptDatetime: '2026-10-23T07:00:00Z',
          warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
          qty: 100,
        },
      ],
    });
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: {
          ...forwardChain(101, MAT, [workOrder(3, [lot])]),
          truncated: true,
          totalProductionLotCount: 812,
        },
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    expect(
      await within(drawer).findByText(
        '생산 LOT 812건 중 500건까지 보이며 사슬 내보내기에도 이 500건만 담깁니다. 나머지는 역방향 추적에서 W/O 번호나 출하번호로 찾으세요.',
      ),
    ).toBeInTheDocument();
    const documents = within(drawer).getByRole('button', { name: '생산 입고, 포장, 출하 1건' });
    expect(documents).toHaveAttribute('aria-expanded', 'false');
    /* 펼칠 수 있음을 나무의 다른 펼치기와 같은 표시로 알린다. 표시는 접근명에 들지 않는다. */
    expect(documents).toHaveTextContent(/^▸/);
    expect(within(drawer).queryByText('GR-SYN-0041')).toBeNull();

    await user.click(documents);
    expect(within(drawer).getByText('GR-SYN-0041')).toBeInTheDocument();
    expect(documents).toHaveAttribute('aria-expanded', 'true');
    expect(documents).toHaveTextContent(/^▾/);
  });

  it('단계 줄의 칸은 그 단계의 첫 줄로 간다 — 첫 W/O에 생산 LOT이 없어도 다음 W/O의 LOT으로 간다', async () => {
    const user = userEvent.setup();
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [workOrder(2, []), workOrder(3, [productionLot(201, PROD)])]),
      },
    });

    const drawer = await screen.findByRole('dialog', { name: MAT });
    const stages = await within(drawer).findByRole('list', { name: '단계' });
    await user.click(within(stages).getByRole('button', { name: /생산\s*1건/ }));

    expect(scrolled.at(-1)).toHaveTextContent(PROD);
  });
});

describe('W-02-09 LOT 추적: LOT 번호 칸', () => {
  it('기간이 비어 있으면 LOT 번호 정확 일치(lotNo)로 기간 없이 부른다', async () => {
    const user = userEvent.setup();
    const old = 'ITEM-A|500|240101|SUP-A|0009';
    const { calls } = setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}`, {
      forwardRows: [forwardRow(101, MAT)],
    });

    const field = await screen.findByLabelText('LOT 번호');
    await user.clear(field);
    await user.type(field, `${old}{Enter}`);

    await waitFor(() =>
      expect(lists(calls, '/trace/material-lot-flows').at(-1)?.searchParams.get('lotNo')).toBe(old),
    );
    const last = lists(calls, '/trace/material-lot-flows').at(-1);
    expect(last?.searchParams.has('q')).toBe(false);
    expect(last?.searchParams.has('receiptDateFrom')).toBe(false);
  });

  it('기간이 있으면 LOT 번호 일부(q)로 부른다', async () => {
    const user = userEvent.setup();
    const { calls } = setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [forwardRow(101, MAT)],
    });

    const field = await screen.findByLabelText('LOT 번호');
    await user.clear(field);
    await user.type(field, '261023{Enter}');

    await waitFor(() =>
      expect(lists(calls, '/trace/material-lot-flows').at(-1)?.searchParams.get('q')).toBe(
        '261023',
      ),
    );
    expect(lists(calls, '/trace/material-lot-flows').at(-1)?.searchParams.has('lotNo')).toBe(false);
  });

  it('기간 400은 문구가 아니라 코드로 가른다(RANGE → 366일 안내)', async () => {
    setup('/production/lot-trace?q=X&from=2025-01-01', {
      listStatus: 400,
      listErrors: {
        errors: [{ scope: 'field', field: 'receiptDateFrom', code: 'RANGE', message: '내부 문구' }],
      },
    });

    expect(await screen.findByText('기간은 366일까지 조회할 수 있습니다')).toBeInTheDocument();
  });

  it('생산 LOT을 정방향으로 열면 목록이 빈 까닭을 말한다', async () => {
    setup(`/production/lot-trace?lot=${PROD}&selected=201`, {
      forwardRows: [],
      forwardChains: { 201: forwardChain(201, PROD, [], 'PRODUCTION') },
    });

    expect(await screen.findByText('자재 입고가 없는 LOT입니다')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: PROD })).toBeInTheDocument();
  });
});

describe('W-02-09 LOT 추적: 목록 내보내기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('받는 동안 진행과 [취소]를 보이고, 취소하면 파일을 만들지 않고 처음 상태로 돌아간다', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:synthetic');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    let release = () => {};
    const exportGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01', {
      forwardRows: [forwardRow(101, MAT)],
      exportGate,
    });

    await user.click(await screen.findByRole('button', { name: '엑셀 내보내기' }));
    expect(await screen.findByText('1건 중 0건 받는 중')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('button', { name: '엑셀 내보내기' })).toBeEnabled();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('끝까지 받으면 파일을 만든다', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:synthetic');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01', {
      forwardRows: [forwardRow(101, MAT)],
    });

    await user.click(await screen.findByRole('button', { name: '엑셀 내보내기' }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '엑셀 내보내기' })).toBeEnabled();
  });
});
