import type { InboundLotSplitPreview, InboundLotSplitResult } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { InboundInspection } from './inbound-queries';
import { SplitLotsDialog } from './split-lots-dialog';

const t = messages.iqcInboundLot.split;

/* 지어낸 값 — 실제 품목 · 공급사 · LOT 번호가 아니다. */
const inspection = {
  inspectionRequestId: 501,
  inboundLotId: 77,
  inboundLotNo: 'IL-20990101-0009',
  inboundLotVersionNo: 4,
  lots: [
    {
      lotId: 1,
      lotNo: 'TST-9001|X|0001',
      lotQty: 1000,
      package: null,
      statusCode: 'INSPECTION_PENDING',
      goodsReceived: false,
    },
    {
      lotId: 2,
      lotNo: 'TST-9001|X|0002',
      lotQty: 1000,
      package: null,
      statusCode: 'INSPECTION_PENDING',
      goodsReceived: false,
    },
    {
      lotId: 3,
      lotNo: 'TST-9001|X|0003',
      lotQty: 500,
      package: { uomId: 9, uomCode: 'BAG', uomName: '봉지', count: 5, qtyPerPackage: 100 },
      statusCode: 'INSPECTION_PENDING',
      goodsReceived: false,
    },
  ],
  results: [
    { inspectionResultId: 11, seqNo: 1, overallJudgmentCode: 'ACCEPTED', matchedLotIds: [1, 3] },
    { inspectionResultId: 12, seqNo: 2, overallJudgmentCode: 'REJECTED', matchedLotIds: [3] },
    { inspectionResultId: 13, seqNo: 3, overallJudgmentCode: 'ACCEPTED', matchedLotIds: [] },
  ],
} as unknown as InboundInspection;

const preview: InboundLotSplitPreview = {
  movedLotCount: 1,
  movedQty: 500,
  remainingLotCount: 2,
  remainingQty: 2000,
  newInspectionInProgress: true,
  movedResults: [{ inspectionResultId: 12, seqNo: 2, overallJudgmentCode: 'REJECTED' }],
  unmatchedResults: [{ inspectionResultId: 11, seqNo: 1, removedLotIds: [3] }],
  keptResults: [{ inspectionResultId: 13, seqNo: 3 }],
  movedAllocations: [
    { purchaseOrderLineId: null, purchaseOrderNo: null, lineNo: null, qty: 200 },
    { purchaseOrderLineId: 40, purchaseOrderNo: 'PO-TEST-1', lineNo: 10, qty: 300 },
  ],
};

const splitResult = {
  inboundLot: { inboundLotId: 78, inboundLotNo: 'IL-20990101-0010' },
  inspectionRequestId: 502,
  movedLotIds: [3],
  movedResultIds: [12],
  movedAllocations: preview.movedAllocations,
} as unknown as InboundLotSplitResult;

interface Setup {
  previewBody?: InboundLotSplitPreview;
  splitResponse?: () => Response;
}

const setup = ({ previewBody = preview, splitResponse }: Setup = {}) => {
  const previewRequests: URL[] = [];
  const splitBodies: unknown[] = [];
  const onSplit = vi.fn();
  const onClose = vi.fn();
  const fetch = createStubFetch([
    {
      match: (request) => request.method === 'GET' && request.url.includes('/split-preview'),
      respond: (request) => {
        previewRequests.push(new URL(request.url));
        return jsonResponse(previewBody);
      },
    },
    {
      match: (request) => request.method === 'POST' && request.url.includes(':split-lots'),
      respond: async (request) => {
        splitBodies.push(await request.json());
        return splitResponse?.() ?? jsonResponse(splitResult, { status: 201 });
      },
    },
  ]);
  renderWithProviders(
    <SplitLotsDialog inspection={inspection} uomCode="EA" onClose={onClose} onSplit={onSplit} />,
    { fetch, session: null },
  );

  return { previewRequests, splitBodies, onSplit, onClose };
};

const lotBox = (tail: string) => screen.getByRole('checkbox', { name: new RegExp(`${tail}$`) });
const submitButton = () => screen.getByRole('button', { name: t.submit });

