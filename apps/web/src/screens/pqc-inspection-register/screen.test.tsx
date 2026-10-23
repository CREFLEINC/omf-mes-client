import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
  /** 그 의뢰의 회차 목록. 함수면 부를 때마다 다시 정한다(저장 뒤 재조회). */
  rounds?: object[] | (() => object[]);
  roundsFail?: boolean;
  /** 저장 응답을 손으로 풀 때까지 붙든다. */
  holdSave?: boolean;
  /** 목록 응답 줄. 없으면 의뢰 하나. */
  queueItems?: object[];
}

const renderScreen = (options: RenderOptions = {}) => {
  const saves: Request[] = [];
  const queueQueries: URLSearchParams[] = [];
  let releaseSave: () => void = () => undefined;

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/quality/inspection-requests') {
      queueQueries.push(url.searchParams);
      const items = options.queueItems ?? [REQUEST];
      return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
    }
    if (path === '/quality/inspection-requests/7101') return jsonResponse(REQUEST);
    if (path === '/production/work-orders/701') {
      return jsonResponse({ workOrderId: 701, workOrderNo: 'WO-20261016-0701', itemId: 101 });
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

  renderWithProviders(<PqcInspectionRegisterScreen />, {
    route: '/quality/pqc-inspections',
    fetch: stubFetch,
  });

  return { saves, queueQueries, releaseSave: () => releaseSave() };
};

