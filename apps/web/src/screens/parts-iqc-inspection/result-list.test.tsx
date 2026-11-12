import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InboundDetail } from './inbound-detail';
import type { InboundInspection } from './inbound-queries';

/**
 * 005 T066 — W-01-01 새 흐름 결과 목록(screens/W-01-01.md). 지어낸 값만 쓴다(공개 저장소 경계).
 * 결과 드로어의 양식은 지금 IQC 양식 그대로라 여기서는 자리표시로 대신한다(`result-drawer.test.tsx` 가 저장을 본다).
 */

const t = messages.iqcInboundLot;

const lot = (lotId: number, statusCode = 'INSPECTION_PENDING') => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: { uomId: 9, uomCode: 'BAG', uomName: '봉지', count: 10, qtyPerPackage: 100 },
  statusCode,
  goodsReceived: false,
});

const result = (seqNo: number, judgment: string | null, matchedLotIds: number[]) => ({
  inspectionResultId: 700 + seqNo,
  inspectionResultNo: `TST-IR-${String(seqNo)}`,
  seqNo,
  overallJudgmentCode: judgment,
  inspectedQty: 200,
  rejectedQty: judgment === 'REJECTED' ? 3 : 0,
  defectNames: judgment === 'REJECTED' ? ['합성 불량'] : [],
  matchedLotIds,
  inspectorName: '합성 검사자',
  inspectedAt: '2099-11-11T01:00:00Z',
  statusCode: 'DRAFT',
  versionNo: 2,
});

const inspection = (over: Partial<InboundInspection> = {}): InboundInspection =>
  ({
    inspectionRequestId: 501,
    inspectionRequestNo: 'TST-REQ-0501',
    inspectionTypeCode: 'IQC',
    targetTypeCode: 'INBOUND_LOT',
    targetId: 77,
    itemId: 31,
    targetQty: 3000,
    uomId: 1,
    statusCode: 'IN_PROGRESS',
    requestedAt: '2099-11-11T01:00:00Z',
    versionNo: 5,
    inboundLotId: 77,
    inboundLotNo: 'IL-20991111-0003',
    inboundLotVersionNo: 4,
    lotCount: 3,
    supplierName: '합성 공급사',
    receivedAt: '2099-11-11T01:40:00Z',
    receivedChannelCode: 'PDA',
    confirmedAt: null,
    overallJudgmentCode: null,
    previewJudgmentCode: 'REJECTED',
    lots: [lot(1), lot(2), lot(3)],
    poAllocations: [
      {
        purchaseOrderLineId: 1,
        purchaseOrderNo: 'TST-PO-1',
        lineNo: 10,
        orderDate: '2099-11-01',
        erpPurchaseOrderNo: null,
        qty: 2500,
      },
    ],
    unallocatedQty: 500,
    results: [result(1, 'ACCEPTED', [1, 2]), result(2, 'REJECTED', [2])],
    ...over,
  }) as InboundInspection;

const mount = (data: InboundInspection, events: unknown[] = []) => {
  const sent: { method: string; path: string; headers: Headers }[] = [];
  const fetch = createStubFetch([
    {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === '/quality/inspection-requests/501',
      respond: () => jsonResponse(data),
    },
    {
      match: (request) =>
        new URL(request.url).pathname === '/quality/inspection-requests/501/history',
      respond: () =>
        jsonResponse({
          inspectionRequestId: 501,
          inspectionRequestNo: 'TST-REQ-0501',
          inspectionTypeCode: 'IQC',
          source: { targetTypeCode: 'INBOUND_LOT', targetId: 77 },
          events: [],
          requestEvents: events,
        }),
    },
    {
      match: (request) => request.method === 'DELETE',
      respond: (request) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname,
          headers: request.headers,
        });
        return new Response(null, { status: 204 });
      },
    },
  ]);

  renderWithProviders(
    <SessionProvider>
      <InboundDetail
        inspectionRequestId={501}
        itemParts={{ code: 'TST-ITEM', name: '합성 자재' }}
        planText="AQL 1.0"
        uomCode="EA"
        renderForm={({ drawer }) => (
          <div>
            {drawer.matchField}
            <p>양식 자리</p>
          </div>
        )}
      />
    </SessionProvider>,
    {
      fetch,
      /* 결과 기록만 하는 계정(W-01-01) — 확정 바는 C4 의 confirm-bar.test.tsx 가 본다. */
      session: {
        userId: 8101,
        loginId: 'TST-LOGIN-01',
        userName: '합성 사용자',
        scopes: [{ businessUnitId: 8301 }],
        mustChangePassword: false,
        roles: [],
        permissions: ['W-01-01'],
      },
    },
  );

  return { sent };
};

