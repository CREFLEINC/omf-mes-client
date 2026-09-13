import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LABEL_RENDITION_NOT_READY_REASON } from '../../patterns/pop-label-rendition';
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
import { localDateTimeText } from './formatting';
import type { RenditionShell } from './print';
import { RepackLabelIssueScreen } from './screen';
import type { CodeValue, HandlingUnit } from './types';

const t = messages.repackLabelIssue;

const ENTRY_ROUTE = '/pop/repack-label-issue';
const REMAINDER_ID = 6603;
const REMAINDER_NO = 'HU-SAMPLE-0019';
const OTHER_NEW_ID = 6604;
const OTHER_NEW_NO = 'HU-SAMPLE-0020';

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processes: [{ processId: PROCESS_ID }],
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
  /** 발행 현황 조회가 실패한다 */
  standingFails?: boolean;
  /** 발행 현황 응답에서 요청한 행이 빠진다 */
  standingMissing?: boolean;
  /** 발행 대기 목록 조회가 실패한다 */
  pendingFails?: boolean;
  /** 발행 대기 요청을 검사한다 */
  pendingRequests?: Request[];
  /** 발행 대기 서버 쪽별 응답 */
  pendingPages?: HandlingUnit[][];
  /** 선택 포장과 같은 SPLIT 사건에 기존 번호 잔량이 있다 */
  hasRemainder?: boolean;
  /** 같은 SPLIT 사건에 신규 RESULT가 둘 이상 있다 */
  hasMultipleNewResults?: boolean;
  /** 재발행 사유 서버 쪽별 응답 */
  reasonPages?: CodeValue[][];
  reasonRequests?: Request[];
  /** 발행 이력 서버 쪽별 응답 */
  historyPages?: ReturnType<typeof makeIssue>[][];
  historyRequests?: Request[];
  /** 포장 유형 공통코드. 기본은 `BOX` 한 값 */
  handlingUnitTypes?: CodeValue[];
  /** 재구성 사건을 못 찾는다 — 그 줄이 무엇인지 말해야 한다(#1044) */
  noRepackEvent?: boolean;
  /**
   * 인쇄 결과 보고 요청을 검사한다. 렌디션이 막힌 뒤로는 «부르지 않아야 하는» 자리를
   * 확인하는 용도로도 쓴다 — 그림을 못 받으면 인쇄도 없고, 인쇄가 없으면 보고도 없다.
   */
  reportWrites?: Request[];
}

/** 대상 포장의 유형 코드에 붙은 표시명. 화면은 코드가 아니라 이것을 보인다(#1045). */
const HANDLING_UNIT_TYPE_VALUE: CodeValue = {
  codeValueId: 9201,
  codeGroupId: 920,
  code: 'BOX',
  codeName: '박스',
  displayOrder: 1,
  isActive: true,
};