describe('W-01-01 자재 관리 LOT 분리 창 (T092 · T093)', () => {
  it('US7-1 자재 관리 LOT 를 고르면 그 LOT 로 미리 보기를 묻고, 고르기 전에는 [분리]가 사유와 함께 잠긴다', async () => {
    const user = userEvent.setup();
    const { previewRequests } = setup();

    expect(screen.getByText(new RegExp(t.introFollow))).toBeInTheDocument();
    expect(screen.queryByText(/P\/O 배분/)).toBeNull();
    /* 결과 칩 — 0003 은 결과 1 · 2 에 매칭돼 있다. */
    const lot3 = lotBox('0003').closest('li') as HTMLElement;
    expect(within(lot3).getByText(t.resultChip(1))).toBeInTheDocument();
    expect(within(lot3).getByText(t.resultChip(2))).toBeInTheDocument();
    expect(within(lot3).getByText('500 EA')).toBeInTheDocument();

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.noneSelected);
    expect(previewRequests).toHaveLength(0);

    await user.click(lotBox('0003'));

    await waitFor(() => expect(previewRequests).toHaveLength(1));
    expect(previewRequests[0]?.pathname).toBe('/logistics/inbound-lots/77/split-preview');
    expect(previewRequests[0]?.searchParams.getAll('lotIds')).toEqual(['3']);
    expect(submitButton()).toBeEnabled();
  });

  it('US7-4 전부 고르면 원래 입하 LOT 에 남아야 한다는 안내를 보이고 [분리]를 잠근다', async () => {
    const user = userEvent.setup();
    const { previewRequests } = setup();

    await user.click(lotBox('0001'));
    await user.click(lotBox('0002'));
    await user.click(lotBox('0003'));

    expect(screen.getByText(t.allSelected)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(t.allSelected);
    expect(screen.queryByRole('region', { name: t.preview })).toBeNull();
    /* 전부 고른 조합으로는 미리 보기를 묻지 않는다. */
    expect(previewRequests.every((url) => url.searchParams.getAll('lotIds').length < 3)).toBe(true);
  });

  it('US7-1 미리 보기 — 옮겨지는 결과 · 매칭만 빠지는 결과 · 그대로 남는 결과 · 옮겨지는 P/O 매칭(P/O 없음 포함)', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(lotBox('0003'));

    const region = await screen.findByRole('region', { name: t.preview });
    await within(region).findByText(t.newLot(1, '500 EA', true));
    expect(
      within(region).getByText(t.remaining('IL-20990101-0009', '2,500', '2,000 EA', 2)),
    ).toBeInTheDocument();

    const moved = within(region).getByText(t.movedResults).closest('li') as HTMLElement;
    expect(moved).toHaveTextContent(`${t.resultChip(2)} 불합격`);
    expect(moved).toHaveTextContent(t.renumber);

    const unmatched = within(region).getByText(t.unmatchedResults).closest('li') as HTMLElement;
    expect(unmatched).toHaveTextContent(`${t.resultChip(1)} — ${t.matchRemoved('0003')}`);

    const kept = within(region).getByText(new RegExp(t.keptResults)).closest('li') as HTMLElement;
    expect(kept).toHaveTextContent(`${t.resultChip(3)}${t.noMatch}`);

    const allocations = within(region).getByText(t.movedAllocations).closest('li') as HTMLElement;
    expect(allocations).toHaveTextContent(`${t.noPo} 200 ${t.toNewLot}`);
    expect(allocations).toHaveTextContent(`${t.poLine('PO-TEST-1', 10)} 300 ${t.toNewLot}`);
  });

  it('US7-1 빈 목록은 「없음」으로 보인다', async () => {
    const user = userEvent.setup();
    setup({
      previewBody: {
        ...preview,
        newInspectionInProgress: false,
        movedResults: [],
        unmatchedResults: [],
        movedAllocations: [],
      },
    });

    await user.click(lotBox('0002'));

    const region = await screen.findByRole('region', { name: t.preview });
    await within(region).findByText(t.newLot(1, '500 EA', false));
    expect(within(region).getAllByText(t.none)).toHaveLength(3);
  });

  it('US7-1 [분리]는 :split-lots 에 고른 LOT · 판 번호 · 사유를 보내고 결과를 넘긴다', async () => {
    const user = userEvent.setup();
    const { splitBodies, onSplit } = setup();

    await user.click(lotBox('0003'));
    await user.type(screen.getByLabelText(t.reason), '외관 찍힘');
    await user.click(submitButton());

    await waitFor(() => expect(onSplit).toHaveBeenCalledWith(splitResult));
    expect(splitBodies).toEqual([{ lotIds: [3], versionNo: 4, reason: '외관 찍힘' }]);
  });

  it('US7-1 사유를 비우면 본문에 사유를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { splitBodies, onSplit } = setup();

    await user.click(lotBox('0002'));
    await user.click(lotBox('0001'));
    await user.click(submitButton());

    await waitFor(() => expect(onSplit).toHaveBeenCalledTimes(1));
    expect(splitBodies).toEqual([{ lotIds: [1, 2], versionNo: 4 }]);
  });

  it('최종 마감된 입하 LOT 는 409 INBOUND_LOT_FINALIZED 를 창 안에 알린다', async () => {
    const user = userEvent.setup();
    const { onSplit } = setup({
      splitResponse: () =>
        jsonResponse(
          {
            errors: [{ scope: 'screen', code: 'INBOUND_LOT_FINALIZED', message: 'finalized' }],
          },
          { status: 409 },
        ),
    });

    await user.click(lotBox('0003'));
    await user.click(submitButton());

    expect(await screen.findByText(t.finalized)).toBeInTheDocument();
    expect(onSplit).not.toHaveBeenCalled();
  });

  it('판 충돌(409 VERSION_CONFLICT)은 다시 불러오라고 안내한다', async () => {
    const user = userEvent.setup();
    const { onSplit } = setup({
      splitResponse: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: 'conflict' },
          { status: 409 },
        ),
    });

    await user.click(lotBox('0003'));
    await user.click(submitButton());

    expect(await screen.findByText(t.conflict)).toBeInTheDocument();
    expect(onSplit).not.toHaveBeenCalled();
  });

  it('분리 문구 — 결과 알림과 버튼 잠김 까닭', () => {
    expect(t.done('IL-20990101-0010', 1)).toBe(
      'IL-20990101-0010 로 자재 관리 LOT 1개를 분리했습니다. 두 입하 LOT 를 각각 판정 확정하세요.',
    );
    expect(t.lockedConfirmed).toBe('판정 확정 뒤에는 분리할 수 없습니다');
    expect(t.lockedSingle).toBe('자재 관리 LOT 가 2개 이상이어야 합니다');
    expect(t.open).toBe('자재 관리 LOT 분리');
  });
});
