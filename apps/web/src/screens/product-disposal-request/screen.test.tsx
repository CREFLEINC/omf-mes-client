import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ProductDisposalRequestScreen } from './screen';

/**
 * 화면 단위 시험.
 *
 * ⭐ **가장 값진 단언은 「무엇이 나가는가」다** — 되돌릴 수 없는 폐기라, 화면이 그리는 모습보다
 * 서버로 나가는 본문이 맞는지가 먼저다.
 */

const t = messages.productDisposalRequest;

const DECISION = {
  dispositionDecisionId: 7001,
  nonconformanceId: 3001,
  nonconformanceNo: 'NC-2026-0071',
  dispositionTypeCode: 'SCRAP' as const,
  decisionQty: 40,
  uomId: 3,
  reason: '재작업 불가 — 변형 손상',
  decidedBy: 12,
  decidedByName: '김품질',
  decidedAt: '2026-09-07T10:00:00+09:00',
  lotId: 9001,
  lotNo: 'FG-0288',
  itemId: 501,
  followUpStatusCode: 'NOT_STARTED' as const,
  followUpQty: 0,
};

const page = { page: 1, size: 50, totalElements: 1, totalPages: 1 };

/** 계약의 `CodeValue` 그대로 만든다 — 필드 이름이 어긋나면 화면이 「이름 없음」만 보인다. */
const codeValues = (values: { code: string; codeName: string }[]) => ({
  items: values.map((one, index) => ({
    codeValueId: index + 1,
    codeGroupId: 1,
    code: one.code,
    codeName: one.codeName,
    displayOrder: index,
    isActive: true,
  })),
  page,
});

const DETAIL = {
  goodsIssue: {
    goodsIssueId: 4001,
    goodsIssueNo: 'GI-2026-000401',
    issueTypeCode: 'OTHER',
    sourceDocumentTypeCode: 'DISPOSITION_DECISION',
    sourceDocumentId: 7001,
    sourceWarehouseId: 11,
    issuedAt: '2026-09-09T10:00:00+09:00',
    statusCode: 'DRAFT',
    approvalRequestId: 5001,
  },
  lines: [],
};

interface StubOptions {
  onCreate?: (request: Request) => void;
  onSubmit?: (request: Request) => void;
  balances?: unknown[];
  /** 상신 응답 상태. 실패 뒤 재시도를 재현할 때 쓴다. */
  submitStatus?: number;
  /** 이력 목록에 실을 전표. 전기 경로를 재현할 때 쓴다. */
  historyRows?: unknown[];
  onPost?: (request: Request) => void;
  postStatus?: number;
}

const buildFetch = (options: StubOptions = {}) =>
  createStubFetch([
    {
      match: (r) => r.url.includes('/quality/disposition-decisions'),
      respond: () => jsonResponse({ items: [DECISION], page }),
    },
    {
      match: (r) => r.url.includes('/inventory/balances'),
      respond: () =>
        jsonResponse({
          items: options.balances ?? [
            {
              groupBy: 'LOCATION',
              itemId: 501,
              lotId: 9001,
              warehouseId: 11,
              locationId: 77,
              ownershipTypeCode: 'OWNED',
              onHandQty: 40,
              reservedQty: 0,
              pickedQty: 0,
              blockedQty: 0,
              availableQty: 40,
              uomId: 3,
            },
          ],
          page,
        }),
    },
    {
      match: (r) => r.url.includes('/app/approval-routes'),
      respond: () =>
        jsonResponse({
          items: [
            {
              approvalRouteId: 1,
              approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
              businessUnitId: null,
              isActive: true,
            },
          ],
          page,
        }),
    },
    {
      match: (r) => r.url.includes('codeGroupCode=ISSUE_TYPE'),
      respond: () => jsonResponse(codeValues([{ code: 'OTHER', codeName: '기타출고' }])),
    },
    {
      match: (r) => r.url.includes('codeGroupCode=GOODS_ISSUE_REASON'),
      respond: () =>
        jsonResponse(codeValues([{ code: 'DEFECT_AFTER_RECEIPT', codeName: '입고 후 불량' }])),
    },
    {
      match: (r) => r.url.includes('/mdm/partners'),
      respond: () =>
        jsonResponse({
          items: [{ partnerId: 303, partnerCode: 'P-303', partnerName: '한빛폐기물' }],
          page,
        }),
    },
    {
      match: (r) => r.url.includes('/mdm/items'),
      respond: () => jsonResponse({ items: [], page }),
    },
    { match: (r) => r.url.includes('/mdm/uoms'), respond: () => jsonResponse({ items: [], page }) },
    {
      match: (r) => r.method === 'POST' && r.url.endsWith('/logistics/goods-issues'),
      respond: (request) => {
        options.onCreate?.(request.clone());
        return jsonResponse(
          {
            goodsIssue: {
              goodsIssueId: 4001,
              goodsIssueNo: 'GI-2026-000401',
              issueTypeCode: 'OTHER',
              sourceDocumentTypeCode: 'DISPOSITION_DECISION',
              sourceDocumentId: 7001,
              sourceWarehouseId: 11,
              issuedAt: '2026-09-09T10:00:00+09:00',
              statusCode: 'DRAFT',
            },
            lines: [],
          },
          { status: 201, headers: { ETag: 'W/"7"' } },
        );
      },
    },
    {
      match: (r) => r.url.includes(':request-approval'),
      respond: (request) => {
        options.onSubmit?.(request.clone());
        return jsonResponse({}, { status: options.submitStatus ?? 202 });
      },
    },
    {
      match: (r) => r.method === 'POST' && r.url.includes(':post'),
      respond: (request) => {
        options.onPost?.(request.clone());
        return options.postStatus === undefined || options.postStatus === 200
          ? jsonResponse(DETAIL.goodsIssue)
          : jsonResponse(
              { errors: [{ scope: 'screen', code: 'NOT_APPROVED', message: '승인 전입니다' }] },
              { status: options.postStatus },
            );
      },
    },
    {
      /* 상세 — **잠금 토큰이 여기 앉는다.** ETag 가 없으면 전기가 서지 않는다. */
      match: (r) => /\/logistics\/goods-issues\/\d+$/.test(new URL(r.url).pathname),
      respond: () => jsonResponse(DETAIL, { headers: { ETag: 'W/"9"' } }),
    },
    {
      match: (r) => r.url.includes('/logistics/goods-issues'),
      respond: () => jsonResponse({ items: options.historyRows ?? [], page }),
    },
  ]);