const defaultReasons = [
  {
    codeValueId: 9101,
    codeGroupId: 910,
    code: REASON_CODE,
    codeName: REASON_NAME,
    displayOrder: 1,
    isActive: true,
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
    match: (request) => request.method === 'GET' && pathOf(request) === '/inventory/handling-units',
    respond: (request) => {
      options.pendingRequests?.push(request.clone());
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      const pendingPages = options.pendingPages ?? [[{ ...handlingUnit }]];
      const total = pendingPages.reduce((count, rows) => count + rows.length, 0);

      return options.pendingFails === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({
            items: pendingPages[page - 1] ?? [],
            page: { page, size: 50, total },
          });
    },
  },
  {
    match: (request) => pathOf(request).endsWith('/repack-events'),
    respond: (request) => {
      /* 재구성으로 생기지 않은 포장 — 서버가 0건이라 답한다(#1044). */
      if (options.noRepackEvent === true) {
        return jsonResponse({ items: [] });
      }

      /*
       * ⭐ **기본은 «사건이 있는» 줄이다.** 이 목록이 세우는 것은 재구성으로 생긴 포장이므로
       *    그쪽이 보통이고, 사건을 못 찾은 줄은 `noRepackEvent` 로만 나온다 — 기본이 0건이면
       *    두 갈래가 같은 것이 되어 「사건 있는 줄」 대조군이 사라진다.
       */
      if (options.hasRemainder !== true) {
        return jsonResponse({
          items: [
            {
              repackEventId: 880,
              repackTypeCode: 'MERGE',
              performedBy: 7001,
              occurredAt: '2026-09-09T06:12:00.000Z',
              lines: [
                {
                  handlingUnitId: Number(pathOf(request).split('/').at(-2)),
                  roleCode: 'RESULT',
                  itemId: ITEM_ID,
                  lotId: LOT_A_ID,
                  qtyBefore: 0,
                  qtyAfter: 80,
                },
              ],
            },
          ],
        });
      }

      return jsonResponse({
        items:
          options.hasRemainder === true
            ? [
                {
                  repackEventId: 881,
                  repackTypeCode: 'SPLIT',
                  performedBy: 7001,
                  occurredAt: '2026-09-03T01:00:00Z',
                  lines: [
                    {
                      handlingUnitId: HANDLING_UNIT_ID,
                      roleCode: 'RESULT',
                      itemId: ITEM_ID,
                      lotId: LOT_A_ID,
                      qtyBefore: 0,
                      qtyAfter: 80,
                    },
                    {
                      handlingUnitId: REMAINDER_ID,
                      roleCode: 'RESULT',
                      itemId: ITEM_ID,
                      lotId: LOT_A_ID,
                      qtyBefore: 180,
                      qtyAfter: 100,
                    },
                    ...(options.hasMultipleNewResults === true
                      ? [
                          {
                            handlingUnitId: OTHER_NEW_ID,
                            roleCode: 'RESULT',
                            itemId: ITEM_ID,
                            lotId: LOT_A_ID,
                            qtyBefore: 0,
                            qtyAfter: 40,
                          },
                        ]
                      : []),
                  ],
                },
              ]
            : [],
      });
    },
  },
  {
    match: (request) => pathOf(request) === `/inventory/handling-units/${String(REMAINDER_ID)}`,
    respond: () =>
      jsonResponse({
        handlingUnit: {
          ...handlingUnit,
          handlingUnitId: REMAINDER_ID,
          handlingUnitNo: REMAINDER_NO,
        },
        contents: [],
      }),
  },
  {
    match: (request) => pathOf(request) === `/inventory/handling-units/${String(OTHER_NEW_ID)}`,
    respond: () =>
      jsonResponse({
        handlingUnit: {
          ...handlingUnit,
          handlingUnitId: OTHER_NEW_ID,
          handlingUnitNo: OTHER_NEW_NO,
        },
        contents: [],
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
    respond: (request) =>
      options.standingFails === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({
            items: new URL(request.url).search.includes(String(REMAINDER_ID))
              ? [
                  {
                    targetTypeCode: 'HANDLING_UNIT',
                    targetId: REMAINDER_ID,
                    issueCount: 1,
                    lastIssuedAt: '2026-09-02T01:00:00Z',
                  },
                  ...(options.hasMultipleNewResults === true &&
                  new URL(request.url).search.includes(String(OTHER_NEW_ID))
                    ? [
                        {
                          targetTypeCode: 'HANDLING_UNIT',
                          targetId: OTHER_NEW_ID,
                          issueCount: 1,
                          lastIssuedAt: '2026-09-02T01:30:00Z',
                        },
                      ]
                    : []),
                ]
              : options.standingMissing === true
                ? []
                : [
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
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode');

      /* 포장 유형은 재발행 사유와 다른 그룹이다 — 한 갈래로 묶으면 사유 쪽 쪽수까지 흐려진다. */
      if (group === 'HANDLING_UNIT_TYPE') {
        /*
         * ⭐ **서버처럼 군다** — 계약의 기본은 「사용 중인 것만」이고, 미사용 값은 화면이
         *    `includeInactive` 를 켜야 온다(공유계약 G-8). 목이 늘 다 내려 주면 화면이 그것을
         *    안 켜도 시험이 통과해, 폐기된 유형이 붙은 옛 포장이 깨지는 것을 못 잡는다.
         */
        const all = options.handlingUnitTypes ?? [HANDLING_UNIT_TYPE_VALUE];
        const items =
          new URL(request.url).searchParams.get('includeInactive') === 'true'
            ? all
            : all.filter((value) => value.isActive);

        return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
      }

      options.reasonRequests?.push(request.clone());
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      const pages = options.reasonPages ?? [defaultReasons];

      return jsonResponse({
        items: pages[page - 1] ?? [],
        page: {
          page,
          size: 100,
          total: pages.reduce((count, rows) => count + rows.length, 0),
        },
      });
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.issueWrites?.push(request.clone());

      const status = options.issueStatus ?? 201;

      if (status >= 400) {
        return jsonResponse(options.issueErrorBody ?? { message: '거부' }, { status });
      }

      return jsonResponse(
        {
          items:
            options.hasRemainder === true
              ? [
                  makeIssue(),
                  makeIssue({
                    documentIssueLogId: DOCUMENT_ISSUE_LOG_ID + 1,
                    target: {
                      targetTypeCode: 'HANDLING_UNIT',
                      targetId: REMAINDER_ID,
                      displayName: REMAINDER_NO,
                    },
                    issueSeq: 2,
                  }),
                ]
              : [makeIssue()],
          issuedCount: options.hasRemainder === true ? 2 : 1,
        },
        { status },
      );
    },
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.historyRequests?.push(request.clone());
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      const pages = options.historyPages ?? [options.history ?? []];

      return options.historyFails === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({
            items: pages[page - 1] ?? [],
            page: {
              page,
              size: 50,
              total: pages.reduce((count, rows) => count + rows.length, 0),
            },
          });
    },
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
    respond: (request) => {
      options.reportWrites?.push(request.clone());

      return options.reportFails === true
        ? jsonResponse({ message: '보고 실패' }, { status: 500 })
        : jsonResponse({ ok: true });
    },
  },
];

const renderScreen = (options: Options = {}, identity: PopIdentity = IDENTIFIED) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <RepackLabelIssueScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route: ENTRY_ROUTE },
  );

const selectPending = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(HANDLING_UNIT_NO) }));
};

