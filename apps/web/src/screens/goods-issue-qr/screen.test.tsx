import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { GoodsIssueQrScreen } from './screen';

const t = messages.goodsIssueQr;

/** 전표와 사번을 갖춘 정상 진입. 값은 지어낸 것이다. */
const ENTRY_ROUTE = '/pop/goods-issue-qr?goodsIssueId=900&workerNo=3391';

const pathOf = (request: Request): string => new URL(request.url).pathname;

/*
 * ⚠ `lineNo` 를 `goodsIssueLineId` 와 «다른 값»으로 둔다. 같게 두면 발행 요약을 어느 키로
 * 잇는지 뒤바꿔도 테스트가 통과한다 — 실 데이터에서는 둘이 전혀 다른 값이다.
 */
const line = (goodsIssueLineId: number, lotId: number, lineNo: number) => ({
  goodsIssueLineId,
  goodsIssueId: 900,
  lineNo,
  itemId: 10,
  lotId,
  issueQty: 500,
  uomId: 30,
  sourceLocationId: 40,
});

const LINES = [line(1001, 20, 1), line(1002, 21, 2)];

const issuedRecord = (documentIssueLogId: number, targetId: number, issueSeq: number) => ({
  documentIssueLogId,
<<<<<<< HEAD
  documentTypeCode: 'GOODS_ISSUE_QR',
=======
  documentTypeCode: 'ISSUE_QR',
>>>>>>> origin/feat/140-pop-shipment-qr-issue
  target: { targetTypeCode: 'GOODS_ISSUE_LINE', targetId },
  issueSeq,
  issuedBy: 1,
  issuedByName: '샘플 작업자',
  issuedAt: '2026-09-02T01:00:00Z',
  printOutcome: 'PENDING',
});

