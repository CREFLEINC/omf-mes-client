import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { plantToday } from '../../patterns/plant-time';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { pickRange } from '../../test/date-picker';
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

/** 지금 주소와 마지막 이동 방식(PUSH, REPLACE). 바로 반영은 주소를 바꿔 써야 한다. */
const NavProbe = () => {
  const location = useLocation();
  const type = useNavigationType();
  return <output data-testid="nav">{`${type} ${location.pathname}${location.search}`}</output>;
};
const navState = () => screen.getByTestId('nav').textContent ?? '';

const MAT = 'ITEM-A|500|261023|SUP-A|0001';
const PROD = 'P-SYN-0001';

/** 이력 줄 목록은 비운다 — 이 파일은 상세 창을 본다(목록은 screen.test.tsx). */
const EMPTY_LINES = [
  '/logistics/goods-receipt-lines',
  '/logistics/shipment-lines',
  '/trace/material-input-lines',
  '/trace/packing-lines',
].map((pathname) => ({
  match: (request: Request) => new URL(request.url).pathname === pathname,
  respond: () =>
    jsonResponse({
      items: [],
      page: { page: 1, size: 50, total: 0 },
      totals: { lineCount: 0, qtyByUom: [], lineCountByType: [] },
    }),
}));

const setup = (route: string, data: TraceStubData, permissions?: string[]) => {
  const calls: URL[] = [];
  renderWithProviders(
    <SessionProvider>
      <LotTraceScreen permissionMenuPath="합성 묶음 › 합성 메뉴" />
      <NavProbe />
    </SessionProvider>,
    {
      session: { ...SYNTHETIC_SESSION, ...(permissions === undefined ? {} : { permissions }) },
      route,
      fetch: createStubFetch([
        ...traceRoutes(data, calls),
        ...EMPTY_LINES,
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
/** 목록과 투입 자재 표의 LOT 번호 칸. 칸이 좁으면 앞쪽만 줄이려고 번호를 두 조각으로 그려 글자 찾기를 칸 단위로 한다. */
const listLot =
  (lotNo: string) =>
  (_content: string, element: Element | null): boolean =>
    element?.classList.contains('lot-trace-lot') === true && element.textContent === lotNo;

/** 오른쪽(좁으면 아래) 상세 창. */
const detailPane = () => screen.getByRole('region', { name: 'LOT 상세' });
/** 상세 머리의 LOT 번호. */
const detailHead = (lotNo: string) => screen.findByRole('heading', { name: lotNo, level: 2 });
/** 상세 요약 항목 하나(항목명 → 값). */
const fact = (scope: HTMLElement, label: string) =>
  within(scope).getAllByText(label, { selector: 'dt' })[0]?.nextElementSibling;

const estimatedChip = (lotNo: string): HTMLElement | null => {
  const row = screen.getByText(listLot(lotNo)).closest('tr');
  if (row === null) throw new Error(`${lotNo} 줄이 없습니다`);
  return within(row).queryByLabelText(/^추정 포함\. /);
};

describe('W-02-09 LOT 생산 이력 조회: 자재 LOT 상세', () => {
  it('LOT을 고르기 전에는 상세 자리에 고르라는 안내를 둔다', async () => {
    setup('/production/lot-trace?from=2026-10-01&to=2026-10-26', {});
    expect(await within(detailPane()).findByText('LOT을 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('자재 LOT 상세: 입하, 자재 입고, 사용처, 생산 LOT마다 제품입고, 포장, 출하를 이름표 단 표로 보인다', async () => {
    const shipped = productionLot(201, PROD, {
      productionReceipts: [
        {
          goodsReceiptId: 41,
          goodsReceiptNo: 'GR-SYN-0041',
          receiptDatetime: '2026-10-23T07:00:00Z',
          warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
          qty: 100,
        },
      ],
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
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [
          workOrder(1, [], null),
          workOrder(2, []),
          workOrder(3, [shipped]),
        ]),
      },
    });

    await detailHead(MAT);
    const pane = detailPane();
    expect(within(pane).getByText('자재 LOT', { selector: '*' })).toBeInTheDocument();
    expect(fact(pane, '생산 LOT 수')).toHaveTextContent('1');
    expect(fact(pane, '출하 건수')).toHaveTextContent('1');
    expect(fact(pane, '고객 수')).toHaveTextContent('1');

    const inbound = within(pane).getByRole('region', { name: '입하' });
    expect(fact(inbound, '입하번호')).toHaveTextContent('IR-SYN-0001');
    expect(fact(inbound, '공급사 LOT')).toHaveTextContent('SL-0001');
    expect(within(inbound).getByRole('table', { name: '자재 입고' })).toHaveTextContent(
      'GR-SYN-0001',
    );

    const usage = within(pane).getByRole('region', { name: '사용처' });
    expect(within(usage).getAllByRole('row')).toHaveLength(4);
    expect(within(usage).getByText('투입만')).toBeInTheDocument();

    const lots = within(pane).getByRole('region', { name: '생산 LOT' });
    expect(within(lots).getByText(PROD)).toBeInTheDocument();
    expect(within(lots).getByText('제품입고 1건, 포장 2건, 출하 1건')).toBeInTheDocument();
    expect(within(lots).getByRole('table', { name: '제품입고' })).toHaveTextContent('GR-SYN-0041');
    expect(within(lots).getByRole('table', { name: '포장' })).toHaveTextContent('포장 중');
    /* 출하는 출하번호로 묶는다 — 출하 한 건은 한 줄이고 수량은 합이다. */
    const shipments = within(lots).getByRole('table', { name: '출하' });
    expect(within(shipments).getAllByText('SH-SYN-0031')).toHaveLength(1);
    expect(shipments).toHaveTextContent('50 EA');
    expect(shipments).toHaveTextContent('고객 A');

    const stages = within(pane).getByRole('list', { name: '단계' });
    /* 포장은 확정(PACKED)만 센다. */
    expect(within(stages).getByRole('button', { name: /포장\s*1건/ })).toBeInTheDocument();
    /* 출하까지 갔으면 흐름이 끝나 진행 중 단계 없이 모두 완료다. */
    expect(within(stages).queryByRole('listitem', { current: 'step' })).toBeNull();
    expect(
      within(stages)
        .getAllByRole('listitem')
        .every((item) => item.getAttribute('data-status') === 'complete'),
    ).toBe(true);
    expect(within(pane).getByText(NOTICE)).toBeInTheDocument();
    /* 이름표 없는 한 줄 나열이 없다 — 값은 모두 표나 항목 아래에 있다. */
    expect(within(pane).queryByRole('list', { name: '사슬' })).toBeNull();
  });

  it('아직 투입되지 않은 LOT은 사용처에 「아직 투입된 기록이 없습니다」', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, []) },
    });

    await detailHead(MAT);
    const usage = within(detailPane()).getByRole('region', { name: '사용처' });
    expect(within(usage).getByText('아직 투입된 기록이 없습니다')).toBeInTheDocument();
    /* 이어진 생산 LOT이 없으면 서버 basis가 null이고 추정 안내를 두지 않는다. */
    expect(within(detailPane()).queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('상세의 추정 안내는 서버 최상위 basis로만 정한다(null이면 생산 LOT이 있어도 두지 않는다)', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: { ...forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]), basis: null },
      },
    });

    await detailHead(MAT);
    expect(within(detailPane()).getByText(PROD)).toBeInTheDocument();
    expect(within(detailPane()).queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('[보기]는 목록을 두고 그 LOT을 상세 가운데에 둔다. [이전 LOT]과 경로로 되돌아간다', async () => {
    const user = userEvent.setup();
    const { calls } = setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]) },
      backwardChains: { 201: backwardChain(201, PROD, [inputMaterial(101, MAT)]) },
    });

    await detailHead(MAT);
    await user.click(within(detailPane()).getByRole('button', { name: `${PROD} 추적 보기` }));

    expect(await detailHead(PROD)).toBeInTheDocument();
    expect(navState()).toMatch(/^PUSH /);
    expect(navState()).toContain('selected=201');
    expect(calls.some((url) => url.pathname === '/trace/lots/201/backward-flow')).toBe(true);
    const inputs = within(detailPane()).getByRole('region', { name: '투입 자재' });
    expect(within(inputs).getByText(listLot(MAT))).toBeInTheDocument();
    const path = within(detailPane()).getByRole('navigation', { name: '경로' });
    expect(path).toHaveTextContent(`자재 LOT ${MAT}`);
    expect(path).toHaveTextContent(`생산 LOT ${PROD}`);

    await user.click(within(path).getByRole('button', { name: '이전 LOT' }));
    expect(await detailHead(MAT)).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('navigation', { name: '경로' })).toBeNull();
    expect(navState()).not.toContain('via=');
  });

  it('[보기]로 지나온 LOT에 다시 가면 경로를 그 자리까지 되돌린다(자재 → 생산 → 같은 자재)', async () => {
    const user = userEvent.setup();
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]) },
      backwardChains: { 201: backwardChain(201, PROD, [inputMaterial(101, MAT)]) },
    });

    await detailHead(MAT);
    await user.click(within(detailPane()).getByRole('button', { name: `${PROD} 추적 보기` }));
    await detailHead(PROD);
    await user.click(within(detailPane()).getByRole('button', { name: `${MAT} 추적 보기` }));

    expect(await detailHead(MAT)).toBeInTheDocument();
    expect(navState()).toContain('selected=101');
    expect(navState()).not.toContain('via=');
    expect(within(detailPane()).queryByRole('navigation', { name: '경로' })).toBeNull();
  });

  it('W-03-01 권한이 있으면 [LOT 상태 보기]를 둔다', async () => {
    setup(
      `/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09', 'W-03-01'],
    );
    await detailHead(MAT);
    expect(within(detailPane()).getByRole('button', { name: 'LOT 상태 보기' })).toBeInTheDocument();
  });

  it('W-03-01 권한이 없으면 [LOT 상태 보기]를 두지 않는다', async () => {
    setup(
      `/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09'],
    );
    await detailHead(MAT);
    expect(within(detailPane()).queryByRole('button', { name: 'LOT 상태 보기' })).toBeNull();
  });
});

