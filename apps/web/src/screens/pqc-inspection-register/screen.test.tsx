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

const renderScreen = () => {
  const saves: Request[] = [];
  const queueQueries: URLSearchParams[] = [];

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/quality/inspection-requests') {
      queueQueries.push(url.searchParams);
      return jsonResponse({ items: [REQUEST], page: { page: 1, size: 50, total: 1 } });
    }
    if (path === '/quality/inspection-requests/7101') return jsonResponse(REQUEST);
    if (path === '/mdm/code-values') {
      return jsonResponse({ items: JUDGMENTS, page: { page: 1, size: 200, total: 2 } });
    }
    if (path === '/mdm/uoms') {
      return jsonResponse({ items: [{ uomId: 1, uomCode: 'EA', uomName: '개' }] });
    }
    if (path === '/quality/inspection-results' && request.method === 'POST') {
      saves.push(request.clone());
      return jsonResponse({ inspectionResultId: 9101 }, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  renderWithProviders(<PqcInspectionRegisterScreen />, {
    route: '/quality/pqc-inspections',
    fetch: stubFetch,
  });

  return { saves, queueQueries };
};

describe('PqcInspectionRegisterScreen (W-03-11)', () => {
  it('PQC 대기 의뢰를 묻는다', async () => {
    const { queueQueries } = renderScreen();

    expect(await screen.findByText(REQUEST.inspectionRequestNo)).toBeInTheDocument();
    expect(queueQueries[0]?.get('inspectionTypeCode')).toBe('PQC');
    expect(queueQueries[0]?.get('pendingOnly')).toBe('true');
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
});