interface Options {
  /** 라인별 발행 횟수. 없는 라인은 요약에서 빠진다(「모른다」). */
  issueCounts?: Record<number, number>;
  /** 프린터 목록. 기본은 0건 */
  printers?: unknown[];
  reasons?: { code: string; codeName: string; displayOrder: number; isActive: boolean }[];
  writes?: Request[];
  issueStatus?: number;
  /** 인쇄 결과 보고 요청을 담아 둔다 */
  reports?: Request[];
  /** 서버가 그린 것을 못 주는 경우 */
  renditionFails?: boolean;
  /** 인쇄 결과 보고가 거부되는 경우 */
  reportFails?: boolean;
  /** 발행 요약 조회 요청을 담아 둔다 — 질의 축을 검사한다 */
  summaryRequests?: Request[];
<<<<<<< HEAD
  /** 프린터 조회 요청을 담아 둔다 — 출력물 종류로 거르는지 검사한다 */
  printerRequests?: Request[];
=======
>>>>>>> origin/feat/140-pop-shipment-qr-issue
  /** 라인 0건 */
  noLines?: boolean;
  /** 라인 조회가 실패하는 경우 */
  linesFail?: boolean;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/logistics/goods-issues/900',
    respond: () =>
      jsonResponse({
        goodsIssue: {
          goodsIssueId: 900,
          goodsIssueNo: 'GI-SAMPLE-0042',
          issueTypeCode: 'NORMAL',
          sourceDocumentTypeCode: 'PICKING',
          sourceDocumentId: 1,
          sourceWarehouseId: 1,
          issuedAt: '2026-09-02T00:00:00Z',
          statusCode: 'POSTED',
        },
        lines: LINES,
      }),
  },
  {
    match: (request) => pathOf(request) === '/logistics/goods-issues/900/lines',
    respond: () =>
      options.linesFail === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({ items: options.noLines === true ? [] : LINES }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/summary',
    respond: (request) => {
      options.summaryRequests?.push(request.clone());

      const counts = options.issueCounts ?? {};

      return jsonResponse({
        items: Object.entries(counts).map(([targetId, issueCount]) => ({
          targetTypeCode: 'GOODS_ISSUE_LINE',
          targetId: Number(targetId),
          issueCount,
        })),
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
<<<<<<< HEAD
    respond: (request) => {
      options.printerRequests?.push(request.clone());

      return jsonResponse({ items: options.printers ?? [] });
    },
=======
    respond: () => jsonResponse({ items: options.printers ?? [] }),
>>>>>>> origin/feat/140-pop-shipment-qr-issue
  },
  {
    match: (request) => pathOf(request) === '/mdm/items',
    respond: () =>
      jsonResponse({
        items: [{ itemId: 10, itemCode: 'ITEM-0001', itemName: '샘플 품목', isActive: true }],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: 30, uomCode: 'EA', uomName: '개', isActive: true }],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request).startsWith('/trace/lots/'),
    respond: (request) => {
      const lotId = Number(pathOf(request).split('/').pop());

      return jsonResponse({
        lot: {
          lotId,
          lotNo: `LOT-SAMPLE-${String(lotId)}`,
          itemId: 10,
          lotTypeCode: 'NEW',
          plantId: 1,
          initialQty: 500,
          uomId: 30,
          statusCode: 'AVAILABLE',
          lifecycleStatusCode: 'ACTIVE',
        },
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: (
          options.reasons ?? [
            { code: 'PRINT_FAILURE', codeName: '인쇄 실패', displayOrder: 1, isActive: true },
          ]
        ).map((reason) => ({ codeValueId: 1, codeGroupId: 1, ...reason })),
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/44001/rendition',
    respond: () =>
      options.renditionFails === true
        ? jsonResponse({ message: '없다' }, { status: 404 })
        : new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/44001:report-print',
    respond: (request) => {
      options.reports?.push(request.clone());

      return options.reportFails === true
        ? jsonResponse({ message: '보고 거부' }, { status: 500 })
        : jsonResponse(issuedRecord(44001, 1001, 1));
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.writes?.push(request.clone());

      if (options.issueStatus !== undefined && options.issueStatus !== 201) {
        return jsonResponse({ message: '거부' }, { status: options.issueStatus });
      }

      return jsonResponse(
        { items: [issuedRecord(44001, 1001, 1)], issuedCount: 1 },
        { status: 201 },
      );
    },
  },
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<GoodsIssueQrScreen />, {
    fetch: createStubFetch(routes(options)),
    route: ENTRY_ROUTE,
  });

const rowFor = (lotNo: string): HTMLElement => {
  const cell = screen.getByText(lotNo);
  const row = cell.closest('tr');

  if (row === null) throw new Error(`행을 찾지 못했습니다: ${lotNo}`);

  return row;
};

/**
 * 셸(Electron)의 인쇄 통로를 흉내 낸다. jsdom 에는 이 통로가 없으므로, 통로가 있는 경우와
 * 없는 경우를 **다른 상태로** 검사한다 — 없는 것을 실패로 접으면 두 상황이 한 문구로 뭉친다.
 */
const installPrintBridge = (save: (bytes: Uint8Array) => Promise<string>): void => {
  (globalThis as { pop?: unknown }).pop = { rendition: { save } };
};

afterEach(() => {
  delete (globalThis as { pop?: unknown }).pop;
});

describe('GoodsIssueQrScreen', () => {
  it('전표 라인을 품목·LOT·수량과 함께 세우고 발행 현황을 행마다 말한다', async () => {
    renderScreen({ issueCounts: { 1001: 0, 1002: 2 } });

    expect(await screen.findByText('GI-SAMPLE-0042', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('LOT-SAMPLE-20')).toBeInTheDocument();

    expect(within(rowFor('LOT-SAMPLE-20')).getByText(t.lines.statusNotIssued)).toBeInTheDocument();
    expect(within(rowFor('LOT-SAMPLE-21')).getByText(t.lines.statusIssued(2))).toBeInTheDocument();
    expect(await screen.findAllByText('ITEM-0001 · 샘플 품목')).toHaveLength(LINES.length);
    expect(screen.getAllByText('500 EA').length).toBeGreaterThan(0);
  });

  it('요약에 없는 라인은 「모른다」로 말한다 — 미발행으로 접지 않는다', async () => {
    renderScreen({ issueCounts: { 1001: 0 } });

    await screen.findByText('LOT-SAMPLE-21');
    expect(within(rowFor('LOT-SAMPLE-21')).getByText(t.lines.statusUnknown)).toBeInTheDocument();
  });

  it('발행을 켜고 끄는 컨트롤을 두지 않는다 — 전량 출고에도 항상 발행한다', async () => {
    renderScreen({ issueCounts: { 1001: 0, 1002: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    expect(screen.getByText(t.alwaysIssueNote)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: t.title })).not.toBeInTheDocument();
  });

  it('고른 라인이 없으면 발행·인쇄가 사유와 함께 비활성이다', async () => {
    renderScreen({ issueCounts: { 1001: 0, 1002: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    expect(screen.getByRole('button', { name: t.action.issue })).toBeDisabled();
    expect(screen.getByText(t.action.disabledNoSelection)).toBeInTheDocument();
  });

  it('파렛트 단위는 사유와 함께 비활성이다', async () => {
    renderScreen({ issueCounts: { 1001: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    expect(screen.getByRole('radio', { name: t.target.unitPallet })).toBeDisabled();
    expect(screen.getByText(t.target.unitPalletPending)).toBeInTheDocument();
  });

  it('프린터가 0건이면 빈 상태를 머리에 보인다', async () => {
    renderScreen({ issueCounts: { 1001: 0 } });

    expect(await screen.findAllByText(t.printer.empty)).not.toHaveLength(0);
  });

  it('이미 발행된 라인을 고르면 재발행 사유를 요구하고, 고르면 발행이 열린다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0, 1002: 2 } });

    await screen.findByText('LOT-SAMPLE-21');
    await user.click(within(rowFor('LOT-SAMPLE-21')).getByRole('checkbox'));

    expect(await screen.findByText(t.action.disabledNoReason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.action.issue })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: t.reissue.label }));
    await user.click(await screen.findByRole('option', { name: '인쇄 실패' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.action.issue })).toBeEnabled();
    });
  });

  it('최초 발행이면 사유를 묻지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0, 1002: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));

    expect(await screen.findByText(t.reissue.notNeeded)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.action.issue })).toBeEnabled();
  });

  it('발행 본문에 회차를 싣지 않고, 사번·멱등 키를 헤더로 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ issueCounts: { 1001: 0, 1002: 0 }, writes });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];

    if (request === undefined) throw new Error('발행 요청이 없습니다');

    expect(request.headers.get('X-Worker-No')).toBe('3391');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();

    const body = (await request.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty('issueSeq');
    expect(body).not.toHaveProperty('reissueReasonCode');
<<<<<<< HEAD
    /*
     * ⭐ 발행 기록의 종류다. 틀리면 요약 조회가 「발행한 적 없다」를 돌려주고 재발행이 신규로
     * 처리된다 — 발행은 되돌릴 수 없는 쓰기라 조회 축보다 이 자리가 더 아프다.
     */
    expect(body.documentTypeCode).toBe('GOODS_ISSUE_QR');
=======
>>>>>>> origin/feat/140-pop-shipment-qr-issue
    expect(body.targets).toEqual([
      { targetTypeCode: 'GOODS_ISSUE_LINE', targetId: 1001, lotId: 20 },
    ]);
  });

  it('발행하면 서버가 매긴 회차를 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.issued(1))).toBeInTheDocument();
    expect(screen.getByText(`${t.target.seqLabel} 1`)).toBeInTheDocument();
  });

  it('403 이면 이 단말에서 발행할 수 없다고 말하고 선택을 유지한다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0 }, issueStatus: 403 });

    await screen.findByText('LOT-SAMPLE-20');
    const checkbox = within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox');
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.errors.forbidden)).toBeInTheDocument();
    expect(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox')).toBeChecked();
  });

  it('발행한 뒤 그린 것을 받아 셸로 보내고 결과를 보고한다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    const saved: Uint8Array[] = [];
    installPrintBridge(async (bytes) => {
      saved.push(bytes);

      return 'C:/labels/sample.png';
    });
    renderScreen({ issueCounts: { 1001: 0 }, reports });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.printed)).toBeInTheDocument();
    expect(saved).toHaveLength(1);
    expect(reports).toHaveLength(1);

    const report = reports[0];

    if (report === undefined) throw new Error('인쇄 보고가 없습니다');

    expect(report.headers.get('X-Worker-No')).toBe('3391');
    expect(await report.json()).toEqual({ outcome: 'SUCCEEDED' });
  });

  it('인쇄가 실패해도 발행 기록은 남고, 실패를 사유와 함께 보고한다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    installPrintBridge(() => Promise.reject(new Error('프린터가 응답하지 않습니다')));
    renderScreen({ issueCounts: { 1001: 0 }, reports });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.printFailed)).toBeInTheDocument();
    /* 발행은 성공했다 — 인쇄 실패가 그것을 지우지 않는다. */
    expect(screen.getByText(t.result.issued(1))).toBeInTheDocument();

    const report = reports[0];

    if (report === undefined) throw new Error('인쇄 보고가 없습니다');

    expect(await report.json()).toMatchObject({ outcome: 'FAILED' });
  });

  it('그린 것을 못 받으면 그것도 인쇄 실패로 보고한다 — 종이는 나오지 않았다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    installPrintBridge(() => Promise.resolve('C:/labels/sample.png'));
    renderScreen({ issueCounts: { 1001: 0 }, reports, renditionFails: true });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.printFailed)).toBeInTheDocument();

    const report = reports[0];

    if (report === undefined) throw new Error('인쇄 보고가 없습니다');

    expect(await report.json()).toMatchObject({ outcome: 'FAILED' });
  });

  it('셸이 없으면 인쇄를 시도하지도 보고하지도 않는다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    renderScreen({ issueCounts: { 1001: 0 }, reports });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.issued(1))).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(t.result.printing)).not.toBeInTheDocument();
    });
    expect(reports).toHaveLength(0);
    expect(screen.queryByText(t.result.printed)).not.toBeInTheDocument();
  });

  it('인쇄는 됐는데 보고를 못 하면 그것을 성공으로 접지 않는다', async () => {
    const user = userEvent.setup();
    installPrintBridge(() => Promise.resolve('C:/labels/sample.png'));
    renderScreen({ issueCounts: { 1001: 0 }, reportFails: true });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    expect(await screen.findByText(t.result.printedUnreported)).toBeInTheDocument();
    expect(screen.queryByText(t.result.printed)).not.toBeInTheDocument();
  });

  it('인쇄 결과 보고에도 멱등 키를 싣는다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    installPrintBridge(() => Promise.resolve('C:/labels/sample.png'));
    renderScreen({ issueCounts: { 1001: 0 }, reports });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });

    expect(reports[0]?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('전체 선택이 모든 라인을 고르고, 다시 누르면 푼다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0, 1002: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(screen.getByRole('button', { name: t.lines.selectAll }));

    expect(await screen.findByText(t.target.selectedCount(LINES.length))).toBeInTheDocument();
    expect(within(rowFor('LOT-SAMPLE-21')).getByRole('checkbox')).toBeChecked();

    await user.click(screen.getByRole('button', { name: t.lines.clearSelection }));

    expect(await screen.findByText(t.target.none)).toBeInTheDocument();
  });

  it('고른 재발행 사유를 본문에 실어 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ issueCounts: { 1001: 0, 1002: 2 }, writes });

    await screen.findByText('LOT-SAMPLE-21');
    await user.click(within(rowFor('LOT-SAMPLE-21')).getByRole('checkbox'));
    await user.click(screen.getByRole('combobox', { name: t.reissue.label }));
    await user.click(await screen.findByRole('option', { name: '인쇄 실패' }));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    expect(await writes[0]?.json()).toMatchObject({ reissueReasonCode: 'PRINT_FAILURE' });
  });

  it('기본으로 표시된 프린터의 상태를 머리에 보인다 — 목록 첫 줄이 아니다', async () => {
    renderScreen({
      issueCounts: { 1001: 0 },
      printers: [
        {
          printerName: 'p-1',
          displayName: '첫 줄 프린터',
          status: 'OFFLINE',
          statusMessage: '연결 끊김',
          isDefault: false,
        },
        {
          printerName: 'p-2',
          displayName: '기본 프린터',
          status: 'READY',
          statusMessage: '대기 중',
          isDefault: true,
        },
      ],
    });

    expect(await screen.findByText(`${t.printer.label} 대기 중`)).toBeInTheDocument();
  });

  it('발행 요약을 출력물 종류로 좁혀 묻는다 — 다른 출력물까지 세면 회차가 틀어진다', async () => {
    const summaryRequests: Request[] = [];
    renderScreen({ issueCounts: { 1001: 0 }, summaryRequests });

    await screen.findByText('LOT-SAMPLE-20');

    const query = new URL(summaryRequests[0]?.url ?? 'http://x/').searchParams;

<<<<<<< HEAD
    expect(query.get('documentTypeCode')).toBe('GOODS_ISSUE_QR');
=======
    expect(query.get('documentTypeCode')).toBe('ISSUE_QR');
>>>>>>> origin/feat/140-pop-shipment-qr-issue
    expect(query.get('targetTypeCode')).toBe('GOODS_ISSUE_LINE');
    expect(query.get('targetIds')).toBe('1001,1002');
  });

