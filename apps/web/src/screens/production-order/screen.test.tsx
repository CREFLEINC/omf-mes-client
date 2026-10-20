import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { ProductionOrderScreen } from './screen';

const t = messages.productionOrder;
const exact = (request: Request, path: string): boolean => new URL(request.url).pathname === path;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 25, total: items.length } });
const order = {
  productionOrderId: 701,
  productionOrderNo: 'SYN-PO-701',
  erpOrderNo: 'SYN-ERP-701',
  parentProductionOrderId: null,
  bomLevel: 0,
  businessUnitId: 2101,
  plantId: 3101,
  itemId: 7101,
  orderQty: 12.5,
  uomId: 8101,
  dueDate: '2026-08-31',
  statusCode: 'SYN-READY',
  expandedWorkOrderCount: 1,
  plannedWorkOrderCount: 1,
};
/* 공통코드 표시명 — 그룹별로 받는다. 이름이 없는 코드는 화면이 코드를 그대로 보인다. */
const codeValueNames: Record<string, { code: string; codeName: string }[]> = {
  PRODUCTION_ORDER_STATUS: [{ code: 'SYN-READY', codeName: '합성 수신' }],
};

const references: StubRoute[] = [
  {
    match: (request) => exact(request, '/mdm/code-values'),
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
      const items = (codeValueNames[group] ?? []).map((value, index) => ({
        ...value,
        codeValueId: index + 1,
        displayOrder: index + 1,
        isActive: true,
      }));
      return jsonResponse(page(items));
    },
  },
  {
    match: (request) => exact(request, '/mdm/business-units'),
    respond: () =>
      jsonResponse(
        page([
          {
            businessUnitId: 2101,
            legalEntityId: 1101,
            businessUnitCode: 'SYN-BU',
            businessUnitName: 'Synthetic unit',
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/plants'),
    respond: () =>
      jsonResponse(
        page([
          {
            plantId: 3101,
            legalEntityId: 1101,
            businessUnitId: 2101,
            plantCode: 'SYN-PLANT',
            plantName: 'Synthetic plant',
            timezoneCode: 'Asia/Seoul',
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse(
        page([
          {
            uomId: 8101,
            uomCode: 'SYN-EA',
            uomName: 'Synthetic each',
            decimalScale: 0,
            isActive: true,
          },
        ]),
      ),
  },
];
const normalRoutes: StubRoute[] = [
  ...references,
  {
    match: (request) => exact(request, '/planning/production-orders'),
    respond: () => jsonResponse({ items: [order], page: { page: 2, size: 25, total: 26 } }),
  },
  {
    match: (request) => exact(request, '/mdm/items/7101'),
    respond: () =>
      jsonResponse({
        item: {
          itemId: 7101,
          itemCode: 'SYN-ITEM',
          itemName: 'Synthetic item',
          itemTypeCode: 'MATERIAL',
          baseUomId: 8101,
          lotControlled: false,
          serialControlTypeCode: 'NONE',
          inspectionRequired: false,
          fifoPolicyCode: 'FIFO',
          negativeStockAllowed: false,
          isActive: true,
        },
        editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP', referenceCount: null },
      }),
  },
  {
    match: (request) => exact(request, '/planning/production-orders/701'),
    respond: () => jsonResponse({ ...order, remarks: 'Synthetic note' }),
  },
  {
    match: (request) => exact(request, '/planning/production-plans'),
    respond: () =>
      jsonResponse(
        page([
          {
            productionPlanId: 501,
            productionOrderId: 701,
            planNo: 'SYN-PLAN-501',
            planDate: '2026-08-25',
            plannedQty: 12.5,
            uomId: 8101,
            bomId: 8201,
            routingId: 8301,
            statusCode: 'SYN-DRAFT',
          },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/production/work-orders'),
    respond: () =>
      jsonResponse(
        page([
          {
            workOrderId: 601,
            workOrderNo: 'SYN-WO-601',
            productionPlanId: 501,
            routingOperationId: 6101,
            itemId: 7101,
            orderQty: 12.5,
            uomId: 8101,
            workOrderTypeCode: 'SYN-NORMAL',
            priorityNo: 1,
            statusCode: 'SYN-READY',
          },
        ]),
      ),
  },
];

/* 지금 주소를 그린다 — W/O 전개·편성 단추가 이동만 하는지 본다. */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: URL[] } => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  return {
    requests,
    fetch: async (request) => {
      requests.push(new URL(request.url));
      return stub(request);
    },
  };
};

describe('ProductionOrderScreen', () => {
  it('URL 목록 조건을 조회하고 선택 뒤에만 exact 기본·계획·W/O를 연결한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ProductionOrderScreen />
        <LocationProbe />
      </>,
      {
        fetch,
        route: '/?businessUnit=2101&page=2',
      },
    );
    const user = userEvent.setup();
    const select = await screen.findByRole('button', { name: t.actions.select('SYN-PO-701') });
    const listRequest = requests.find((url) => url.pathname === '/planning/production-orders');
    expect(listRequest?.searchParams.get('businessUnitId')).toBe('2101');
    expect(listRequest?.searchParams.get('includeChildren')).toBe('true');
    expect(listRequest?.searchParams.get('page')).toBe('2');
    expect(requests.some((url) => url.pathname === '/planning/production-orders/701')).toBe(false);
    expect(
      screen.queryByRole('button', { name: t.actions.productionPlan }),
    ).not.toBeInTheDocument();
    /* 상태는 코드가 아니라 공통코드 표시명으로 — 사용 중지 코드까지 받는다. */
    expect(await screen.findByText('합성 수신')).toBeInTheDocument();
    const codeGroups = requests
      .filter((url) => url.pathname === '/mdm/code-values')
      .map((url) => [
        url.searchParams.get('codeGroupCode'),
        url.searchParams.get('includeInactive'),
      ]);
    expect(codeGroups).toEqual(
      expect.arrayContaining([
        ['PRODUCTION_ORDER_STATUS', 'true'],
        ['PRODUCTION_PLAN_STATUS', 'true'],
        ['WORK_ORDER_STATUS', 'true'],
        ['WORK_ORDER_TYPE', 'true'],
      ]),
    );
    /* 검색은 서버가 ERP W/O 번호(production_order_no)만 본다 — 안내도 그것만 말한다. */
    expect(screen.getByLabelText(t.fields.q)).toHaveAttribute(
      'placeholder',
      t.values.searchPlaceholder,
    );

    await user.click(select);
    expect(await screen.findByText('SYN-PLAN-501')).toBeInTheDocument();
    expect(await screen.findByText('SYN-WO-601')).toBeInTheDocument();
    expect(screen.getAllByText('SYN-ERP-701').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        requests
          .filter((url) =>
            ['/planning/production-plans', '/production/work-orders'].includes(url.pathname),
          )
          .map((url) => url.search),
      ).toEqual(['?productionOrderId=701', '?productionOrderId=701']),
    );
    expect(screen.queryByRole('button', { name: /재동기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.actions.integrationSync })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
    expect(screen.getByRole('heading', { name: t.panes.filters })).toBeInTheDocument();
    expect(screen.getByLabelText(t.panes.basic).parentElement).toHaveClass(
      'production-order-detail-grid',
    );
    /* 「초기화」와 같은 DS 테두리 단추 — 누르면 선택한 ERP W/O 로 W/O 전개·편성 화면에 이동만 한다. */
    await user.click(screen.getByRole('button', { name: t.actions.productionPlan }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/production/production-plans?productionOrderId=701',
    );
  });

  it('목록 실패를 빈 성공으로 바꾸지 않고 상세 요청도 시작하지 않는다', async () => {
    const { fetch, requests } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/planning/production-orders'),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
    ]);
    renderWithProviders(<ProductionOrderScreen />, { fetch });

    expect(await screen.findByRole('alert')).toHaveTextContent(t.listLoadFailedTitle);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(requests.some((url) => url.pathname.includes('/planning/production-orders/'))).toBe(
      false,
    );
  });

  describe('자동 계획', () => {
    const needsReview = {
      ...order,
      autoPlan: { status: 'NEEDS_REVIEW', reasons: ['BOM_MISSING', 'LINE_UNKNOWN'] },
    };
    const done = { ...order, autoPlan: { status: 'DONE', reasons: [] } };
    const isAutoPlan = (request: Request): boolean =>
      request.method === 'POST' &&
      decodeURIComponent(new URL(request.url).pathname) ===
        '/planning/production-orders/701:auto-plan';

    /* 자동 계획이 성공하면 서버가 그 P/O 를 「완료」로 바꿔 내린다. */
    const autoPlanRoutes = (
      respond: (request: Request) => Response | Promise<Response>,
      {
        initial = needsReview,
        afterSuccess = done,
      }: { initial?: object; afterSuccess?: object } = {},
    ) => {
      let current: object = initial;
      const posts: Request[] = [];
      const reads: string[] = [];
      const routes: StubRoute[] = [
        {
          match: isAutoPlan,
          respond: async (request) => {
            posts.push(request.clone());
            const response = await respond(request);
            if (response.ok) current = afterSuccess;
            return response;
          },
        },
        {
          match: (request) => exact(request, '/planning/production-orders'),
          respond: () => {
            reads.push('list');
            return jsonResponse(page([current]));
          },
        },
        {
          match: (request) => exact(request, '/planning/production-orders/701'),
          respond: () => {
            reads.push('detail');
            return jsonResponse(current);
          },
        },
        ...normalRoutes,
      ];
      return { routes, posts, reads };
    };
    const result = (outcome: string, reasons: string[] = []) =>
      jsonResponse({ productionOrderId: 701, outcome, productionPlanId: 501, reasons });

    const openSelected = async (routes: StubRoute[]) => {
      renderWithProviders(<ProductionOrderScreen />, {
        fetch: createStubFetch(routes),
        route: '/?sel=701',
      });
      return screen.findByRole('button', { name: t.actions.autoPlan });
    };

    it('목록 열은 상태만, 사유는 마우스 올림과 읽어 주기로 낸다', async () => {
      const { routes } = autoPlanRoutes(() => result('CONFIRMED'));
      renderWithProviders(<ProductionOrderScreen />, { fetch: createStubFetch(routes) });

      const table = await screen.findByRole('table', { name: t.panes.list });
      const label = await within(table).findByText(t.values.autoPlanStatus.NEEDS_REVIEW);
      const chip = label.closest('[title]');
      const reasons = `${t.values.autoPlanReasons.BOM_MISSING} · ${t.values.autoPlanReasons.LINE_UNKNOWN}`;
      expect(chip).toHaveAttribute('title', reasons);
      expect(chip).toHaveTextContent(`${t.values.autoPlanStatus.NEEDS_REVIEW}: ${reasons}`);
    });

    it('확인 필요면 사유를 한 줄씩 보이고, 누르면 멱등 키로 요청한 뒤 다시 읽는다', async () => {
      const { routes, posts, reads } = autoPlanRoutes(() => result('CONFIRMED'));
      const button = await openSelected(routes);
      const user = userEvent.setup();

      const basic = screen.getByLabelText(t.panes.basic);
      const reasons = within(basic)
        .getAllByRole('listitem')
        .map((node) => node.textContent);
      expect(reasons).toEqual([
        t.values.autoPlanReasons.BOM_MISSING,
        t.values.autoPlanReasons.LINE_UNKNOWN,
      ]);
      const readsBefore = reads.length;

      await user.click(button);

      expect(await screen.findByText(t.autoPlan.confirmed)).toBeInTheDocument();
      expect(posts).toHaveLength(1);
      expect(posts[0]?.headers.get('Idempotency-Key')).toMatch(/\S/);
      expect(await posts[0]?.text()).toBe('');
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: t.actions.autoPlan })).not.toBeInTheDocument(),
      );
      expect(reads.slice(readsBefore)).toEqual(expect.arrayContaining(['list', 'detail']));
      expect(within(basic).queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('라인 미정 작성 중 계획이 이미 있으면 다시 눌러도 같은 상태를 알리고 단추를 남긴다', async () => {
      const existingDraft = {
        ...order,
        statusCode: 'RECEIVED',
        autoPlan: { status: 'NEEDS_REVIEW', reasons: ['LINE_UNKNOWN', 'PLAN_NOT_CONFIRMED'] },
      };
      const { routes } = autoPlanRoutes(
        () => result('DRAFT', ['LINE_UNKNOWN', 'PLAN_NOT_CONFIRMED']),
        { initial: existingDraft, afterSuccess: existingDraft },
      );
      const button = await openSelected(routes);
      const user = userEvent.setup();

      await user.click(button);

      expect(await screen.findByText(t.autoPlan.draft)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.actions.autoPlan })).toBeEnabled();
      expect(
        within(screen.getByLabelText(t.panes.basic))
          .getAllByRole('listitem')
          .map((node) => node.textContent),
      ).toEqual([
        t.values.autoPlanReasons.LINE_UNKNOWN,
        t.values.autoPlanReasons.PLAN_NOT_CONFIRMED,
      ]);
    });

    it.each([
      [
        ['BOM_MISSING', 'ROUTING_AMBIGUOUS'],
        `${t.values.autoPlanReasons.BOM_MISSING} · ${t.values.autoPlanReasons.ROUTING_AMBIGUOUS}`,
      ],
      /* 확정 계획이 수량을 다 덮지 못한 경우 — 남은 수량 계획을 만들지 않고 사유만 알린다. */
      [['QTY_REMAINING'], t.values.autoPlanReasons.QTY_REMAINING],
    ])('계획을 못 만들면 사유(%j)를 알린다', async (reasons, text) => {
      const { routes } = autoPlanRoutes(() => result('NOT_PLANNED', reasons));
      const button = await openSelected(routes);

      await userEvent.setup().click(button);

      expect(await screen.findByText(t.autoPlan.notPlanned)).toBeInTheDocument();
      expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('충돌(409)이면 공통 충돌 문구와 다시 불러오기를 낸다', async () => {
      const { routes, reads } = autoPlanRoutes(() =>
        jsonResponse(
          {
            code: 'VERSION_CONFLICT',
            message: 'synthetic conflict',
            conflictCause: 'erpSync',
          },
          { status: 409 },
        ),
      );
      const button = await openSelected(routes);
      const user = userEvent.setup();

      await user.click(button);

      expect(await screen.findByText(messages.conflict.erpSync)).toBeInTheDocument();
      const readsBefore = reads.length;
      await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
      await waitFor(() =>
        expect(reads.slice(readsBefore)).toEqual(expect.arrayContaining(['list', 'detail'])),
      );
      expect(screen.queryByText(messages.conflict.erpSync)).not.toBeInTheDocument();
    });

    it('응답을 기다리는 동안 단추를 잠근다', async () => {
      let release: (response: Response) => void = () => undefined;
      const { routes, posts } = autoPlanRoutes(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      );
      const button = await openSelected(routes);
      const user = userEvent.setup();

      await user.click(button);
      await waitFor(() => expect(button).toBeDisabled());
      await user.click(button);
      expect(posts).toHaveLength(1);

      release(result('CONFIRMED'));
      expect(await screen.findByText(t.autoPlan.confirmed)).toBeInTheDocument();
    });

    it('권한이 없으면(403) 권한 문구를 띄우고 성공 알림을 내지 않는다', async () => {
      const { routes } = autoPlanRoutes(() =>
        jsonResponse({ message: 'synthetic forbidden' }, { status: 403 }),
      );
      const button = await openSelected(routes);

      await userEvent.setup().click(button);

      expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
      expect(screen.queryByText(t.autoPlan.confirmed)).not.toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it('자동 계획을 한 적 없는 수신 P/O 는 단추로 필요할 때 계획한다', async () => {
      const { routes, posts } = autoPlanRoutes(() => result('CONFIRMED'), {
        initial: { ...order, statusCode: 'RECEIVED', autoPlan: null },
      });
      const button = await openSelected(routes);

      const basic = screen.getByLabelText(t.panes.basic);
      expect(within(basic).queryByText(t.fields.autoPlan, { selector: 'dt' })).toBeNull();
      await userEvent.setup().click(button);

      expect(await screen.findByText(t.autoPlan.confirmed)).toBeInTheDocument();
      expect(posts).toHaveLength(1);
    });

    it('자동 계획을 한 적 없어도 수신 상태가 아니면 단추가 없다', async () => {
      const { routes } = autoPlanRoutes(() => result('CONFIRMED'), {
        initial: { ...order, statusCode: 'CANCELLED', autoPlan: null },
      });
      renderWithProviders(<ProductionOrderScreen />, {
        fetch: createStubFetch(routes),
        route: '/?sel=701',
      });

      expect(await screen.findByRole('button', { name: t.actions.productionPlan })).toBeEnabled();
      await waitFor(() =>
        expect(screen.getByLabelText(t.panes.basic)).toHaveTextContent('SYN-PO-701'),
      );
      expect(screen.queryByRole('button', { name: t.actions.autoPlan })).not.toBeInTheDocument();
    });

    it('완료된 P/O 에는 자동 계획 단추가 없다', async () => {
      const { routes } = autoPlanRoutes(() => result('CONFIRMED'), { initial: done });
      renderWithProviders(<ProductionOrderScreen />, {
        fetch: createStubFetch(routes),
        route: '/?sel=701',
      });

      expect(await screen.findByRole('button', { name: t.actions.productionPlan })).toBeEnabled();
      await waitFor(() =>
        expect(screen.getByLabelText(t.panes.basic)).toHaveTextContent(
          t.values.autoPlanStatus.DONE,
        ),
      );
      expect(screen.queryByRole('button', { name: t.actions.autoPlan })).not.toBeInTheDocument();
    });
  });
});
