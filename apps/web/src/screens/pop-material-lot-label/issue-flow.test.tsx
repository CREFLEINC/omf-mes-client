import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopMaterialLotLabelScreen } from './screen';

/**
 * 등록·인쇄 3단계 — **호출이 다섯이고 한 트랜잭션이 아니다.**
 *
 * 여기서 무는 것은 「무엇을 보내는가」와 「어디서 멈췄을 때 무엇이라 말하는가」다. 본문 조립은
 * `issue-request.test.ts` 가 따로 문다 — 그쪽은 순수 함수라 이 화면을 띄우지 않고 잰다.
 */

/** 합성값이다 — 계약의 예시값도 실 운영 값도 쓰지 않는다(공개 저장소 경계). */
const WORKER_NO = '900028';
const LOT_ID = 9001;
const ISSUE_LOG_ID = 44001;
const LOT_NO = 'RM-9999|500|260827|SUP-011|0001';

const receiptOf = (n: number) => ({
  inboundReceiptId: 8100 + n,
  inboundReceiptNo: `SYN-IB-${String(n).padStart(4, '0')}`,
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T09:12:30Z',
  statusCode: 'SYN_STATUS',
});

const lineOf = (lotId: number | null, receiptNo = 1) => ({
  inboundReceiptLineId: 8500 + receiptNo,
  inboundReceiptId: 8100 + receiptNo,
  lineNo: 1,
  itemId: 8601,
  receivedQty: 500,
  uomId: 8401,
  supplierLotMissing: true,
  supplierLotLabelAttached: false,
  inspectionRequired: false,
  statusCode: 'SYN_STATUS',
  lotId,
});

const issueRecord = (issueSeq: number) => ({
  documentIssueLogId: ISSUE_LOG_ID,
  documentTypeCode: 'MATERIAL_LOT_LABEL',
  target: { targetTypeCode: 'LOT', targetId: LOT_ID, displayName: 'SYN-LOT-0001' },
  lotId: LOT_ID,
  lotNo: LOT_NO,
  issueSeq,
  issuedBy: 1,
  issuedByName: '합성 작업자',
  issuedAt: '2026-08-27T09:20:00Z',
  printOutcome: 'PENDING',
});

interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

interface FlowOptions {
  /** 목록에 세울 입하 건 수. 결과가 다른 줄로 새는지 보려면 둘 이상이 필요하다. */
  receiptCount?: number;
  /** 이 라인으로 이미 만들어진 LOT. `null` 이면 아직 등록 전이다. */
  lotId?: number | null;
  identity?: Partial<PopIdentity>;
  /** 발행 기록 호출을 실패시킨다 — LOT 은 생기고 기록은 없는 상태를 만든다. */
  issueFails?: boolean;
  /** 그 실패의 상태 코드. 403 은 「이 단말에 출력 권한이 없다」라 처리가 갈린다. */
  issueFailStatus?: number;
  /**
   * 그 실패의 본문. ⚠ **계약은 403·422 를 오류 봉투로 정의한다** — 봉투를 실어야 정규화가
   * 실서버와 같은 갈래를 내고, 그때도 화면이 권한 거부를 알아보는지 잴 수 있다.
   */
  issueFailBody?: unknown;
  /** 등록 호출을 이 상태 코드로 실패시킨다. 409 는 채번 충돌이라 **다시 부르면 풀린다.** */
  registerFailStatus?: number;
  /** 등록 실패의 본문. 계약의 `ConflictResponse`(`conflictCause`)를 실을 때 쓴다. */
  registerFailBody?: unknown;
  /** 발행 호출을 끝나지 않게 붙잡는다 — 실행 중 상태를 재는 데 쓴다. */
  issueHangs?: boolean;
  /** 인쇄 결과 보고만 실패시킨다. 종이는 이미 나온 상태다. */
  reportFails?: boolean;
  /** 라벨에 실을 품목 조회 실패를 재현한다. */
  renderFails?: boolean;
  /** 셸 인쇄 통로를 심는다. 없으면 브라우저와 같은 상태다. */
  shellPrint?: (() => Promise<string>) | null;
  reissueReasons?: { code: string; codeName: string }[];
  /**
   * 인쇄 결과를 보고한 뒤에는 서버가 그 라인을 발행한 것으로 거른다 — 미발행 라인 질의에 빈
   * 목록을 답한다. 끄면 발행 전후로 같은 라인을 답한다.
   */
  filtersIssuedAfterReport?: boolean;
}

