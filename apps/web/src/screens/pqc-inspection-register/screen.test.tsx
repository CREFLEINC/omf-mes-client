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
      return jsonResponse({ items: [REQUEST], page: { page: 1, size: 50, total: 1 } });
    }
    if (path === '/quality/inspection-requests/7101') return jsonResponse(REQUEST);
    if (path === '/production/work-orders/701') {
      return jsonResponse({ workOrderId: 701, workOrderNo: 'WO-20261016-0701', itemId: 101 });
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

const openRequest = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', {
      name: messages.oqcInspection.queue.openRow(REQUEST.inspectionRequestNo),
    }),
  );
  return within(screen.getByRole('region', { name: t.detail.paneLabel }));
};

describe('PqcInspectionRegisterScreen (W-03-11)', () => {
  it('PQC 대기 의뢰를 묻는다', async () => {
    const { queueQueries } = renderScreen();

    expect(await screen.findByText(REQUEST.inspectionRequestNo)).toBeInTheDocument();
    expect(queueQueries[0]?.get('inspectionTypeCode')).toBe('PQC');
    expect(queueQueries[0]?.get('pendingOnly')).toBe('true');
  });

  it('패널 머리줄은 내부 id 가 아니라 W/O 번호·품목 코드를 보인다 — LOT 이 없으면 「—」', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      await screen.findByRole('button', {
        name: messages.oqcInspection.queue.openRow(REQUEST.inspectionRequestNo),
      }),
    );

    const header = await screen.findByLabelText(pqc.detail.heading);
    await waitFor(() =>
      expect(header).toHaveTextContent(
        `${pqc.detail.fields.workOrderId} WO-20261016-0701 · ${pqc.detail.fields.itemId} F534F50200 · ${pqc.detail.fields.lotId} ${pqc.emptyValue}`,
      ),
    );
  });

  it('고른 의뢰를 판정해 바로 저장한다 — 사번 헤더를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen();

    await user.click(
      await screen.findByRole('button', {
        name: messages.oqcInspection.queue.openRow(REQUEST.inspectionRequestNo),
      }),
    );
    const pane = within(screen.getByRole('region', { name: t.detail.paneLabel }));

    await user.type(await pane.findByRole('textbox', { name: pqc.result.fields.accepted }), '5');
    await user.type(pane.getByRole('textbox', { name: pqc.result.fields.rejected }), '0');
    await user.type(pane.getByRole('textbox', { name: pqc.result.fields.held }), '0');
    await user.click(pane.getByRole('combobox', { name: pqc.result.judgment }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    await user.click(pane.getByRole('button', { name: pqc.result.confirm }));

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

    await user.type(await pane.findByRole('textbox', { name: pqc.result.fields.accepted }), '5');
    await waitFor(() => expect(pane.getByRole('button', { name: pqc.result.save })).toBeEnabled());
    await user.click(pane.getByRole('button', { name: pqc.result.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(pane.queryByText(pqc.result.saved)).not.toBeInTheDocument();
    expect(pane.getByRole('button', { name: pqc.result.save })).toBeDisabled();
    expect(pane.getByRole('button', { name: pqc.result.confirm })).toBeDisabled();

    releaseSave();
    expect(await pane.findByText(pqc.result.saved)).toBeInTheDocument();
  });

  it('확정이 서버에 닿으면 목록을 다시 묻는다(리뷰 m5)', async () => {
    const user = userEvent.setup();
    const { saves, queueQueries } = renderScreen();
    const pane = await openRequest(user);

    await user.type(await pane.findByRole('textbox', { name: pqc.result.fields.accepted }), '5');
    await user.type(pane.getByRole('textbox', { name: pqc.result.fields.rejected }), '0');
    await user.type(pane.getByRole('textbox', { name: pqc.result.fields.held }), '0');
    await user.click(pane.getByRole('combobox', { name: pqc.result.judgment }));
    await user.click(await screen.findByRole('option', { name: '합격' }));
    const before = queueQueries.length;
    await user.click(pane.getByRole('button', { name: pqc.result.confirm }));

    await waitFor(() => expect(saves).toHaveLength(1));
    await waitFor(() => expect(queueQueries.length).toBeGreaterThan(before));
  });

  it('⛔ 저장된 회차를 못 읽으면 저장·확정을 잠그고 이유를 말한다(리뷰 M1)', async () => {
    const user = userEvent.setup();
    renderScreen({ roundsFail: true });
    const pane = await openRequest(user);

    expect(await pane.findByText(messages.httpError.description)).toBeInTheDocument();
    expect(pane.getByRole('button', { name: pqc.result.save })).toBeDisabled();
    expect(pane.getByRole('button', { name: pqc.result.confirm })).toBeDisabled();
  });

  it('저장 뒤 재조회가 사람이 고친 칸을 되돌리지 않는다(리뷰 m1)', async () => {
    const user = userEvent.setup();
    let saved = false;
    renderScreen({
      rounds: () => (saved ? [{ ...ROUND, acceptedQty: 9, versionNo: 2 }] : [ROUND]),
    });
    const pane = await openRequest(user);

    const accepted = await pane.findByRole('textbox', { name: pqc.result.fields.accepted });
    await waitFor(() => expect(accepted).toHaveValue('3'));
    await user.clear(accepted);
    await user.type(accepted, '4');
    saved = true;
    await waitFor(() => expect(pane.getByRole('button', { name: pqc.result.save })).toBeEnabled());
    await user.click(pane.getByRole('button', { name: pqc.result.save }));

    expect(await pane.findByText(pqc.result.saved)).toBeInTheDocument();
    expect(pane.getByRole('textbox', { name: pqc.result.fields.accepted })).toHaveValue('4');
  });
});
