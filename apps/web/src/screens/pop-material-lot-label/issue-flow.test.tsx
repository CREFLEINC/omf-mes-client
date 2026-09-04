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
              items: [lineOf(receiptNo === 1 ? lotId : null, receiptNo)],
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

            return options.issueFails === true
              ? jsonResponse({ message: '실패' }, { status: 500 })
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

            return jsonResponse(issueRecord(1));
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
