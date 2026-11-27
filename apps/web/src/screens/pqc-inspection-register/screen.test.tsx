import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { PqcInspectionRegisterScreen } from './screen';

/**
 * W-03-11 — 판정 규칙은 P-02-13 의 시험이 잰다. 여기서는 관리웹이 «더한» 것만 잰다:
 * PQC 목록 질의 · 고른 의뢰의 패널 · 계정 세션으로 바로 저장(사번 헤더 없음).
 */

const t = messages.pqcInspectionRegister;
const pqc = messages.pqcInspection;

const REQUEST = {
  inspectionRequestId: 7101,
  inspectionRequestNo: 'IR-PQC-7101',
  inspectionTypeCode: 'PQC',
  inspectionPlanVersionId: null,
  targetTypeCode: 'WORK_ORDER',
  targetId: 701,
  itemId: 101,
  lotId: null,
  workOrderId: 701,
  targetQty: 5,
  uomId: 1,
  statusCode: 'REQUESTED',
  requestedAt: '2026-10-16T09:00:00+09:00',
  versionNo: 1,
};

const JUDGMENTS = [
  { codeValueId: 1, code: 'ACCEPTED', codeName: '합격', displayOrder: 1, isActive: true },
  { codeValueId: 2, code: 'REJECTED', codeName: '불합격', displayOrder: 2, isActive: true },
];

const ROUND = {
  inspectionResultId: 9101,
  inspectionResultNo: 'IRS-9101',
  inspectionRequestId: 7101,
  inspectionRound: 1,
  inspectedQty: 5,
  acceptedQty: 3,
  rejectedQty: 0,
  heldQty: 2,
  uomId: 1,
  inspectorId: 1,
  inspectedAt: '2026-10-16T09:00:00+09:00',
  statusCode: 'DRAFT',
  versionNo: 1,
};

interface RenderOptions {
  /** 의뢰가 기본 생략으로 닫혔다(#353). */
  skipped?: boolean;
  /** 그 의뢰의 회차 목록. 함수면 부를 때마다 다시 정한다(저장 뒤 재조회). */
  rounds?: object[] | (() => object[]);
  roundsFail?: boolean;
  /** 저장 응답을 손으로 풀 때까지 붙든다. */
  holdSave?: boolean;
  /** 목록 응답 줄. 없으면 의뢰 하나. */
  queueItems?: object[];
  /** 작업지시에 생산 실적이 하나도 없다(진척 수량 모두 0). */
  noProduction?: boolean;
}

