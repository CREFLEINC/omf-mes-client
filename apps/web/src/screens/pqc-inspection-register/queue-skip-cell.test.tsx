import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PqcQueueSkipCell } from './queue-skip-cell';

const q = messages.iqcInspection.queue;
const t = messages.pqcInspectionRegister.skip;

const render = (approvals: object[], rounds: object[] = []) => {
  const writes: Request[] = [];
  renderWithProviders(<PqcQueueSkipCell inspectionRequestId={7} workOrderId={11} />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/approval-requests',
        respond: () =>
          jsonResponse({ items: approvals, page: { page: 1, size: 20, total: approvals.length } }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
        respond: () =>
          jsonResponse({ items: rounds, page: { page: 1, size: 100, total: rounds.length } }),
      },
      {
        match: (request) => request.method === 'POST',
        respond: (request) => {
          writes.push(request);
          return jsonResponse({});
        },
      },
    ]),
  });
  return { writes };
};

describe('PqcQueueSkipCell', () => {
  it('결재가 없으면 생략 요청 — 작업지시 단위로 사유와 함께 보낸다', async () => {
    const { writes } = render([]);

    await userEvent.click(await screen.findByRole('button', { name: q.skipRequest }));
    await userEvent.type(screen.getByLabelText(new RegExp(t.reason)), '사유');
    await userEvent.click(screen.getByRole('button', { name: t.request }));

    await screen.findByText(t.requested);
    expect(new URL((writes[0] as Request).url).pathname).toBe(
      '/production/work-orders/11:request-pqc-skip',
    );
  });

  it('결재 중이면 승인 처리, 승인되면 생략 실행', async () => {
    render([{ approvalRequestId: 1, statusCode: 'APPROVED' }]);

    expect(await screen.findByRole('button', { name: q.skipExecute })).toBeInTheDocument();
  });

  it('확정 회차가 있으면 단추를 두지 않는다', async () => {
    render([], [{ statusCode: 'CONFIRMED', inspectionRound: 1 }]);

    expect(await screen.findByText(q.emptyValue)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