const renderFlow = (options: FlowOptions = {}) => {
  const sent: Sent[] = [];
  const lotId = options.lotId ?? null;
  const receipts = Array.from({ length: options.receiptCount ?? 1 }, (_, index) =>
    receiptOf(index + 1),
  );

  const record = async (request: Request): Promise<void> => {
    // The body parses asynchronously. Reserve the event slot first so the
    // recorded order matches the actual network order.
    const entry: Sent = {
      method: request.method,
      path: new URL(request.url).pathname,
      headers: request.headers,
      body: null,
    };
    sent.push(entry);
    if (request.body !== null) entry.body = await request.clone().json();
  };

  /*
   * 등록이 끝난 뒤 목록을 다시 읽으면 그 라인에는 LOT 이 붙어 있다 — 서버가 그렇게 답한다.
   * 이 값을 고정으로 두면 「등록은 됐는데 기록이 실패한」 상태에서도 화면이 계속 「등록·인쇄」를
   * 내어, 실제로는 없는 경로를 시험하게 된다.
   */
  let createdLotId: number | null = null;

  const user = userEvent.setup();
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
    {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/logistics/inbound-receipts',
          respond: () =>
            jsonResponse({ items: receipts, page: { page: 1, size: 20, total: receipts.length } }),
        },
        {
          match: (request) =>
            /\/logistics\/inbound-receipts\/\d+\/lines$/u.test(new URL(request.url).pathname),
          respond: (request) => {
            const matched = /\/inbound-receipts\/(\d+)\/lines$/u.exec(
              new URL(request.url).pathname,
            );
            const receiptNo = Number(matched?.[1] ?? 8101) - 8100;
            const isReported = sent.some((entry) => entry.path.endsWith(':report-print'));
            const asksUnissued = new URL(request.url).searchParams.get('labelIssued') === 'false';

            if (options.filtersIssuedAfterReport === true && isReported && asksUnissued) {
              return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
            }

            return jsonResponse({
              items: [lineOf(receiptNo === 1 ? (lotId ?? createdLotId) : null, receiptNo)],
              page: { page: 1, size: 20, total: 1 },
            });
          },
        },
        {
          match: (request) => new URL(request.url).pathname === '/app/printers',
          respond: () =>
            jsonResponse({
              items: [
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
        /*
         * ⭐ **품목은 단건 경로로만 스텁한다**(omf-all-around#27) — 목록(`/mdm/items`)은 한 쪽만
         *    돌려줘 첫 쪽 밖 품목이 「알 수 없음」이 되는 자리다. 하네스가 스텁 없는 요청을
         *    던지므로, 목록 스텁이 여기 없는 것이 곧 감지기다. 거래처는 단건 조회가 단말
         *    토큰에 열려 있지 않아 목록 그대로다(`lookups` 머리말).
         */
        {
          match: (request) => new URL(request.url).pathname === '/mdm/partners',
          respond: () =>
            jsonResponse({
              items: [
                {
                  partnerId: 8201,
                  partnerCode: 'SYN-P-01',
                  partnerName: '합성 공급사 가',
                  isActive: true,
                },
              ],
              page: { page: 1, size: 20, total: 1 },
            }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/uoms',
          respond: () =>
            jsonResponse({
              items: [{ uomId: 8401, uomCode: 'EA', uomName: '개', isActive: true }],
              page: { page: 1, size: 20, total: 1 },
            }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/code-values',
          respond: () =>
            jsonResponse({
              items: (
                options.reissueReasons ?? [{ code: 'SYN_REISSUE_01', codeName: '인쇄 실패' }]
              ).map((reason, index) => ({
                codeValueId: 7001 + index,
                codeGroupId: 7000,
                code: reason.code,
                codeName: reason.codeName,
                displayOrder: index,
                isActive: true,
              })),
              page: { page: 1, size: 20, total: 1 },
            }),
        },
        {
          match: (request) => new URL(request.url).pathname === `/trace/lots/${String(LOT_ID)}`,
          respond: () =>
            jsonResponse({
              lot: {
                lotId: LOT_ID,
                lotNo: LOT_NO,
                itemId: 8601,
                lotTypeCode: 'MATERIAL',
                plantId: 8301,
                initialQty: 500,
                uomId: 8401,
                sourceTypeCode: 'INBOUND_RECEIPT_LINE',
                sourceId: 8501,
                statusCode: 'SYN_STATUS',
              },
              externalIdentifiers: [],
              holds: [],
            }),
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/trace/lots' && request.method === 'POST',
          respond: (request) => {
            void record(request);

            if (options.registerFailStatus !== undefined) {
              // ⛔ 실패한 등록이 LOT 을 남기지 않는다 — 남기면 단추가 「인쇄」로 바뀌어 안내가 어긋난다.
              return jsonResponse(options.registerFailBody ?? { message: '등록 실패' }, {
                status: options.registerFailStatus,
              });
            }

            createdLotId = LOT_ID;

            return jsonResponse(
              {
                lot: {
                  lotId: LOT_ID,
                  lotNo: LOT_NO,
                  itemId: 8601,
                  lotTypeCode: 'MATERIAL',
                  plantId: 8301,
                  initialQty: 500,
                  uomId: 8401,
                  sourceTypeCode: 'INBOUND_RECEIPT_LINE',
                  sourceId: 8501,
                  statusCode: 'SYN_STATUS',
                },
                externalIdentifiers: [],
                holds: [],
              },
              { status: 201 },
            );
          },
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/app/document-issues' && request.method === 'POST',
          respond: (request) => {
            void record(request);

            /*
             * 끝나지 않는 응답 — 「실행 중」이 유지된다. 본문을 닫지 않는 흐름으로 준다.
             * 목의 답은 «동기»로 만들어야 하므로 응답 자체를 미루지 않고 본문에서 멈춘다.
             */
            if (options.issueHangs === true) {
              return new Response(new ReadableStream({ start: () => undefined }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              });
            }

            return options.issueFails === true
              ? jsonResponse(options.issueFailBody ?? { message: '실패' }, {
                  status: options.issueFailStatus ?? 500,
                })
              : jsonResponse(
                  { items: [issueRecord(lotId === null ? 1 : 2)], issuedCount: 1 },
                  { status: 201 },
                );
          },
        },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/items/8601',
          respond: (request) => {
            void record(request);
            /*
             * ⚠ **이 경로를 부르는 자리가 둘이다** — 목록·카드의 품목 이름(화면이 열릴 때)과
             *   라벨에 찍을 품번(등록이 끝난 뒤 · `mutations.buildLabel`). `renderFails` 가
             *   겨냥하는 것은 뒤쪽이므로, 발행 기록이 생긴 뒤의 호출만 실패로 돌린다. 앞쪽까지
             *   실패시키면 줄의 이름이 「이름을 불러오지 못했습니다」가 되어 줄을 고를 수 없다.
             */
            const isAfterIssue = sent.some((entry) => entry.path === '/app/document-issues');

            return options.renderFails === true && isAfterIssue
              ? jsonResponse(
                  { errors: [{ scope: 'screen', code: 'ITEM_FAILED', message: '품목 조회 실패' }] },
                  { status: 503 },
                )
              : jsonResponse({
                  item: {
                    itemId: 8601,
                    itemCode: 'SYN-ITEM-01',
                    itemName: '합성 품목 가',
                    isActive: true,
                  },
                  editability: {},
                });
          },
        },
        {
          match: (request) =>
            new URL(request.url).pathname ===
            `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`,
          respond: (request) => {
            void record(request);

            return options.reportFails === true
              ? jsonResponse({ message: '보고 실패' }, { status: 500 })
              : jsonResponse(issueRecord(1));
          },
        },
      ]),
    },
  );

  if (options.shellPrint !== undefined && options.shellPrint !== null) {
    window.pop = { rendition: { save: options.shellPrint } };
  }

  return { ...result, user, sent };
};

afterEach(() => {
  delete window.pop;
});

const chooseLine = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const row = await screen.findByRole('button', {
    name: '입하 SYN-IB-0001 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
  });
  await user.click(row);
};

