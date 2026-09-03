import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  DOCUMENT_ISSUE_LOG_ID,
  HANDLING_UNIT_ID,
  HANDLING_UNIT_NO,
  ITEM_CODE,
  ITEM_ID,
  LOT_A_ID,
  LOT_A_NO,
  LOT_B_ID,
  PROCESS_ID,
  REASON_CODE,
  REASON_NAME,
  TERMINAL_ID,
  UOM_CODE,
  UOM_ID,
  WORKER_NO,
  handlingUnit,
  lotNoOf,
  makeContent,
  makeIssue,
  readyPrinter,
} from './fixtures';
import type { RenditionShell } from './print';
import { RepackLabelIssueScreen } from './screen';

const t = messages.repackLabelIssue;

const ENTRY_ROUTE = `/pop/repack-label-issue?handlingUnitId=${String(HANDLING_UNIT_ID)}&workerNo=${WORKER_NO}`;

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

/**
 * 버튼을 **매번 다시 찾는다.**
 *
 * ⚠ 발행 버튼은 막힌 동안 `Tooltip` 에 감싸여 서고 열리면 감싸개가 풀린다 — 그때 엘리먼트가
 * 교체되므로, 처음 잡아 둔 참조는 화면이 열려도 영원히 비활성인 «떨어져 나온 노드»다(실측).
 */
const submitButton = (): HTMLElement => screen.getByRole('button', { name: t.issue.submit });

/** 사유 선택 — DS `Select` 의 트리거는 `combobox` 이고, 이름은 붙은 라벨에서 온다. */
const reasonSelect = (): HTMLElement =>
  screen.getByRole('combobox', { name: new RegExp(t.issue.reasonLabel) });

const clickWhenEnabled = async (find: () => HTMLElement): Promise<void> => {
  await waitFor(() => {
    expect(find()).toBeEnabled();
  });
  await userEvent.click(find());
};

interface Options {
  lotIds?: number[];
  canPrintLabel?: boolean;
  /** 이 포장의 발행 횟수. 0 이면 최초 발행이다 */
  issueCount?: number;
  /** 발행 이력. 기본은 없음 */
  history?: ReturnType<typeof makeIssue>[];
  printers?: (typeof readyPrinter)[];
  /** 발행 응답 상태. 기본 201 */
  issueStatus?: number;
  issueErrorBody?: unknown;
  issueWrites?: Request[];
  /** 발행 이력 조회가 실패한다 */
  historyFails?: boolean;
  /** 렌디션 조회가 실패한다 */
  renditionFails?: boolean;
  /** 인쇄 결과 보고가 실패한다 */
  reportFails?: boolean;
  /** 어느 발행 기록의 렌디션을 받았는지 담아 둔다 */
  renditionCalls?: number[];
}

