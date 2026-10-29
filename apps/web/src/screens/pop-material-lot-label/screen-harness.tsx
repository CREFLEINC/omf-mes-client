/**
 * 이 화면의 감지기 전용 발판 — 자재 LOT 라벨 발행 화면의 시험 흉내 서버. 런타임 코드는 이 모듈을
 * 참조하지 않는다 — 참조하면 예시 값이 배포 번들에 들어간다. 값은 **전부 지어낸 것이다**(공개 저장소 경계).
 *
 * 목록 시험(`screen.test.tsx`)과 발행 시험(`issue-flow.test.tsx`)이 **한 스텁을 함께 쓴다.** 스텁이
 * 갈리면 두 파일이 다른 서버를 상대로 같은 화면을 검사하게 된다.
 *
 * ⭐ 서버처럼 기억한다 — 줄마다 만든 LOT, 문서마다의 발행 회차, 발행 기록이 생긴 줄. 그래서 발행 뒤
 *    목록을 다시 받으면 그 줄이 대기에서 빠지고 다시 인쇄 쪽에 선다(실서버와 같은 순서).
 * ⭐ 줄 목록 경로(`GET /logistics/inbound-receipt-lines` · 장부 P-118)는 고를 수 있다 — `missing` 이면
 *    404 를 답해 화면이 입하 건 → 줄 모으기로 돌아가는 길을, `served` 면 새 경로를 잰다.
 */
import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopMaterialLotLabelScreen } from './screen';

export const WORKER_NO = '900028';
export const ISSUE_LOG_BASE = 44000;

/**
 * 시험의 「지금」 — 공장 2026-08-28(금) 15:00. 발판의 입하일(08-27)이 화면의 기본 기간(이번 주 ·
 * 08-24 월요일부터)에 든다. 두 시험 파일이 날짜만 이 값으로 멈춘다(타이머는 그대로 돈다).
 * ⚠ 입하일과 같은 날로 두지 않는다 — 표의 입하 칸은 오늘 들어온 줄이면 날짜를 빼고 시각만 적는다.
 */
export const HARNESS_NOW = new Date('2026-08-28T08:00:00Z');

export interface ReceiptFixture {
  inboundReceiptId: number;
  inboundReceiptNo: string;
  supplierId: number;
  plantId: number;
  receiptDatetime: string;
  statusCode: string;
}

export interface LineFixture {
  inboundReceiptLineId: number;
  inboundReceiptId: number;
  lineNo: number;
  itemId: number;
  receivedQty: number;
  uomId: number;
  inspectionRequired: boolean;
  /** 처음부터 붙어 있는 LOT(등록만 되고 발행 기록이 없는 줄). */
  lotId: number | null;
  /** 처음부터 발행된 줄 — 다시 인쇄 쪽에 선다. */
  issued?: boolean;
}

export const receipt = (
  id: number,
  supplierId: number,
  receiptDatetime: string,
  statusCode = 'REGISTERED',
): ReceiptFixture => ({
  inboundReceiptId: id,
  inboundReceiptNo: `SYN-IB-${String(id).padStart(4, '0')}`,
  supplierId,
  plantId: 8301,
  receiptDatetime,
  statusCode,
});

export const line = (
  id: number,
  receiptId: number,
  itemId: number,
  receivedQty: number,
  over: Partial<LineFixture> = {},
): LineFixture => ({
  inboundReceiptLineId: id,
  inboundReceiptId: receiptId,
  lineNo: 1,
  itemId,
  receivedQty,
  uomId: 8401,
  inspectionRequired: false,
  lotId: null,
  ...over,
});

export const ITEMS = [
  { itemId: 8601, itemCode: 'SYN-ITEM-01', itemName: '합성 품목 가', isActive: true },
  { itemId: 8602, itemCode: 'SYN-ITEM-02', itemName: '합성 품목 나', isActive: true },
];

export const PARTNERS = [
  { partnerId: 8201, partnerCode: 'SYN-P-01', partnerName: '합성 공급사 가', isActive: true },
  { partnerId: 8202, partnerCode: 'SYN-P-02', partnerName: '합성 공급사 나', isActive: true },
];

/** 만든 LOT 의 번호 — 자재 LOT 다섯 칸 모양을 흉내 낸다. */
export const lotNoOf = (lotId: number): string => `SYN-ITEM|500|260827|SYN-P|${String(lotId)}`;