const web = t.web;

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

    await user.type(screen.getByRole('textbox', { name: t.filters.keyword }), 'IR-PQC');
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBe('IR-PQC'));

    await user.click(screen.getByRole('button', { name: t.filters.reset }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('q')).toBeNull());
  });

  it('품목 검색의 × 를 누르면 품목 조건을 풀고 바로 다시 조회한다(#135)', async () => {
    const user = userEvent.setup();
    const { queueQueries } = renderScreen();
    await screen.findByText(REQUEST.inspectionRequestNo);

    await user.click(screen.getByLabelText(t.filters.item));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'F534F50200' }));
    await user.click(within(dialog).getByRole('button', { name: t.filters.itemPick }));
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    await waitFor(() => expect(queueQueries.at(-1)?.get('itemId')).toBe('101'));

    const before = queueQueries.length;
    await user.click(screen.getByRole('button', { name: t.filters.itemClear }));
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
      (await screen.findAllByRole('row'))[1]?.querySelector('td')?.textContent ?? null;
    await screen.findByText(LATER.inspectionRequestNo);
    expect(await firstNo()).toBe(LATER.inspectionRequestNo);

    await user.click(screen.getByRole('button', { name: t.columns.requestedAt }));
    await waitFor(async () => expect(await firstNo()).toBe(REQUEST.inspectionRequestNo));

    const [, firstRow] = screen.getAllByRole('row');
    await user.click(within(firstRow as HTMLElement).getByText('합성 품목'));
    const summary = await screen.findByRole('region', { name: web.summary.heading });
    await waitFor(() => expect(summary).toHaveTextContent(REQUEST.inspectionRequestNo));
  });

  it('상세의 검사 기본 정보는 작업지시 번호·품목 이름·코드를 보이고, LOT 이 없으면 「—」(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await openRequest(user);

    const summary = await screen.findByRole('region', { name: web.summary.heading });
    await waitFor(() => expect(summary).toHaveTextContent('WO-20261016-0701'));
    expect(summary).toHaveTextContent('합성 품목');
    expect(summary).toHaveTextContent('F534F50200');
    expect(summary).toHaveTextContent(web.summary.inspectionTypeName);
    expect(summary).toHaveTextContent(`${web.summary.lot}${pqc.emptyValue}`);
  });

  it('목록으로 돌아갈 때 저장하지 않은 입력이 있으면 한 번 묻는다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);

    await user.type(await pane.findByRole('textbox', { name: web.quantity.accepted }), '1');
    await user.click(screen.getByRole('button', { name: t.detail.backToList }));
    expect(await screen.findByText(t.detail.leaveUnsaved)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.detail.keepEditing }));
    expect(pane.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('1');

    await user.click(screen.getByRole('button', { name: t.detail.backToList }));
    await user.click(await screen.findByRole('button', { name: t.detail.leaveAnyway }));
    expect(await screen.findByText(REQUEST.inspectionRequestNo)).toBeInTheDocument();
  });

  it('검사 수량 입력 제목 줄에 총 검사 수량을 보인다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);

    const quantity = await pane.findByRole('region', { name: web.quantity.heading });
    await waitFor(() => expect(quantity).toHaveTextContent(`${web.quantity.targetQty}5`));
  });

  it('작성중 회차가 있으면 검사 수량 입력 제목 줄에 회차를 보인다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen({ rounds: [ROUND] });
    const pane = await openRequest(user);

    const quantity = await pane.findByRole('region', { name: web.quantity.heading });
    await waitFor(() => expect(quantity).toHaveTextContent(web.quantity.round(1)));
  });

  it('불합격 처분은 판정이 「불합격」일 때만 보이고, 다른 판정으로 바꾸면 고른 처분을 거둔다(#135)', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRequest(user);
    const disposition = (): HTMLElement | null =>
      pane.queryByRole('radio', { name: pqc.disposition.scrap });

    await user.type(await pane.findByRole('textbox', { name: web.quantity.rejected }), '2');
    expect(disposition()).toBeNull();

    await user.click(pane.getByRole('combobox', { name: web.judgment.label }));
    await user.click(await screen.findByRole('option', { name: '불합격' }));
    await user.click(await pane.findByRole('radio', { name: pqc.disposition.scrap }));
    expect(disposition()).toBeChecked();

    await user.click(pane.getByRole('combobox', { name: web.judgment.label }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    expect(disposition()).toBeNull();

    await user.click(pane.getByRole('combobox', { name: web.judgment.label }));
    await user.click(await screen.findByRole('option', { name: '불합격' }));
    expect(await pane.findByRole('radio', { name: pqc.disposition.scrap })).not.toBeChecked();
  });

  it('고른 의뢰를 판정해 바로 저장한다 — 사번 헤더를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen();

    const pane = await openRequest(user);

    await user.type(await pane.findByRole('textbox', { name: web.quantity.accepted }), '5');
    await user.type(pane.getByRole('textbox', { name: web.quantity.rejected }), '0');
    await user.type(pane.getByRole('textbox', { name: web.quantity.held }), '0');
    await user.click(pane.getByRole('combobox', { name: web.judgment.label }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    await user.click(pane.getByRole('button', { name: web.actions.confirm }));

    await waitFor(() => expect(saves).toHaveLength(1));
    const [saved] = saves;
    expect(saved?.headers.get('X-Worker-No')).toBeNull();
    expect(saved?.headers.get('Idempotency-Key')).toBeTruthy();
    const body = (await saved?.json()) as { statusCode: string; overallJudgmentCode?: string };
    expect(body.statusCode).toBe('CONFIRMED');
    expect(body.overallJudgmentCode).toBe('ACCEPTED');
  });

  it('⭐ 저장은 서버 답을 받은 뒤에야 「저장했습니다」를 보이고, 기다리는 동안 두 단추를 잠근다(리뷰 m5)', async () => {
    const user = userEvent.setup();
    const { saves, releaseSave } = renderScreen({ holdSave: true });
    const pane = await openRequest(user);

    await user.type(await pane.findByRole('textbox', { name: web.quantity.accepted }), '5');
    await waitFor(() => expect(pane.getByRole('button', { name: pqc.result.save })).toBeEnabled());
    await user.click(pane.getByRole('button', { name: pqc.result.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(pane.queryByText(pqc.result.saved)).not.toBeInTheDocument();
    expect(pane.getByRole('button', { name: pqc.result.save })).toBeDisabled();
    expect(pane.getByRole('button', { name: web.actions.confirm })).toBeDisabled();

    releaseSave();
    expect(await pane.findByText(pqc.result.saved)).toBeInTheDocument();
  });

  it('확정이 서버에 닿으면 목록을 다시 묻는다(리뷰 m5)', async () => {
    const user = userEvent.setup();
    const { saves, queueQueries } = renderScreen();
    const pane = await openRequest(user);

    await user.type(await pane.findByRole('textbox', { name: web.quantity.accepted }), '5');
    await user.type(pane.getByRole('textbox', { name: web.quantity.rejected }), '0');
    await user.type(pane.getByRole('textbox', { name: web.quantity.held }), '0');
    await user.click(pane.getByRole('combobox', { name: web.judgment.label }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    const before = queueQueries.length;
    await user.click(pane.getByRole('button', { name: web.actions.confirm }));

    await waitFor(() => expect(saves).toHaveLength(1));
    await waitFor(() => expect(queueQueries.length).toBeGreaterThan(before));
  });

  it('⛔ 저장된 회차를 못 읽으면 저장·확정을 잠그고 이유를 말한다(리뷰 M1)', async () => {
    const user = userEvent.setup();
    renderScreen({ roundsFail: true });
    const pane = await openRequest(user);

    expect(await pane.findByText(messages.httpError.description)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: pqc.result.save })).toBeDisabled();
    expect(pane.getByRole('button', { name: web.actions.confirm })).toBeDisabled();
  });

  it('저장 뒤 재조회가 사람이 고친 칸을 되돌리지 않는다(리뷰 m1)', async () => {
    const user = userEvent.setup();
    let saved = false;
    renderScreen({
      rounds: () => (saved ? [{ ...ROUND, acceptedQty: 9, versionNo: 2 }] : [ROUND]),
    });
    const pane = await openRequest(user);

    const accepted = await pane.findByRole('textbox', { name: web.quantity.accepted });
    await waitFor(() => expect(accepted).toHaveValue('3'));
    await user.clear(accepted);
    await user.type(accepted, '4');
    saved = true;
    await waitFor(() => expect(pane.getByRole('button', { name: pqc.result.save })).toBeEnabled());
    await user.click(pane.getByRole('button', { name: pqc.result.save }));

    expect(await pane.findByText(pqc.result.saved)).toBeInTheDocument();
    expect(pane.getByRole('textbox', { name: web.quantity.accepted })).toHaveValue('4');
  });
});