const renderScreen = (options: RenderOptions = {}) => {
  const saves: Request[] = [];
  const queueQueries: URLSearchParams[] = [];
  let releaseSave: () => void = () => undefined;

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/quality/inspection-requests' && url.searchParams.has('workOrderId')) {
      queueQueries.push(url.searchParams);
      const items = url.searchParams.get('workOrderId') === '701' ? [REQUEST] : [];
      return jsonResponse({ items, page: { page: 1, size: 5, total: items.length } });
    }
    if (path === '/quality/inspection-requests') {
      queueQueries.push(url.searchParams);
      const items = options.queueItems ?? [REQUEST];
      return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
    }
    if (path === '/quality/inspection-requests/7101')
      return jsonResponse(
        options.skipped === true
          ? { ...REQUEST, statusCode: 'SKIPPED', skipBasisCode: 'DEFAULT' }
          : REQUEST,
      );
    if (path === '/trace/lots') {
      const lotNo = url.searchParams.get('lotNo');
      const workOrderId = url.searchParams.get('workOrderId');
      const lots = [
        {
          lotId: 801,
          lotNo: 'M-LOT-0701',
          sourceTypeCode: 'WORK_ORDER',
          sourceId: 701,
          lifecycleStatusCode: 'WAITING',
        },
        {
          lotId: 803,
          lotNo: 'M-LOT-0701B',
          sourceTypeCode: 'WORK_ORDER',
          sourceId: 701,
          lifecycleStatusCode: 'ACTIVE',
        },
        {
          lotId: 804,
          lotNo: 'M-LOT-0701X',
          sourceTypeCode: 'WORK_ORDER',
          sourceId: 701,
          lifecycleStatusCode: 'VOIDED',
        },
        {
          lotId: 802,
          lotNo: 'M-LOT-0799',
          sourceTypeCode: 'WORK_ORDER',
          sourceId: 799,
          lifecycleStatusCode: 'WAITING',
        },
      ].filter((lot) =>
        lotNo !== null ? lot.lotNo === lotNo : String(lot.sourceId) === workOrderId,
      );
      return jsonResponse({ items: lots, page: { page: 1, size: 5, total: lots.length } });
    }
    if (path === '/production/work-orders') {
      const q = (url.searchParams.get('q') ?? '').toUpperCase();
      const items = [
        { workOrderId: 701, workOrderNo: 'WO-20261016-0701', itemId: 101 },
        { workOrderId: 702, workOrderNo: 'WO-20261016-0702', itemId: 101 },
      ].filter((row) => row.workOrderNo.includes(q));
      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    }
    if (path === '/production/work-orders/701') {
      return jsonResponse({
        workOrderId: 701,
        workOrderNo: 'WO-20261016-0701',
        itemId: 101,
        ...(options.noProduction === true ? { progress: { goodQty: 0 } } : {}),
      });
    }
    if (path === '/mdm/items') {
      return jsonResponse({
        items: [
          {
            itemId: 101,
            itemCode: 'F534F50200',
            itemName: '합성 품목',
            itemTypeCode: 'FG',
            isActive: true,
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      });
    }
    if (path === '/mdm/items/101') {
      return jsonResponse({ item: { itemId: 101, itemCode: 'F534F50200', itemName: '합성 품목' } });
    }
    if (path === '/mdm/code-values') {
      return jsonResponse({ items: JUDGMENTS, page: { page: 1, size: 200, total: 2 } });
    }
    if (path === '/mdm/uoms') {
      return jsonResponse({ items: [{ uomId: 1, uomCode: 'EA', uomName: '개' }] });
    }
    if (path === '/quality/inspection-results' && request.method === 'GET') {
      if (options.roundsFail === true)
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      const rounds =
        typeof options.rounds === 'function' ? options.rounds() : (options.rounds ?? []);
      return jsonResponse({ items: rounds, page: { page: 1, size: 100, total: rounds.length } });
    }
    if (path === '/quality/inspection-results/9101/measurements') {
      return jsonResponse({ items: [], page: { page: 1, size: 500, total: 0 } });
    }
    if (path === '/quality/inspection-results' && request.method === 'POST') {
      saves.push(request.clone());
      if (options.holdSave === true) {
        await new Promise<void>((resolve) => {
          releaseSave = resolve;
        });
      }
      return jsonResponse({ inspectionResultId: 9101 }, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  /* 결과 창이 검사자(세션)를 읽는다(omf-all-around#356) — 앱처럼 세션 자리 안에 둔다. */
  renderWithProviders(
    <SessionProvider>
      <PqcInspectionRegisterScreen />
    </SessionProvider>,
    {
      route: '/quality/pqc-inspections',
      fetch: stubFetch,
      session: {
        userId: 8101,
        loginId: 'TST-LOGIN-01',
        userName: '합성 사용자',
        scopes: [{ businessUnitId: 8301 }],
        mustChangePassword: false,
        roles: [],
        permissions: [],
      },
    },
  );

  return { saves, queueQueries, releaseSave: () => releaseSave() };
};

const web = t.web;
const hub = messages.common.inspectionHub;

const td = messages.iqcInboundLot.drawer;

/* 결과 창(omf-all-around#356) — [검사 결과 추가]로 연다. */
const openAddDrawer = async (
  user: ReturnType<typeof userEvent.setup>,
  pane: ReturnType<typeof within>,
  round = 1,
) => {
  const add = await pane.findByRole('button', { name: web.results.add });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
  return within(await screen.findByRole('dialog', { name: td.addTitle(round) }));
};

/* 필수 칸(나머지 수량 · 종합 판정)을 채운다 — 그래야 [제출]이 눌린다(omf-all-around#356). */
const fillRequired = async (
  user: ReturnType<typeof userEvent.setup>,
  drawer: ReturnType<typeof within>,
): Promise<void> => {
  for (const name of [web.quantity.rejected, web.quantity.held]) {
    await user.clear(drawer.getByRole('textbox', { name }));
    await user.type(drawer.getByRole('textbox', { name }), '0');
  }
  await user.click(drawer.getByRole('combobox', { name: web.judgmentBox }));
  await user.click(await screen.findByRole('option', { name: '합격' }));
};

/* 확정할 수 있는 작성중 회차 — 수량이 맞고 종합 판정이 있다. */
const READY_ROUND = { ...ROUND, acceptedQty: 5, heldQty: 0, overallJudgmentCode: 'ACCEPTED' };

/* 목록 줄의 의뢰번호 단추로 상세를 연다(#135 — 목록과 상세가 나뉜 화면). */
const openRequest = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText(REQUEST.inspectionRequestNo));
  return within(await screen.findByRole('region', { name: t.detail.paneLabel }));
};

describe('PqcInspectionRegisterScreen (W-03-11)', () => {
  it('PQC 대기 의뢰를 묻는다', async () => {
    const { queueQueries } = renderScreen();

    expect(await screen.findByText(REQUEST.inspectionRequestNo)).toBeInTheDocument();
    expect(queueQueries[0]?.get('inspectionTypeCode')).toBe('PQC');
    expect(queueQueries[0]?.get('pendingOnly')).toBe('true');
  });

  it('조건 줄의 의뢰번호 검색을 목록 질의 q 로 싣고, 초기화하면 뺀다(#135)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    /* 품목 · 작업지시 · 의뢰번호는 「조건 더보기」에 접혀 있다(#225 · C-6). */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    await user.type(screen.getByRole('textbox', { name: t.filters.keyword }), 'IR-PQC');
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBe('IR-PQC'));

    await user.click(screen.getByRole('checkbox', { name: t.queue.pendingOnly }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('pendingOnly')).not.toBe('true'));

    await user.click(screen.getByRole('button', { name: t.filters.reset }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBeNull());
    /* 초기화는 처음 연 상태로 — 「대기·진행만 보기」도 다시 켠다(OQC 와 같다). */
    expect(queueQueries.at(-1)?.get('pendingOnly')).toBe('true');
    expect(screen.getByRole('checkbox', { name: t.queue.pendingOnly })).toBeChecked();
  });

  it('종합 판정을 건 채 「대기·진행만 보기」를 다시 켜면 판정을 푼다 — 판정은 확정 건에만 있다(#356)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);

    await user.click(
      screen.getByRole('combobox', { name: messages.common.inspectionHub.judgmentFilter }),
    );
    await user.click(await screen.findByRole('option', { name: '합격' }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('overallJudgmentCode')).toBe('ACCEPTED'));
    expect(queueQueries.at(-1)?.get('pendingOnly')).not.toBe('true');

    await user.click(screen.getByRole('checkbox', { name: t.queue.pendingOnly }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('pendingOnly')).toBe('true'));
    expect(queueQueries.at(-1)?.get('overallJudgmentCode')).toBeNull();
  });

  it('「대기」 칩을 건 채 종합 판정을 고르면 칩을 푼다 — 판정은 확정 건에만 있다(#356)', async () => {
    /* 칩은 탭 막대 자리에만 선다 — 시험에서 그 자리를 세운다. */
    const slot = document.createElement('div');
    slot.id = HUB_ACTIONS_ID;
    document.body.append(slot);
    try {
      const user = userEvent.setup();
      const { queueQueries } = renderScreen();
      await screen.findByText(REQUEST.inspectionRequestNo);
      /* 건수 칩의 조회(한 줄짜리)는 빼고 목록 조회만 본다. */
      const lastListQuery = () => queueQueries.filter((query) => query.get('size') !== '1').at(-1);
      const hub = messages.common.inspectionHub;

      await user.click(await screen.findByRole('button', { name: hub.filterOn(hub.requested) }));
      await waitFor(() => expect(lastListQuery()?.get('statusCode')).toBe('REQUESTED'));

      await user.click(screen.getByRole('combobox', { name: hub.judgmentFilter }));
      await user.click(await screen.findByRole('option', { name: '합격' }));
      await waitFor(() => expect(lastListQuery()?.get('overallJudgmentCode')).toBe('ACCEPTED'));
      expect(lastListQuery()?.get('statusCode')).toBeNull();
      expect(screen.getByRole('button', { name: hub.filterOn(hub.requested) })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } finally {
      slot.remove();
    }
  });

  it('「초기화」는 처음 연 상태에서는 없고, 바꾼 것이 생기면 나타난다(C-6)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();

    await user.type(screen.getByRole('textbox', { name: t.filters.keyword }), 'IR');

    expect(screen.getByRole('button', { name: t.filters.reset })).toBeInTheDocument();
  });

  it('접힌 칸에 걸린 조건은 칩으로 보이고, × 는 그 조건만 풀어 다시 조회한다(C-6)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });

    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: t.filters.keyword })).toBeNull();

    await user.click(more);
    await user.type(screen.getByRole('textbox', { name: t.filters.keyword }), 'IR-PQC');
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBe('IR-PQC'));

    /* 펼쳐 있으면 칸에 값이 보이므로 칩이 없다. */
    /* 칩 라벨은 대상 이름 — 칸 라벨의 「검색」은 싣지 않는다. */
    const chip = '의뢰번호: IR-PQC';
    expect(screen.queryByText(chip)).toBeNull();

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.close }));
    expect(screen.getByText(chip)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: messages.common.filterMore.remove('의뢰번호') }),
    );
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBeNull());
    expect(screen.queryByText(chip)).toBeNull();
  });

  it('LOT 스캔은 생산 LOT 의 작업지시로 대기 의뢰를 찾아 열고, 없으면 공정검사 문구를 낸다(#135)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    const scan = screen.getByRole('textbox', { name: messages.inspectionDocuments.scan.label });

    await user.type(scan, 'M-LOT-0799{Enter}');
    expect(await screen.findByText(t.filters.lotNoRequest)).toBeInTheDocument();

    await user.clear(scan);
    await user.type(scan, 'M-LOT-0701{Enter}');
    expect(await screen.findByRole('region', { name: t.detail.paneLabel })).toBeInTheDocument();
    const asked = queueQueries.filter((query) => query.has('workOrderId'));
    expect(asked.at(-1)?.get('workOrderId')).toBe('701');
    expect(asked.at(-1)?.has('lotId')).toBe(false);
  });

  it('작업지시 번호로 찾은 작업지시를 목록 질의 workOrderId 로 싣고, 못 찾거나 여럿이면 조회하지 않는다(#135)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    /* 품목 · 작업지시 · 의뢰번호는 「조건 더보기」에 접혀 있다(#225 · C-6). */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    const field = screen.getByRole('textbox', { name: t.filters.workOrder });
    const asked = (): number => queueQueries.length;

    await user.type(field, 'WO-9999');
    let before = asked();
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    expect(await screen.findByText(t.filters.workOrderNotFound)).toBeInTheDocument();
    expect(asked()).toBe(before);

    await user.clear(field);
    await user.type(field, '07');
    before = asked();
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    expect(await screen.findByText(t.filters.workOrderAmbiguous)).toBeInTheDocument();
    expect(asked()).toBe(before);

    await user.clear(field);
    await user.type(field, 'wo-20261016-0701');
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('workOrderId')).toBe('701'));
  });

  it('품목은 칸에서 바로 검색해 고르고, 「전체」를 고르면 품목 조건을 풀고 바로 다시 조회한다(#135 · #226)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);
    /* 품목 · 작업지시 · 의뢰번호는 「조건 더보기」에 접혀 있다(#225 · C-6). */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    await user.click(screen.getByLabelText(t.filters.item));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'F534F50200 · 합성 품목' }));
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('itemId')).toBe('101'));

    const before = queueQueries.length;
    await user.click(screen.getByLabelText(t.filters.item));
    await user.click(await screen.findByRole('option', { name: t.filters.all }));
    await waitFor(() => expect(queueQueries.length).toBeGreaterThan(before));
    expect(queueQueries.at(-1)?.get('itemId')).toBeNull();
  });

  it('목록은 내부 번호가 아니라 작업지시 번호·품목 이름·코드를 보인다(#135)', async () => {
    renderScreen();

    expect(await screen.findByText('WO-20261016-0701')).toBeInTheDocument();
    expect(await screen.findByText('합성 품목')).toBeInTheDocument();
    expect(screen.getByText('F534F50200')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t.columns.requestedAt })).toBeInTheDocument();
  });

  it('의뢰 일시 머리를 누르면 그 쪽 안에서 정렬하고, 정렬한 줄을 누르면 그 의뢰가 열린다(#135)', async () => {
    const user = userEvent.setup();
    const LATER = {
      ...REQUEST,
      inspectionRequestId: 7102,
      inspectionRequestNo: 'IR-PQC-7102',
      requestedAt: '2026-10-17T09:00:00+09:00',
    };
    renderScreen({ queueItems: [LATER, REQUEST] });

    const firstNo = async (): Promise<string | null> =>
      (await screen.findAllByRole('row'))[1]?.querySelector('td:nth-child(5)')?.textContent ?? null;
    await screen.findByText(LATER.inspectionRequestNo);
    expect(await firstNo()).toBe(LATER.inspectionRequestNo);

    await user.click(screen.getByRole('button', { name: t.columns.requestedAt }));
    await waitFor(async () => expect(await firstNo()).toBe(REQUEST.inspectionRequestNo));

    const [, firstRow] = screen.getAllByRole('row');
    await user.click(within(firstRow as HTMLElement).getByText('합성 품목'));
    const summary = await screen.findByRole('region', { name: web.summary.heading });
    await waitFor(() => expect(summary).toHaveTextContent(REQUEST.inspectionRequestNo));
  });

  it('#353 기본 생략으로 닫힌 의뢰는 생략 안내만 보이고, 수량·판정 입력과 [판정 확정]이 없다', async () => {
    const user = userEvent.setup();
    renderScreen({ skipped: true });
    const pane = await openRequest(user);

    expect(await pane.findByText(messages.partsIqcInspection.skipped.notice)).toBeInTheDocument();
    expect(pane.queryByRole('button', { name: web.actions.confirm })).toBeNull();
    expect(pane.queryByRole('button', { name: web.results.add })).toBeNull();
  });

  it('상세의 검사 기본 정보는 작업지시 번호·품목 이름·코드와 작업지시의 생산 LOT 을 보이고, 머리 제목은 「검사 기본 정보」(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openRequest(user);

    const summary = await screen.findByRole('region', { name: web.summary.heading });
    await waitFor(() => expect(summary).toHaveTextContent('WO-20261016-0701'));
    expect(summary).toHaveTextContent('합성 품목');
    expect(summary).toHaveTextContent('F534F50200');
    expect(summary).toHaveTextContent(web.summary.inspectionTypeName);
    /* 대상 LOT 은 작업지시의 생산 LOT — 폐번은 빼고, 여럿이면 첫 번호 「외 N건」(#135). */
    await waitFor(() =>
      expect(summary).toHaveTextContent(
        `${web.summary.lot}${web.summary.lotMore('M-LOT-0701', 1)}`,
      ),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: t.detail.sectionTitle }),
    ).toBeInTheDocument();
  });

  it('결과 창에 적던 것이 있으면 [취소] 때 한 번 묻고, 묻는 창 [취소]면 그대로, [닫기]면 닫는다(#356)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);

    /* 처음 그대로면 묻지 않고 닫는다. */
    await user.click(drawer.getByRole('button', { name: td.cancel }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: td.addTitle(1) })).not.toBeInTheDocument(),
    );

    const again = await openAddDrawer(user, pane);
    await user.type(again.getByRole('textbox', { name: web.quantity.rejected }), '1');
    await user.click(again.getByRole('button', { name: td.cancel }));
    expect(await screen.findByText(td.discardBody)).toBeInTheDocument();

    /* 묻는 창의 [취소] — 결과 창 바닥의 [취소]와 이름이 같아 묻는 창 안에서 찾는다. */
    const ask = screen.getByText(td.discardBody).closest('dialog') as HTMLElement;
    await user.click(within(ask).getByRole('button', { name: td.discardStay }));
    expect(again.getByRole('textbox', { name: web.quantity.rejected })).toHaveValue('1');

    await user.click(again.getByRole('button', { name: td.cancel }));
    await user.click(await screen.findByRole('button', { name: td.discardLeave }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: td.addTitle(1) })).not.toBeInTheDocument(),
    );
  });

  it('결과 창의 [되돌리기]는 한 번의 입력(수량과 그에 따른 자동 판정)을 한 칸으로 되돌리고, [다시 실행]으로 되살린다(#356)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);
    const rejected = drawer.getByRole('textbox', { name: web.quantity.rejected });

    await user.type(rejected, '1');
    expect(drawer.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('4');
    expect(drawer.getByRole('combobox', { name: web.judgmentBox })).toHaveTextContent('불합격');

    await user.click(drawer.getByRole('button', { name: messages.partsIqcInspection.footer.undo }));
    expect(rejected).toHaveValue('');
    expect(drawer.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('5');
    expect(drawer.getByRole('combobox', { name: web.judgmentBox })).not.toHaveTextContent('불합격');

    await user.click(drawer.getByRole('button', { name: messages.partsIqcInspection.footer.redo }));
    expect(rejected).toHaveValue('1');
    expect(drawer.getByRole('combobox', { name: web.judgmentBox })).toHaveTextContent('불합격');
  });

  it('결과 창의 검사 정보에 총 검사 수량을 보이고, 새 결과의 합격 수량은 총 검사 수량이다(#135 · #356)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);

    const info = drawer.getByRole('region', { name: web.drawer.infoBox });
    await waitFor(() => expect(info).toHaveTextContent(new RegExp(hub.qtyTotalOf('5(?: \\S+)?'))));
    expect(drawer.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('5');
  });

  it('작성중 회차가 있으면 결과 표에 그 회차가 서고, 추가는 잠기고 [수정]이 저장된 값으로 창을 연다(#356)', async () => {
    const user = userEvent.setup();
    renderScreen({ rounds: [ROUND] });
    const pane = await openRequest(user);

    const results = await pane.findByRole('region', { name: web.results.heading(1) });
    expect(within(results).getByText(web.results.round(1))).toBeInTheDocument();
    await waitFor(() => expect(pane.getByRole('button', { name: web.results.add })).toBeDisabled());

    const edit = within(results).getByRole('button', {
      name: `${web.results.round(1)} ${web.results.edit}`,
    });
    await waitFor(() => expect(edit).toBeEnabled());
    await user.click(edit);
    const drawer = within(await screen.findByRole('dialog', { name: td.editTitle(1) }));
    expect(drawer.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('3');
    expect(drawer.getByRole('textbox', { name: web.quantity.held })).toHaveValue('2');
  });

  it('불합격 처분은 판정이 「불합격」일 때만 보이고, 다른 판정으로 바꾸면 고른 처분을 거둔다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);
    const disposition = (): HTMLElement | null =>
      drawer.queryByRole('radio', { name: pqc.disposition.scrap });

    await user.type(drawer.getByRole('textbox', { name: web.quantity.rejected }), '2');
    /* 불합격이 있으면 종합 판정이 「불합격」으로 채워지고 처분 칸이 선다(#197). 처분은 아직 고르지 않았다. */
    expect(drawer.getByRole('combobox', { name: web.judgmentBox })).toHaveTextContent('불합격');
    expect(disposition()).not.toBeChecked();

    await user.click(await drawer.findByRole('radio', { name: pqc.disposition.scrap }));
    expect(disposition()).toBeChecked();

    await user.click(drawer.getByRole('combobox', { name: web.judgmentBox }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    expect(disposition()).toBeNull();

    await user.click(drawer.getByRole('combobox', { name: web.judgmentBox }));
    await user.click(await screen.findByRole('option', { name: '불합격' }));
    expect(await drawer.findByRole('radio', { name: pqc.disposition.scrap })).not.toBeChecked();
  });

  it('[제출]은 필수 칸이 차야 눌리고, 작성중(DRAFT)으로 바로 저장한다 — 사번 헤더를 싣지 않는다(#356)', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen();
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);

    /* 종합 판정이 비면 잠겨 있다(omf-all-around#356). */
    expect(drawer.getByRole('button', { name: td.save })).toBeDisabled();
    await fillRequired(user, drawer);
    await waitFor(() => expect(drawer.getByRole('button', { name: td.save })).toBeEnabled());
    await user.click(drawer.getByRole('button', { name: td.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    const [saved] = saves;
    expect(saved?.headers.get('X-Worker-No')).toBeNull();
    expect(saved?.headers.get('Idempotency-Key')).toBeTruthy();
    const body = (await saved?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      inspectionRequestId: 7101,
      inspectedQty: 5,
      acceptedQty: 5,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 1,
      statusCode: 'DRAFT',
      overallJudgmentCode: 'ACCEPTED',
    });
    expect(body.previousResultId).toBeUndefined();
    /* 창은 닫히고 IQC 와 같은 알림(#356). */
    expect(await screen.findByText(td.added)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('⭐ 제출은 서버 답을 받은 뒤에야 알림을 띄우고 창을 닫으며, 기다리는 동안 단추를 잠근다(리뷰 m5)', async () => {
    const user = userEvent.setup();
    const { saves, releaseSave } = renderScreen({ holdSave: true });
    const pane = await openRequest(user);
    const drawer = await openAddDrawer(user, pane);

    await fillRequired(user, drawer);
    await waitFor(() => expect(drawer.getByRole('button', { name: td.save })).toBeEnabled());
    await user.click(drawer.getByRole('button', { name: td.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(screen.queryByText(td.added)).not.toBeInTheDocument();
    expect(drawer.getByRole('button', { name: td.save })).toBeDisabled();
    expect(drawer.getByRole('button', { name: td.cancel })).toBeDisabled();

    releaseSave();
    expect(await screen.findByText(td.added)).toBeInTheDocument();
  });

  it('[수정] 뒤 제출은 같은 작성중 저장을 보내고 「N회차 검사 결과를 고쳤습니다.」를 알린다(#356)', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({ rounds: [READY_ROUND] });
    const pane = await openRequest(user);

    const edit = await pane.findByRole('button', {
      name: `${web.results.round(1)} ${web.results.edit}`,
    });
    await waitFor(() => expect(edit).toBeEnabled());
    await user.click(edit);
    const drawer = within(await screen.findByRole('dialog', { name: td.editTitle(1) }));
    await user.clear(drawer.getByRole('textbox', { name: web.quantity.held }));
    await user.type(drawer.getByRole('textbox', { name: web.quantity.held }), '1');
    await waitFor(() => expect(drawer.getByRole('button', { name: td.save })).toBeEnabled());
    await user.click(drawer.getByRole('button', { name: td.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    const body = (await saves[0]?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ statusCode: 'DRAFT', acceptedQty: 4, heldQty: 1 });
    expect(await screen.findByText(td.updated(1))).toBeInTheDocument();
  });

  it('[판정 확정]은 저장된 작성중 결과를 그대로 확정(CONFIRMED)으로 보내고, 서버에 닿으면 목록을 다시 묻는다(리뷰 m5 · #356)', async () => {
    const user = userEvent.setup();
    const { saves, queueQueries } = renderScreen({ rounds: [READY_ROUND] });
    const pane = await openRequest(user);

    const confirm = pane.getByRole('button', { name: web.actions.confirm });
    await waitFor(() => expect(confirm).toBeEnabled());
    const before = queueQueries.length;
    await user.click(confirm);
    /* PQC 는 작업지시 단위 전이 글을 쓴다 — OQC 의 LOT 상태 글이 아니다(리뷰 #1660). */
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(messages.judgmentConfirm.pqcLotState.release)).toBeInTheDocument();
    /* 확인 창에서 한 번 더 누른다(omf-all-around#286). */
    await user.click(dialog.getByRole('button', { name: messages.judgmentConfirm.confirm }));

    await waitFor(() => expect(saves).toHaveLength(1));
    const [saved] = saves;
    expect(saved?.headers.get('X-Worker-No')).toBeNull();
    const body = (await saved?.json()) as Record<string, unknown>;
    expect(body).toEqual({
      inspectionRequestId: 7101,
      inspectedQty: 5,
      acceptedQty: 5,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 1,
      inspectedAt: READY_ROUND.inspectedAt,
      statusCode: 'CONFIRMED',
      overallJudgmentCode: 'ACCEPTED',
    });
    await waitFor(() => expect(queueQueries.length).toBeGreaterThan(before));
  });

  it('작성중 결과가 없으면 [판정 확정]을 잠그고 결과를 먼저 추가하라고 말한다(#356)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);

    expect(await pane.findByText(web.results.needResult)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: web.actions.confirm })).toBeDisabled();
  });

  it('⛔ 저장된 회차를 못 읽으면 추가·확정을 잠그고 이유를 말한다(리뷰 M1)', async () => {
    const user = userEvent.setup();
    renderScreen({ roundsFail: true });
    const pane = await openRequest(user);

    expect(await pane.findByText(messages.httpError.description)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: web.results.add })).toBeDisabled();
    expect(pane.getByRole('button', { name: web.actions.confirm })).toBeDisabled();
  });

  it('⛔ 생산 실적이 없으면 이유를 말하고 결과 추가·확정을 잠근다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen({ noProduction: true });
    const pane = await openRequest(user);

    expect(await pane.findByText(web.noProductionResult)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: web.results.add })).toBeDisabled();
    expect(pane.getByRole('button', { name: web.actions.confirm })).toBeDisabled();
  });

  /* 목록 접기(#350) — 접힌 탭에 건수, 펼치면 고른 의뢰가 그대로(입력은 결과 창에서 한다 · #356). */
  it('목록을 접으면 「목록 N건」 탭이 서고, 펼쳐도 고른 의뢰가 그대로다(#350)', async () => {
    const storageKey = 'omf-mes:pqc-inspection-register:split:collapsed';
    window.localStorage.removeItem(storageKey);
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    await pane.findByRole('button', { name: web.results.add });
    const split = document.querySelector('.po-board-split');

    await user.click(screen.getAllByRole('button', { name: hub.listCollapse })[0]!);
    expect(split).toHaveAttribute('data-left-collapsed', 'true');
    const tab = split!.querySelector<HTMLElement>('.po-board-list-tab');
    expect(tab).toHaveTextContent('목록1건');

    await user.click(tab!);
    expect(split).not.toHaveAttribute('data-left-collapsed');
    expect(
      within(screen.getByRole('region', { name: t.queue.heading })).getByText(
        REQUEST.inspectionRequestNo,
      ),
    ).toHaveAttribute('aria-current', 'true');
    expect(pane.getByRole('button', { name: web.results.add })).toBeInTheDocument();
    window.localStorage.removeItem(storageKey);
  });
});