const defaultReasons = [
  {
    codeValueId: 9101,
    codeGroupId: 910,
    code: REASON_CODE,
    codeName: REASON_NAME,
    displayOrder: 1,
  },
];

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
    respond: () =>
      jsonResponse({
        items: [{ processId: PROCESS_ID, canPrintLabel: options.canPrintLabel ?? true }],
      }),
  },
  {
    match: (request) => pathOf(request) === `/inventory/handling-units/${String(HANDLING_UNIT_ID)}`,
    respond: () =>
      jsonResponse({
        handlingUnit,
        contents: (options.lotIds ?? [LOT_A_ID]).map((lotId) => makeContent(lotId)),
      }),
  },
  {
    match: (request) => pathOf(request).startsWith('/trace/lots/'),
    respond: (request) => {
      const lotId = Number(pathOf(request).split('/').pop());

      return jsonResponse({
        lot: { lotId, lotNo: lotNoOf[lotId] ?? '', itemId: ITEM_ID },
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (request) => pathOf(request) === `/mdm/items/${String(ITEM_ID)}`,
    respond: () =>
      jsonResponse({
        item: { itemId: ITEM_ID, itemCode: ITEM_CODE, itemName: '샘플 품목' },
        editability: { editableFields: [] },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: UOM_ID, uomCode: UOM_CODE, uomName: '개', isActive: true }],
        page: { page: 1, size: 20, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () => jsonResponse({ items: options.printers ?? [readyPrinter] }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/summary',
    respond: () =>
      jsonResponse({
        items: [
          {
            targetTypeCode: 'HANDLING_UNIT',
            targetId: HANDLING_UNIT_ID,
            issueCount: options.issueCount ?? 0,
            lastIssuedAt: null,
          },
        ],
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () => jsonResponse({ items: defaultReasons, page: { page: 1, size: 100, total: 1 } }),
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.issueWrites?.push(request.clone());

      const status = options.issueStatus ?? 201;

      if (status >= 400) {
        return jsonResponse(options.issueErrorBody ?? { message: '거부' }, { status });
      }

      return jsonResponse({ items: [makeIssue()], issuedCount: 1 }, { status });
    },
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues',
    respond: () =>
      options.historyFails === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({
            items: options.history ?? [],
            page: { page: 1, size: 50, total: options.history?.length ?? 0 },
          }),
  },
  {
    match: (request) => pathOf(request).endsWith('/rendition'),
    respond: (request) => {
      const id = Number(pathOf(request).split('/').at(-2));
      options.renditionCalls?.push(id);

      return options.renditionFails === true
        ? jsonResponse({ message: '렌디션 실패' }, { status: 500 })
        : new Response(new Uint8Array([9, 9, 9]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          });
    },
  },
  {
    match: (request) => pathOf(request).includes(':report-print'),
    respond: () =>
      options.reportFails === true
        ? jsonResponse({ message: '보고 실패' }, { status: 500 })
        : jsonResponse({ ok: true }),
  },
];

const renderScreen = (options: Options = {}, identity: PopIdentity = IDENTIFIED) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <RepackLabelIssueScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route: ENTRY_ROUTE },
  );

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:label');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { pop?: unknown }).pop;
  vi.restoreAllMocks();
});

describe('RepackLabelIssueScreen — 대상 포장', () => {
  it('포장 번호와 내용물이 선다', async () => {
    renderScreen({ lotIds: [LOT_A_ID] });

    expect(await screen.findByText(HANDLING_UNIT_NO)).toBeInTheDocument();
    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
  });

  /*
   * ⭐ `P-02-09` 는 혼적을 ⚠ 로 세우지만 이 화면은 아니다 — 라벨이 포장 단위 한 장이라
   * LOT 이 여럿이어도 «고를 것»이 갈리지 않는다(스펙 §4-B).
   */
  it('LOT 이 여럿이어도 경고로 세우지 않는다', async () => {
    renderScreen({ lotIds: [LOT_A_ID, LOT_B_ID] });

    expect(await screen.findByText(t.handlingUnit.mixedLot(2))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 발행 조건', () => {
  it('최초 발행이면 사유 없이 발행할 수 있다', async () => {
    const issueWrites: Request[] = [];
    renderScreen({ issueCount: 0, issueWrites });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]?.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('reissueReasonCode');
  });

  /* ⛔ 사유가 필요한데 비었으면 보내지 않는다 — 서버도 422 로 막지만 먼저 막는 자리가 화면이다. */
  it('재발행인데 사유를 안 고르면 보내지 않는다', async () => {
    const issueWrites: Request[] = [];
    renderScreen({ issueCount: 1, issueWrites });

    expect(await screen.findByText(t.issue.reissue(1))).toBeInTheDocument();

    await userEvent.click(submitButton());

    expect(issueWrites).toHaveLength(0);
    expect(submitButton()).toBeDisabled();
  });

  it('사유를 고르면 그 값이 실려 나간다', async () => {
    const issueWrites: Request[] = [];
    renderScreen({ issueCount: 1, issueWrites });

    await screen.findByText(t.issue.reissue(1));
    await userEvent.click(reasonSelect());
    await userEvent.click(await screen.findByRole('option', { name: REASON_NAME }));

    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]?.json()) as Record<string, unknown>;
    expect(body.reissueReasonCode).toBe(REASON_CODE);
  });

  /* 화면 선차단은 단말 기능 구성으로 한다(스펙 §6). 집행은 서버의 403 이다. */
  it('단말에 출력 권한이 없으면 발행이 막힌다', async () => {
    renderScreen({ canPrintLabel: false });

    await screen.findByText(HANDLING_UNIT_NO);
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
  });

  it('사번이 없으면 발행이 막힌다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch(routes({})),
        route: `/pop/repack-label-issue?handlingUnitId=${String(HANDLING_UNIT_ID)}`,
      },
    );

    await screen.findByText(HANDLING_UNIT_NO);
    expect(submitButton()).toBeDisabled();
  });
});

