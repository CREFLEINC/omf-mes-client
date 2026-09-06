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
const LOT_NO = '0009999990000005002608270000110001';

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
  /** 셸 인쇄 통로를 심는다. 없으면 브라우저와 같은 상태다. */
  shellPrint?: (() => Promise<string>) | null;
  reissueReasons?: { code: string; codeName: string }[];
}

const renderFlow = (options: FlowOptions = {}) => {
  const sent: Sent[] = [];
  const lotId = options.lotId ?? null;
  const receipts = Array.from({ length: options.receiptCount ?? 1 }, (_, index) =>
    receiptOf(index + 1),
  );

  const record = async (request: Request): Promise<void> => {
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      headers: request.headers,
      body: request.body === null ? null : await request.clone().json(),
    });
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
    processId: null,
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
          match: (request) => new URL(request.url).pathname === '/mdm/items',
          respond: () =>
            jsonResponse({
              items: [
                { itemId: 8601, itemCode: 'SYN-ITEM-01', itemName: '합성 품목 가', isActive: true },
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
          match: (request) =>
            new URL(request.url).pathname ===
            `/app/document-issues/${String(ISSUE_LOG_ID)}/rendition`,
          respond: () =>
            new Response(new Uint8Array([1, 2, 3]), {
              status: 200,
              headers: { 'Content-Type': 'image/png' },
            }),
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
    name: 'SYN-IB-0001 SYN-ITEM-01 · 합성 품목 가 선택',
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
    expect(screen.getByText('사번을 확인한 뒤에 등록·인쇄할 수 있습니다.')).toBeInTheDocument();
  });

  it('등록 → 발행 기록 → 인쇄 결과 보고 순으로 부르고, 사번을 헤더에 싣는다', async () => {
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
      '/trace/lots',
      '/app/document-issues',
      `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`,
    ]);

    for (const entry of sent) {
      expect(entry.headers.get('X-Worker-No')).toBe(WORKER_NO);
      expect(entry.headers.get('Idempotency-Key')).not.toBeNull();
    }
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

  it('셸이 인쇄에 성공하면 성공으로 보고한다', async () => {
    const { user, sent } = renderFlow({ shellPrint: vi.fn(async () => 'C:/syn/label.png') });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(
        sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`)?.body,
      ).toEqual({ outcome: 'SUCCEEDED' });
    });
  });

  it('⛔ 셸 통로가 없으면 인쇄 성공으로 보고하지 않고 사유와 함께 실패로 보고한다', async () => {
    const { user, sent } = renderFlow();
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '등록·인쇄' }));

    await waitFor(() => {
      expect(
        sentTo(sent, `/app/document-issues/${String(ISSUE_LOG_ID)}:report-print`)?.body,
      ).toMatchObject({ outcome: 'FAILED' });
    });

    expect(await screen.findByText(/라벨이 나오지 않았습니다/u)).toBeInTheDocument();
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

    expect(await screen.findByText(/라벨이 나오지 않았습니다|인쇄했습니다/u)).toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', { name: 'SYN-IB-0002 SYN-ITEM-01 · 합성 품목 가 선택' }),
    );

    expect(screen.queryByText(/라벨이 나오지 않았습니다|인쇄했습니다/u)).not.toBeInTheDocument();
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

    // 등록이 끝났으므로 단추 이름은 「인쇄」다 — 그 단추도, 재인쇄도 막혀 있어야 한다.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '인쇄' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: '재인쇄' })).toBeDisabled();
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

    await user.click(screen.getByRole('button', { name: '닫기' }));
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

  /**
   * ⛔ **다른 본문에 같은 키를 실지 않는다.** 발행이 실패한 줄은 재인쇄 경로가 열리는데, 재인쇄
   * 본문에는 사유가 붙는다 — 키를 그대로 물려주면 사유 없는 앞선 발행이 되돌아오거나 거절된다.
   */
  it('재인쇄는 본문이 달라지므로 새 멱등 키로 나간다', async () => {
    const { user, sent } = renderFlow({ lotId: LOT_ID, issueFails: true });
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '인쇄' }));
    expect(await screen.findByText('등록·인쇄를 끝내지 못했습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '닫기' }));

    await user.click(screen.getByRole('button', { name: '재인쇄' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('combobox', { name: '사유' }));
    await user.click(await screen.findByRole('option', { name: '인쇄 실패' }));
    await user.click(dialog.getByRole('button', { name: '재인쇄' }));

    await waitFor(() => {
      expect(sent.filter((entry) => entry.path === '/app/document-issues')).toHaveLength(2);
    });

    const issues = sent.filter((entry) => entry.path === '/app/document-issues');
    expect(issues[1]?.body).toMatchObject({ reissueReasonCode: 'SYN_REISSUE_01' });
    expect(issues[0]?.headers.get('Idempotency-Key')).not.toBe(
      issues[1]?.headers.get('Idempotency-Key'),
    );
  });

  /**
   * ⚠ **종이가 안 나온 채 보고까지 실패한 것은 인쇄 실패다.** 기록은 남았으니 재인쇄로 이어간다 —
   * 「끝내지 못했습니다」로 접으면 다음에 무엇을 할지가 사라진다.
   */
  it('셸이 없어 못 찍고 보고까지 실패하면 재인쇄로 안내한다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID, reportFails: true });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    expect(await screen.findByText(/라벨이 나오지 않았습니다/u)).toBeInTheDocument();
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
        screen.getByRole('button', { name: 'SYN-IB-0002 SYN-ITEM-01 · 합성 품목 가 선택' }),
      ).toBeDisabled();
    });
  });

  /**
   * ⚠ **종이가 나온 뒤의 실패는 다르게 말한다.** 「끝내지 못했습니다」로 내면 작업자가 다시 찍어
   * 같은 LOT 의 라벨이 두 장 돌아다닌다.
   */
  it('인쇄는 됐고 보고만 실패하면 다시 찍지 말라고 말한다', async () => {
    const { user } = renderFlow({
      lotId: LOT_ID,
      reportFails: true,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
    });
    await chooseLine(user);
    await user.click(screen.getByRole('button', { name: '인쇄' }));

    expect(
      await screen.findByText(
        '라벨은 나왔습니다. 인쇄 결과만 서버에 남기지 못했습니다 — 다시 찍지 마세요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('등록·인쇄를 끝내지 못했습니다.')).not.toBeInTheDocument();
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

  it('LOT 번호를 뜻의 경계로 끊어 보인다 — 라벨과 눈으로 대조하는 자리다', async () => {
    const { user } = renderFlow({ lotId: LOT_ID });
    await chooseLine(user);

    expect(await screen.findByText('000999999 000000500 260827 000011 0001')).toBeInTheDocument();
  });
});

describe('PopMaterialLotLabelScreen — 재인쇄', () => {
  it('발행한 적이 없으면 재인쇄를 막는다 — 재발행할 회차가 없다', async () => {
    const { user } = renderFlow();
    await chooseLine(user);

    expect(screen.getByRole('button', { name: '재인쇄' })).toBeDisabled();
  });

  it('사유를 고르기 전에는 보내지 않고, 고른 사유를 본문에 싣는다', async () => {
    const { user, sent } = renderFlow({
      lotId: LOT_ID,
      shellPrint: vi.fn(async () => 'C:/syn/label.png'),
    });
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
    await chooseLine(user);

    await user.click(screen.getByRole('button', { name: '재인쇄' }));

    expect(
      await screen.findByText(
        '고를 수 있는 재발행 사유가 아직 없습니다. 사유 없이는 재인쇄할 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });
});
