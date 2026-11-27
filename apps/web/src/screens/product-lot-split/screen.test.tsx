import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { PuToastHost } from '../../patterns/pop-uniform';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { ProductLotSplit, SplitLookup, SplitResult } from './queries';
import { ProductLotSplitScreen } from './screen';

/*
 * P-04-08 생산 LOT 분리(피처 013 · 시안 P0408). 합성값만 쓴다.
 * 시험 이름 앞 ID 는 verification.md · quickstart.md 의 것이다.
 */

const t = messages.productLotSplit;
const WORKER = '900028';
const LOT_NO = 'SYN-PL-261118-0412';

afterEach(() => {
  delete window.pop;
});

const lookupOf = (overrides: Partial<SplitLookup> = {}): SplitLookup => ({
  lot: {
    lotId: 123,
    lotNo: LOT_NO,
    itemCode: 'SYN-ITEM-01',
    itemName: '합성 보호 케이스',
    uomCode: 'EA',
    statusCode: 'NORMAL',
    workOrderNo: 'WO-SYN-0012',
    labelQty: 100,
  },
  blocked: null,
  locations: [
    {
      locationId: 45,
      locationCode: 'FG-A-01',
      warehouseCode: 'FG',
      onHandQty: 100,
      selectable: true,
      blocked: null,
      systemRoleCode: null,
    },
  ],
  ...overrides,
});

const RESULT: SplitResult = {
  productLotSplitId: 9,
  parentLot: { lotId: 123, lotNo: LOT_NO, qty: 70, documentIssueLogId: 501, issueSeq: 2 },
  childLot: { lotId: 777, lotNo: `${LOT_NO}-S1`, qty: 30, documentIssueLogId: 502, issueSeq: 1 },
  location: { locationId: 45, locationCode: 'FG-A-01', warehouseCode: 'FG' },
  splitAt: '2026-11-20T02:12:00Z',
};

const splitRow = (overrides: Partial<ProductLotSplit> = {}): ProductLotSplit => ({
  productLotSplitId: 3,
  status: 'UNCONFIRMED',
  parentLot: { lotId: 301, lotNo: 'SYN-PL-261116-0107', qty: 150 },
  childLot: { lotId: 302, lotNo: 'SYN-PL-261116-0107-S2', qty: 50 },
  item: { itemId: 1, itemCode: 'SYN-ITEM-01', itemName: '합성 보호 케이스', uomCode: 'EA' },
  location: { locationId: 46, locationCode: 'FG-A-04' },
  splitAt: '2026-11-19T09:05:00Z',
  splitWorkerNo: WORKER,
  confirmedAt: null,
  confirmedWorkerNo: null,
  lastPrint: { parent: 'PRINTED', child: 'FAILED' },
  ...overrides,
});

interface Sent {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Headers;
  body: unknown;
}

interface Options {
  lookup?: SplitLookup | ((lotNo: string) => Response);
  queue?: ProductLotSplit[] | (() => ProductLotSplit[]);
  split?: () => Response;
  reasons?: { code: string; codeName: string }[];
}

const REASONS = [
  { code: 'PRINT_FAILURE', codeName: '인쇄 실패' },
  { code: 'DAMAGED', codeName: '라벨 손상' },
  { code: 'LOST', codeName: '분실' },
  { code: 'LOT_SPLIT', codeName: 'LOT 분리' },
];

