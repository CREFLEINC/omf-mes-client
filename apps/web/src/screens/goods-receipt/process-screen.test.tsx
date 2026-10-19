import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubRoute } from '../../test/api-harness';
import { pickDate } from '../../test/date-picker';
import {
  inboundReceiptFixtures,
  inboundReceiptLine,
  lotFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { LOT_PAGE_SIZE } from './lookups';
import { GoodsReceiptProcess } from './process-screen';
import { irKeys } from './queries';
import {
  allRoutes,
  BackProbe,
  CHANGED_ITEM_LABEL,
  changingItemRoute,
  changingLinesRoute,
  createRecordingFetch,
  currentLocation,
  DETAIL_MARKER,
  DETAIL_PATH,
  failingGoodsReceiptRoute,
  failingLinesRoute,
  failingListRoute,
  failingLookupRoute,
  failingLotDetailRoute,
  goodsReceiptRoute,
  GOODS_RECEIPTS_PATH,
  INTERNAL_IDS,
  isGet,
  ITEM_LABEL,
  itemDetailRoutes,
  itemPath,
  LINES_PATH,
  LIST_PATH,
  linesRoute,
  listBody,
  listRoute,
  LocationProbe,
  LOCATIONS_PATH,
  lookupRoute,
  lookupRoutes,
  LOT_DETAIL_PATH,
  lotDetailRoute,
  LOTS_PATH,
  offlineGoodsReceiptRoute,
  otherLinesRoute,
  PARTNERS_PATH,
  PLANT_LABEL,
  PLANTS_PATH,
  type RecordedRequest,
  requestsTo,
  ROUTE,
  SearchProbe,
  shrinkingLinesRoute,
  SUPPLIER_LABEL,
  UOMS_PATH,
  type User,
  WAREHOUSES_PATH,
} from './test-support';

const t = messages.goodsReceipt;
const pp = messages.common.processPage;

/**
 * **값 목록이 확정된 뒤의 화면**을 만들어 내기 위한 자리(기존 화면 감지기에서 옮겼다).
 * 배열만 갈아 끼운다 — 판정·선택지 만들기·검증은 실물 그대로다.
 */
const { codeValues } = vi.hoisted(() => ({
  codeValues: {
    receiptType: [] as string[],
    sourceDocumentType: ['INBOUND_RECEIPT'] as string[],
    qualityStatus: [] as string[],
    inventoryStatus: ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'] as string[],
    reason: [] as string[],
  },
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return {
    ...actual,
    PLACEHOLDER_GOODS_RECEIPT_CODES: codeValues,
    withRuntimeGoodsReceiptCodes: () => codeValues,
  };
});

vi.mock('./queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./queries')>();

  return {
    ...actual,
    useGoodsReceiptCodeValues: () => ({ data: [], isError: false }),
  };
});

const SAMPLE_RECEIPT_TYPE = 'SAMPLE_RECEIPT_TYPE_A';
const SAMPLE_QUALITY = 'SAMPLE_QUALITY_A';
/** 재고 상태는 계약이 값을 넷으로 못박아 그 밖의 값으로는 요청 본문이 만들어지지 않는다. */
const SAMPLE_INVENTORY = 'AVAILABLE';
const SAMPLE_REASON = 'SAMPLE_REASON_A';

const clearCodeLists = (): void => {
  codeValues.receiptType = [];
  codeValues.sourceDocumentType = ['INBOUND_RECEIPT'];
  codeValues.qualityStatus = [];
  codeValues.inventoryStatus = ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'];
  codeValues.reason = [];
};

const fillCodeLists = (): void => {
  codeValues.receiptType = [SAMPLE_RECEIPT_TYPE];
  codeValues.sourceDocumentType = ['INBOUND_RECEIPT'];
  codeValues.qualityStatus = [SAMPLE_QUALITY];
  codeValues.inventoryStatus = ['AVAILABLE', 'IN_TRANSIT', 'ON_HOLD', 'BLOCKED'];
  codeValues.reason = [SAMPLE_REASON];
};

beforeEach(clearCodeLists);

const IR_NO = 'IR-2026-900001';
const PROCESS_ROUTE = `${ROUTE}/${IR_NO}`;

/** 작업함 자리 — [← 작업함]이 이 경로로 간다. */
const WorklistStub = () => <p>작업함</p>;