const openScreen = (options: StubOptions = {}, route = '/') =>
  renderWithProviders(<ProductDisposalRequestScreen />, { fetch: buildFetch(options), route });

/**
 * 폐기 사유를 고른다.
 *
 * ⚠ DS `Select` 는 네이티브 `<select>` 가 아니라 «열고 고르는» 콤보박스다 — `selectOptions` 로는
 * 조작되지 않는다. 저장소의 다른 화면 시험이 쓰는 방식을 그대로 쓴다.
 */
const pickReason = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(await screen.findByRole('combobox', { name: t.issue.reasonLabel }));
  await user.click(await screen.findByRole('option', { name: '입고 후 불량' }));
};

/**
 * 「승인 요청」을 눌러 **확인 창까지 통과한다.**
 *
 * ⭐ 되돌릴 수 없는 쓰기라 창이 한 겹 서 있다 — 시험도 사용자가 지나는 길을 그대로 지난다.
 */
const submitRequest = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.request.submit }));

  /* ⚠ 창의 확인 버튼과 화면 버튼이 같은 문구다 — 창 «안»에서 집는다. */
  const dialog = await screen.findByRole('dialog');

  await user.click(within(dialog).getByRole('button', { name: t.confirm.submit }));
};

describe('W-04-10 제품 폐기 요청 — 화면', () => {
  /** ⭐ 처분 사유를 요청 사유의 기본값으로 인용한다(§5-5) — 승인자가 판정 근거를 바로 본다. */
  it('대상을 고르면 처분 사유가 요청 사유에 채워진다', async () => {
    const user = userEvent.setup();
    openScreen();

    const row = await screen.findByRole('checkbox', { name: 'FG-0288 선택' });
    await user.click(row);

    await waitFor(() =>
      expect(screen.getByLabelText(t.request.reasonLabel)).toHaveValue('재작업 불가 — 변형 손상'),
    );
  });

  /**
   * ⛔ **상신 본문에 사유가 실려야 한다**(통지 #675 §3).
   *
   * 화면 끝에서 끝까지 눌러 **실제로 나가는 두 본문**을 잡는다 — 조립 함수만 검사하면 화면이
   * 그것을 부르지 않아도 통과한다.
   */
  it('승인 요청을 누르면 전표를 만들고 사유를 실어 상신한다', async () => {
    const user = userEvent.setup();
    const creates: Request[] = [];
    const submits: Request[] = [];
    openScreen({ onCreate: (r) => creates.push(r), onSubmit: (r) => submits.push(r) });

    await user.click(await screen.findByRole('checkbox', { name: 'FG-0288 선택' }));
    await user.click(await screen.findByRole('checkbox', { name: t.issue.selfDisposal }));
    await pickReason(user);
    await submitRequest(user);

    await waitFor(() => expect(submits).toHaveLength(1));

    const issueBody = (await creates[0]?.json()) as Record<string, unknown>;
    const approvalBody: unknown = await submits[0]?.json();

    expect(issueBody.sourceDocumentTypeCode).toBe('DISPOSITION_DECISION');
    expect(issueBody.postImmediately).toBe(false);
    expect(issueBody.lines).toEqual([
      { itemId: 501, lotId: 9001, issueQty: 40, uomId: 3, sourceLocationId: 77 },
    ]);
    expect(approvalBody).toEqual({ reason: '재작업 불가 — 변형 손상' });
  });

  /**
   * ⛔ **재시도가 폐기 전표를 «두 벌» 만들면 안 된다.**
   *
   * ⚠ **이 시험이 화면을 «눌러» 재현해야 한다.** 훅 시험은 얼린 본문 상수를 두 번 넘겨서
   * 화면이 매번 새로 만드는 경로를 지나지 않는다 — 실제로 그 틈에 결함이 있었다(시각이
   * 본문에 실려 멱등 지문이 매 클릭 달라졌다). 「키가 같다」가 아니라 **키를 이름으로 잡아
   * 견준다.**
   */
  it('상신이 실패한 뒤 다시 눌러도 전표를 두 벌 만들지 않는다', async () => {
    const user = userEvent.setup();
    const creates: Request[] = [];
    openScreen({
      onCreate: (r) => creates.push(r),
      submitStatus: 504,
    });

    await user.click(await screen.findByRole('checkbox', { name: 'FG-0288 선택' }));
    await user.click(await screen.findByRole('checkbox', { name: t.issue.selfDisposal }));
    await pickReason(user);

    await submitRequest(user);
    await waitFor(() => expect(creates).toHaveLength(1));

    await submitRequest(user);
    await waitFor(() => expect(creates).toHaveLength(2));

    const first = creates[0]?.headers.get('Idempotency-Key');

    expect(first).toBeTruthy();
    expect(creates[1]?.headers.get('Idempotency-Key')).toBe(first);
  });

  /**
   * ⛔ **한 LOT 이 여러 자리에 있으면 막고 사유를 말한다.**
   *
   * 첫 줄을 집으면 조용히 틀린 선반에서 빠진다. **막힌다**가 아니라 **왜 막혔는가**를 잡는다.
   */
  it('LOT 이 여러 위치에 나뉘어 있으면 그 사유로 요청을 막는다', async () => {
    const user = userEvent.setup();
    openScreen({
      balances: [
        {
          groupBy: 'LOCATION',
          itemId: 501,
          lotId: 9001,
          warehouseId: 11,
          locationId: 77,
          ownershipTypeCode: 'OWNED',
          onHandQty: 20,
          reservedQty: 0,
          pickedQty: 0,
          blockedQty: 0,
          availableQty: 20,
          uomId: 3,
        },
        {
          groupBy: 'LOCATION',
          itemId: 501,
          lotId: 9001,
          warehouseId: 11,
          locationId: 78,
          ownershipTypeCode: 'OWNED',
          onHandQty: 20,
          reservedQty: 0,
          pickedQty: 0,
          blockedQty: 0,
          availableQty: 20,
          uomId: 3,
        },
      ],
    });

    /*
     * ⭐ **채울 것을 먼저 채운다.** 게이트가 「먼저 채울 것을 먼저 말한다」라서, 사유를
     * 비워 두면 자리 사유가 아니라 사유 입력이 뜬다 — 그러면 이 시험이 엉뚱한 것을 잡는다.
     */
    await user.click(await screen.findByRole('checkbox', { name: 'FG-0288 선택' }));
    await user.click(await screen.findByRole('checkbox', { name: t.issue.selfDisposal }));
    await pickReason(user);

    expect(await screen.findByText(t.placement.split)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.request.submit })).toBeDisabled();
  });

  /** §3 — 탭 둘이 서고, 주소가 가리키는 탭이 선다. */
  it('처리 이력 탭을 주소로 열 수 있다', async () => {
    openScreen({}, '/?tab=history');

    expect(await screen.findByRole('heading', { name: t.panes.history })).toBeInTheDocument();
  });

  /**
   * ⭐ **활성 탭의 내용만 담는다** — 숨은 탭의 표가 접근성 트리에 남으면 이름으로 집는 조작과
   * 시험이 숨은 글자를 잡는다.
   */
  it('요청 탭에서는 이력 구획이 접근성 트리에 없다', async () => {
    openScreen();

    await screen.findByRole('heading', { name: t.panes.targets });

    expect(screen.queryByRole('heading', { name: t.panes.history })).not.toBeInTheDocument();
  });

  /**
   * ⛔ **요청 탭에 전기 버튼을 두지 않는다.**
   *
   * 전기는 «고른 전표»에 거는 조작인데, 요청을 올리면 초안이 비어 걸 대상이 남지 않는다.
   * 사용자는 승인 뒤 다시 와서 「처리 이력」에서 고른다(§5-4).
   */
  it('요청 탭에는 기타출고 처리 버튼을 두지 않는다', async () => {
    openScreen();

    await screen.findByRole('heading', { name: t.panes.targets });

    expect(screen.queryByRole('button', { name: t.issue.submit })).not.toBeInTheDocument();
  });

  /** ⛔ 승인·반려는 이 화면에 없다(J-10) — 어디서 하는지를 머리에 적는다. */
  it('승인·반려 버튼을 두지 않고 결재함을 가리킨다', async () => {
    openScreen();

    await screen.findByRole('heading', { name: t.panes.targets });

    expect(screen.getByText(t.headerNotice)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '반려' })).not.toBeInTheDocument();
  });

  /** ⛔ 폐기 «계정»을 묻지 않는다 — 회계는 이 시스템 밖이다(DR-009). 없는 것이 정상이라 적는다. */
  it('폐기 계정을 묻지 않고 그 사실을 적는다', async () => {
    openScreen();

    await screen.findByRole('heading', { name: t.panes.targets });

    expect(screen.getByText(t.withdrawn.account)).toBeInTheDocument();
  });

  /** §5-2 — 판정이 선행이라는 사실을 목록 위에 적는다. */
  it('판정 없이 폐기할 수 없다는 사실을 적는다', async () => {
    openScreen();

    /* 목록이 서기 전에는 배너도 없다 — 「없다」가 아니라 「아직」이라 기다린다. */
    expect(await screen.findByText(t.targets.judgmentRequired)).toBeInTheDocument();

    const pane = screen.getByRole('region', { name: t.panes.targets });

    expect(within(pane).getByText(t.targets.judgmentRequired)).toBeInTheDocument();
  });
});