describe('W-01-01 새 흐름 결과 목록', () => {
  it('US3-2 결과가 여러 건이면 순번 · 판정 · 매칭 LOT 끝 번호로 보이고, LOT 표에는 매칭된 결과 칩이 선다', async () => {
    mount(inspection());

    const results = await screen.findByRole('table', { name: t.results.heading(2) });
    const rows = within(results).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(t.results.seq(1));
    expect(rows[0]).toHaveTextContent('0001');
    expect(rows[0]).toHaveTextContent('0002');
    expect(rows[1]).toHaveTextContent('3 · 합성 불량');

    const lots = screen.getByRole('table', { name: t.detail.lotsHeading(3) });
    const lot2 = within(lots).getAllByRole('row')[2] as HTMLElement;
    expect(lot2).toHaveTextContent(t.detail.matchedChip(1));
    expect(lot2).toHaveTextContent(t.detail.matchedChip(2));
    expect(within(lots).getAllByRole('row')[3]).toHaveTextContent(t.detail.none);
    expect(screen.getByText(/TST-PO-1\/10 · 2,500 · P\/O 없음 500/u)).toBeInTheDocument();
  });

  it('US3-3 같은 자재 관리 LOT 를 두 결과에 매칭할 수 있다 — 드로어가 「결과 n에도 매칭됨」을 보인다', async () => {
    const user = userEvent.setup();
    mount(inspection());

    await user.click(await screen.findByRole('button', { name: t.results.add }));
    const drawer = await screen.findByRole('dialog', { name: t.drawer.addTitle(3) });

    expect(within(drawer).getByText(t.drawer.alsoMatched('1, 2'))).toBeInTheDocument();
    expect(within(drawer).getByRole('checkbox', { name: lot(2).lotNo })).not.toBeDisabled();
  });

  it('US3-5 종합 판정 미리 보기는 불합격 > 보류 > 합격이고, 자재 관리 LOT 상태는 검사 대기 그대로다', async () => {
    mount(inspection());

    expect(await screen.findByText(t.detail.banner.preview('불합격', 2))).toBeInTheDocument();
    expect(screen.getByText(t.detail.preview('불합격'))).toBeInTheDocument();
    const lots = screen.getByRole('table', { name: t.detail.lotsHeading(3) });
    expect(within(lots).getAllByText(t.detail.lotStatus.INSPECTION_PENDING)).toHaveLength(3);
  });

  it('결과가 없으면 「아직 결과가 없습니다」 안내와 「기록된 결과가 없습니다.」', async () => {
    mount(inspection({ results: [], previewJudgmentCode: null }));

    expect(await screen.findByText(t.detail.banner.empty)).toBeInTheDocument();
    expect(screen.getByText(t.results.empty)).toBeInTheDocument();
  });

  it('US3-6 확정 전 삭제 — 확인 창 뒤 DELETE(판 번호와 함께), 알림', async () => {
    const user = userEvent.setup();
    const { sent } = mount(inspection());

    await user.click(
      await screen.findByRole('button', { name: `${t.results.seq(2)} ${t.results.remove}` }),
    );
    const ask = await screen.findByRole('dialog', { name: t.results.deleteTitle(2) });
    expect(ask).toHaveTextContent(t.results.deleteBody);
    await user.click(within(ask).getByRole('button', { name: t.results.deleteConfirm }));

    expect(await screen.findByText(t.results.deleted(2))).toBeInTheDocument();
    expect(sent[0]?.path).toBe('/quality/inspection-results/702');
    expect(sent[0]?.headers.get('If-Match')).toBe('2');
  });

  it('US3-6 변경 이력 — 누가 · 언제 · 무엇을, 서버가 만든 내용 그대로', async () => {
    const user = userEvent.setup();
    mount(inspection(), [
      {
        occurredAt: '2099-11-11T02:00:00Z',
        eventCode: 'RESULT_UPDATED',
        actorName: '합성 검사자',
        detail: '결과 2 수정 — 합격 → 불합격',
      },
    ]);

    await user.click(await screen.findByRole('button', { name: t.history.open }));
    const history = await screen.findByRole('dialog', {
      name: t.history.title('IL-20991111-0003'),
    });

    expect(await within(history).findByText('결과 2 수정 — 합격 → 불합격')).toBeInTheDocument();
    expect(within(history).getByText(t.history.events.RESULT_UPDATED ?? '')).toBeInTheDocument();
    expect(within(history).getByText('2099-11-11 09:00')).toBeInTheDocument();
  });

  it('판정 확정 뒤에는 결과를 고치거나 지울 수 없고 「확정됨」, 분리 단추는 까닭과 함께 잠긴다', async () => {
    mount(
      inspection({
        confirmedAt: '2099-11-11T03:00:00Z',
        overallJudgmentCode: 'ACCEPTED',
        previewJudgmentCode: 'ACCEPTED',
        confirmedByName: '합성 확정자',
        results: [result(1, 'ACCEPTED', [1])],
      }),
    );

    expect(await screen.findByText(t.results.lockedHead)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.results.add })).toBeNull();
    expect(screen.getByText(t.results.lockedRow)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.split.open })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.split.open })).toHaveAccessibleDescription(
      t.split.lockedConfirmed,
    );
    expect(screen.getByText(t.detail.lockedConfirmed)).toBeInTheDocument();
  });

  it('자재 관리 LOT 가 하나면 분리 단추가 잠긴다', async () => {
    mount(inspection({ lots: [lot(1)], results: [] }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.split.open })).toHaveAccessibleDescription(
        t.split.lockedSingle,
      ),
    );
  });
});
