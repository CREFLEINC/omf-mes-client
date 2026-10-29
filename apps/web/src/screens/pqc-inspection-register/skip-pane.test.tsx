import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { PqcSkipPane } from './skip-pane';

/** W-03-11 PQC 생략 구획(omf-all-around#212 · 서버 선행 P-152) — 요청 → 결재 → 실행. OQC 생략 구획과 같은 모양이다. */

const t = messages.pqcInspectionRegister.skip;

const approval = (statusCode: string) => ({
  approvalRequestId: 81,
  approvalRequestNo: 'AP-20261029-0001',
  approvalTypeCode: 'PQC_SKIP',
  requestedBy: 5,
  requestedByName: '검사자',
  requestedAt: '2026-10-29T01:00:00Z',
  statusCode,
  reason: '긴급 생산',
  target: {
    targetTypeCode: 'WORK_ORDER',
    targetId: 11,
    displayName: 'WORK_ORDER #11',
    openable: false,
  },
  currentStepNo: null,
  totalStepNo: 1,
});

const renderPane = (
  latest: string | null,
  requestStatusCode = 'REQUESTED',
  skipBasisCode: string | null = null,
) => {
  const writes: Request[] = [];
  const reads: URL[] = [];
  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/app/approval-requests') {
      reads.push(url);
      const items = latest === null ? [] : [approval(latest)];
      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    }
    if (url.pathname === '/production/work-orders/11:request-pqc-skip') {
      writes.push(request.clone());
      return jsonResponse({ approvalRequestId: 81 }, { status: 202 });
    }
    if (url.pathname === '/production/work-orders/11:skip-pqc') {
      writes.push(request.clone());
      return jsonResponse({ workOrderId: 11 });
    }
    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };
  renderWithProviders(
    <PqcSkipPane
      workOrderId={11}
      requestStatusCode={requestStatusCode}
      skipBasisCode={skipBasisCode}
    />,
    { fetch: stubFetch },
  );
  return { writes, reads };
};

describe('PQC 생략 구획', () => {
  it('자기 작업지시의 PQC_SKIP 결재를 찾는다', async () => {
    const { reads } = renderPane(null);
    await screen.findByRole('button', { name: t.openRequest });

    expect(reads[0]?.searchParams.get('approvalTypeCode')).toBe('PQC_SKIP');
    expect(reads[0]?.searchParams.get('targetTypeCode')).toBe('WORK_ORDER');
    expect(reads[0]?.searchParams.get('targetId')).toBe('11');
  });

  it('결재가 없으면 창에서 사유를 받아 생략을 요청한다 — 사유가 비면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane(null);
    await user.click(await screen.findByRole('button', { name: t.openRequest }));
    const button = screen.getByRole('button', { name: t.request });

    await user.click(button);
    expect(await screen.findByText(t.reasonRequired)).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.type(screen.getByLabelText(t.reason), '  긴급 생산  ');
    await user.click(button);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]!.url).pathname).toBe('/production/work-orders/11:request-pqc-skip');
    expect(await writes[0]!.json()).toEqual({ reason: '긴급 생산' });
    expect(await screen.findByText(t.requested)).toBeInTheDocument();
  });

  it('결재 대기면 요청 단추 없이 대기 안내만 선다', async () => {
    renderPane('PENDING');
    expect(await screen.findByText(t.pending)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.openRequest })).not.toBeInTheDocument();
  });

  it('승인되면 실행 단추가 서고 누르면 실행한다', async () => {
    const user = userEvent.setup();
    const { writes } = renderPane('APPROVED');
    await user.click(await screen.findByRole('button', { name: t.execute }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL(writes[0]!.url).pathname).toBe('/production/work-orders/11:skip-pqc');
    expect(await screen.findByText(t.executed)).toBeInTheDocument();
  });

  it('기본 생략으로 만들어진 의뢰는 결재 없이 「기본 설정」 생략이라고 말한다', async () => {
    const { reads } = renderPane(null, 'SKIPPED', 'DEFAULT');
    expect(await screen.findByText(t.skippedDefault)).toBeInTheDocument();
    expect(reads).toHaveLength(0);
  });

  it('결재 승인으로 생략된 의뢰는 그렇게 말한다', async () => {
    renderPane(null, 'SKIPPED', 'APPROVAL');
    expect(await screen.findByText(t.skipped)).toBeInTheDocument();
  });

  it('끝난(완료) 의뢰에는 구획을 세우지 않는다', () => {
    renderPane(null, 'COMPLETED');
    expect(screen.queryByRole('region', { name: t.heading })).not.toBeInTheDocument();
  });
});