describe('RepackLabelIssueScreen — 연결', () => {
  /*
   * ⛔ **온라인 전용이다**(스펙 §6 · K-5). 라벨을 서버가 그리므로 끊긴 채로 발행하면 기록만
   * 남고 인쇄할 것이 오지 않는다 — 회차만 오르고 종이는 없다.
   */
  it('끊겨 있으면 발행이 막히고 사유를 말한다', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderScreen();

    await screen.findByText(HANDLING_UNIT_NO);
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(screen.getByText(t.device.offline)).toBeInTheDocument();
  });

  it('연결돼 있으면 헤더가 그렇게 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.device.online)).toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 프린터', () => {
  /* ⚠ 단말 마스터에 프린터 축이 아직 없어 비어 올 수 있다(착수 이슈 §6). */
  it('프린터가 없으면 감추지 않고 사유를 말한다', async () => {
    renderScreen({ printers: [] });

    expect(await screen.findByText(t.issue.printersEmpty)).toBeInTheDocument();
  });

  it('기본 프린터가 골라진 채로 선다', async () => {
    const issueWrites: Request[] = [];
    renderScreen({ issueWrites });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]?.json()) as Record<string, unknown>;
    expect(body.printerName).toBe(readyPrinter.printerName);
  });
});

describe('RepackLabelIssueScreen — 발행 뒤', () => {
  /* ⚠ 미리보기가 발행 «뒤에» 온다(착수 이슈 §6) — 발행 전에는 볼 것이 없다. */
  it('발행 이력이 없으면 미리보기를 열 수 없다', async () => {
    renderScreen({ history: [] });

    expect(await screen.findByRole('button', { name: t.issue.preview })).toBeDisabled();
  });

  it('발행 이력이 있으면 미리보기를 열 수 있다', async () => {
    renderScreen({ history: [makeIssue({ printOutcome: 'SUCCEEDED' })] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.issue.preview })).toBeEnabled();
    });
  });

  /*
   * ⛔ **받았다고 그려지는 것은 아니다.** 200 · `image/png` 여도 내용이 이미지가 아니면
   * 브라우저가 깨진 아이콘을 놓는다(실측 — 목 서버가 본문에 `"string"` 을 준다).
   */
  it('라벨이 그려지지 않으면 깨진 그림 대신 사유를 말한다', async () => {
    renderScreen({ issueCount: 0 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    const image = await screen.findByAltText(t.preview.alt);
    fireEvent.error(image);

    expect(await screen.findByText(t.preview.notDrawable)).toBeInTheDocument();
    expect(screen.getByAltText(t.preview.alt)).not.toBeVisible();
  });

  it('발행하면 미리보기가 뜨고, 인쇄를 눌러야 프린터로 간다', async () => {
    const save = vi.fn(async () => 'ok');
    (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = {
      rendition: { save },
    };

    renderScreen({ issueCount: 0 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByAltText(t.preview.alt)).toBeInTheDocument();
    /* 아직 종이는 나가지 않았다 — 사용자가 보고 나서 누른다. */
    expect(save).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: t.preview.print }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(t.print.succeeded)).toBeInTheDocument();
  });

  /* 발행 이력은 회차로 쌓인다(K-1) — 앞 회차를 덮지 않는다. */
  it('발행 이력이 회차별로 선다', async () => {
    renderScreen({
      history: [
        makeIssue({ issueSeq: 2, printOutcome: 'FAILED', documentIssueLogId: 44202 }),
        makeIssue({ issueSeq: 1, printOutcome: 'SUCCEEDED' }),
      ],
    });

    expect(await screen.findByText(t.history.seq(2))).toBeInTheDocument();
    expect(screen.getByText(t.history.seq(1))).toBeInTheDocument();
  });

  /*
   * ⛔ **목록의 첫 줄이 최신이라고 가정하지 않는다** — 계약이 정렬을 보장하지 않아 오름차순으로
   * 오면 첫 줄이 1회차다(독립 검증 실측).
   */
  it('오름차순으로 와도 가장 높은 회차를 연다', async () => {
    const renditionCalls: number[] = [];
    renderScreen({
      renditionCalls,
      history: [
        makeIssue({ issueSeq: 1, printOutcome: 'SUCCEEDED', documentIssueLogId: 44301 }),
        makeIssue({ issueSeq: 2, printOutcome: 'SUCCEEDED', documentIssueLogId: 44302 }),
      ],
    });

    await clickWhenEnabled(() => screen.getByRole('button', { name: t.issue.preview }));

    await waitFor(() => {
      expect(renditionCalls).toContain(44302);
    });
    expect(renditionCalls).not.toContain(44301);
  });

  it('발행 이력이 없으면 그 사실을 말한다', async () => {
    renderScreen({ history: [] });

    expect(await screen.findByText(t.history.empty)).toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 막힌 사유를 말한다', () => {
  /*
   * ⛔ **툴팁에만 두면 도달하지 않는다** — 감싼 버튼이 비활성이라 포커스를 못 받고, 터치
   * 패널에는 hover 가 없다(독립 검증 실측).
   */
  it('권한이 없으면 그 문구가 화면에 보인다', async () => {
    renderScreen({ canPrintLabel: false });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
  });

  it('사번이 없으면 그 문구가 화면에 보인다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch(routes({})),
        route: `/pop/repack-label-issue?handlingUnitId=${String(HANDLING_UNIT_ID)}`,
      },
    );

    expect(await screen.findByText(t.entry.missingWorker)).toBeInTheDocument();
  });

  /* 「확인할 수 없다」와 「권한이 없다」는 다른 말이고, 앞의 것에만 다시 물을 길을 준다(G-3). */
  it('권한을 확인할 수 없으면 다시 확인할 길을 준다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch([
          {
            match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
            respond: () => jsonResponse({ message: '조회 실패' }, { status: 500 }),
          },
          ...routes({}),
        ]),
        route: ENTRY_ROUTE,
      },
    );

    expect(await screen.findByText(t.gate.unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.issue.gateRetry })).toBeInTheDocument();
    expect(screen.queryByText(t.gate.denied)).not.toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 발행 실패', () => {
  /* 422 는 사유가 빠진 것이라 그 말이 사유 칸 아래에 서야 한다(스펙 §6). */
  it('사유를 지목한 422 는 사유 칸 아래에 선다', async () => {
    renderScreen({
      issueCount: 1,
      issueStatus: 422,
      issueErrorBody: {
        errors: [
          {
            scope: 'field',
            field: 'reissueReasonCode',
            code: 'REQUIRED',
            message: '재발행 사유가 필요합니다.',
          },
        ],
      },
    });

    await screen.findByText(t.issue.reissue(1));
    await userEvent.click(reasonSelect());
    await userEvent.click(await screen.findByRole('option', { name: REASON_NAME }));
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText('재발행 사유가 필요합니다.')).toBeInTheDocument();
  });

  /* 403 은 단말 출력 권한이다 — 사용자가 할 일이 「담당자 문의」다. */
  it('403 은 권한 사유를 말한다', async () => {
    renderScreen({ issueCount: 0, issueStatus: 403 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.error.forbidden)).toBeInTheDocument();
  });

  /*
   * ⛔ **종이는 나왔다.** 「인쇄하지 못했다」고 말하고 「다시 인쇄」를 권하면 같은 라벨이 한
   * 장 더 나온다(독립 검증 실측).
   */
  it('보고만 실패하면 다시 인쇄를 권하지 않는다', async () => {
    const save = vi.fn(async () => 'ok');
    (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = { rendition: { save } };

    renderScreen({ issueCount: 0, reportFails: true });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);
    await userEvent.click(await screen.findByRole('button', { name: t.preview.print }));

    expect(await screen.findByText(t.print.reportFailedTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.print.retry })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.print.reportRetry })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
  });

  /* ⛔ 회차만 오르고 빠져나갈 길이 없는 자리를 두지 않는다. */
  it('이력 조회가 실패해도 방금 발행한 것으로 다시 볼 수 있다', async () => {
    renderScreen({ issueCount: 0, historyFails: true, renditionFails: true });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
  });

  /* ⛔ 인쇄 실패를 발행 실패로 말하지 않는다(K-4) — 복구는 「다시 인쇄」다. */
  it('인쇄가 실패해도 발행 기록이 남았다고 말한다', async () => {
    (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = {
      rendition: {
        save: vi.fn(async () => {
          throw new Error('용지 걸림');
        }),
      },
    };

    renderScreen({ issueCount: 0 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);
    await userEvent.click(await screen.findByRole('button', { name: t.preview.print }));

    expect(await screen.findByText(t.print.failedTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.print.retry })).toBeInTheDocument();
  });
});