<<<<<<< HEAD
  it('프린터도 출력물 종류로 좁혀 묻는다 — 거르지 않으면 못 찍는 프린터가 섞인다', async () => {
    const printerRequests: Request[] = [];
    renderScreen({ issueCounts: { 1001: 0 }, printerRequests });

    await screen.findByText('LOT-SAMPLE-20');

    const query = new URL(printerRequests[0]?.url ?? 'http://x/').searchParams;

    expect(query.get('documentTypeCode')).toBe('GOODS_ISSUE_QR');
  });

=======
>>>>>>> origin/feat/140-pop-shipment-qr-issue
  it('미리보기를 못 받으면 깨진 그림 대신 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { 1001: 0 } });

    await screen.findByText('LOT-SAMPLE-20');
    await user.click(within(rowFor('LOT-SAMPLE-20')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.action.issue }));

    const preview = await screen.findByAltText(t.target.previewAlt);

    fireEvent.error(preview);

    expect(await screen.findByText(t.target.previewFailed)).toBeInTheDocument();
    expect(screen.queryByAltText(t.target.previewAlt)).not.toBeInTheDocument();
  });

  it('라인이 0건이면 빈 상태를 말한다', async () => {
    renderScreen({ noLines: true });

    expect(await screen.findByText(t.lines.empty)).toBeInTheDocument();
  });

  it('라인을 못 불러오면 빈 목록이 아니라 실패라고 말한다', async () => {
    renderScreen({ linesFail: true });

    expect(await screen.findByText(t.lines.failed)).toBeInTheDocument();
    expect(screen.queryByText(t.lines.empty)).not.toBeInTheDocument();
  });

  it('전표 없이 들어오면 그 사실을 말한다', async () => {
    renderWithProviders(<GoodsIssueQrScreen />, {
      fetch: createStubFetch(routes({})),
      route: '/pop/goods-issue-qr',
    });

    expect(await screen.findByText(t.entry.missingIssue)).toBeInTheDocument();
  });

  it('사번이 없으면 발행을 열지 않는다', async () => {
    renderWithProviders(<GoodsIssueQrScreen />, {
      fetch: createStubFetch(routes({ issueCounts: { 1001: 0 } })),
      route: '/pop/goods-issue-qr?goodsIssueId=900',
    });

    expect(await screen.findByText(t.entry.missingWorker)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.action.issue })).toBeDisabled();
    expect(screen.getByText(t.action.disabledNoWorker)).toBeInTheDocument();
  });
});
