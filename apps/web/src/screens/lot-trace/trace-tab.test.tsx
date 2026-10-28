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
/** 목록의 LOT 번호 칸. 칸이 좁으면 앞쪽만 줄이려고 번호를 두 조각으로 그려 글자 찾기를 칸 단위로 한다. */
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

describe('W-02-09 LOT 추적: 자재 LOT 탭', () => {
  it('처음 열면 자재 LOT 탭이고, 기본 기간 30일을 채우고 진입점이 없으면 부르지 않고 [조회]를 사유와 함께 잠근다', async () => {
    const { calls } = setup('/production/lot-trace', {});

    expect(
      await screen.findByRole('tab', { name: '자재 LOT', selected: true }),
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

    expect(await screen.findByText(listLot(MAT))).toBeInTheDocument();
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

    expect(await screen.findByText(listLot(MAT))).toBeInTheDocument();
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

  it('LOT을 고르기 전에는 상세 자리에 고르라는 안내를 둔다', async () => {
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [forwardRow(101, MAT)],
    });
    await screen.findByText(listLot(MAT));
    expect(within(detailPane()).getByText('LOT을 고르세요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('행을 누르면 목록 옆 상세에 그 LOT이 서고, 고른 행을 표시한다', async () => {
    const user = userEvent.setup();
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, []) },
    });
    await user.click(await screen.findByText(listLot(MAT)));

    expect(await detailHead(MAT)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: `${MAT} 추적 열기` })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(navState()).toContain('selected=101');
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
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
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
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: {
        101: { ...forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]), basis: null },
      },
    });

    await detailHead(MAT);
    expect(within(detailPane()).getByText(PROD)).toBeInTheDocument();
    expect(within(detailPane()).queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('[보기]는 탭과 목록을 두고 그 LOT을 상세 가운데에 둔다. [이전 LOT]과 경로로 되돌아간다', async () => {
    const user = userEvent.setup();
    const { calls } = setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      forwardChains: { 101: forwardChain(101, MAT, [workOrder(3, [productionLot(201, PROD)])]) },
      backwardChains: { 201: backwardChain(201, PROD, [inputMaterial(101, MAT)]) },
    });

    await detailHead(MAT);
    await user.click(within(detailPane()).getByRole('button', { name: `${PROD} 추적 보기` }));

    expect(await detailHead(PROD)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '자재 LOT', selected: true })).toBeInTheDocument();
    /* 목록은 그대로이고 처음 고른 행을 짚는다. */
    expect(screen.getByRole('row', { name: `${MAT} 추적 열기` })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(navState()).toMatch(/^PUSH /);
    expect(navState()).toContain('selected=201');
    expect(calls.some((url) => url.pathname === '/trace/lots/201/backward-flow')).toBe(true);
    const inputs = within(detailPane()).getByRole('region', { name: '투입 자재' });
    expect(within(inputs).getByText(MAT)).toBeInTheDocument();
    const path = within(detailPane()).getByRole('navigation', { name: '경로' });
    expect(path).toHaveTextContent(`자재 LOT ${MAT}`);
    expect(path).toHaveTextContent(`생산 LOT ${PROD}`);

    await user.click(within(path).getByRole('button', { name: '이전 LOT' }));
    expect(await detailHead(MAT)).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('navigation', { name: '경로' })).toBeNull();
    expect(navState()).not.toContain('via=');
  });

  it('W-03-01 권한이 있으면 [LOT 상태 보기]를 둔다', async () => {
    setup(
      `/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09', 'W-03-01'],
    );
    await detailHead(MAT);
    expect(within(detailPane()).getByRole('button', { name: 'LOT 상태 보기' })).toBeInTheDocument();
  });

  it('W-03-01 권한이 없으면 [LOT 상태 보기]를 두지 않는다', async () => {
    setup(
      `/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`,
      { forwardRows: [forwardRow(101, MAT)], forwardChains: { 101: forwardChain(101, MAT, []) } },
      ['W-02-09'],
    );
    await detailHead(MAT);
    expect(within(detailPane()).queryByRole('button', { name: 'LOT 상태 보기' })).toBeNull();
  });
});

describe('W-02-09 LOT 추적: 제품 LOT 탭', () => {
  it('W/O 번호 진입점으로 부른다(기간 없이)', async () => {
    const { calls } = setup('/production/lot-trace?tab=backward&wo=WO-SYN-0001', {
      backwardRows: [backwardRow(201, PROD)],
    });

    expect(
      await screen.findByRole('tab', { name: '제품 LOT', selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText(listLot(PROD))).toBeInTheDocument();
    const list = lists(calls, '/trace/product-lot-flows')[0];
    expect(list?.searchParams.get('workOrderNo')).toBe('WO-SYN-0001');
    expect(list?.searchParams.has('dateFrom')).toBe(false);
  });

  it('목록: 서버 basis가 있으면 「추정 포함」 칩, null이면 칩이 없다', async () => {
    const none = 'P-SYN-0002';
    setup('/production/lot-trace?tab=backward&wo=WO-SYN-0001', {
      backwardRows: [backwardRow(201, PROD), backwardRow(202, none, { basis: null })],
    });

    expect(await screen.findByText(listLot(PROD))).toBeInTheDocument();
    expect(estimatedChip(PROD)).toHaveAccessibleName(`추정 포함. ${TIP_LOT}`);
    expect(estimatedChip(none)).toBeNull();
  });

  it('투입 자재가 없으면 「투입 자재가 없습니다」, 출하가 없으면 「아직 출하되지 않았습니다」', async () => {
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
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
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
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
    const inputs = within(pane).getByRole('table', { name: '투입 자재' });
    expect(within(inputs).getAllByText('SL-0001')).toHaveLength(2);
    expect(within(inputs).getAllByText('공급사 A')).toHaveLength(2);
    expect(within(pane).getByText(NOTICE)).toBeInTheDocument();
    for (const name of ['제품입고', '포장', '출하']) {
      expect(within(pane).getByRole('region', { name })).toBeInTheDocument();
    }

    await user.click(within(pane).getByRole('button', { name: 'SF-SYN-0001 추적 보기' }));

    expect(await detailHead('SF-SYN-0001')).toBeInTheDocument();
    expect(within(detailPane()).getByRole('navigation', { name: '경로' })).toHaveTextContent(
      `생산 LOT ${PROD}`,
    );
    expect(within(detailPane()).getByText('ITEM-A|20|261023|SUP-A|0002')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '제품 LOT', selected: true })).toBeInTheDocument();
  });

  it('다시 투입된 반제품 LOT은 사용처와 그 생산 LOT도 함께 보인다', async () => {
    const semi = 'SF-SYN-0001';
    setup(`/production/lot-trace?tab=backward&lot=${semi}&selected=301`, {
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

  it('사용처를 불러오지 못하면(500) 그 자리에 사유와 [다시 조회]를 둔다', async () => {
    setup(`/production/lot-trace?tab=backward&lot=${PROD}&selected=201`, {
      backwardRows: [backwardRow(201, PROD)],
      backwardChains: { 201: backwardChain(201, PROD, []) },
      chainFailures: { 'forward-201': 500 },
    });

    await detailHead(PROD);
    expect(within(detailPane()).getByText('사용처를 불러오지 못했습니다')).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
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

  it('추적이 403이면 상세에 권한 안내를 보이고 [다시 조회]를 두지 않는다', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 403 },
    });

    expect(await within(detailPane()).findByText(FORBIDDEN_TITLE)).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('주소의 LOT이 없으면(404) 「LOT을 찾을 수 없습니다」이고 [다시 조회]를 두지 않는다', async () => {
    setup('/production/lot-trace?tab=backward&lot=P-SYN-9999&selected=999', {
      backwardRows: [],
    });

    expect(await within(detailPane()).findByText('LOT을 찾을 수 없습니다')).toBeInTheDocument();
    expect(within(detailPane()).getByText('목록에서 LOT을 다시 고르세요.')).toBeInTheDocument();
    expect(within(detailPane()).queryByRole('button', { name: '다시 조회' })).toBeNull();
  });

  it('그 밖의 실패(500)는 [다시 조회]를 둔다', async () => {
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
      forwardRows: [forwardRow(101, MAT)],
      chainFailures: { 'forward-101': 500 },
    });

    expect(
      await within(detailPane()).findByText('추적 정보를 불러오지 못했습니다'),
    ).toBeInTheDocument();
    expect(within(detailPane()).getByRole('button', { name: '다시 조회' })).toBeInTheDocument();
  });
});

describe('W-02-09 LOT 추적: 큰 사슬과 단계 줄', () => {
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
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
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
        '생산 LOT 812건 중 500건까지 보이며 추적 내보내기에도 이 500건만 담깁니다. 나머지는 제품 LOT 탭에서 W/O 번호나 출하번호로 찾으세요.',
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
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
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
    setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}&selected=101`, {
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

  it('생산 LOT을 자재 LOT 탭으로 열면 목록이 빈 까닭을 말한다', async () => {
    setup(`/production/lot-trace?lot=${PROD}&selected=201`, {
      forwardRows: [],
      forwardChains: { 201: forwardChain(201, PROD, [], 'PRODUCTION') },
      backwardChains: { 201: backwardChain(201, PROD, []) },
    });

    expect(await screen.findByText('자재 입고가 없는 LOT입니다')).toBeInTheDocument();
    expect(await detailHead(PROD)).toBeInTheDocument();
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

describe('W-02-09 LOT 추적: 추적 조건 바로 반영', () => {
  const flows = (calls: URL[]) => lists(calls, '/trace/material-lot-flows');

  it('LOT 번호는 칠 때마다 부르지 않고 칸을 떠날 때 반영한다', async () => {
    const user = userEvent.setup();
    const { calls } = setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}`, {
      forwardRows: [forwardRow(101, MAT)],
    });
    const field = await screen.findByLabelText('LOT 번호');
    await waitFor(() => expect(flows(calls)).toHaveLength(1));

    await user.clear(field);
    await user.type(field, 'ITEM-B');
    expect(flows(calls)).toHaveLength(1);

    await user.tab();
    await waitFor(() => expect(flows(calls).at(-1)?.searchParams.get('lotNo')).toBe('ITEM-B'));
    expect(flows(calls)).toHaveLength(2);
    expect(navState()).toMatch(/^REPLACE /);
  });

  it('LOT 번호를 지우면(×) 바로 반영하고, 진입점이 없으니 부르지 않고 시작 안내를 보인다', async () => {
    const user = userEvent.setup();
    const { calls } = setup(`/production/lot-trace?lot=${encodeURIComponent(MAT)}`, {
      forwardRows: [forwardRow(101, MAT)],
    });
    await screen.findByText(listLot(MAT));
    const before = flows(calls).length;

    await user.click(screen.getByRole('button', { name: '지우기' }));

    expect(
      await screen.findByText('품목이나 LOT 번호로 찾으세요. 입하번호로도 찾을 수 있습니다'),
    ).toBeInTheDocument();
    expect(navState()).not.toContain('lot=');
    expect(flows(calls)).toHaveLength(before);
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('기간이 366일을 넘으면 반영하지 않고 기간 칸 아래 사유를 보인다', async () => {
    const user = userEvent.setup();
    const { calls } = setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [forwardRow(101, MAT)],
    });
    await screen.findByText(listLot(MAT));
    const before = flows(calls).length;

    await pickRange(user, screen.getByLabelText('입고 기간'), '2025-01-01', '2026-10-26');

    expect(await screen.findByText('기간은 366일까지 조회할 수 있습니다')).toBeInTheDocument();
    expect(flows(calls)).toHaveLength(before);
    expect(navState()).toContain('from=2026-10-01');
  });

  it('기간을 고르면 바로 반영하고 쪽을 1로 돌린다', async () => {
    const user = userEvent.setup();
    const { calls } = setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26&page=2', {
      forwardRows: [forwardRow(101, MAT)],
    });
    await screen.findByText(listLot(MAT));

    await pickRange(user, screen.getByLabelText('입고 기간'), '2026-10-05', '2026-10-20');

    await waitFor(() =>
      expect(flows(calls).at(-1)?.searchParams.get('receiptDateFrom')).toBe('2026-10-05'),
    );
    expect(flows(calls).at(-1)?.searchParams.get('page')).toBe('1');
    expect(navState()).toMatch(/^REPLACE /);
  });

  it('단계 칩은 바로 반영하고 주소를 바꿔 쓴다', async () => {
    const user = userEvent.setup();
    setup('/production/lot-trace?q=ITEM-A&from=2026-10-01&to=2026-10-26', {
      forwardRows: [forwardRow(101, MAT)],
    });
    const chips = await screen.findByRole('group', { name: '진행' });

    await user.click(within(chips).getByRole('button', { name: '투입 1' }));

    await waitFor(() => expect(navState()).toContain('stage=CONSUMED'));
    expect(navState()).toMatch(/^REPLACE /);
  });
});