/** 줄에서 만들어질 LOT 번호(줄 id 로 정한다 — 시험이 미리 안다). */
export const lotIdFor = (lineId: number): number => 9000 + (lineId % 1000);

export interface Sent {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Headers;
  body: unknown;
}

export interface HarnessOptions {
  receipts?: ReceiptFixture[];
  lines?: LineFixture[];
  /** 줄 목록 경로(P-118)를 서버가 아는가. 기본은 모른다(404) — 지금의 실서버다. */
  lineList?: 'served' | 'missing';
  identity?: Partial<PopIdentity>;
  /** 이 줄의 등록을 이 상태로 실패시킨다(줄 id → 상태 코드). */
  registerFail?: Record<number, { status: number; body?: unknown }>;
  /** 발행 기록을 이 상태로 실패시킨다(모든 줄). */
  issueFail?: { status: number; body?: unknown };
  /** 발행 기록을 끝나지 않게 붙잡는다 — 「보내는 중」을 잰다. */
  issueHangs?: boolean;
  reportFails?: boolean;
  /** 라벨에 실을 품목 조회를 발행 기록 뒤에만 실패시킨다(목록의 이름은 풀린다). */
  renderFails?: boolean;
  /** LOT 상세의 품질 상태(모든 LOT). */
  lotStatusCode?: string;
  reissueReasons?: { code: string; codeName: string }[];
  /** IQC 라벨이 이미 나간 적이 있다 — 사유 없는 IQC 발행을 422(사유 필수)로 거절한다. */
  iqcRequiresReason?: boolean;
  /** 입하 목록 조회를 실패시킨다. */
  receiptsFail?: boolean;
  printers?: unknown[];
  printersFail?: boolean;
}

const page = (total: number) => ({ page: 1, size: 200, total });

