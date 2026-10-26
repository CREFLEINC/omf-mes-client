import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { SkipPane } from './skip-pane';

/** W-04-03 OQC 생략 구획(omf-all-around#119 · 서버 선행 P-83) — 요청 → 결재 → 실행. */

const t = messages.oqcInspection.skip;

const approval = (statusCode: string) => ({
  approvalRequestId: 61,
  approvalRequestNo: 'AP-20261020-0001',
  approvalTypeCode: 'OQC_SKIP',
  requestedBy: 5,
  requestedByName: '검사자',
  requestedAt: '2026-10-20T01:00:00Z',
  statusCode,
  reason: '고객 승인 출하',
  target: {
    targetTypeCode: 'SHIPMENT_REQUEST',
    targetId: 21,
    displayName: 'SHIPMENT_REQUEST #21',
    openable: false,
  },
  currentStepNo: null,
  totalStepNo: 1,
});

const renderPane = (latest: string | null, requestStatusCode = 'REQUESTED') => {
  const writes: Request[] = [];
  const reads: URL[] = [];
  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/app/approval-requests') {
      reads.push(url);
      const items = latest === null ? [] : [approval(latest)];
      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    }
    if (url.pathname === '/logistics/shipment-requests/21:request-oqc-skip') {
      writes.push(request.clone());
      return jsonResponse({ approvalRequestId: 61 }, { status: 202 });
    }
    if (url.pathname === '/logistics/shipment-requests/21:skip-oqc') {
      writes.push(request.clone());
      return jsonResponse({ shipmentRequestId: 21 });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };
  renderWithProviders(<SkipPane shipmentRequestId={21} requestStatusCode={requestStatusCode} />, {
    fetch: stubFetch,
  });
  return { writes, reads };
};

describe('OQC 생략 구획', () => {
  it('자기 출하작업지시의 OQC_SKIP 결재를 찾는다', async () => {
    const { reads } = renderPane(null);
    await screen.findByRole('button', { name: t.openRequest });

    expect(reads[0]?.searchParams.get('approvalTypeCode')).toBe('OQC_SKIP');
    expect(reads[0]?.searchParams.get('targetTypeCode')).toBe('SHIPMENT_REQUEST');
    expect(reads[0]?.searchParams.get('targetId')).toBe('21');
  });

  it('결재가 없으면 창에서 사유를 받아 생략을 요청한다 — 사유가 비면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane(null);
    await user.click(await screen.findByRole('button', { name: t.openRequest }));
    const button = screen.getByRole('button', { name: t.request });

    await user.click(button);
    expect(await screen.findByText(t.reasonRequired)).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.type(screen.getByLabelText(t.reason), '  고객 승인 출하  ');
    await user.click(button);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await writes[0]?.json()).toEqual({ reason: '고객 승인 출하' });
    expect(writes[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText(t.requested)).toBeInTheDocument();
  });

  it('결재 중이면 진행 중이라고만 말하고 요청·실행 단추를 두지 않는다', async () => {
    renderPane('PENDING');
    expect(await screen.findByText(t.pending)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.openApproval })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.openRequest })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.execute })).not.toBeInTheDocument();
  });

  it('승인되면 실행 단추가 서고, 누르면 생략을 실행한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane('APPROVED');
    await user.click(await screen.findByRole('button', { name: t.execute }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.url).toContain('/logistics/shipment-requests/21:skip-oqc');
    expect(await screen.findByText(t.executed)).toBeInTheDocument();
  });

  it('반려됐으면 반려를 알리고 다시 요청할 수 있다', async () => {
    renderPane('REJECTED');
    expect(await screen.findByText(t.rejected)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.openRequest })).toBeInTheDocument();
  });

  it('생략으로 닫힌 의뢰는 그 사실만 말하고 결재를 묻지 않는다', async () => {
    const { reads } = renderPane(null, 'SKIPPED');
    expect(await screen.findByText(t.skipped)).toBeInTheDocument();
    expect(reads).toHaveLength(0);
  });

  it('끝난 의뢰(완료)에는 구획을 세우지 않는다', () => {
    renderPane(null, 'COMPLETED');
    expect(screen.queryByRole('region', { name: t.heading })).not.toBeInTheDocument();
    expect(screen.queryByText(t.steps[0] ?? '')).not.toBeInTheDocument();
  });
});