describe('W-02-09 LOT 생산 이력 조회: 제품 LOT 상세', () => {
  it('상세 조건 안의 조건(W/O 번호)이 주소에 있어도 접힌 채 열고, 걸린 조건을 한 줄로 알린다', async () => {
    setup('/production/lot-trace?wo=WO-SYN-0001', {});

    expect(await screen.findByText('상세 조건: W/O 번호 WO-SYN-0001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '상세 조건 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('투입 자재가 없으면 「투입 자재가 없습니다」, 출하가 없으면 「아직 출하되지 않았습니다」', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, [], false) },
    });

    await detailHead(PROD);
    const pane = detailPane();
    expect(within(pane).getByText('투입 자재가 없습니다')).toBeInTheDocument();
    expect(within(pane).getByText('아직 출하되지 않았습니다')).toBeInTheDocument();
    expect(within(pane).getByText('W/O 실적으로 만든 LOT이 아닙니다')).toBeInTheDocument();
    expect(fact(pane, '투입 자재 LOT 수')).toHaveTextContent('0');
    expect(fact(pane, '공급사 수')).toHaveTextContent('0');
    expect(within(pane).queryByText(NOTICE)).not.toBeInTheDocument();
    /* 사용처가 없는 생산 LOT(정방향 404)은 실패로 보이지 않는다. */
    expect(within(pane).queryByText('사용처를 불러오지 못했습니다')).toBeNull();
    expect(within(pane).queryByRole('region', { name: '사용처' })).toBeNull();
  });

  it('제품 LOT 상세: 생산 실적, 투입 자재 표, 반제품 투입 LOT은 [보기]로 가운데 둔다', async () => {
    const user = userEvent.setup();
    const semi = inputMaterial(301, 'SF-SYN-0001', {
      lotTypeCode: 'PRODUCTION',
      producedBy: { workOrderId: 80, workOrderNo: 'WO-SYN-0080' },
    });
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: {
        201: backwardChain(201, PROD, [semi, inputMaterial(101, MAT)]),
        301: backwardChain(301, 'SF-SYN-0001', [inputMaterial(102, 'ITEM-A|20|261023|SUP-A|0002')]),
      },
    });

    await detailHead(PROD);
    const pane = detailPane();
    expect(fact(pane, '투입 자재 LOT 수')).toHaveTextContent('2');
    expect(fact(pane, '공급사 수')).toHaveTextContent('1');
    /* W/O 실적은 이 LOT이 아니라 W/O 전체다. 값마다 항목명을 단다. */
    const production = within(pane).getByRole('region', { name: '생산 실적' });
    expect(fact(production, 'W/O 번호')).toHaveTextContent('WO-SYN-0070');
    expect(fact(production, 'W/O 실적 건수')).toHaveTextContent('2');
    expect(fact(production, 'W/O 양품 수량')).toHaveTextContent('120 EA');
    expect(fact(production, 'W/O 불량 수량')).toHaveTextContent('5 EA');
    /* 투입 자재 표는 상세 창 안에 들어오게 자재 LOT, 품목명, 투입량, 연결 근거, [보기]만 둔다. */
    const inputs = within(pane).getByRole('table', { name: '투입 자재' });
    expect(
      within(inputs)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['자재 LOT', '품목명', '투입량', '연결 근거', '추적']);
    expect(within(inputs).getAllByText('추정(투입 시각)')).toHaveLength(2);
    expect(within(pane).getByText(NOTICE)).toBeInTheDocument();
    for (const name of ['제품입고', '포장', '출하']) {
      expect(within(pane).getByRole('region', { name })).toBeInTheDocument();
    }

    await user.click(within(pane).getByRole('button', { name: 'SF-SYN-0001 추적 보기' }));

    expect(await detailHead('SF-SYN-0001')).toBeInTheDocument();
    expect(within(detailPane()).getByRole('navigation', { name: '경로' })).toHaveTextContent(
      `생산 LOT ${PROD}`,
    );
    expect(
      within(detailPane()).getByText(listLot('ITEM-A|20|261023|SUP-A|0002')),
    ).toBeInTheDocument();
  });

  it('다시 투입된 반제품 LOT은 사용처와 그 생산 LOT도 함께 보인다', async () => {
    const semi = 'SF-SYN-0001';
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=301`, {
      backwardRows: [backwardRow(301, semi)],
      backwardChains: { 301: backwardChain(301, semi, [inputMaterial(101, MAT)]) },
      forwardChains: {
        301: forwardChain(301, semi, [workOrder(5, [productionLot(201, PROD)])], 'PRODUCTION'),
      },
    });

    await detailHead(semi);
    const pane = detailPane();
    expect(within(pane).getByRole('region', { name: '투입 자재' })).toHaveTextContent(MAT);
    expect(within(pane).getByRole('region', { name: '사용처' })).toHaveTextContent('WO-SYN-0005');
    expect(within(pane).getByRole('region', { name: '생산 LOT' })).toHaveTextContent(PROD);
  });

  it('사용처만 403이면 그 자리에 권한 안내를 둔다', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, []) },
      chainFailures: { 'forward-201': 403 },
    });

    await detailHead(PROD);
    expect(
      within(detailPane()).getByText('LOT 생산 이력 조회 권한이 없습니다'),
    ).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('사용처를 불러오지 못하면(500) 그 자리에 사유와 [다시 조회]를 둔다', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, []) },
      chainFailures: { 'forward-201': 500 },
    });

    await detailHead(PROD);
    expect(within(detailPane()).getByText('사용처를 불러오지 못했습니다')).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });
});

const FORBIDDEN_TITLE = 'LOT 생산 이력 조회 권한이 없습니다';
const PERMISSION_DENIED = {
  errors: [
    { scope: 'screen', code: 'PERMISSION_DENIED', message: '이 기능을 쓸 권한이 없습니다.' },
  ],
};

describe('W-02-09 LOT 생산 이력 조회: 권한 없음과 없는 LOT', () => {
  it('추적이 403이면 상세에 권한 안내를 보이고 [다시 조회]를 두지 않는다', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 403 },
    });

    expect(await within(detailPane()).findByText(FORBIDDEN_TITLE)).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('주소의 LOT이 없으면(404) 「LOT을 찾을 수 없습니다」이고 [다시 조회]를 두지 않는다', async () => {
    setup('/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=999', {
      backwardRows: [],
    });

    expect(await within(detailPane()).findByText('LOT을 찾을 수 없습니다')).toBeInTheDocument();
    expect(within(detailPane()).getByText('목록에서 LOT을 다시 고르세요.')).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('그 밖의 실패(500)는 [다시 조회]를 둔다', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 500 },
    });

    expect(
      await within(detailPane()).findByText('추적 정보를 불러오지 못했습니다'),
    ).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });
});

describe('W-02-09 LOT 생산 이력 조회: 큰 사슬과 단계 줄', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('생산 LOT이 잘린 큰 사슬은 안내를 두고, 생산 LOT이 많으면 묶음을 접은 채 시작한다', async () => {
    const user = userEvent.setup();
    const lots = [201, 202, 203, 204].map((id) =>
      productionLot(id, `P-SYN-0${String(id)}`, {
        productionReceipts: [
          {
            goodsReceiptId: id,
            goodsReceiptNo: `GR-SYN-0${String(id)}`,
            receiptDatetime: '2026-10-23T07:00:00Z',
            warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
            qty: 100,
          },
        ],
      }),
    );
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: {
          ...forwardChain(101, MAT, [workOrder(3, lots)]),
          truncated: true,
          totalProductionLotCount: 812,
        },
      },
    });

    await detailHead(MAT);
    const pane = detailPane();
    expect(
      within(pane).getByText(
        '생산 LOT 812건 중 500건까지 보이며 추적 내보내기에도 이 500건만 담깁니다. 나머지는 상세 조건의 W/O 번호나 출하번호로 찾으세요.',
      ),
    ).toBeInTheDocument();
    const group = within(pane).getByText('P-SYN-0201').closest('details');
    expect(group).not.toHaveAttribute('open');
    expect(within(pane).getByText('GR-SYN-0201')).not.toBeVisible();

    await user.click(within(pane).getByText('P-SYN-0201'));
    expect(group).toHaveAttribute('open');
  });

  it('단계 줄의 칸은 그 단계의 첫 구획으로 간다', async () => {
    const user = userEvent.setup();
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: forwardChain(101, MAT, [workOrder(2, []), workOrder(3, [productionLot(201, PROD)])]),
      },
    });

    await detailHead(MAT);
    const stages = within(detailPane()).getByRole('list', { name: '단계' });
    await user.click(within(stages).getByRole('button', { name: /생산\s*1건/ }));

    expect(scrolled.at(-1)).toHaveTextContent(PROD);
  });

  it('공정 순서의 단계 줄: 지난 단계는 완료, 가장 멀리 간 단계는 진행 중, 닿지 않은 단계는 대기다', async () => {
    setup(`/production/lot-trace?from=2026-10-20&to=2026-10-26&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]) },
    });

    await detailHead(MAT);
    const stages = within(detailPane()).getByRole('list', { name: '단계' });
    const items = within(stages).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual([
      'complete',
      'complete',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(within(stages).getByRole('button', { name: /제품입고\s*0건/ })).toBeDisabled();
  });
});