describe('W-04-10 — 「기타출고 처리」', () => {
  const openHistory = (over: StubOptions = {}) =>
    openScreen({ historyRows: [DETAIL.goodsIssue], ...over }, '/?tab=history');

  /** ⛔ 고르지 않았으면 걸 대상이 없다 — 무엇을 골라야 하는지 말한다. */
  it('전표를 고르기 전에는 사유를 말하고 잠근다', async () => {
    openHistory();

    expect(await screen.findByText(t.issue.pickRow)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.issue.submit })).toBeDisabled();
  });

  /**
   * ⛔ **버튼이 실제로 요청을 보내야 한다.**
   *
   * ⚠ 한때 이 버튼에 `onClick` 이 없어 **눌러도 아무 일이 없었다.** 「열려 있다」만 단언하면
   * 그 공백을 덮는다 — **나가는 요청을 이름으로 잡는다.**
   */
  it('전표를 고르고 누르면 전기 요청이 나간다', async () => {
    const user = userEvent.setup();
    const posts: Request[] = [];
    openHistory({ onPost: (r) => posts.push(r) });

    await user.click(await screen.findByRole('checkbox', { name: '행 선택' }));

    const button = screen.getByRole('button', { name: t.issue.submit });

    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(posts).toHaveLength(1));

    const body = (await posts[0]?.json()) as Record<string, unknown>;

    /* 계약의 `PostRequest` 는 **두 값뿐**이다 — 더 실으면 서버가 모르는 필드가 나간다. */
    expect(Object.keys(body).sort()).toEqual(['businessDate', 'occurredAt']);
    /* ⛔ 잠금 토큰은 «상세»에서 온다 — 없으면 요청이 나가면 안 된다. */
    expect(posts[0]?.headers.get('If-Match')).toBe('W/"9"');
  });

  /**
   * ⛔ **승인 전이라는 판정을 화면이 흉내 내지 않는다**(J-8 · 통지 #674).
   *
   * 버튼은 열려 있고, 막는 것은 서버다. 그 문구를 배너로 낸다.
   */
  it('승인 전이면 서버의 400 을 배너로 낸다', async () => {
    const user = userEvent.setup();
    openHistory({ postStatus: 400 });

    await user.click(await screen.findByRole('checkbox', { name: '행 선택' }));

    const button = screen.getByRole('button', { name: t.issue.submit });

    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText('승인 전입니다')).toBeInTheDocument();
  });
});