const renderSelectedScreen = async (
  options: Options = {},
  identity: PopIdentity = IDENTIFIED,
): Promise<void> => {
  renderScreen(options, identity);
  await selectPending();
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:label');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { pop?: unknown }).pop;
  vi.restoreAllMocks();
});

/**
 * ⛔ **배포본은 발행 대기 목록을 «부르지 않는다»**(#1095). 서버 구현 기준선에 `labelIssued`
 *    축이 없고 실서버는 없는 축을 거부하지 않고 무시한다 — 그대로 부르면 「발행 대기」 표에
 *    창고의 모든 취급 단위가 서고, 이미 라벨이 붙은 포장에 새 라벨이 나간다.
 *
 * ⚠ **요청이 나가지 않는 것까지 본다.** 표가 비어 보이는 것만으로는 부르지 않았다는 증거가
 *    되지 못한다 — 부르고 나서 응답을 버려도 표는 똑같이 비어 보인다.
 */
describe('RepackLabelIssueScreen — 서버 구현 기준선', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('배포본에서는 발행 대기 목록을 부르지 않고 사유를 적는다', async () => {
    vi.stubEnv('MODE', 'production');
    const asked: string[] = [];
    const watched: StubRoute = {
      match: (request) => {
        asked.push(new URL(request.url).pathname);

        return false;
      },
      respond: () => jsonResponse({}),
    };
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      { fetch: createStubFetch([watched, ...routes({})]), route: ENTRY_ROUTE },
    );

    expect(await screen.findByText(t.pending.unsupported)).toBeInTheDocument();
    expect(asked.some((path) => path === '/inventory/handling-units')).toBe(false);
  });
});

