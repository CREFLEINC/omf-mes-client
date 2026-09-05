import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { WorkOrderResultCorrectionWorkspace } from './result-correction-workspace';

const t = messages.workOrderClose.correction;
const WORK_ORDER_ID = 705;
const RESULT_ID = 901;

const productionResult = {
  productionResultId: RESULT_ID,
  productionResultNo: 'SYN-RESULT-901',
  workOrderId: WORK_ORDER_ID,
  resultSequence: 3,
  goodQty: 90,
  defectQty: 10,
  holdQty: 0,
  scrapQty: 0,
  reworkQty: 0,
  uomId: 801,
  resultSourceCode: 'MANUAL',
  occurredAt: '2026-08-31T14:20:00+09:00',
  workerId: 2001,
  statusCode: 'RECORDED',
};

interface RecordedWrite {
  pathname: string;
  headers: Headers;
  body: unknown;
}

const routes = (correctResponse: () => Response, writes: RecordedWrite[]): StubRoute[] => [
  {
    match: (request) =>
      request.method === 'GET' &&
      new URL(request.url).pathname === '/production/production-results',
    respond: (request) => {
      const query = new URL(request.url).searchParams;
      expect(Object.fromEntries(query)).toEqual({
        workOrderId: String(WORK_ORDER_ID),
        page: '1',
        size: '200',
      });
      return jsonResponse({
        items: [productionResult],
        page: { page: 1, size: 200, total: 1 },
      });
    },
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/workers',
    respond: () =>
      jsonResponse({
        items: [
          {
            workerId: 2001,
            workerNo: 'SYN-2001',
            workerName: '합성 작업자',
            businessUnitId: 1,
            plantId: 1,
            statusCode: 'ACTIVE',
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 1 },
      }),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/code-values',
    respond: (request) => {
      expect(new URL(request.url).searchParams.get('codeGroupCode')).toBe(
        'PRODUCTION_RESULT_CORRECT_REASON',
      );
      return jsonResponse({
        items: [
          {
            codeValueId: 1,
            codeGroupId: 2,
            code: 'RECOUNT',
            codeName: '재집계',
            displayOrder: 1,
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 1 },
      });
    },
  },
  {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname ===
        `/production/production-results/${String(RESULT_ID)}:correct`,
    respond: (request) => {
      writes.push({
        pathname: new URL(request.url).pathname,
        headers: request.headers,
        body: undefined,
      });
      return correctResponse();
    },
  },
  {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname ===
        `/production/production-results/${String(RESULT_ID)}:request-approval`,
    respond: (request) => {
      writes.push({
        pathname: new URL(request.url).pathname,
        headers: request.headers,
        body: undefined,
      });
      return jsonResponse({ approvalRequestId: 3001, requestNo: 'SYN-APR-3001' }, { status: 202 });
    },
  },
];

const renderWorkspace = (correctResponse: () => Response, writes: RecordedWrite[]) => {
  const stubRoutes = routes(correctResponse, writes).map((route) => ({
    ...route,
    respond: (request: Request) => {
      const response = route.respond(request);
      const recorded = writes.at(-1);
      if (request.method === 'POST' && recorded !== undefined && recorded.body === undefined) {
        void request
          .clone()
          .json()
          .then((body: unknown) => {
            recorded.body = body;
          });
      }
      return response;
    },
  }));

  return renderWithProviders(
    <WorkOrderResultCorrectionWorkspace workOrderId={WORK_ORDER_ID} workOrderNo="SYN-WO-705" />,
    { fetch: createStubFetch(stubRoutes) },
  );
};

const openCorrection = async () => {
  const user = userEvent.setup();
  await screen.findByRole('button', { name: t.actions.select(3) });
  await user.click(screen.getByRole('button', { name: t.actions.select(3) }));
  await user.click(screen.getByRole('button', { name: t.actions.correct }));
  await user.click(screen.getByRole('combobox', { name: t.fields.reason }));
  await user.click(screen.getByRole('option', { name: '재집계' }));
  return user;
};

describe('마감 후 생산실적 정정', () => {
  it('201이면 등급과 작업자 헤더 없이 정정 실적을 추가한다', async () => {
    const writes: RecordedWrite[] = [];
    renderWorkspace(() => jsonResponse(productionResult, { status: 201 }), writes);
    const user = await openCorrection();
    const goodQty = screen.getByLabelText(`${t.fields.goodQty} (90)`);
    await user.clear(goodQty);
    await user.type(goodQty, '80');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(writes[0]?.body).toEqual({ reasonCode: 'RECOUNT', goodQty: 80 }));
    expect(writes[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(writes[0]?.headers.get('If-Match')).toBeNull();
    expect(writes[0]?.headers.get('X-Worker-No')).toBeNull();
    expect(writes[0]?.body).not.toHaveProperty('grade');
  });

  it('화면 단위 400 뒤에만 승인 사유를 받아 별도 상신한다', async () => {
    const writes: RecordedWrite[] = [];
    renderWorkspace(
      () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'APPROVAL_REQUIRED',
                message: '승인이 필요합니다.',
              },
            ],
          },
          { status: 400 },
        ),
      writes,
    );
    const user = await openCorrection();
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    await screen.findByRole('dialog', { name: t.approval.title });
    await user.type(screen.getByLabelText(t.approval.reason), '수량 재집계 승인 요청');
    await user.click(screen.getByRole('button', { name: t.actions.requestApproval }));

    await waitFor(() => expect(writes).toHaveLength(2));
    await waitFor(() => expect(writes[1]?.body).toEqual({ reason: '수량 재집계 승인 요청' }));
    expect(writes[1]?.pathname).toContain(':request-approval');
    expect(writes[1]?.headers.get('If-Match')).toBeNull();
    expect(writes[1]?.headers.get('X-Worker-No')).toBeNull();
    expect(writes[1]?.body).not.toHaveProperty('approvalTypeCode');
    expect(writes[1]?.body).not.toHaveProperty('grade');
  });
});