const renderProcess = (
  routes: StubRoute[],
  search = '',
  navigateTo = '',
  hold: string[] = [],
  irNo = IR_NO,
): { requests: RecordedRequest[]; queryClient: QueryClient; release: () => void; user: User } => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { queryClient } = renderWithProviders(
    <>
      <Routes>
        <Route path={ROUTE} element={<WorklistStub />} />
        <Route path={`${ROUTE}/:inboundReceiptNo`} element={<GoodsReceiptProcess />} />
      </Routes>
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}/${irNo}${search}` },
  );

  return { requests, queryClient, release, user: userEvent.setup() };
};

const lineTable = (): HTMLElement => screen.getByRole('table');
const lineRow = (lineNo: number): HTMLElement =>
  screen.getByRole('row', { name: t.lineTable.rowLabel(lineNo) });
const actionBar = (): HTMLElement => screen.getByRole('region', { name: pp.actionBar });
const nextToPost = (): HTMLElement =>
  screen.getByRole('button', { name: pp.next(t.process.steps.post) });
const nextToConfirm = (): HTMLElement =>
  screen.getByRole('button', { name: pp.next(t.process.steps.confirm) });
const postButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.post });

const selectLine = async (user: User, lineNo: number): Promise<void> => {
  await user.click(lineRow(lineNo));
};

type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];

const RECEIPT_DATE = '2026-08-06';
const RECEIPT_TIME = '09:12';
const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const OTHER_WAREHOUSE_LABEL = 'SAMPLE-WH-02 · 합성 창고 나';
const LOCATION_LABEL = 'SAMPLE-LOC-A1 · 합성 열 가1';
const OTHER_LOCATION_LABEL = 'SAMPLE-LOC-B · 합성 구역 나';

const POST_INTERNAL_IDS = [...INTERNAL_IDS, '9901', '9902', '9903', '9701', '9702', '9801', '9802'];

const postRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === GOODS_RECEIPTS_PATH);

const lastPostBody = (requests: RecordedRequest[]): GoodsReceiptCreate => {
  const sent = postRequests(requests);

  expect(sent.length).toBeGreaterThan(0);

  return sent[sent.length - 1]?.body as GoodsReceiptCreate;
};

const chooseOption = async (user: User, fieldLabel: string, optionLabel: string): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: fieldLabel }));
  await user.click(screen.getByRole('option', { name: optionLabel }));
};

/** 단계 1에서 1번 줄을 고르고 단계 2 「입고 정보」로 넘어간다. */
const openPostStep = async (user: User): Promise<void> => {
  await screen.findAllByText(ITEM_LABEL);
  await selectLine(user, 1);
  await user.click(nextToPost());
  await screen.findByRole('heading', { name: t.postTitle });
};

const chooseRequiredCodes = async (user: User, inventory = SAMPLE_INVENTORY): Promise<void> => {
  await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);
  await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
  await chooseOption(user, t.fields.inventoryStatus, inventory);
};

const fillDatetime = async (user: User): Promise<void> => {
  await pickDate(user, screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATE);
  await user.type(screen.getByLabelText(t.process.receiptTime), RECEIPT_TIME);
};

/** 보낼 수 있는 상태까지 채운다 — 창고·위치·필수 코드 셋·입고 일시. 원천 문서 유형은 읽기 전용이다. */
const fillDraft = async (user: User): Promise<void> => {
  await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
  await chooseOption(user, t.fields.location, LOCATION_LABEL);
  await chooseRequiredCodes(user);
  await fillDatetime(user);
};

const expectDatetimeKept = (): void => {
  expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveTextContent(RECEIPT_DATE);
  expect(screen.getByLabelText(t.process.receiptTime)).toHaveValue(RECEIPT_TIME);
};

/** 값 목록이 확정된 뒤의 화면을 열고 「입고 정보」를 다 채운다. */
const setupFilled = async (
  routes: StubRoute[] = allRoutes(),
  hold: string[] = [],
): Promise<ReturnType<typeof renderProcess>> => {
  fillCodeLists();

  const rendered = renderProcess(routes, '', '', hold);

  await openPostStep(rendered.user);
  await fillDraft(rendered.user);

  return rendered;
};

/** 확정 확인 단계까지 간다. */
const setupConfirm = async (
  routes: StubRoute[] = allRoutes(),
  hold: string[] = [],
): Promise<ReturnType<typeof renderProcess>> => {
  const rendered = await setupFilled(routes, hold);

  await rendered.user.click(nextToConfirm());
  await screen.findByRole('heading', { name: t.process.steps.confirm });

  return rendered;
};

describe('GoodsReceiptProcess — 진입', () => {
  /* 대상 전표는 기존 목록 조회를 입하번호로 걸러 찾는다 — 입하 상세를 부르지 않는다. */
  it('주소의 입하번호로 목록을 조회하고 상세를 부르지 않는다', async () => {
    const { requests } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.get('q')).toBe(IR_NO);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
  });

  /* T-W-C 처리 머리 — 제목은 대상 번호, 옆에 상대·일시·문서 번호. */
  it('처리 머리에 입하번호와 공급사·입하일시·거래명세서번호가 보인다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('heading', { name: IR_NO })).toBeInTheDocument();
    expect(
      screen.getByText(`${SUPPLIER_LABEL} · 2026-08-06 07:12 · DN-2026-900001`),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.title })).toBeInTheDocument();
  });

  /* T-W-C 단계 표시 — 명사형 단계 셋, 지금은 첫 단계. */
  it('단계 표시에 세 단계가 있고 라인 선택에서 시작한다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    const steps = screen.getByRole('list', { name: pp.steps });

    for (const label of [t.process.steps.line, t.process.steps.post, t.process.steps.confirm]) {
      expect(within(steps).getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('heading', { name: new RegExp(`^${t.lineTable.title}`) }),
    ).toBeInTheDocument();
  });

  it('품목·단위·자재 LOT을 부르고 자재 LOT은 품목마다 쪽 크기를 실어 부른다', async () => {
    const { requests } = renderProcess(allRoutes());

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, itemPath(9301)).length).toBeGreaterThan(0);
    expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(0);
    expect(
      requestsTo(requests, LOTS_PATH)
        .map((request) => request.url.searchParams.get('itemId'))
        .sort(),
    ).toEqual(['9301', '9302']);
    for (const request of requestsTo(requests, LOTS_PATH)) {
      expect(request.url.searchParams.get('size')).toBe(String(LOT_PAGE_SIZE));
    }
    for (const path of [PLANTS_PATH, itemPath(9301), UOMS_PATH]) {
      for (const request of requestsTo(requests, path)) {
        expect(request.url.searchParams.has('size')).toBe(false);
      }
    }
  });

  it('입하번호가 목록에 없으면 찾을 수 없다고 밝히고 작업함으로 돌아갈 길을 둔다', async () => {
    const { user } = renderProcess(allRoutes(), '', '', [], 'IR-2026-999999');

    await screen.findByText(t.process.notFoundTitle);
    await user.click(screen.getByRole('button', { name: t.actions.toWorklist }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('목록 조회가 실패하면 배너로 내고 찾을 수 없다고 하지 않는다', async () => {
    renderProcess([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.process.notFoundTitle)).not.toBeInTheDocument();
  });

  it('라인 조회 실패는 배너로 내고 라인 없음을 함께 내지 않는다', async () => {
    renderProcess([listRoute(), failingLinesRoute(), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
  });

  it('라인이 없는 전표는 라인 없음을 낸다', async () => {
    renderProcess(
      [listRoute(), otherLinesRoute(), ...lookupRoutes()],
      '',
      '',
      [],
      'IR-2026-900002',
    );

    await screen.findByText(t.empty.noLinesTitle);
  });
});

describe('GoodsReceiptProcess — 단계 1 라인 선택 (C-1)', () => {
  it('자재 LOT이 없거나 수량이 0 이하인 줄은 고를 수 없고 사유가 보인다', async () => {
    const { user } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(lineRow(3)).toHaveAttribute('aria-disabled', 'true');
    expect(lineRow(3)).toHaveAccessibleDescription(t.reasons.lineNoLot);
    expect(lineRow(4)).toHaveAttribute('aria-disabled', 'true');
    expect(lineRow(4)).toHaveAccessibleDescription(t.reasons.lineQtyNotPositive);

    await selectLine(user, 3);

    expect(currentLocation()).toBe(PROCESS_ROUTE);
    /* 짝 방향 — 고를 수 있는 줄은 실제로 열려 있다. */
    expect(lineRow(1)).not.toHaveAttribute('aria-disabled');
  });

  /* C-1 — 끝 열 [선택] 버튼이 없다. */
  it('라인 표에 선택 버튼이 없다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).queryAllByRole('button')).toHaveLength(0);
  });

  /* C-4·C-5 — 고르기 전에는 [다음]이 잠기고 「남은 일」이 그 사유다. */
  it('줄을 고르기 전에는 다음이 잠기고 남은 일이 사유다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(nextToPost()).toBeDisabled();
    expect(nextToPost()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.process.remaining.pickLine}`,
    );
  });

  it('줄을 고르면 행이 선택 표시되고 주소에 남고 다음이 열린다', async () => {
    const { user } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);
    });
    expect(lineRow(1)).toHaveAttribute('aria-selected', 'true');
    expect(nextToPost()).toBeEnabled();
    /* C-2 — 선택 결과(입력 폼)를 표 아래에 쌓지 않는다. 다음 단계에서 연다. */
    expect(screen.queryByRole('combobox', { name: t.fields.warehouse })).not.toBeInTheDocument();
  });

  /* T-W-C — 줄 고르기는 뒤로가기 기록을 늘리지 않는다. 뒤로가기는 작업함으로 간다. */
  it('줄을 골라도 뒤로가기 기록이 늘지 않는다', async () => {
    const { user } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);
    await selectLine(user, 2);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9402`);
    });
  });

  it('둘째 줄을 고르면 앞 선택이 풀린다', async () => {
    const { user } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);
    await selectLine(user, 2);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9402`);
    });
    expect(within(lineTable()).getAllByRole('row', { selected: true })).toHaveLength(1);
  });

  it('고른 줄을 다시 누르면 풀린다', async () => {
    const { user } = renderProcess(allRoutes(), '?line=9401');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(PROCESS_ROUTE);
    });
  });

  it('라인 목록에 없거나 고를 수 없는 줄은 주소에서 정리된다', async () => {
    renderProcess(allRoutes(), '?line=9403');

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(PROCESS_ROUTE);
    });
  });

  it('라인 응답 전에는 고른 줄을 지우지 않는다', async () => {
    const { release } = renderProcess(allRoutes(), '?line=9401', '', [LINES_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);
  });

  it('다시 부른 라인에서 사라진 줄은 정리된다', async () => {
    const { queryClient } = renderProcess(
      [listRoute(), shrinkingLinesRoute(), ...lookupRoutes()],
      '?line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lines(9001) });
    });

    await waitFor(() => {
      expect(currentLocation()).toBe(PROCESS_ROUTE);
    });
  });
});