describe('RepackLabelIssueScreen — 대상 포장', () => {
  it('임시 URL 값 대신 labelIssued=false 발행 대기 목록에서 고른다', async () => {
    const pendingRequests: Request[] = [];
    renderScreen({ pendingRequests });

    expect(await screen.findByRole('button', { name: new RegExp(HANDLING_UNIT_NO) })).toBeEnabled();
    /*
     * ⛔ **같은 사유를 한 번만 말한다**(사용자 지적 2026-09-12). 《대상 포장》 구획 한가운데와
     * 액션 줄에 같은 문장이 동시에 서 있었고, **앞 판의 단언이 그 중복을 「2」로 못박아**
     * 두어 결함이 아니라 사양처럼 보였다. 구획이 말하고 액션 줄은 비켜난다.
     */
    expect(screen.getAllByText(t.entry.missingHandlingUnit)).toHaveLength(1);
    expect(pendingRequests).toHaveLength(1);

    const url = new URL(pendingRequests[0]?.url ?? 'http://localhost');
    expect(url.searchParams.get('labelIssued')).toBe('false');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('size')).toBe('50');
  });

  /*
   * #1044 — 사건을 못 찾은 줄이 포장 번호조차 없이 모든 칸 「—」 로 서면, 작업자는 눌러 보기
   * 전에 무엇인지 알 수 없고 잘못 골라 엉뚱한 라벨을 뽑을 여지가 생긴다.
   *
   * ⛔ 줄을 «빼지» 않는다 — 후보를 좁히는 것은 서버 몫이다(계약 `labelIssued=false`).
   */
  it('재구성 이력이 없는 줄도 포장 번호와 사유를 적는다', async () => {
    renderScreen({ noRepackEvent: true });

    expect(await screen.findByText(t.pending.noEvent(HANDLING_UNIT_NO))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: t.pending.selectRow(t.pending.noEvent(HANDLING_UNIT_NO), HANDLING_UNIT_NO),
      }),
    ).toBeEnabled();
    /* 서버가 200 으로 «없다»고 답한 줄이다 — 못 읽었다는 말을 세우지 않는다(#1150). */
    expect(screen.queryByText(/확인 불가/)).not.toBeInTheDocument();
  });

  it('발행 대기 조회가 실패하면 다시 조회할 수 있다', async () => {
    renderScreen({ pendingFails: true });

    expect(await screen.findByText(t.pending.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
  });

  it('발행 대기 목록은 계약의 전체 건수까지 다음 쪽을 이어 받는다', async () => {
    const pendingRequests: Request[] = [];
    const nextHandlingUnit = {
      ...handlingUnit,
      handlingUnitId: HANDLING_UNIT_ID + 1,
      handlingUnitNo: 'HU-SAMPLE-0022',
    };
    renderScreen({
      pendingRequests,
      pendingPages: [[{ ...handlingUnit }], [nextHandlingUnit]],
    });

    /* 둘째 쪽까지 이어 받았는지는 그 줄을 고르는 단추가 섰는지로 잰다 — 번호는 ② 구획이 낸다. */
    expect(
      await screen.findByRole('button', {
        name: new RegExp(nextHandlingUnit.handlingUnitNo),
      }),
    ).toBeVisible();
    expect(pendingRequests).toHaveLength(2);
    expect(new URL(pendingRequests[1]?.url ?? 'http://localhost').searchParams.get('page')).toBe(
      '2',
    );
  });

  /*
   * ⭐ **재출력을 고르지 않으면 사유 칸도 없다**(설계 §3-1 「③은 재출력 체크가 없으면 한 줄로
   *    접는다」 · 사용자 지적 2026-09-11). 이 화면의 세로 예산은 슬랙 0 이라 쓰지 않는 칸
   *    하나가 아래 구획을 밀어낸다.
   */
  it('최초 발행이면 재발행 사유 칸을 세우지 않는다', async () => {
    await renderSelectedScreen();

    await screen.findByText(t.issue.targetsLabel);

    expect(
      screen.queryByRole('combobox', { name: new RegExp(t.issue.reasonLabel) }),
    ).not.toBeInTheDocument();
  });

  it('포장 번호와 내용물이 선다', async () => {
    await renderSelectedScreen({ lotIds: [LOT_A_ID] });

    expect(await screen.findByText(HANDLING_UNIT_NO)).toBeInTheDocument();
    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
  });

  /* #1045 — 현장은 `BOX` 를 읽지 않는다. 같은 값을 다른 화면은 「박스」로 쓴다. */
  it('포장 유형을 공통코드 표시명으로 보인다', async () => {
    await renderSelectedScreen({ lotIds: [LOT_A_ID] });

    expect(await screen.findByText(HANDLING_UNIT_TYPE_VALUE.codeName)).toBeInTheDocument();
    expect(screen.queryByText(HANDLING_UNIT_TYPE_VALUE.code)).not.toBeInTheDocument();
  });

  /* 폐기된 유형이 붙은 옛 포장도 이름으로 읽혀야 한다 — 이름을 푸는 조회는 좁히지 않는다. */
  it('미사용으로 바뀐 유형도 표시명으로 보인다', async () => {
    await renderSelectedScreen({
      lotIds: [LOT_A_ID],
      handlingUnitTypes: [{ ...HANDLING_UNIT_TYPE_VALUE, isActive: false }],
    });

    expect(await screen.findByText(HANDLING_UNIT_TYPE_VALUE.codeName)).toBeInTheDocument();
  });

  /* 표시명을 못 받았을 때만 코드를 보이되, 없다는 사실을 함께 적는다 — 이름을 지어내지 않는다. */
  it('표시명을 못 받으면 코드와 함께 표시명이 없다고 적는다', async () => {
    await renderSelectedScreen({ lotIds: [LOT_A_ID], handlingUnitTypes: [] });

    expect(
      await screen.findByText(t.handlingUnit.typeUnknown(HANDLING_UNIT_TYPE_VALUE.code)),
    ).toBeInTheDocument();
  });

  /*
   * ⭐ `P-02-09` 는 혼적을 ⚠ 로 세우지만 이 화면은 아니다 — 라벨이 포장 단위 한 장이라
   * LOT 이 여럿이어도 «고를 것»이 갈리지 않는다(스펙 §4-B).
   */
  it('LOT 이 여럿이어도 경고로 세우지 않는다', async () => {
    await renderSelectedScreen({ lotIds: [LOT_A_ID, LOT_B_ID] });

    expect(await screen.findByText(t.handlingUnit.mixedLot(2))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 발행 조건', () => {
  it('분할 잔량은 원 번호를 유지하고 사용자가 선택한 경우에만 혼합 재발행한다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ hasRemainder: true, issueWrites });

    const remainderCheckbox = await screen.findByRole('checkbox', {
      name: t.issue.remainderLabel(REMAINDER_NO, 1),
    });
    expect(remainderCheckbox).not.toBeChecked();
    expect(screen.getByText(t.issue.remainderNumberNote)).toBeInTheDocument();

    await userEvent.click(remainderCheckbox);
    expect(submitButton()).toBeDisabled();
    await userEvent.click(reasonSelect());
    await userEvent.click(await screen.findByRole('option', { name: REASON_NAME }));
    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });
    const body = (await issueWrites[0]?.json()) as {
      targets: { targetId: number }[];
      reissueReasonCode?: string;
    };
    expect(body.targets.map((target) => target.targetId)).toEqual([HANDLING_UNIT_ID, REMAINDER_ID]);
    expect(body.reissueReasonCode).toBe(REASON_CODE);
  });

  it('같은 분할의 다른 신규 RESULT는 이미 발행됐어도 잔량으로 보지 않는다', async () => {
    await renderSelectedScreen({ hasRemainder: true, hasMultipleNewResults: true });

    expect(
      await screen.findByRole('checkbox', { name: t.issue.remainderLabel(REMAINDER_NO, 1) }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: t.issue.remainderLabel(OTHER_NEW_NO, 1) }),
    ).not.toBeInTheDocument();
  });

  it('최초 발행이면 사유 없이 발행할 수 있다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueCount: 0, issueWrites });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]?.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('reissueReasonCode');
  });

  it('발행 요약에서 요청 대상이 빠지면 최초 발행으로 단정하지 않고 막는다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ standingMissing: true, issueWrites });

    expect(await screen.findAllByText(t.issue.summaryFailed)).toHaveLength(2);
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
    expect(submitButton()).toBeDisabled();
    expect(issueWrites).toHaveLength(0);
  });

  /* ⛔ 사유가 필요한데 비었으면 보내지 않는다 — 서버도 422 로 막지만 먼저 막는 자리가 화면이다. */
  it('재발행인데 사유를 안 고르면 보내지 않는다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueCount: 1, issueWrites });

    expect(await screen.findByText(t.issue.reissue(1))).toBeInTheDocument();

    await userEvent.click(submitButton());

    expect(issueWrites).toHaveLength(0);
    expect(submitButton()).toBeDisabled();
  });

  it('사유를 고르면 그 값이 실려 나간다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueCount: 1, issueWrites });

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

  it('재발행 사유는 계약의 전체 건수까지 다음 쪽을 이어 받는다', async () => {
    const reasonRequests: Request[] = [];
    const nextReason: CodeValue = {
      codeValueId: 9102,
      codeGroupId: 910,
      code: 'DAMAGE',
      codeName: '라벨 훼손',
      displayOrder: 2,
      isActive: true,
    };
    await renderSelectedScreen({
      issueCount: 1,
      reasonRequests,
      reasonPages: [defaultReasons, [nextReason]],
    });

    await userEvent.click(reasonSelect());
    expect(await screen.findByRole('option', { name: nextReason.codeName })).toBeInTheDocument();
    expect(reasonRequests).toHaveLength(2);
    expect(new URL(reasonRequests[1]?.url ?? 'http://localhost').searchParams.get('page')).toBe(
      '2',
    );
  });

  /* 화면 선차단은 단말 기능 구성으로 한다(스펙 §6). 집행은 서버의 403 이다. */
  it('단말에 출력 권한이 없으면 발행이 막힌다', async () => {
    await renderSelectedScreen({ canPrintLabel: false });

    await screen.findByText(HANDLING_UNIT_NO);
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
  });

  it('사번이 없으면 발행이 막힌다', async () => {
    /* ⚠ 사번은 주소보다 셸·세션이 먼저다 — 셋 다 없을 때를 잰다(2026-09-08). */
    renderWithProviders(
      <PopIdentityProvider value={{ ...IDENTIFIED, workerNo: null }}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch(routes({})),
        route: `/pop/repack-label-issue?handlingUnitId=${String(HANDLING_UNIT_ID)}&workerNo=URL-FAKE`,
      },
    );

    await selectPending();
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
    await renderSelectedScreen();

    await screen.findByText(HANDLING_UNIT_NO);
    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });
    expect(screen.getByText(t.device.offline)).toBeInTheDocument();
  });

  it('연결돼 있으면 헤더가 그렇게 말한다', async () => {
    await renderSelectedScreen();

    expect(await screen.findByText(t.device.online)).toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 프린터', () => {
  /* ⚠ 단말 마스터에 프린터 축이 아직 없어 비어 올 수 있다(착수 이슈 §6). */
  it('프린터가 없으면 감추지 않고 사유를 말한다', async () => {
    await renderSelectedScreen({ printers: [] });

    expect(await screen.findByText(t.issue.printersEmpty)).toBeInTheDocument();
  });

  it('기본 프린터가 골라진 채로 선다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueWrites });

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
    await renderSelectedScreen({ history: [] });

    expect(await screen.findByRole('button', { name: t.issue.preview })).toBeDisabled();
  });

  /*
   * #1043 — 서버 원문(`2026-09-03T01:20:00Z`)이 그대로 서면 발행 대기 칸과 두 표기가 섞이고
   * 현지 시각과 아홉 시간 어긋나 보인다.
   */
  it('발행 이력의 시각을 현지 시각 한 꼴로 적는다', async () => {
    const issuedAt = '2026-09-03T01:20:00Z';
    await renderSelectedScreen({ history: [makeIssue({ issuedAt })] });

    expect(
      await screen.findByText(new RegExp(localDateTimeText(issuedAt, '—'))),
    ).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(issuedAt))).not.toBeInTheDocument();
  });

  it('발행 이력이 있으면 미리보기를 열 수 있다', async () => {
    await renderSelectedScreen({ history: [makeIssue({ printOutcome: 'SUCCEEDED' })] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.issue.preview })).toBeEnabled();
    });
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(`patterns/pop-label-rendition` 머리말 · 대응표 P1 「미구현
   * 5건」). 원래 이 시험은 「200·image/png 여도 내용이 그림이 아니면 깨진 아이콘 대신 사유를
   * 말한다」를 쟀다 — 그 갈래는 그림을 «받았을 때만» 성립하는데, 이제는 아예 받으러 가지
   * 않아 항상 `renditionFailed` 로 정착한다. 그림이 오지 않는다는 사실 자체(네트워크 요청도
   * 나가지 않는다)로 다시 잰다.
   */
  it('그림을 받으러 가지 않고 renditionFailed 로 정착한다 — 네트워크 요청도 나가지 않는다', async () => {
    const renditionCalls: number[] = [];
    await renderSelectedScreen({ issueCount: 0, renditionCalls });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(renditionCalls).toHaveLength(0);
    expect(screen.queryByAltText(t.preview.alt)).not.toBeInTheDocument();
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 미리보기 창(`PreviewDialog`)은
   * 그림을 받았을 때만 열린다(`screen.tsx` 의 `open={phase === 'preview' || phase ===
   * 'printing'}`) — 그림을 아예 받지 않으니 이 창 자체가 더는 뜨지 않는다. 「닫기가 한
   * 자리만 있다」는 원래 뜻(같은 동작을 두 군데 두지 않는다)은, 창이 안 뜨니 복구 동작
   * (재시도)이 정말 하나뿐인가로 옮겨 잰다.
   */
  it('그림을 받지 못하면 미리보기 창 자체가 뜨지 않는다 — 복구 동작은 재시도 하나뿐이다', async () => {
    await renderSelectedScreen({ history: [makeIssue({ printOutcome: 'SUCCEEDED' })] });

    await clickWhenEnabled(() => screen.getByRole('button', { name: t.issue.preview }));

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.preview.print })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.preview.close })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: messages.common.retry })).toHaveLength(1);
  });

  /*
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 원래 이 시험은 미리보기가 뜨고
   * 인쇄까지 이어지는 정상 경로를 쟀다 — 그림을 받는 걸음이 막혀 이제 그 경로 자체가 없다.
   * ⭐ **발행(`POST /app/document-issues`)은 그대로 된다** — 막힌 것은 그 뒤의 그림 취득뿐임을
   * 함께 짚는다.
   */
  it('발행은 되어도 미리보기·인쇄는 막힌다 — 셸에 아무것도 보내지 않는다', async () => {
    const save = vi.fn(async () => 'ok');
    (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = {
      rendition: { save },
    };
    const issueWrites: Request[] = [];
    const renditionCalls: number[] = [];

    await renderSelectedScreen({ issueCount: 0, issueWrites, renditionCalls });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    /* 발행 기록은 남는다 — 막힌 것은 그 뒤의 그림 취득이지 발행이 아니다. */
    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });
    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(screen.queryByAltText(t.preview.alt)).not.toBeInTheDocument();
    expect(renditionCalls).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  });

  /* 발행 이력은 회차로 쌓인다(K-1) — 앞 회차를 덮지 않는다. */
  it('발행 이력이 회차별로 선다', async () => {
    await renderSelectedScreen({
      history: [
        makeIssue({ issueSeq: 2, printOutcome: 'FAILED', documentIssueLogId: 44202 }),
        makeIssue({ issueSeq: 1, printOutcome: 'SUCCEEDED' }),
      ],
    });

    expect(await screen.findByText(t.history.seq(2))).toBeInTheDocument();
    expect(screen.getByText(t.history.seq(1))).toBeInTheDocument();
  });

  it('발행 이력은 계약의 전체 건수까지 다음 쪽을 이어 받는다', async () => {
    const historyRequests: Request[] = [];
    await renderSelectedScreen({
      historyRequests,
      historyPages: [
        [makeIssue({ issueSeq: 1, documentIssueLogId: 44001 })],
        [makeIssue({ issueSeq: 2, documentIssueLogId: 44002 })],
      ],
    });

    expect(await screen.findByText(t.history.seq(2))).toBeInTheDocument();
    expect(screen.getByText(t.history.seq(1))).toBeInTheDocument();
    expect(historyRequests).toHaveLength(2);
    expect(new URL(historyRequests[1]?.url ?? 'http://localhost').searchParams.get('page')).toBe(
      '2',
    );
  });

  /*
   * ⛔ **목록의 첫 줄이 최신이라고 가정하지 않는다** — 계약이 정렬을 보장하지 않아 오름차순으로
   * 오면 첫 줄이 1회차다(독립 검증 실측).
   *
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 원래 이 시험은 실제 렌디션
   * 요청이 «어느 회차의 documentIssueLogId 로» 나가는지를 보고 최고 회차 선택을 확인했다 —
   * 이제 그 요청 자체가 나가지 않아 그 방법으로는 더 잴 수 없다. 대신 최고 회차를 골라도(즉
   * 미리보기가 열려도) 순서와 무관하게 네트워크 요청은 여전히 0건임을 잰다 — 회차 선택
   * 로직이 남아 있다는 것은 미리보기 단추가 활성화된다는 사실로 이미 확인된다(바로 위 시험).
   */
  it('이력이 오름차순으로 와도 미리보기 시도가 네트워크를 부르지 않는다', async () => {
    const renditionCalls: number[] = [];
    await renderSelectedScreen({
      renditionCalls,
      history: [
        makeIssue({ issueSeq: 1, printOutcome: 'SUCCEEDED', documentIssueLogId: 44301 }),
        makeIssue({ issueSeq: 2, printOutcome: 'SUCCEEDED', documentIssueLogId: 44302 }),
      ],
    });

    await clickWhenEnabled(() => screen.getByRole('button', { name: t.issue.preview }));

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(renditionCalls).toHaveLength(0);
  });

  it('발행 이력이 없으면 그 사실을 말한다', async () => {
    await renderSelectedScreen({ history: [] });

    expect(await screen.findByText(t.history.empty)).toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 막힌 사유를 말한다', () => {
  /*
   * ⛔ **툴팁에만 두면 도달하지 않는다** — 감싼 버튼이 비활성이라 포커스를 못 받고, 터치
   * 패널에는 hover 가 없다(독립 검증 실측).
   */
  it('권한이 없으면 그 문구가 화면에 보인다', async () => {
    await renderSelectedScreen({ canPrintLabel: false });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
  });

  it('사번이 없으면 그 문구가 화면에 보인다', async () => {
    /* ⚠ 사번은 주소보다 셸·세션이 먼저다 — 셋 다 없을 때를 잰다(2026-09-08). */
    renderWithProviders(
      <PopIdentityProvider value={{ ...IDENTIFIED, workerNo: null }}>
        <RepackLabelIssueScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch(routes({})),
        route: `/pop/repack-label-issue?handlingUnitId=${String(HANDLING_UNIT_ID)}&workerNo=URL-FAKE`,
      },
    );

    await selectPending();
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

    await selectPending();
    expect(await screen.findByText(t.gate.unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.issue.gateRetry })).toBeInTheDocument();
    expect(screen.queryByText(t.gate.denied)).not.toBeInTheDocument();
  });
});