const render = (options: Options = {}) => {
  const sent: Sent[] = [];
  const record = async (request: Request): Promise<void> => {
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.clone().text();
    sent.push({
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      headers: request.headers,
      body: text === '' ? null : (JSON.parse(text) as unknown),
    });
  };
  const queueOf = (): ProductLotSplit[] =>
    typeof options.queue === 'function' ? options.queue() : (options.queue ?? []);
  const pathIs = (path: string) => (request: Request) => new URL(request.url).pathname === path;
  let reissueSeq = 0;

  const fetch = createStubFetch([
    {
      match: pathIs('/logistics/product-lot-splits:lookup'),
      respond: async (request) => {
        await record(request);
        const lotNo = new URL(request.url).searchParams.get('lotNo') ?? '';
        if (typeof options.lookup === 'function') return options.lookup(lotNo);
        return jsonResponse(options.lookup ?? lookupOf());
      },
    },
    {
      match: (request) =>
        pathIs('/logistics/product-lot-splits')(request) && request.method === 'GET',
      respond: async (request) => {
        await record(request);
        const items = queueOf();
        return jsonResponse({
          items,
          page: { page: 1, size: 200, total: items.length },
          unconfirmedCount: items.length,
        });
      },
    },
    {
      match: (request) =>
        pathIs('/logistics/product-lot-splits')(request) && request.method === 'POST',
      respond: async (request) => {
        await record(request);
        return options.split?.() ?? jsonResponse(RESULT);
      },
    },
    {
      match: (request) => pathIs('/app/document-issues')(request) && request.method === 'POST',
      respond: async (request) => {
        await record(request);
        reissueSeq += 1;
        const body = (await request.json()) as { targets: { targetId: number }[] };
        return jsonResponse(
          {
            items: body.targets.map((target, index) => ({
              documentIssueLogId: 900 + reissueSeq * 10 + index,
              documentTypeCode: 'PRODUCTION_LOT_LABEL',
              target: { targetTypeCode: 'LOT', targetId: target.targetId, displayName: 'LOT' },
              issueSeq: 3,
              issuedBy: 1,
              issuedByName: '합성',
              issuedAt: '2026-11-20T03:00:00Z',
              printOutcome: 'PENDING',
            })),
            issuedCount: body.targets.length,
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => /:report-print$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        await record(request);
        return jsonResponse({});
      },
    },
    {
      match: pathIs('/app/printers'),
      respond: () =>
        jsonResponse({
          items: [
            {
              printerName: 'syn-label-printer',
              displayName: '합성 라벨 프린터',
              status: 'READY',
              statusMessage: '대기 중',
              isDefault: true,
            },
          ],
        }),
    },
    {
      match: pathIs('/mdm/code-values'),
      respond: () =>
        jsonResponse({
          items: (options.reasons ?? REASONS).map((reason, index) => ({
            codeValueId: index + 1,
            codeGroupId: 9,
            code: reason.code,
            codeName: reason.codeName,
            displayOrder: index + 1,
            isActive: true,
          })),
          page: { page: 1, size: 50, total: (options.reasons ?? REASONS).length },
        }),
    },
  ]);
  const identity: PopIdentity = {
    terminalId: 7,
    processes: null,
    equipment: null,
    workerNo: WORKER,
    plantId: 7701,
  };

  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <ProductLotSplitScreen />
      <PuToastHost />
    </PopIdentityProvider>,
    { fetch },
  );

  return { sent };
};

/** 셸 인쇄 — `failAt` 번째(1부터) 장에서 실패한다. */
const shellPrints = (failAt: number | null = null) => {
  const saved: string[] = [];
  window.pop = {
    rendition: {
      save: (_bytes: Uint8Array, label: string) => {
        saved.push(label);
        return failAt !== null && saved.length === failAt
          ? Promise.reject(new Error('용지 없음'))
          : Promise.resolve('/tmp/x.tspl');
      },
    },
  } as unknown as typeof window.pop;
  return saved;
};

const scan = async (user: ReturnType<typeof userEvent.setup>, lotNo = LOT_NO) => {
  const field = screen.getByRole('textbox', { name: t.work.scanLabel });
  await user.type(field, `${lotNo}{Enter}`);
};

const keypad = async (user: ReturnType<typeof userEvent.setup>, digits: string) => {
  for (const digit of digits) {
    await user.click(screen.getByRole('button', { name: digit }));
  }
};

const splitButton = () => screen.getByRole('button', { name: t.bar.split });

describe('P-04-08 생산 LOT 분리', () => {
  it('Q24 · US1-1 · Q1 스캔 → 위치 하나 자동 선택 → 키패드 30 → 「원래 70 / 새 30」 → 분리 → 두 장 미리보기 → 인쇄 → 보고', async () => {
    const user = userEvent.setup();
    const saved = shellPrints();
    const { sent } = render();

    await scan(user);
    await screen.findByText(LOT_NO);
    expect(sent.find((each) => each.path.endsWith(':lookup'))?.search.get('lotNo')).toBe(LOT_NO);
    /* 위치가 하나면 이미 골라져 있다. */
    expect(screen.getByRole('radio', { name: /FG-A-01/u }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(splitButton()).toHaveProperty('disabled', true);

    await keypad(user, '30');
    const preview = screen.getByRole('group', { name: t.preview.label });
    expect(within(preview).getByText('70 EA')).toBeTruthy();
    expect(within(preview).getByText('30 EA')).toBeTruthy();

    await user.click(splitButton());
    const dialog = await screen.findByRole('dialog', { name: t.dialog.splitTitle });
    const post = sent.find(
      (each) => each.method === 'POST' && each.path === '/logistics/product-lot-splits',
    );
    expect(post?.body).toMatchObject({ lotId: 123, locationId: 45, qty: 30 });
    expect((post?.body as { businessDate: string }).businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(post?.headers.get('X-Worker-No')).toBe(WORKER);
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(within(dialog).getByText(t.dialog.parentCaption(2))).toBeTruthy();
    expect(within(dialog).getByText(t.dialog.childCaption(1))).toBeTruthy();
    expect(within(dialog).getByText('QTY 70 EA')).toBeTruthy();
    expect(within(dialog).getByText('QTY 30 EA')).toBeTruthy();
    expect(within(dialog).getAllByText('W/O WO-SYN-0012')).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.print }));
    await screen.findByText(t.result.printedTitle);
    /* 원래 → 새 차례로 두 장, 각 장마다 성공 보고. */
    expect(saved).toEqual([LOT_NO, `${LOT_NO}-S1`]);
    const reports = sent.filter((each) => each.path.endsWith(':report-print'));
    expect(reports.map((each) => each.path)).toEqual([
      '/app/document-issues/501:report-print',
      '/app/document-issues/502:report-print',
    ]);
    expect(
      reports.every((each) => (each.body as { outcome: string }).outcome === 'SUCCEEDED'),
    ).toBe(true);
  });

  it('F1 조회가 끝나면 스캔 칸이 비고 다시 포커스를 잡아, 막힌 LOT 다음 스캔이 이어 붙지 않는다', async () => {
    const user = userEvent.setup();
    const { sent } = render({
      lookup: (lotNo) =>
        jsonResponse(
          lotNo === 'SYN-BLOCKED'
            ? lookupOf({ blocked: { code: 'INVALID_STATE', detail: 'HOLD' } })
            : lookupOf(),
        ),
    });
    const field = screen.getByRole('textbox', { name: t.work.scanLabel });

    await user.type(field, 'SYN-BLOCKED{Enter}');
    await screen.findByText(t.blocked.INVALID_STATE.title('보류'));
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });
    expect((field as HTMLInputElement).value).toBe('');

    /* 스캐너의 다음 스캔 — 칸을 누르지 않고 바로 친다. */
    await user.keyboard(`${LOT_NO}{Enter}`);
    await waitFor(() => {
      expect(
        sent
          .filter((each) => each.path.endsWith(':lookup'))
          .map((each) => each.search.get('lotNo')),
      ).toEqual(['SYN-BLOCKED', LOT_NO]);
    });
  });

  it('US1-3 처음 발행하는 원래 LOT(응답 1회차)은 「첫 발행」, 2회차 이상은 「재발행」으로 적는다', async () => {
    const user = userEvent.setup();
    shellPrints();
    render({
      split: () => jsonResponse({ ...RESULT, parentLot: { ...RESULT.parentLot, issueSeq: 1 } }),
    });

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    const dialog = await screen.findByRole('dialog', { name: t.dialog.splitTitle });
    expect(within(dialog).getByText(t.dialog.parentFirstCaption(1))).toBeTruthy();
    expect(within(dialog).queryByText(t.dialog.parentCaption(1))).toBeNull();
  });

  it('US1-3 분리 직후 인쇄는 사유를 묻지 않는다 — 다시 발행 요청이 없다', async () => {
    const user = userEvent.setup();
    shellPrints();
    const { sent } = render();

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    const dialog = await screen.findByRole('dialog', { name: t.dialog.splitTitle });
    expect(within(dialog).queryByRole('radiogroup')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: t.dialog.print }));
    await screen.findByText(t.result.printedTitle);
    expect(sent.some((each) => each.path === '/app/document-issues')).toBe(false);
  });

  it('US1-6 · Q6 두 위치에 있으면 고르기 전 단추가 꺼지고, 막힌 위치 타일은 고를 수 없다', async () => {
    const user = userEvent.setup();
    render({
      lookup: lookupOf({
        lot: { ...lookupOf().lot, labelQty: 160 },
        locations: [
          {
            locationId: 45,
            locationCode: 'FG-A-01',
            warehouseCode: 'FG',
            onHandQty: 100,
            selectable: true,
            blocked: null,
            systemRoleCode: null,
          },
          {
            locationId: 46,
            locationCode: 'FG-A-02',
            warehouseCode: 'FG',
            onHandQty: 60,
            selectable: true,
            blocked: null,
            systemRoleCode: null,
          },
          {
            locationId: 90,
            locationCode: 'UWVT-SYS-STAGING',
            warehouseCode: 'FG',
            onHandQty: 20,
            selectable: false,
            blocked: { code: 'PUTAWAY_PENDING' },
            systemRoleCode: 'PUTAWAY_STAGING',
          },
        ],
      }),
    });

    await scan(user);
    await screen.findByText(LOT_NO);
    /* 고를 수 있는 위치만 센다(적치 대기 자리는 빼고 둘). */
    expect(screen.getByText(t.location.many(2, '160 EA'))).toBeTruthy();
    expect(screen.getByRole('radio', { name: /FG-A-01/u }).getAttribute('aria-checked')).toBe(
      'false',
    );
    /* 적치 대기 자리는 시스템 코드 대신 「적치 대기」로 보인다. */
    expect(screen.queryByText('UWVT-SYS-STAGING')).toBeNull();
    expect(
      screen.getByRole('radio', {
        name: new RegExp(`^${t.location.blocked.PUTAWAY_PENDING ?? ''}`, 'u'),
      }),
    ).toHaveProperty('disabled', true);
    expect(screen.getByText(t.location.blocked.PUTAWAY_PENDING ?? '')).toBeTruthy();
    /* 위치를 고르기 전에는 수량 칸도 없다. */
    expect(screen.queryByRole('textbox', { name: t.qty.label })).toBeNull();
    expect(splitButton()).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('radio', { name: /FG-A-02/u }));
    await keypad(user, '20');
    /* 원래 라벨 수량은 LOT 하나의 값 — 160 − 20. */
    const preview = screen.getByRole('group', { name: t.preview.label });
    expect(within(preview).getByText('140 EA')).toBeTruthy();
    expect(splitButton()).toHaveProperty('disabled', false);
  });

  it('US2-4 · Q11 수량이 그 위치 보유 이상이면 「수량을 확인하세요」, 단추가 꺼진다', async () => {
    const user = userEvent.setup();
    render();

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '100');
    expect(screen.getByText(t.qty.badTitle)).toBeTruthy();
    expect(screen.getByText(t.qty.bad('100 EA'), { exact: false })).toBeTruthy();
    expect(splitButton()).toHaveProperty('disabled', true);
    /* 정수 단위(EA)는 소수점 키가 꺼진다. */
    expect(screen.getByRole('button', { name: '.' })).toHaveProperty('disabled', true);
  });

  it('US2-4 서버가 400 RANGE 로 돌려보내면 같은 수량 안내를 보인다', async () => {
    const user = userEvent.setup();
    render({
      split: () =>
        jsonResponse(
          { errors: [{ scope: 'field', field: 'qty', code: 'RANGE', message: '범위 밖' }] },
          { status: 400 },
        ),
    });

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    expect(await screen.findByText(t.qty.badTitle)).toBeTruthy();
    expect(splitButton()).toHaveProperty('disabled', true);
  });

  describe('T026 막힌 이유 — 스캔 조회의 blocked', () => {
    const cases: [string, string | null, string][] = [
      /* 피처 016 US1-3 · Q4 — 공정 반제품 LOT 은 「반제품 LOT 은 분리할 수 없습니다」. */
      ['SEMI_FINISHED_LOT', null, t.blocked.SEMI_FINISHED_LOT.title],
      ['NOT_PRODUCTION_LOT', null, t.blocked.NOT_PRODUCTION_LOT.title],
      ['SPLIT_SERIAL_LOT', null, t.blocked.SPLIT_SERIAL_LOT.title],
      ['INVALID_STATE', 'HOLD', t.blocked.INVALID_STATE.title('보류')],
      ['LOT_SPLIT_UNCONFIRMED', '2026-11-20T02:12:00Z', t.blocked.LOT_SPLIT_UNCONFIRMED.title],
      ['LOT_ALREADY_RESERVED', 'SR-2611-0042', t.blocked.LOT_ALREADY_RESERVED.title],
    ];

    it.each(cases)('US2 %s → 빨간 안내, 위치·수량 칸 없음', async (code, detail, title) => {
      const user = userEvent.setup();
      render({
        lookup: lookupOf({
          blocked: { code: code as never, detail },
        }),
      });

      await scan(user);
      expect(await screen.findByText(title)).toBeTruthy();
      expect(screen.queryByRole('radiogroup', { name: t.location.label })).toBeNull();
      expect(splitButton()).toHaveProperty('disabled', true);
    });

    it('US2-1 · Q8 예약된 LOT 은 지시서 번호를 문구에 넣는다', async () => {
      const user = userEvent.setup();
      render({
        lookup: lookupOf({ blocked: { code: 'LOT_ALREADY_RESERVED', detail: 'SR-2611-0042' } }),
      });

      await scan(user);
      expect(
        await screen.findByText(t.blocked.LOT_ALREADY_RESERVED.body('SR-2611-0042'), {
          exact: false,
        }),
      ).toBeTruthy();
    });
  });

  describe('T026 막힌 이유 — 분리 409 code', () => {
    const codes = [
      'SEMI_FINISHED_LOT',
      'NOT_PRODUCTION_LOT',
      'SPLIT_SERIAL_LOT',
      'INVALID_STATE',
      'LOT_SPLIT_UNCONFIRMED',
      'LOT_ALREADY_RESERVED',
      'PUTAWAY_PENDING',
      'NOT_PRODUCT_WAREHOUSE',
      'MIXED_STOCK_STATUS',
    ] as const;

    it.each(codes)('US2 409 %s → 그 code 의 문구, 단추 꺼짐', async (code) => {
      const user = userEvent.setup();
      render({
        split: () =>
          jsonResponse({ code, message: '거절', conflictCause: 'user' }, { status: 409 }),
      });

      await scan(user);
      await screen.findByText(LOT_NO);
      await keypad(user, '30');
      await user.click(splitButton());
      const title =
        code === 'INVALID_STATE' ? t.blocked.INVALID_STATE.titleNoState : t.blocked[code].title;
      expect(await screen.findByText(title)).toBeTruthy();
      expect(splitButton()).toHaveProperty('disabled', true);
    });
  });

  it('US2-1 · Q8 분리 409 가 실은 값(지시서 번호 · 분리 시각 · 상태)을 조회 때와 같은 문구로 보인다', async () => {
    const user = userEvent.setup();
    let answer: { code: string; detail: string | null } = {
      code: 'LOT_ALREADY_RESERVED',
      detail: 'SR-2611-0042',
    };
    render({
      split: () =>
        jsonResponse({ ...answer, message: '거절', conflictCause: 'user' }, { status: 409 }),
    });

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    expect(
      await screen.findByText(t.blocked.LOT_ALREADY_RESERVED.body('SR-2611-0042'), {
        exact: false,
      }),
    ).toBeTruthy();

    answer = { code: 'INVALID_STATE', detail: 'HOLD' };
    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    expect(await screen.findByText(t.blocked.INVALID_STATE.title('보류'))).toBeTruthy();

    answer = { code: 'LOT_SPLIT_UNCONFIRMED', detail: '2026-11-20T02:12:00Z' };
    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    expect(
      await screen.findByText(t.blocked.LOT_SPLIT_UNCONFIRMED.body('11-20 09:12'), {
        exact: false,
      }),
    ).toBeTruthy();
  });

  it('US2-7 · Q13 확인 전 LOT 은 「분리 확인을 먼저 하세요」와 나눈 시각을 보인다', async () => {
    const user = userEvent.setup();
    render({
      lookup: lookupOf({
        blocked: { code: 'LOT_SPLIT_UNCONFIRMED', detail: '2026-11-20T02:12:00Z' },
      }),
    });

    await scan(user);
    expect(await screen.findByText(t.blocked.LOT_SPLIT_UNCONFIRMED.title)).toBeTruthy();
    expect(
      screen.getByText(t.blocked.LOT_SPLIT_UNCONFIRMED.body('11-20 09:12'), { exact: false }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: t.lot.label })).getByText(t.lot.queued),
    ).toBeTruthy();
  });

  it('Q13 없는 번호(404)는 칸 아래 빨간 한 줄', async () => {
    const user = userEvent.setup();
    render({
      lookup: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'NOT_FOUND', message: '없음' }] },
          { status: 404 },
        ),
    });

    await scan(user, 'NO-SUCH-LOT');
    expect(await screen.findByText(t.work.notFound('NO-SUCH-LOT'))).toBeTruthy();
  });

  it('Q7 인쇄 한 장(새 LOT) 실패 → 결과 띠 「1장을 인쇄하지 못했습니다」, 목록 칩 「인쇄 실패」', async () => {
    const user = userEvent.setup();
    shellPrints(2);
    let printedOnce = false;
    const { sent } = render({
      queue: () =>
        printedOnce
          ? [
              splitRow({
                productLotSplitId: 9,
                parentLot: { lotId: 123, lotNo: LOT_NO, qty: 70 },
                childLot: { lotId: 777, lotNo: `${LOT_NO}-S1`, qty: 30 },
                lastPrint: { parent: 'PRINTED', child: 'FAILED' },
              }),
            ]
          : [],
    });

    await scan(user);
    await screen.findByText(LOT_NO);
    await keypad(user, '30');
    await user.click(splitButton());
    const dialog = await screen.findByRole('dialog', { name: t.dialog.splitTitle });
    printedOnce = true;
    await user.click(within(dialog).getByRole('button', { name: t.dialog.print }));

    expect(await screen.findByText(t.result.failedTitle(1, t.result.whichChild))).toBeTruthy();
    const reports = sent.filter((each) => each.path.endsWith(':report-print'));
    expect((reports[1]?.body as { outcome: string }).outcome).toBe('FAILED');
    expect(await screen.findByText(t.queue.childChip(t.queue.failed))).toBeTruthy();
    expect(screen.getByText(t.queue.newTag)).toBeTruthy();
  });

  it('US1-7 · Q7 확인 대기 줄을 고르면 사유(「LOT 분리」 없음)를 받고 두 장을 다시 출력한다', async () => {
    const user = userEvent.setup();
    const saved = shellPrints();
    const row = splitRow();
    const { sent } = render({
      queue: [row],
      lookup: (lotNo) =>
        jsonResponse(
          lookupOf({
            lot: { ...lookupOf().lot, lotNo, workOrderNo: 'WO-SYN-0099' },
            blocked: { code: 'LOT_SPLIT_UNCONFIRMED', detail: row.splitAt },
          }),
        ),
    });

    await user.click(
      await screen.findByRole('radio', { name: t.queue.choose(row.parentLot.lotNo) }),
    );
    await user.click(screen.getByRole('button', { name: t.bar.reprint }));
    const dialog = await screen.findByRole('dialog', { name: t.dialog.reprintTitle });
    await within(dialog).findByRole('radio', { name: '인쇄 실패' });
    expect(within(dialog).queryByRole('radio', { name: 'LOT 분리' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: t.dialog.print })).toHaveProperty(
      'disabled',
      true,
    );

    await user.click(within(dialog).getByRole('radio', { name: '라벨 손상' }));
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: t.dialog.print })).toHaveProperty(
        'disabled',
        false,
      );
    });
    await user.click(within(dialog).getByRole('button', { name: t.dialog.print }));

    expect(await screen.findByText(t.result.reprinted)).toBeTruthy();
    const issue = sent.find((each) => each.path === '/app/document-issues');
    expect(issue?.body).toEqual({
      documentTypeCode: 'PRODUCTION_LOT_LABEL',
      targets: [
        { targetTypeCode: 'LOT', targetId: 301 },
        { targetTypeCode: 'LOT', targetId: 302 },
      ],
      reissueReasonCode: 'DAMAGED',
      printerName: 'syn-label-printer',
    });
    expect(saved).toEqual([row.parentLot.lotNo, row.childLot.lotNo]);
  });

  it('재검증 2회차 확인 대기 줄을 고르거나 다시 출력 사유 창을 닫으면 포커스가 스캔 칸으로 돌아온다', async () => {
    const user = userEvent.setup();
    const row = splitRow();
    render({ queue: [row] });
    const field = screen.getByRole('textbox', { name: t.work.scanLabel });

    await user.click(
      await screen.findByRole('radio', { name: t.queue.choose(row.parentLot.lotNo) }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });

    await user.click(screen.getByRole('button', { name: t.bar.reprint }));
    const dialog = await screen.findByRole('dialog', { name: t.dialog.reprintTitle });
    await user.click(within(dialog).getByRole('button', { name: t.dialog.close }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(field);
    });
  });

  it('US1-1 빈 목록이면 「확인 대기 분리가 없습니다」, 목록 머리 수 0', async () => {
    render({ queue: [] });

    expect(await screen.findByText(t.queue.emptyTitle)).toBeTruthy();
    const queue = screen.getByRole('region', { name: t.queue.title });
    expect(within(queue).getByText('0')).toBeTruthy();
  });
});