describe('GoodsReceiptProcess — 참조 풀이', () => {
  it('참조가 풀린 뒤에도 내부 번호가 화면에 없다', async () => {
    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(screen.getAllByText(PLANT_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByText(/LOT-2026-900010/)).toBeInTheDocument();
    expect(
      screen.getAllByText(t.lineTable.receivedQtyPair(100, 'SAMPLE-EA')).length,
    ).toBeGreaterThan(0);

    const main = document.body.textContent ?? '';
    const shown = main.replace(currentLocation(), '');

    for (const id of INTERNAL_IDS) {
      expect(shown).not.toContain(id);
    }
  });

  it.each([
    ['품목', itemPath(9301)],
    ['단위', UOMS_PATH],
    ['자재 LOT', LOTS_PATH],
  ])('%s 참조가 실패하면 라인 표에 사유와 복구 경로가 있다', async (_label, path) => {
    const { requests, user } = renderProcess([failingLookupRoute(path), ...allRoutes()]);

    await screen.findByText(t.reasons.lineReferencesFailed);

    expect(lineTable().textContent ?? '').toContain(t.values.referenceFailed);

    const before = requestsTo(requests, path).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, path).length).toBeGreaterThan(before);
    });
  });

  it('자재 LOT 목록이 잘리면 그 사실을 밝히고 잘리지 않으면 내지 않는다', async () => {
    renderProcess([
      listRoute(),
      linesRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      ...itemDetailRoutes(),
      lookupRoute(UOMS_PATH, uomFixtures),
      lookupRoute(LOTS_PATH, lotFixtures, { total: 500 }),
    ]);

    await screen.findByText(t.reasons.lineReferencesTruncated);
  });

  it('자재 LOT 목록이 잘리지 않으면 잘림 안내를 내지 않는다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText('LOT-2026-900010');

    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });

  it('자재 LOT 이름이 늦게 와도 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderProcess(
      [listRoute(), linesRoute([inboundReceiptLine()]), ...lookupRoutes()],
      '',
      '',
      [LOTS_PATH],
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText('LOT-2026-900010');
  });

  it('자재 LOT이 없는 줄은 알 수 없음이 아니라 사유만 둔다', async () => {
    renderProcess([
      listRoute(),
      linesRoute([inboundReceiptLine({ lotId: null })]),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.reasons.lineNoLot)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  it('공장 참조가 실패하면 자동 적용 값에 사유가 보인다', async () => {
    const { user } = renderProcess([failingLookupRoute(PLANTS_PATH), ...allRoutes()]);

    await openPostStep(user);

    expect(screen.getByLabelText(t.process.derived.title).textContent ?? '').toContain(
      t.values.referenceFailed,
    );
  });
});

describe('GoodsReceiptProcess — 단계 2 입고 정보', () => {
  /* T-W-C — 지난 단계에서 정한 값만 점선 상자 한 줄로. */
  it('지난 단계 요약에 고른 줄이 한 줄로 보인다', async () => {
    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(screen.getByLabelText(pp.previousSummary)).toHaveTextContent(
      t.process.previousLine(1, ITEM_LABEL, 'LOT-2026-900010', '100 SAMPLE-EA'),
    );
  });

  /* T-W-C — 업무 규칙에서 정해지는 값은 입력 칸이 아니라 읽기 전용으로 출처와 함께. */
  it('공장·입고 수량·원천 문서 유형·영업일은 입력 칸이 아니라 출처와 함께 보인다', async () => {
    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    const derived = screen.getByLabelText(t.process.derived.title);

    expect(within(derived).getByText(PLANT_LABEL)).toBeInTheDocument();
    expect(within(derived).getByText('INBOUND_RECEIPT')).toBeInTheDocument();
    expect(within(derived).getAllByText(t.process.derived.fromInboundReceipt)).toHaveLength(2);
    expect(within(derived).getByText(t.process.derived.fromInboundLine)).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: t.fields.sourceDocumentType }),
    ).not.toBeInTheDocument();
  });

  /* T-W-C — 선택 입력(사유·비고)은 「추가 입력(선택)」으로 접는다. */
  it('사유와 비고는 추가 입력(선택) 안에 접혀 있다', async () => {
    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    const details = screen.getByText(pp.optionalInput).closest('details');

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(within(details as HTMLElement).getByLabelText(t.fields.remarks)).toBeInTheDocument();
  });

  /* C-7 — 처음 열었을 때 오류를 표시하지 않는다. */
  it('처음 열었을 때 오류가 없다', async () => {
    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('.field-error')).toBeNull();
  });

  it('코드 목록이 확정되지 않았으면 다음이 잠기고 남은 일이 그 사유다', async () => {
    const { user, requests } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(nextToConfirm()).toBeDisabled();
    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postCodeListPending}`,
    );
    /* 입고 유형·품질 상태(본문)와 사유(추가 입력) — 셋 다 운영 코드 목록을 기다린다. */
    expect(screen.getAllByText(t.filters.codePending)).toHaveLength(3);
    expect(postRequests(requests)).toHaveLength(0);
  });

  it('코드 목록이 채워지면 남은 일이 「창고를 고르세요」로 바뀐다', async () => {
    fillCodeLists();

    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postNeedsWarehouse}`,
    );
    expect(screen.queryByText(t.filters.codePending)).not.toBeInTheDocument();
    /* 순서대로 입력한다 — 앞 칸 전에는 잠겨 있다. */
    expect(screen.getByRole('combobox', { name: t.fields.qualityStatus })).toBeDisabled();
  });

  it('창고를 고르면 적치 위치가 열리고 포커스가 옮겨 간다', async () => {
    fillCodeLists();

    const { user } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(screen.getByRole('combobox', { name: t.fields.location })).toBeDisabled();

    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);

    const location = screen.getByRole('combobox', { name: t.fields.location });

    expect(location).toBeEnabled();
    await waitFor(() => {
      expect(location).toHaveFocus();
    });
  });

  it('필요한 값을 다 채우면 다음이 열리고 저절로 나가지 않는다', async () => {
    const { requests } = await setupFilled();

    expect(nextToConfirm()).toBeEnabled();
    expect(actionBar()).toHaveTextContent(t.process.remaining.next);
    expect(postRequests(requests)).toHaveLength(0);
  });

  /* 목 서버는 빈 문자열도 201로 통과시킨다 — 막는 곳이 화면뿐이다. */
  it('필수 코드가 하나라도 비면 잠긴 채로 사유가 바뀐다', async () => {
    fillCodeLists();

    const { user } = renderProcess(allRoutes());

    await openPostStep(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, SAMPLE_RECEIPT_TYPE);

    expect(nextToConfirm()).toBeDisabled();
    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postNeedsCodes}`,
    );
  });

  it('입고 일시는 날짜와 시각을 모두 넣어야 채워진다', async () => {
    fillCodeLists();

    const { user } = renderProcess(allRoutes());

    await openPostStep(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseRequiredCodes(user);
    await pickDate(user, screen.getByLabelText(t.fields.receiptDatetime), RECEIPT_DATE);

    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postNeedsReceiptDatetime}`,
    );

    await user.type(screen.getByLabelText(t.process.receiptTime), RECEIPT_TIME);

    expect(nextToConfirm()).toBeEnabled();
  });

  it('코드가 상한을 넘으면 인라인 오류를 내고 확정 확인으로 넘어가지 않는다', async () => {
    fillCodeLists();
    codeValues.receiptType = ['S'.repeat(51)];

    const { user, requests } = renderProcess(allRoutes());

    await openPostStep(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseOption(user, t.fields.receiptType, 'S'.repeat(51));
    await chooseOption(user, t.fields.qualityStatus, SAMPLE_QUALITY);
    await chooseOption(user, t.fields.inventoryStatus, SAMPLE_INVENTORY);
    await fillDatetime(user);
    await user.click(nextToConfirm());

    expect(screen.getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: t.process.steps.confirm }),
    ).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });
});