export const renderLabelScreen = (options: HarnessOptions = {}) => {
  const receipts = options.receipts ?? [receipt(8101, 8201, '2026-08-27T09:12:30Z')];
  const lines = options.lines ?? [line(8501, 8101, 8601, 500)];
  const sent: Sent[] = [];
  const createdLots = new Map<number, number>(
    lines.flatMap((each) => (each.lotId === null ? [] : [[each.inboundReceiptLineId, each.lotId]])),
  );
  const issuedLines = new Set(
    lines.filter((each) => each.issued === true).map((each) => each.inboundReceiptLineId),
  );
  const issueCounts = new Map<string, number>();
  const issueByLog = new Map<number, number>();
  let logSeq = 0;

  for (const each of lines) {
    if (each.issued === true) {
      const lotId =
        createdLots.get(each.inboundReceiptLineId) ?? lotIdFor(each.inboundReceiptLineId);
      createdLots.set(each.inboundReceiptLineId, lotId);
      issueCounts.set(`MATERIAL_LOT_LABEL|${String(lotId)}`, 1);
    }
  }

  const record = async (request: Request): Promise<void> => {
    const url = new URL(request.url);
    const entry: Sent = {
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      headers: request.headers,
      body: null,
    };

    sent.push(entry);
    if (request.method !== 'GET' && request.body !== null)
      entry.body = await request.clone().json();
  };

  const lineByLot = (lotId: number): LineFixture | undefined =>
    lines.find((each) => createdLots.get(each.inboundReceiptLineId) === lotId);

  const lotOf = (lotId: number) => ({
    lotId,
    lotNo: lotNoOf(lotId),
    itemId: lineByLot(lotId)?.itemId ?? 8601,
    lotTypeCode: 'MATERIAL',
    plantId: 8301,
    initialQty: lineByLot(lotId)?.receivedQty ?? 500,
    uomId: 8401,
    sourceTypeCode: 'INBOUND_RECEIPT_LINE',
    sourceId: lineByLot(lotId)?.inboundReceiptLineId ?? 0,
    statusCode: options.lotStatusCode ?? 'INSPECTION_PENDING',
  });

  const lineView = (each: LineFixture) => ({
    inboundReceiptLineId: each.inboundReceiptLineId,
    inboundReceiptId: each.inboundReceiptId,
    lineNo: each.lineNo,
    itemId: each.itemId,
    receivedQty: each.receivedQty,
    uomId: each.uomId,
    supplierLotMissing: true,
    supplierLotLabelAttached: false,
    inspectionRequired: each.inspectionRequired,
    statusCode: 'REGISTERED',
    lotId: createdLots.get(each.inboundReceiptLineId) ?? null,
  });

  const wantsIssued = (url: URL): boolean => url.searchParams.get('labelIssued') === 'true';
  const inView = (each: LineFixture, issued: boolean): boolean =>
    issuedLines.has(each.inboundReceiptLineId) === issued;

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/logistics/inbound-receipt-lines',
      respond: (request) => {
        void record(request);

        if (options.lineList !== 'served') {
          return jsonResponse({ message: 'Not Found' }, { status: 404 });
        }

        const url = new URL(request.url);
        const items = lines
          .filter((each) => inView(each, wantsIssued(url)))
          .map((each) => {
            const at = receipts.find((r) => r.inboundReceiptId === each.inboundReceiptId);
            const lotId = createdLots.get(each.inboundReceiptLineId) ?? null;
            const seq =
              lotId === null ? 0 : (issueCounts.get(`MATERIAL_LOT_LABEL|${String(lotId)}`) ?? 0);

            return {
              ...lineView(each),
              inboundReceiptNo: at?.inboundReceiptNo ?? '',
              receiptDatetime: at?.receiptDatetime ?? '',
              supplierId: at?.supplierId ?? 0,
              plantId: 8301,
              lotNo: lotId === null ? null : lotNoOf(lotId),
              lotStatusCode:
                lotId === null ? null : (options.lotStatusCode ?? 'INSPECTION_PENDING'),
              lastLabelIssue:
                seq === 0 ? null : { issueSeq: seq, issuedAt: '2026-08-27T10:02:00Z' },
            };
          });

        return jsonResponse({ items, page: page(items.length) });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/logistics/inbound-receipts',
      respond: (request) => {
        void record(request);

        return options.receiptsFail === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse({ items: receipts, page: page(receipts.length) });
      },
    },
    {
      match: (request) =>
        /\/logistics\/inbound-receipts\/\d+\/lines$/u.test(new URL(request.url).pathname),
      respond: (request) => {
        void record(request);
        const url = new URL(request.url);
        const receiptId = Number(/\/inbound-receipts\/(\d+)\/lines$/u.exec(url.pathname)?.[1]);
        const items = lines
          .filter((each) => each.inboundReceiptId === receiptId && inView(each, wantsIssued(url)))
          .map(lineView);

        return jsonResponse({ items, page: page(items.length) });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/app/printers',
      respond: () =>
        options.printersFail === true
          ? jsonResponse({ message: '실패' }, { status: 500 })
          : jsonResponse({
              items: options.printers ?? [
                {
                  printerName: 'syn-label-printer',
                  displayName: '합성 라벨 프린터 가',
                  status: 'READY',
                  statusMessage: '대기 중',
                  isDefault: true,
                  supportedDocumentTypeCodes: ['LABEL'],
                },
              ],
            }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/partners',
      respond: () => jsonResponse({ items: PARTNERS, page: page(PARTNERS.length) }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/uoms',
      respond: () =>
        jsonResponse({
          items: [{ uomId: 8401, uomCode: 'EA', uomName: '개', isActive: true }],
          page: page(1),
        }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () => {
        const reasons = options.reissueReasons ?? [
          { code: 'PRINT_FAILURE', codeName: '인쇄 실패' },
          { code: 'DAMAGED', codeName: '훼손' },
        ];

        return jsonResponse({
          items: reasons.map((reason, index) => ({
            codeValueId: 7001 + index,
            codeGroupId: 7000,
            code: reason.code,
            codeName: reason.codeName,
            displayOrder: index,
            isActive: true,
          })),
          page: page(reasons.length),
        });
      },
    },
    {
      match: (request) => /\/mdm\/items\/\d+$/u.test(new URL(request.url).pathname),
      respond: (request) => {
        void record(request);
        const itemId = Number(/\/mdm\/items\/(\d+)$/u.exec(new URL(request.url).pathname)?.[1]);
        const item = ITEMS.find((each) => each.itemId === itemId);
        const isAfterIssue = sent.some((entry) => entry.path === '/app/document-issues');

        if (options.renderFails === true && isAfterIssue) {
          return jsonResponse(
            { errors: [{ scope: 'screen', code: 'ITEM_FAILED', message: '품목 조회 실패' }] },
            { status: 503 },
          );
        }

        return item === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse({ item, editability: {} });
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname === '/trace/lots' && request.method === 'GET',
      respond: (request) => {
        void record(request);
        const lotNo = new URL(request.url).searchParams.get('lotNo');
        const found = [...createdLots.values()].find((lotId) => lotNoOf(lotId) === lotNo);

        return jsonResponse({
          items: found === undefined ? [] : [lotOf(found)],
          page: page(found === undefined ? 0 : 1),
        });
      },
    },
    {
      match: (request) => /^\/trace\/lots\/\d+$/u.test(new URL(request.url).pathname),
      respond: (request) => {
        const lotId = Number(/\/trace\/lots\/(\d+)$/u.exec(new URL(request.url).pathname)?.[1]);

        return jsonResponse({ lot: lotOf(lotId), externalIdentifiers: [], holds: [] });
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname === '/trace/lots' && request.method === 'POST',
      respond: async (request) => {
        await record(request);
        const body = sent.at(-1)?.body as { sourceId: number };
        const fail = options.registerFail?.[body.sourceId];

        if (fail !== undefined) {
          return jsonResponse(fail.body ?? { message: '등록 실패' }, { status: fail.status });
        }

        const lotId = lotIdFor(body.sourceId);
        createdLots.set(body.sourceId, lotId);

        return jsonResponse(
          { lot: lotOf(lotId), externalIdentifiers: [], holds: [] },
          { status: 201 },
        );
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname === '/app/document-issues' && request.method === 'POST',
      respond: async (request) => {
        await record(request);
        const body = sent.at(-1)?.body as {
          documentTypeCode: string;
          targets: { lotId: number }[];
          reissueReasonCode?: string | null;
        };

        if (options.issueHangs === true) {
          return new Response(new ReadableStream({ start: () => undefined }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (options.issueFail !== undefined) {
          return jsonResponse(options.issueFail.body ?? { message: '실패' }, {
            status: options.issueFail.status,
          });
        }

        const lotId = body.targets[0]?.lotId ?? 0;
        const key = `${body.documentTypeCode}|${String(lotId)}`;
        const seq = (issueCounts.get(key) ?? 0) + 1;
        const needsReason =
          (seq > 1 ||
            (options.iqcRequiresReason === true && body.documentTypeCode === 'IQC_LABEL')) &&
          (body.reissueReasonCode ?? null) === null;

        if (needsReason) {
          return jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'reissueReasonCode',
                  code: 'REQUIRED',
                  message: '재발행 사유가 필요합니다.',
                },
              ],
            },
            { status: 422 },
          );
        }

        issueCounts.set(key, seq);
        logSeq += 1;
        const logId = ISSUE_LOG_BASE + logSeq;
        issueByLog.set(logId, lotId);

        if (body.documentTypeCode === 'MATERIAL_LOT_LABEL') {
          const issuedLine = lineByLot(lotId);
          if (issuedLine !== undefined) issuedLines.add(issuedLine.inboundReceiptLineId);
        }

        return jsonResponse(
          {
            items: [
              {
                documentIssueLogId: logId,
                documentTypeCode: body.documentTypeCode,
                target: { targetTypeCode: 'LOT', targetId: lotId, displayName: lotNoOf(lotId) },
                lotId,
                lotNo: lotNoOf(lotId),
                issueSeq: seq,
                issuedBy: 1,
                issuedByName: '합성 작업자',
                issuedAt: '2026-08-27T09:20:00Z',
                printOutcome: 'PENDING',
              },
            ],
            issuedCount: 1,
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) =>
        /\/app\/document-issues\/\d+:report-print$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        await record(request);

        return options.reportFails === true
          ? jsonResponse({ message: '보고 실패' }, { status: 500 })
          : jsonResponse({ documentIssueLogId: 1, printOutcome: 'SUCCEEDED' });
      },
    },
  ]);

  const identity: PopIdentity = {
    terminalId: null,
    processes: null,
    equipment: null,
    workerNo: WORKER_NO,
    ...options.identity,
  };

  const result = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <PopMaterialLotLabelScreen />
    </PopIdentityProvider>,
    { fetch },
  );

  return { ...result, sent, issuedLines, createdLots };
};

/** 보낸 요청 가운데 이 경로의 것. */
export const sentTo = (sent: readonly Sent[], path: string): Sent[] =>
  sent.filter((entry) => entry.path === path);