const sentTo = (sent: Sent[], path: string): Sent | undefined =>
  sent.find((entry) => entry.path === path);

describe('PopMaterialLotLabelScreen — 등록·인쇄', () => {
  it('⛔ 사번이 없으면 등록·인쇄를 막고 왜 못 하는지 보인다 — 감추지 않는다', async () => {
    const { user } = renderFlow({ identity: { workerNo: null } });
    await chooseLine(user);

    expect(screen.getByRole('button', { name: '등록·인쇄' })).toBeDisabled();
    // 사유는 화면 맨 위 공용 띠 하나로만 말한다(사용자 지시 2026-09-17).
    expect(screen.getByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(
      screen.queryByText('사번을 확인한 뒤에 등록·인쇄할 수 있습니다.'),
    ).not.toBeInTheDocument();
  });

  it('등록 → 발행 → 품목 조회 → 인쇄 → 보고를 순서대로 부르고 사번을 싣는다', async () => {
    const shellPrint = vi.fn(async () => 'C:/syn/label.png');
    const { user, sent } = renderFlow({ shellPrint });
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(
        sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`),
      ).toBeDefined();
    });
    expect(sent.map((entry) => entry.path)).toEqual([
      /* 화면이 목록 줄의 품목 이름을 단건으로 푼다(omf-all-around#27). */
      '/mdm/items/8601',
      '/trace/lots',
      '/app/document-issues',
      /* 라벨에 찍을 품번 — 이름 풀이와 같은 경로지만 부르는 자리가 다르다. */
      '/mdm/items/8601',
      `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`,
    ]);
    expect(shellPrint).toHaveBeenCalledTimes(1);
    for (const entry of sent.filter((each) => each.method === 'POST')) {
      expect(entry.headers.get('X-Worker-No')).toBe(WORKER_NO);
      expect(entry.headers.get('Idempotency-Key')).not.toBeNull();
    }
  });

  /** ⭐ 서버 렌디션(100 × 60)이 아니라 POP 이 짠 80 × 30 라벨이 셸로 간다(사용자 지시 2026-09-14). */
  it('셸에 80 × 30 TSPL 라벨을 넘기고 QR 에는 LOT 번호만 싣는다', async () => {
    const shellPrint = vi.fn(async (..._args: unknown[]) => 'C:/syn/label.tspl');
    const { user } = renderFlow({ shellPrint });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(shellPrint).toHaveBeenCalledTimes(1);
    });

    const [bytes, , , format] = shellPrint.mock.calls[0] ?? [];
    const commands = new TextDecoder().decode(bytes as Uint8Array);

    expect(format).toBe('tspl');
    expect(commands.startsWith('SIZE 80 mm,30 mm')).toBe(true);
    expect(commands).toContain(`"${LOT_NO}"\r\n`);
    expect(commands).toContain('ITEM SYN-ITEM-01');
    expect(commands).toContain('QTY 500 EA');
  });

  it('등록 본문의 원천 짝이 입하 «라인» 을 가리킨다', async () => {
    const { user, sent } = renderFlow({ shellPrint: vi.fn(async () => 'C:/syn/label.png') });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(sentTo(sent, '/trace/lots')).toBeDefined();
    });

    expect(sentTo(sent, '/trace/lots')?.body).toMatchObject({
      sourceTypeCode: 'INBOUND_RECEIPT_LINE',
      sourceId: 8501,
    });
  });

  it('라벨 값을 못 받으면 셸이 있어도 인쇄·보고에 닿지 않는다', async () => {
    const shellPrint = vi.fn(async () => 'C:/syn/label.png');
    const { user, sent } = renderFlow({ shellPrint, renderFails: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();
    expect(shellPrint).not.toHaveBeenCalled();
    expect(
      sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`),
    ).toBeUndefined();
  });

  it('셸 통로가 없고 라벨 값 조회가 실패해도 LOT 생성 사실을 보존한다', async () => {
    const { user, sent } = renderFlow({ renderFails: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();
    expect(
      screen.getByText('자재LOT 은 만들어졌습니다. 다시 등록하지 마시고 「인쇄」로 이어가세요.'),
    ).toBeInTheDocument();
    expect(
      sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`),
    ).toBeUndefined();
  });

  /**
   * ⛔ **결과는 그 결과를 만든 줄의 것이다.** 끝난 뒤 다른 자재를 고르면 「인쇄했습니다」가
   * 아직 찍지 않은 자재 밑에 서고, 사람은 그것을 자기 것으로 읽는다.
   */
  it('⛔ 끝난 뒤 다른 자재를 고르면 앞 자재의 결과가 따라오지 않는다', async () => {
    const { user } = renderFlow({
      receiptCount: 2,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(
      await screen.findByText(/라벨이 나오지 않았습니다|인쇄했습니다|끝내지 못했습니다/u),
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', {
        name: '입하 SYN-IB-0002 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
      }),
    );

    expect(
      screen.queryByText(/라벨이 나오지 않았습니다|인쇄했습니다|끝내지 못했습니다/u),
    ).not.toBeInTheDocument();
  });

  it('⛔ LOT 만 생기고 발행 기록이 실패하면 「다시 등록하지 말라」고 함께 말한다', async () => {
    const { user } = renderFlow({ issueFails: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(
      await screen.findByText(
        '자재LOT 은 만들어졌습니다. 다시 등록하지 마시고 「인쇄」로 이어가세요.',
      ),
    ).toBeInTheDocument();
  });

  /**
   * ⚠ **409 는 400 이 아니다**(변경 통지 #534 §1). 채번 충돌은 서버가 스스로 다시 시도한 끝의
   * 실패라 **다시 부르면 풀린다** — 사용자가 고칠 값이 아니므로 그렇게 말하지 않는다.
   */
  it('등록이 409 면 다시 누르라고 말하고, 다시 누를 수 있게 둔다', async () => {
    const { user } = renderFlow({ registerFailStatus: 409 });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(
      await screen.findByText(
        '지금은 등록을 끝내지 못했습니다. 잠시 뒤 「등록·인쇄」를 다시 누르세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('등록·인쇄를 끝내지 못했습니다.')).not.toBeInTheDocument();
    // 「다시 누르면 풀린다」가 말뿐이 아니어야 한다 — 단추가 실제로 열려 있어야 한다.
    expect(screen.getByRole('button', { name: '등록·인쇄' })).not.toBeDisabled();
  });

  /**
   * ⚠ **계약대로 온 409 도 같은 갈래여야 한다.** `/trace/lots` 의 409 는 `ConflictResponse`
   * 봉투이고, 정규화는 그것을 `conflict` 로 접는다 — 상태 코드만 보는 판정은 여기서 갈라진다.
   */
  it('계약 봉투로 온 409 도 재시도 가능으로 읽는다', async () => {
    const { user } = renderFlow({
      registerFailStatus: 409,
      registerFailBody: { conflictCause: 'user', message: '충돌' },
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(
      await screen.findByText(
        '지금은 등록을 끝내지 못했습니다. 잠시 뒤 「등록·인쇄」를 다시 누르세요.',
      ),
    ).toBeInTheDocument();
  });

  it('등록이 400 이면 채번 충돌 문구를 쓰지 않는다', async () => {
    const { user } = renderFlow({ registerFailStatus: 400 });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();
  });

  /**
   * ⛔ **출력 권한이 없는 단말에서는 재시도 수단을 주지 않는다**(스펙 §5-2 · 통지 #534 §2).
   * 다시 눌러도 같은 답이 오고, LOT 은 이미 생겼으므로 **다른 단말**로 안내한다.
   */
  it('발행이 403 이면 다른 단말로 안내하고 재시도 단추를 주지 않는다', async () => {
    const { user } = renderFlow({
      issueFails: true,
      issueFailStatus: 403,
      /*
       * ⛔ **계약 모양으로 답하게 한다.** 계약은 이 403 을 오류 봉투로 정의하고, 정규화는 봉투를
       * 보면 상태 코드를 버린다 — 계약 밖 본문으로 재면 실서버에서 죽는 판정이 통과한다.
       */
      issueFailBody: {
        errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '출력 권한이 없습니다.' }],
      },
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    expect(
      await screen.findByText(
        '이 단말에서는 라벨을 발행할 수 없습니다. 라벨 프린터가 있는 단말에서 인쇄하세요.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '자재LOT 은 만들어졌습니다. 다시 등록하지 마세요 — 다른 단말에서 인쇄할 수 있습니다.',
      ),
    ).toBeInTheDocument();

    // 등록이 끝났으므로 단추 이름은 「인쇄」다 — 그 단추가 막혀 있어야 한다.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '인쇄' })).toBeDisabled();
    });
    /*
     * ⛔ **닫기를 주지 않는다.** 닫으면 결과가 지워져 차단이 함께 풀리는데 서버의 답은 그대로다 —
     * 닫기가 「재시도 단추를 주지 않는다」를 무르는 우회로가 된다.
     */
    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  /**
   * ⛔ **재시도가 회차를 올리지 않는다**(스펙 §5-2). 매번 새 멱등 키를 만들면 서버가 두 요청을
   * 다른 쓰기로 보아 「이 라벨이 몇 번째인가」가 어긋난다.
   */
  it('발행을 다시 시도해도 같은 멱등 키로 나간다', async () => {
    const { user, sent } = renderFlow({ lotId: LOT_ID, issueFails: true });
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '인쇄' }));
    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(sent.filter((entry) => entry.path === '/app/document-issues')).toHaveLength(2);
    });

    const keys = sent
      .filter((entry) => entry.path === '/app/document-issues')
      .map((entry) => entry.headers.get('Idempotency-Key'));

    expect(keys[0]).not.toBeNull();
    expect(keys[0]).toBe(keys[1]);
  });

  /** 라벨 값 조회 실패는 이미 등록된 LOT을 새로 만든 것처럼 알리지 않는다. */
  it('이미 등록된 자재에서 라벨 값 조회 실패면 새 LOT 생성 안내를 덧붙이지 않는다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID, renderFails: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();
    expect(
      screen.queryByText('자재LOT 은 만들어졌습니다. 다시 등록하지 마시고 「인쇄」로 이어가세요.'),
    ).not.toBeInTheDocument();
  });

  /**
   * ⛔ **실행 중에는 줄을 바꾸지 못한다.** 바꾸면 그 실행의 결과가 어느 줄에도 서지 않아
   * 실패가 소리 없이 사라진다.
   */
  it('실행 중에는 다른 자재를 고르지 못한다', async () => {
    const { user } = renderFlow({ receiptCount: 2, issueHangs: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: '입하 SYN-IB-0002 · 품목 SYN-ITEM-01 · 합성 품목 가 · 수량 500 EA 선택',
        }),
      ).toBeDisabled();
    });
    // 보기를 바꿔도 고른 줄이 풀린다 — 실행 중에는 쪽 이동과 함께 탭도 잠근다(#1241).
    expect(screen.getByRole('button', { name: '발행 완료' })).toBeDisabled();
    /*
     * ⛔ **갱신도 같은 자리에서 잠근다**(omf-all-around#29). 도는 사이에 목록이 바뀌면 고른 줄이
     *    빠질 수 있고, 그때 발번 대상 카드가 빈 상태로 돌아가 「인쇄 중인데 아무것도 고르지 않은
     *    화면」이 된다. 주기 갱신도 같은 까닭으로 멈춘다(`queries.listRefetchInterval`).
     */
    expect(screen.getByRole('button', { name: '갱신' })).toBeDisabled();
  });

  /**
   * 셸은 인쇄 성공을 답했으나 보고만 실패한 경우, 다시 찍으라는 안내가 나오면
   * 같은 라벨을 두 장 만든다. 발행 기록과 보고 요청은 그대로 남는다.
   */
  it('인쇄 후 보고 실패를 라벨 출력 성공과 구분한다', async () => {
    const shellPrint = vi.fn(async () => 'C:/syn/label.png');
    const { user, sent } = renderFlow({ lotId: LOT_ID, reportFails: true, shellPrint });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    expect(
      await screen.findByText(
        '라벨은 나왔습니다. 인쇄 결과만 서버에 남기지 못했습니다 — 다시 찍지 마세요.',
      ),
    ).toBeInTheDocument();
    expect(shellPrint).toHaveBeenCalledTimes(1);
    expect(sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`)).toBeDefined();
  });
});

describe('PopMaterialLotLabelScreen — 이미 등록된 자재', () => {
  it('등록을 다시 부르지 않고 발행 기록부터 시작한다', async () => {
    const { user, sent } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
    });
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(sentTo(sent, '/app/document-issues')).toBeDefined();
    });

    expect(sentTo(sent, '/trace/lots')).toBeUndefined();
  });

  /* 칸 사이에 구분자 `|` 가 이미 있다. 다시 끊으면 라벨에 인쇄된 글자와 달라진다. */
  it('LOT 번호를 원문 그대로 보인다 — 라벨과 눈으로 대조하는 자리다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID });
    await chooseLine(user);

    expect(await screen.findByText(LOT_NO)).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 발행 여부 목록', () => {
  /**
   * ⛔ 입하 건은 발행 여부로 거르지 않으므로(#1241) 인쇄 뒤 건은 목록에 남는다. 라인을 다시 읽지
   * 않으면 방금 찍은 줄이 미발행으로 남고 첫 단추가 열려, 누르면 서버가 사유 없음으로 거절한다.
   */
  it('인쇄를 마치면 그 줄이 미발행 목록에서 빠진다', async () => {
    const { user } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
      filtersIssuedAfterReport: true,
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /SYN-IB-0001/u })).not.toBeInTheDocument();
    });
  });

  /**
   * ⛔ **줄이 목록에서 빠져도 그 실행의 결과는 남는다.** 발행 기록이 생긴 줄은 미발행 목록에서
   * 곧바로 빠지는데, 결과를 줄과 함께 지우면 「라벨이 나오지 않았습니다」가 소리 없이 사라져
   * 작업자가 라벨이 나온 줄 안다.
   */
  it('인쇄가 실패한 줄이 목록에서 빠져도 실패 안내와 다음 할 일을 남긴다', async () => {
    const { user } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => {
        throw new Error('프린터 응답 없음');
      }),
      filtersIssuedAfterReport: true,
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /SYN-IB-0001/u })).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/라벨이 나오지 않았습니다/u)).toBeInTheDocument();
    expect(screen.getByText(/「발행 완료」에서 「재인쇄」/u)).toBeInTheDocument();
  });

  it('인쇄를 마친 줄이 목록에서 빠져도 인쇄했다는 안내를 남긴다', async () => {
    const { user } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
      filtersIssuedAfterReport: true,
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /SYN-IB-0001/u })).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/인쇄했습니다/u)).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 재인쇄', () => {
  /**
   * ⭐ 발행 완료 목록(사용자 지시 2026-09-15 · #1241). ⛔ 사유 없는 발행은 2회차부터 서버가
   * 거절하므로 첫 단추를 두지 않고 재인쇄만 둔다.
   */
  it('발행 완료 목록에서 고른 자재에는 재인쇄 단추 하나만 둔다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID });
    await user.click(await screen.findByRole('button', { name: '발행 완료' }));
    await chooseLine(user);

    expect(await screen.findByRole('button', { name: '재인쇄' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '인쇄' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '등록·인쇄' })).not.toBeInTheDocument();
  });

  it('미발행 목록에서 고른 자재에는 재인쇄 단추가 없다 — 재발행할 회차가 없다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID });
    await chooseLine(user);

    expect(await screen.findByRole('button', { name: '인쇄' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재인쇄' })).not.toBeInTheDocument();
  });

  it('사번을 모르면 발행 완료 자재의 재인쇄를 감추지 않고 막는다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID, identity: { workerNo: null } });
    await user.click(await screen.findByRole('button', { name: '발행 완료' }));
    await chooseLine(user);

    expect(await screen.findByRole('button', { name: '재인쇄' })).toBeDisabled();
  });

  /**
   * ⛔ **다른 본문에 같은 키를 실지 않는다.** 재인쇄의 발행이 실패한 뒤 사유를 바꿔 다시 보내면
   * 본문이 달라진다 — 앞선 키를 물려주면 서버가 앞선 쓰기를 되돌려 주거나 거절한다.
   * 같은 사유로 다시 보내면 같은 키여야 회차가 두 번 오르지 않는다.
   */
  it('재인쇄를 다시 보낼 때 사유가 같으면 같은 키, 다르면 새 키로 나간다', async () => {
    const { user, sent } = renderFlow({
      lotId: LOT_ID,
      issueFails: true,
      reissueReasons: [
        { code: 'SYN_REISSUE_01', codeName: '인쇄 실패' },
        { code: 'SYN_REISSUE_02', codeName: '라벨 훼손' },
      ],
    });
    await user.click(await screen.findByRole('button', { name: '발행 완료' }));
    await chooseLine(user);

    const reissueWith = async (reason: string): Promise<void> => {
      await user.click(screen.getByRole('button', { name: '재인쇄' }));
      const dialog = within(await screen.findByRole('dialog'));
      await user.click(dialog.getByRole('combobox', { name: '사유' }));
      await user.click(await screen.findByRole('option', { name: reason }));
      await user.click(dialog.getByRole('button', { name: '재인쇄' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '재인쇄' })).toBeEnabled();
      });
    };

    await reissueWith('인쇄 실패');
    await reissueWith('인쇄 실패');
    await reissueWith('라벨 훼손');

    await waitFor(() => {
      expect(sent.filter((entry) => entry.path === '/app/document-issues')).toHaveLength(3);
    });
    const keys = sent
      .filter((entry) => entry.path === '/app/document-issues')
      .map((entry) => entry.headers.get('Idempotency-Key'));

    expect(keys[0]).not.toBeNull();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('사유를 고르기 전에는 보내지 않고, 고른 사유를 본문에 싣는다', async () => {
    const { user, sent } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
    });
    await user.click(await screen.findByRole('button', { name: '발행 완료' }));
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '재인쇄' }));

    // 창 안쪽으로 좁힌다 — 카드의 「재인쇄」와 창의 「재인쇄」가 같은 이름이다.
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('button', { name: '재인쇄' })).toBeDisabled();

    await user.click(dialog.getByRole('combobox', { name: '사유' }));
    await user.click(await screen.findByRole('option', { name: '인쇄 실패' }));
    await user.click(dialog.getByRole('button', { name: '재인쇄' }));

    await waitFor(() => {
      expect(sentTo(sent, '/app/document-issues')?.body).toMatchObject({
        reissueReasonCode: 'SYN_REISSUE_01',
      });
    });
  });

  it('⛔ 고를 사유가 없으면 재인쇄를 열지 않고 왜 못 하는지 보인다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID, reissueReasons: [] });
    await user.click(await screen.findByRole('button', { name: '발행 완료' }));
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '재인쇄' }));

    expect(
      await screen.findByText(
        '고를 수 있는 재발행 사유가 아직 없습니다. 사유 없이는 재인쇄할 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });
});