describe('GoodsReceiptProcess — 창고와 적치 위치', () => {
  it('창고를 고르기 전에는 위치를 부르지 않는다', async () => {
    fillCodeLists();

    const { user, requests } = renderProcess(allRoutes());

    await openPostStep(user);

    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(0);

    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);

    await waitFor(() => {
      expect(requestsTo(requests, LOCATIONS_PATH).length).toBeGreaterThan(0);
    });
    expect(requestsTo(requests, LOCATIONS_PATH)[0]?.url.searchParams.get('warehouseId')).toBe(
      '9701',
    );
  });

  /* 위치는 창고에 속한다. 창고를 바꾸면 위치만 비우고 코드·일시는 남긴다. */
  it('창고를 바꾸면 위치만 비우고 코드와 일시는 남긴다', async () => {
    const { user } = await setupFilled();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);

    expect(screen.getByRole('combobox', { name: t.fields.location })).not.toHaveTextContent(
      LOCATION_LABEL,
    );
    expect(nextToConfirm()).toBeDisabled();
    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postNeedsLocation}`,
    );
    expect(screen.getByRole('combobox', { name: t.fields.receiptType })).toHaveTextContent(
      SAMPLE_RECEIPT_TYPE,
    );
    expectDatetimeKept();
  });

  it('창고를 바꾸면 그 창고의 위치 목록이 온다', async () => {
    const { user } = await setupFilled();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);
    await user.click(screen.getByRole('combobox', { name: t.fields.location }));

    expect(await screen.findByRole('option', { name: OTHER_LOCATION_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: LOCATION_LABEL })).not.toBeInTheDocument();
  });

  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    fillCodeLists();

    const { user } = renderProcess(
      allRoutes([lookupRoute(WAREHOUSES_PATH, warehouseFixtures, { total: 40 })]),
    );

    await openPostStep(user);

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveAccessibleDescription(
      t.filters.lookupTruncated,
    );
  });

  it('위치 목록이 오는 동안 그 사실을 밝힌다', async () => {
    fillCodeLists();

    const { user, release } = renderProcess(allRoutes(), '', '', [LOCATIONS_PATH]);

    await openPostStep(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: t.fields.location })).toHaveAccessibleDescription(
        t.filters.lookupLoading,
      );
    });

    await act(async () => {
      release();
    });

    await waitFor(() => {
      expect(screen.queryByText(t.filters.lookupLoading)).not.toBeInTheDocument();
    });
  });

  it('고른 창고의 공장이 전표와 다르면 그 사실을 밝힌다', async () => {
    const { user } = await setupFilled();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);

    expect(
      screen.getByText(
        (_text, element) =>
          element?.classList.contains('field-note') === true &&
          element.textContent === t.notes.warehousePlantDiffers(PLANT_LABEL),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t.notes.warehousePlant('SAMPLE-PLT-02 · 합성 공장 나')),
    ).toBeInTheDocument();
  });
});

describe('GoodsReceiptProcess — 단계 3 확정 확인 (C-9)', () => {
  /* 확정 확인 단계가 확인 대화상자를 대신한다 — 넘어가는 것만으로 요청이 나가지 않는다. */
  it('확정 확인으로 넘어가도 요청이 나가지 않는다', async () => {
    const { requests } = await setupConfirm();

    expect(postRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('저장될 값과 반영 사항 다섯, 되돌릴 수 없다는 안내를 보인다', async () => {
    await setupConfirm();

    expect(screen.getAllByText(IR_NO).length).toBeGreaterThan(0);
    expect(screen.getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_RECEIPT_TYPE)).toBeInTheDocument();
    expect(screen.getByText(`${RECEIPT_DATE} ${RECEIPT_TIME}`)).toBeInTheDocument();

    const effects = screen.getByRole('region', { name: t.process.effectsTitle });

    for (const label of Object.values({
      a: t.process.effects.createReceipt,
      b: t.process.effects.lotStatus,
      c: t.process.effects.ledger,
      d: t.process.effects.balance,
      e: t.process.effects.erp,
    })) {
      expect(within(effects).getByText(label)).toBeInTheDocument();
    }
    expect(within(effects).getByText(t.process.effects.erpNote)).toBeInTheDocument();
    expect(within(effects).getByText(t.dialog.submitIrreversible)).toBeInTheDocument();
    /* 「적재」는 「전송」이 아니다. */
    expect(effects.textContent ?? '').not.toContain('전송 완료');
  });

  it('지난 단계 요약에 줄과 창고·위치가 보인다', async () => {
    await setupConfirm();

    expect(screen.getByLabelText(pp.previousSummary)).toHaveTextContent(
      t.process.previousWhere(WAREHOUSE_LABEL, LOCATION_LABEL),
    );
  });

  it('확정 확인 단계에는 입력칸이 없다', async () => {
    await setupConfirm();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  /* T-W-C — 완료한 단계는 단계 표시에서 눌러 돌아갈 수 있고 입력한 값은 유지한다. */
  it('단계 표시로 입고 정보에 돌아가면 입력한 값이 남아 있다', async () => {
    const { user } = await setupConfirm();

    await user.click(screen.getByRole('button', { name: pp.returnToStep(t.process.steps.post) }));

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      WAREHOUSE_LABEL,
    );
    expectDatetimeKept();
  });

  it('이전을 누르면 입고 정보로 돌아가고 값이 남는다', async () => {
    const { user, requests } = await setupConfirm();

    await user.click(screen.getByRole('button', { name: pp.prev }));

    expectDatetimeKept();
    expect(postRequests(requests)).toHaveLength(0);
  });

  /* 아직 갈 수 없는 단계는 누를 수 없다. */
  it('아직 가지 않은 단계는 누를 수 없다', async () => {
    renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);

    expect(
      screen.queryByRole('button', { name: pp.returnToStep(t.process.steps.confirm) }),
    ).not.toBeInTheDocument();
  });

  /*
   * 확인 단계에 있는 동안 주소로 줄이 바뀌면(앞으로가기·주소 편집) 라인 선택으로 돌아간다 —
   * 머물면 사용자가 확인한 줄과 나갈 줄이 갈린다.
   */
  it('확인 단계에서 주소로 줄이 바뀌면 라인 선택으로 돌아가고 요청이 나가지 않는다', async () => {
    fillCodeLists();

    const { user, requests } = renderProcess(allRoutes(), '', 'line=9402');

    await openPostStep(user);
    await fillDraft(user);
    await user.click(nextToConfirm());
    await screen.findByRole('heading', { name: t.process.steps.confirm });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9402');
    });
    expect(screen.queryByRole('button', { name: t.actions.post })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: new RegExp(`^${t.lineTable.title}`) }),
    ).toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(0);
  });

  /*
   * 확인 단계에 있는 동안 라인 응답이 다시 와 초안이 비워지면, 보내는 자리가 한 번 더 본다 —
   * 빈 코드·번호 0으로 되돌릴 수 없는 전표가 나가지 않는다.
   */
  it('확인 단계에서 초안이 비워지면 입고 처리를 눌러도 요청이 나가지 않는다', async () => {
    const { user, queryClient, requests } = await setupConfirm(allRoutes([changingLinesRoute()]));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lines(9001) });
    });
    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(1);
    });

    await user.click(postButton());

    expect(postRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 왜 나가지 않았는지가 화면에 남는다(입고 정보로 돌아가 사유를 보인다). */
    expect(nextToConfirm()).toBeDisabled();
    expect(nextToConfirm()).toHaveAccessibleDescription(
      `${pp.remaining}: ${t.actionReasons.postNeedsWarehouse}`,
    );
  });
});

describe('GoodsReceiptProcess — 실제로 나가는 요청', () => {
  const postOnce = async (
    routes: StubRoute[] = allRoutes(),
  ): Promise<ReturnType<typeof renderProcess>> => {
    const rendered = await setupConfirm(routes);

    await rendered.user.click(postButton());
    await waitFor(() => {
      expect(postRequests(rendered.requests)).toHaveLength(1);
    });

    return rendered;
  };

  it('입고 처리를 누르면 요청이 딱 한 번 나간다', async () => {
    const { requests } = await postOnce();

    expect(postRequests(requests)[0]?.method).toBe('POST');
  });

  it('공장이 입하 전표의 값이고 창고는 고른 값이다', async () => {
    const { requests } = await postOnce();

    expect(lastPostBody(requests).plantId).toBe(9201);
    expect(lastPostBody(requests).warehouseId).toBe(9701);
  });

  it('라인 값이 입하 라인 그대로이고 원천이 입하 전표를 가리킨다', async () => {
    const { requests } = await postOnce();

    const body = lastPostBody(requests);

    expect(body.sourceDocumentTypeCode).toBe('INBOUND_RECEIPT');
    expect(body.sourceDocumentId).toBe(9001);
    expect(body.lines).toEqual([
      {
        inboundReceiptLineId: 9401,
        itemId: 9301,
        lotId: 9601,
        receiptQty: 100,
        uomId: 9501,
        qualityStatusCode: SAMPLE_QUALITY,
        inventoryStatusCode: SAMPLE_INVENTORY,
        destinationLocationId: 9802,
      },
    ]);
  });

  it('영업일이 입고 일시에서 나오고 발생 시각을 싣지 않으며 일시에 offset이 붙는다', async () => {
    const { requests } = await postOnce();

    const body = lastPostBody(requests);

    expect(body.businessDate).toBe(RECEIPT_DATE);
    expect(body.receiptDatetime.startsWith(`${RECEIPT_DATE}T${RECEIPT_TIME}:00`)).toBe(true);
    expect(Object.keys(body)).not.toContain('occurredAt');
    expect(/[+-]\d{2}:\d{2}$/.test(body.receiptDatetime)).toBe(true);
  });

  it('사유와 비고를 넣지 않으면 그 키를 싣지 않는다', async () => {
    const { requests } = await postOnce();

    const keys = Object.keys(lastPostBody(requests));

    expect(keys).not.toContain('reasonCode');
    expect(keys).not.toContain('remarks');
    expect(keys).toContain('receiptTypeCode');
  });

  it('창고를 바꾼 뒤 고른 위치가 요청에 실린다', async () => {
    const { user, requests } = await setupFilled();

    await chooseOption(user, t.fields.warehouse, OTHER_WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, OTHER_LOCATION_LABEL);
    await user.click(nextToConfirm());
    await user.click(postButton());

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });
    expect(lastPostBody(requests).lines[0]?.destinationLocationId).toBe(9811);
  });

  it('추가 입력의 사유와 비고는 요청에 실린다', async () => {
    const { user, requests } = await setupFilled();

    await user.click(screen.getByText(pp.optionalInput));
    await chooseOption(user, t.fields.reason, SAMPLE_REASON);
    await user.type(screen.getByLabelText(t.fields.remarks), '합성 비고');
    await user.click(nextToConfirm());
    await user.click(postButton());

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });
    expect(lastPostBody(requests).reasonCode).toBe(SAMPLE_REASON);
    expect(lastPostBody(requests).remarks).toBe('합성 비고');
  });

  /* 계약이 모르는 재고 상태 코드가 선택지에 실려도 되돌릴 수 없는 쓰기는 나가지 않는다. */
  it('계약이 모르는 재고 상태 코드로는 요청이 나가지 않는다', async () => {
    fillCodeLists();
    codeValues.inventoryStatus = ['SAMPLE_INVENTORY_A'];

    const { user, requests } = renderProcess(allRoutes());

    await openPostStep(user);
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseRequiredCodes(user, 'SAMPLE_INVENTORY_A');
    await fillDatetime(user);
    await user.click(nextToConfirm());
    await user.click(postButton());

    expect(postRequests(requests)).toHaveLength(0);
    expect(screen.queryByText(t.process.doneTitle)).not.toBeInTheDocument();
  });
});

describe('GoodsReceiptProcess — 전송 중 잠금', () => {
  it('전송 중에 다시 눌러도 요청이 늘지 않고 돌아가는 길이 닫힌다', async () => {
    const { user, requests, release } = await setupConfirm(allRoutes(), [GOODS_RECEIPTS_PATH]);

    await user.click(postButton());

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(1);
    });

    await user.click(postButton());

    expect(postRequests(requests)).toHaveLength(1);
    expect(screen.getByRole('button', { name: pp.prev })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.title })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: pp.returnToStep(t.process.steps.post) }),
    ).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
  });
});

describe('GoodsReceiptProcess — 완료 (C-9)', () => {
  const succeed = async (
    routes: StubRoute[] = allRoutes(),
  ): Promise<ReturnType<typeof renderProcess>> => {
    const rendered = await setupConfirm(routes);

    await rendered.user.click(postButton());
    await screen.findByRole('status', { name: t.result.label });

    return rendered;
  };

  it('성공 알림에 입고번호가 있고 결과에 상태 코드가 보인다', async () => {
    await succeed();

    expect(screen.getByText(t.process.doneTitle)).toBeInTheDocument();
    expect(screen.getByText(t.process.doneReceiptNo('GR-2026-800001'))).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_GR_STATUS_A')).toBeInTheDocument();
  });

  it('하단 바에 다음 라인 처리(주 동작)와 작업함으로가 있다', async () => {
    await succeed();

    const bar = actionBar();

    expect(within(bar).getByRole('button', { name: t.actions.nextLine })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: t.actions.toWorklist })).toBeInTheDocument();
    expect(bar).toHaveTextContent(t.process.remaining.done);
  });

  it('고른 줄은 주소에 남고 라인과 자재 LOT을 다시 부른다', async () => {
    const { requests } = await succeed();

    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);
    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(1);
      expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
    });
    expect(await screen.findByText('SAMPLE_LOT_STATUS_A')).toBeInTheDocument();
  });

  it('성공하기 전에는 자재 LOT을 다시 부르지 않는다', async () => {
    const { requests } = await setupConfirm();

    expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(0);
  });

  it('실패한 뒤에도 자재 LOT을 다시 부르지 않는다', async () => {
    const { user, requests } = await setupConfirm(allRoutes([failingGoodsReceiptRoute(400)]));

    await user.click(postButton());
    await screen.findByText(messages.httpError.title);

    expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(0);
  });

  it('자재 LOT 재조회가 실패하면 그 사실을 밝힌다', async () => {
    await succeed(allRoutes([failingLotDetailRoute()]));

    expect(await screen.findByText(t.result.lotStatusFailed)).toBeInTheDocument();
  });

  it('결과에 내부 번호가 없다', async () => {
    await succeed();

    const pane = screen.getByRole('status', { name: t.result.label });

    expect(within(pane).getByText('GR-2026-800001')).toBeInTheDocument();
    for (const id of POST_INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  it('원장 유무를 내고 잔액은 확인하지 않는다고 밝힌다', async () => {
    await succeed();

    expect(screen.getByText(t.result.ledgerAll)).toBeInTheDocument();
    expect(screen.getByText(t.result.balanceNote)).toBeInTheDocument();
  });

  it('원장 라인이 오지 않으면 그 사실을 따로 말한다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({}, { inventoryTransactionLineId: null })]));

    expect(screen.getByText(t.result.ledgerNone)).toBeInTheDocument();
  });

  it.each([
    [true, t.result.erpQueued],
    [false, t.result.erpNotQueued],
  ])('ERP 적재가 %s이면 그 갈래의 문구를 낸다', async (queued, text) => {
    await succeed(allRoutes([goodsReceiptRoute({ erpMessageQueued: queued })]));

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpUnknown)).not.toBeInTheDocument();
  });

  it('ERP 적재 값이 응답에 없으면 알 수 없다고 말한다', async () => {
    await succeed();

    expect(screen.getByText(t.result.erpUnknown)).toBeInTheDocument();
  });

  it('결과 어디에도 「전송 완료」가 없다', async () => {
    await succeed(allRoutes([goodsReceiptRoute({ erpMessageQueued: true })]));

    expect(screen.getByRole('status', { name: t.result.label }).textContent ?? '').not.toContain(
      '전송 완료',
    );
  });

  /* C-4 — 늘 쓸 수 없던 「원천 문서 보기」를 두지 않는다. */
  it('늘 비활성이던 원천 문서 보기가 없다', async () => {
    await succeed();

    expect(screen.queryByRole('button', { name: /원천 문서/ })).not.toBeInTheDocument();
  });

  it('완료 뒤에는 단계 표시로 앞 단계에 돌아가지 않는다', async () => {
    await succeed();

    expect(
      screen.queryByRole('button', { name: pp.returnToStep(t.process.steps.post) }),
    ).not.toBeInTheDocument();
  });

  it('다음 라인 처리를 누르면 같은 전표의 라인 선택으로 돌아가고 결과가 사라진다', async () => {
    const { user } = await succeed();

    await user.click(screen.getByRole('button', { name: t.actions.nextLine }));

    await waitFor(() => {
      expect(currentLocation()).toBe(PROCESS_ROUTE);
    });
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: new RegExp(`^${t.lineTable.title}`) }),
    ).toBeInTheDocument();
  });

  it('작업함으로를 누르면 작업함으로 간다', async () => {
    const { user } = await succeed();

    await user.click(screen.getByRole('button', { name: t.actions.toWorklist }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 다시 처리해 본문을 만들지 못하면 앞 성공의 결과가 남지 않는다 — 새 번호로 읽힌다. */
  it('다음 라인에서 계약이 모르는 코드로 처리하면 앞 결과가 남지 않고 요청도 늘지 않는다', async () => {
    const { user, requests } = await succeed();

    codeValues.inventoryStatus = [SAMPLE_INVENTORY, 'SAMPLE_INVENTORY_A'];

    await user.click(screen.getByRole('button', { name: t.actions.nextLine }));
    await selectLine(user, 1);
    await user.click(nextToPost());
    await chooseOption(user, t.fields.warehouse, WAREHOUSE_LABEL);
    await chooseOption(user, t.fields.location, LOCATION_LABEL);
    await chooseRequiredCodes(user, 'SAMPLE_INVENTORY_A');
    await fillDatetime(user);
    await user.click(nextToConfirm());
    await user.click(postButton());

    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    expect(postRequests(requests)).toHaveLength(1);
  });
});

describe('GoodsReceiptProcess — 실패 세 갈래', () => {
  const fail = async (route: StubRoute): Promise<ReturnType<typeof renderProcess>> => {
    const rendered = await setupConfirm(allRoutes([route]));

    await rendered.user.click(postButton());

    return rendered;
  };

  it('칸 검증 실패는 입고 정보로 돌아가 그 칸에 붙고 입력이 남는다', async () => {
    await fail(
      failingGoodsReceiptRoute(400, {
        errors: [{ scope: 'field', field: 'remarks', code: 'INVALID', message: '합성 서버 오류' }],
      }),
    );

    /* 칸의 오류는 그 칸이 있는 「입고 정보」로 돌아가 붙는다 — 접힌 추가 입력도 펼친다. */
    expect(await screen.findByText('합성 서버 오류')).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.remarks)).toHaveAccessibleDescription('합성 서버 오류');
    expectDatetimeKept();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  it('권한 없음은 다른 문구이고 등록 여부 확인 안내를 내지 않는다', async () => {
    await fail(failingGoodsReceiptRoute(403));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.postRecheck)).not.toBeInTheDocument();
  });

  it('응답을 받지 못하면 등록 여부를 확인하라는 안내가 함께 나온다', async () => {
    await fail(offlineGoodsReceiptRoute());

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.postRecheck)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
  });

  it('실패한 뒤 다시 보낼 수 있다', async () => {
    const { user, requests } = await fail(failingGoodsReceiptRoute(400));

    await screen.findByText(messages.httpError.title);
    await user.click(postButton());

    await waitFor(() => {
      expect(postRequests(requests)).toHaveLength(2);
    });
  });
});

describe('GoodsReceiptProcess — 작업함 복귀와 파기 확인', () => {
  it('초안이 없으면 확인 없이 작업함으로 간다', async () => {
    const { user } = renderProcess(allRoutes());

    await screen.findAllByText(ITEM_LABEL);
    await user.click(screen.getByRole('button', { name: t.title }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('초안이 있으면 작업함으로 가기 전에 파기 확인을 받는다', async () => {
    const { user, requests } = await setupFilled();

    await user.click(screen.getByRole('button', { name: t.title }));

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(t.dialog.discardLead)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);

    await user.click(within(dialog).getByRole('button', { name: t.actions.keepEditing }));

    expectDatetimeKept();

    await user.click(screen.getByRole('button', { name: t.title }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
    expect(postRequests(requests)).toHaveLength(0);
  });

  it('초안이 있는 채 다른 줄을 고르면 파기 확인을 받는다', async () => {
    const { user } = await setupFilled();

    await user.click(screen.getByRole('button', { name: pp.returnToStep(t.process.steps.line) }));
    await selectLine(user, 2);

    expect(screen.getByText(t.dialog.discardLead)).toBeInTheDocument();
    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9402`);
    });
  });
});