describe('RepackLabelIssueScreen — 발행 실패', () => {
  it('신규 발행 실패를 같은 요청·멱등 키로 다시 시도한다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueCount: 0, issueStatus: 500, issueWrites });

    await clickWhenEnabled(submitButton);
    expect(await screen.findByText(t.error.issueTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(issueWrites).toHaveLength(2);
    });
    expect(issueWrites[1]?.headers.get('Idempotency-Key')).toBe(
      issueWrites[0]?.headers.get('Idempotency-Key'),
    );
    expect(await issueWrites[1]?.json()).toEqual(await issueWrites[0]?.json());
  });

  it('재발행 실패도 고른 사유를 유지해 같은 요청으로 다시 시도한다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ issueCount: 1, issueStatus: 500, issueWrites });

    await userEvent.click(reasonSelect());
    await userEvent.click(await screen.findByRole('option', { name: REASON_NAME }));
    await clickWhenEnabled(submitButton);
    expect(await screen.findByText(t.error.issueTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(issueWrites).toHaveLength(2);
    });
    const retryBody = (await issueWrites[1]?.json()) as { reissueReasonCode?: string };
    expect(retryBody.reissueReasonCode).toBe(REASON_CODE);
    expect(issueWrites[1]?.headers.get('Idempotency-Key')).toBe(
      issueWrites[0]?.headers.get('Idempotency-Key'),
    );
  });

  /* 422 는 사유가 빠진 것이라 그 말이 사유 칸 아래에 서야 한다(스펙 §6). */
  it('사유를 지목한 422 는 사유 칸 아래에 선다', async () => {
    await renderSelectedScreen({
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

  /* 요약을 모르면 최초·재발행을 가를 수 없다 — 쓰지 않고 같은 조회를 다시 할 길을 둔다. */
  it('현황 조회 실패는 발행을 막고 다시 조회할 수 있다', async () => {
    const issueWrites: Request[] = [];
    await renderSelectedScreen({ standingFails: true, issueWrites });

    expect(await screen.findAllByText(t.issue.summaryFailed)).toHaveLength(2);
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
    expect(submitButton()).toBeDisabled();
    expect(issueWrites).toHaveLength(0);
  });

  /* 403 은 단말 출력 권한이다 — 사용자가 할 일이 「담당자 문의」다. */
  it('403 은 권한 사유를 말한다', async () => {
    await renderSelectedScreen({ issueCount: 0, issueStatus: 403 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.error.forbidden)).toBeInTheDocument();
  });

  /*
   * ⛔ **종이는 나왔다.** 「인쇄하지 못했다」고 말하고 「다시 인쇄」를 권하면 같은 라벨이 한
   * 장 더 나온다(독립 검증 실측).
   *
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 「보고만 실패」는 «인쇄까지는
   * 됐다»는 전제가 있어야 하는데 그림을 못 받으니 인쇄 자체가 없다 — 그 전제가 성립하는
   * `reportFailed` 상태는 이제 이 화면에서 이를 수 없다. 대신 그림을 못 받으면 셸에도(인쇄)
   * 서버 보고에도 아예 닿지 않는다는, 지금 실제로 성립하는 사실을 잰다.
   */
  it('그림을 받지 못하면 셸에도 인쇄 결과 보고에도 닿지 않는다', async () => {
    const save = vi.fn(async () => 'ok');
    (window as unknown as { pop?: { rendition?: RenditionShell } }).pop = { rendition: { save } };
    const reportWrites: Request[] = [];

    await renderSelectedScreen({ issueCount: 0, reportWrites });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(reportWrites).toHaveLength(0);
  });

  /* ⛔ 회차만 오르고 빠져나갈 길이 없는 자리를 두지 않는다. */
  it('이력 조회가 실패해도 방금 발행한 것으로 다시 볼 수 있다', async () => {
    await renderSelectedScreen({ issueCount: 0, historyFails: true, renditionFails: true });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
  });

  /*
   * ⛔ 인쇄 실패를 발행 실패로 말하지 않는다(K-4) — 복구는 실패 사유의 새 회차다(K-7).
   *
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 원래 이 시험은 셸이 인쇄에
   * 실패한 뒤 「다시 발행」이 `PRINT_FAILURE` 사유의 새 회차를 만드는 것을 쟀다 — 이제
   * 그림을 못 받아 인쇄까지 가지 못하므로 그 실패 사유 자체가 나지 않는다. 대신 그림을 못
   * 받은 것도 **발행 실패로 말하지 않는다**는 같은 원칙을, 지금 실제로 있는 자리
   * (`renditionFailed` 배너의 «재시도»)에서 잰다 — 재시도는 미리보기를 다시 열 뿐 새 발행
   * 요청을 보내지 않는다(회차가 이유 없이 오르지 않는다).
   */
  it('그림을 받지 못해도 발행 실패로 말하지 않는다 — 재시도가 새 회차를 만들지 않는다', async () => {
    const issueWrites: Request[] = [];

    await renderSelectedScreen({ issueCount: 0, issueWrites });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });
    await userEvent.click(await screen.findByRole('button', { name: messages.common.retry }));

    expect(await screen.findByText(t.preview.failed)).toBeInTheDocument();
    expect(issueWrites).toHaveLength(1);
  });

  /*
   * ⛔ **셸·서버가 준 오류 문구를 작업자에게 보이지 않는다.** 현장에서 할 일은 프린터를
   *    확인한 뒤 실패 사유로 재발행하는 것이고, 기술 사유는 그 판단을 돕지 않으면서 화면만
   *    어지럽힌다.
   *
   * ⛔⛔ **서버에 이 경로가 없다**(대응표 P1 「미구현 5건」). 원래 이 시험은 셸이 던진 실패
   * 문구('용지 걸림')가 새지 않는지를 쟀다 — 이제는 그림을 못 받는 내부 사유
   * (`LABEL_RENDITION_NOT_READY_REASON`)가 그 자리를 대신한다. 같은 원칙(내부 사유 문자열이
   * 화면에 그대로 새지 않는다)이 이 사유에도 지켜지는지로 다시 잰다.
   */
  it('실패 사유 원문을 화면에 싣지 않는다', async () => {
    await renderSelectedScreen({ issueCount: 0 });

    await screen.findByText(HANDLING_UNIT_NO);
    await clickWhenEnabled(submitButton);

    await screen.findByText(t.preview.failed);
    expect(screen.getByText(t.print.failedBody)).toBeInTheDocument();
    expect(screen.queryByText(LABEL_RENDITION_NOT_READY_REASON)).not.toBeInTheDocument();
  });
});