describe('GoodsReceiptProcess — 초안이 사라지지 않는다', () => {
  it('입력이 주소를 바꾸지 않고 조회도 다시 부르지 않는다', async () => {
    const { user, requests } = await setupFilled();

    const listCallsBefore = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByText(pp.optionalInput));
    await user.type(screen.getByLabelText(t.fields.remarks), '합성 비고');

    expect(currentLocation()).toBe(`${PROCESS_ROUTE}?line=9401`);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(listCallsBefore);
  });

  /* #43 — 되돌림의 신호는 고른 줄과 라인 응답 둘뿐이다. 목록이 다시 와도 입력이 남는다. */
  it('목록이 다시 도착해도 입력이 되돌아가지 않는다', async () => {
    let call = 0;
    const changingHeaderList: StubRoute = {
      match: (request) => isGet(request, LIST_PATH),
      respond: () => {
        call += 1;

        return jsonResponse(
          listBody(
            inboundReceiptFixtures.map((row) =>
              row.inboundReceiptId === 9001
                ? { ...row, deliveryNoteNo: `DN-CHANGED-${String(call)}` }
                : row,
            ),
          ),
        );
      },
    };
    const { queryClient } = await setupFilled([
      changingHeaderList,
      linesRoute(),
      goodsReceiptRoute(),
      lotDetailRoute(),
      ...lookupRoutes(),
    ]);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });
    await screen.findByText(/DN-CHANGED-2/);

    expectDatetimeKept();
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      WAREHOUSE_LABEL,
    );
  });

  it('참조가 다시 도착해도 입력이 되돌아가지 않는다', async () => {
    const { queryClient } = await setupFilled(allRoutes([changingItemRoute()]));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['goods-receipt-lookups'] });
    });
    await screen.findAllByText(new RegExp(CHANGED_ITEM_LABEL.replace(/[()]/g, '\\$&')));

    expectDatetimeKept();
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      WAREHOUSE_LABEL,
    );
  });
});
