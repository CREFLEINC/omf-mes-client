import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders, type StubRoute } from '../../test/api-harness';
import { pickDate } from '../../test/date-picker';
import { inboundReceiptFixtures } from './fixtures';
import { irKeys } from './queries';
import { GoodsReceiptWorklist } from './screen';
import {
  allRoutes,
  BackProbe,
  changingListRoute,
  createRecordingFetch,
  currentLocation,
  DETAIL_MARKER,
  DETAIL_PATH,
  failingListRoute,
  failingLookupRoute,
  GOODS_RECEIPTS_PATH,
  INTERNAL_IDS,
  itemPath,
  LIST_PATH,
  LocationProbe,
  LOTS_PATH,
  listRoute,
  lookupRoutes,
  PARTNERS_PATH,
  type RecordedRequest,
  requestsTo,
  ROUTE,
  SUPPLIER_LABEL,
  UOMS_PATH,
  type User,
} from './test-support';

const t = messages.goodsReceipt;
const pager = messages.common.pageNav;

/** 처리 화면 자리 — 작업함 행을 누르면 이 경로로 간다. 처리 화면 자체는 `process-screen.test.tsx`가 잰다. */
const ProcessStub = () => <p>처리 화면</p>;

const renderWorklist = (
  routes: StubRoute[],
  search = '',
  hold: string[] = [],
): { requests: RecordedRequest[]; queryClient: QueryClient; release: () => void; user: User } => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { queryClient } = renderWithProviders(
    <>
      <Routes>
        <Route path={ROUTE} element={<GoodsReceiptWorklist />} />
        <Route path={`${ROUTE}/:inboundReceiptNo`} element={<ProcessStub />} />
      </Routes>
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, release, user: userEvent.setup() };
};

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

describe('GoodsReceiptWorklist — 첫 진입 조회', () => {
  /* 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지 읽을 수 없다. */
  it('목록 요청이 1회 나가고 날짜 조건이 실리지 않는다', async () => {
    const { requests } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(inboundReceiptFixtures.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  it('입하 상세를 부르지 않는다', async () => {
    const { requests } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /* 작업함은 고르는 자리다 — 쓰기도, 라인 표가 쓰는 참조(품목·단위·자재 LOT)도 부르지 않는다. */
  it('쓰기와 라인 참조를 부르지 않고 공급사만 부른다', async () => {
    const { requests } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, GOODS_RECEIPTS_PATH)).toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expect(requestsTo(requests, itemPath(9301))).toHaveLength(0);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(1);
    /* 공급사는 끝까지 받느라 200건씩 부른다. 목록에는 쪽 크기를 싣지 않는다. */
    expect(requestsTo(requests, PARTNERS_PATH)[0]?.url.searchParams.get('size')).toBe('200');
    expect(requestsTo(requests, LIST_PATH)[0]?.url.searchParams.has('size')).toBe(false);
  });

  /* C-4 — 값 목록이 비어 늘 고를 수 없던 상태 조건 칸을 두지 않는다. */
  it('늘 고를 수 없는 상태 조건 칸이 없다', async () => {
    renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(screen.queryByLabelText(t.fields.status)).not.toBeInTheDocument();
  });

  /* C-6 — [조회]는 오른쪽 끝 채움 버튼, [초기화]는 그 왼쪽. */
  it('조회가 초기화의 오른쪽에 선다', async () => {
    renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const reset = screen.getByRole('button', { name: messages.common.reset });
    const search = screen.getByRole('button', { name: messages.common.search });

    expect(reset.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('GoodsReceiptWorklist — 조건과 주소', () => {
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderWorklist(
      allRoutes(),
      '?sup=9101&from=2026-08-01&to=2026-08-31&st=SAMPLE_IR_STATUS_A&q=IR-2026',
    );

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('supplierId')).toBe('9101');
    expect(query?.get('receiptDateFrom')).toBe('2026-08-01');
    expect(query?.get('receiptDateTo')).toBe('2026-08-31');
    expect(query?.get('statusCode')).toBe('SAMPLE_IR_STATUS_A');
    expect(query?.get('q')).toBe('IR-2026');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=IR-2026-900002');
  });

  /* C-12 — 입하일은 DS `DatePicker`로 고르고 그 값이 조회에 실린다. */
  it('입하일을 DatePicker로 고르면 조회에 실린다', async () => {
    const { requests, user } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await pickDate(user, screen.getByLabelText(t.fields.receiptDateFrom), '2026-08-01');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('receiptDateFrom')).toBe(
      '2026-08-01',
    );
  });

  /* 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다. */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderWorklist(allRoutes(), '?page=2');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=IR-2026-900002');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  it('조건 변경이 쪽을 첫 쪽으로 되돌린다', async () => {
    const { user } = renderWorklist(allRoutes(), '?page=2');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=IR-2026`);
    });
  });

  it('초기화가 조건을 모두 비운다', async () => {
    const { user } = renderWorklist(allRoutes(), '?sup=9101&q=IR');

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* C-8 — 공용 쪽 이동 부품. [다음]·[마지막]이 조건을 유지한 채 쪽만 바꾼다. */
  it('쪽 이동이 조건을 유지하고 쪽만 바꾼다', async () => {
    const { user } = renderWorklist(
      [listRoute(inboundReceiptFixtures, { page: 1, size: 2, total: 6 }), ...lookupRoutes()],
      '?sup=9101',
    );

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: pager.next }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });

    await user.click(screen.getByRole('button', { name: pager.last }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=3`);
    });
  });

  /* 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다. */
  it('정수가 아닌 조건은 요청에 실리지 않는다', async () => {
    const { requests } = renderWorklist(allRoutes(), '?sup=abc&page=0&from=2026-13-01');

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('page')).toBe(false);
    expect(query?.has('receiptDateFrom')).toBe(false);
  });

  it('조건을 치는 동안 주소가 바뀌지 않고 요청도 늘지 않는다', async () => {
    const { requests, user } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /* #43 — 목록 응답이 도착해 부모가 다시 그려져도 치던 조건이 사라지지 않는다. */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { requests, queryClient, user } = renderWorklist([
      changingListRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText('IR-2026-900001');
    await screen.findByText(pager.total(4));

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
    });
    await screen.findByText(pager.total(5));

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('IR-2026-9');
  });
});

describe('GoodsReceiptWorklist — 조회 실패', () => {
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderWorklist([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회가 실패해도 조건 줄은 남는다', async () => {
    renderWorklist([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderWorklist([failingListRoute(403), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderWorklist([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('GoodsReceiptWorklist — 처리 화면으로 이동 (T-W-C 작업함 · C-1)', () => {
  /* 행 어디를 눌러도 그 전표의 처리 화면으로 간다. 끝 열 [선택] 버튼이 없다. */
  it('행을 누르면 그 전표의 처리 화면으로 간다', async () => {
    const { user } = renderWorklist(allRoutes(), '?sup=9101');

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).queryByRole('button', { name: /선택/ })).not.toBeInTheDocument();

    await user.click(screen.getByText('IR-2026-900001'));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}/IR-2026-900001`);
    });
    expect(screen.getByText('처리 화면')).toBeInTheDocument();
  });

  it('키보드 Enter로도 처리 화면으로 간다', async () => {
    const { user } = renderWorklist(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    screen.getByRole('row', { name: t.actions.openRow('IR-2026-900002') }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}/IR-2026-900002`);
    });
  });

  /* 브라우저 뒤로가기는 조건·쪽이 그대로인 작업함으로 돌아간다. */
  it('뒤로 가면 조건이 그대로인 작업함으로 돌아온다', async () => {
    const { user } = renderWorklist(allRoutes(), '?sup=9101&page=2');

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByText('IR-2026-900001'));
    await screen.findByText('처리 화면');
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });
  });
});

describe('GoodsReceiptWorklist — 빈 상태', () => {
  it('조건에 맞는 결과가 없으면 결과 없음을 낸다', async () => {
    renderWorklist([listRoute([]), ...lookupRoutes()]);

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 첫 쪽 안내를 낸다', async () => {
    const { user } = renderWorklist(
      [listRoute([], { page: 5, size: 50, total: 120 }), ...lookupRoutes()],
      '?page=5',
    );

    await screen.findByText(t.empty.beyondLastTitle);
    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });
});

describe('GoodsReceiptWorklist — 참조 풀이', () => {
  /* #47 — 미도착을 「알 수 없음」으로 내면 정상 값이 잘못된 값으로 보인다. */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderWorklist(allRoutes(), '', [PARTNERS_PATH]);

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(within(listTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(SUPPLIER_LABEL);
  });

  /* #44 — 이름을 못 풀어도 번호를 내지 않는다. */
  it('참조 목록에 없는 값은 알 수 없음이고 내부 번호를 내지 않는다', async () => {
    renderWorklist(allRoutes());

    await screen.findByText('IR-2026-900002');

    expect(within(listTable()).getByText(t.values.unknown)).toBeInTheDocument();
    expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);

    const pane = screen.getByRole('region', { name: t.panes.list });

    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  it('공급사 참조가 실패하면 목록에 사유와 복구 경로가 있다', async () => {
    const { requests, user } = renderWorklist([failingLookupRoute(PARTNERS_PATH), ...allRoutes()]);

    await screen.findByText(t.reasons.referencesFailed);

    const pane = screen.getByRole('region', { name: t.panes.list });

    expect(pane.textContent ?? '').toContain(t.values.referenceFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;

    await user.click(within(pane).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });
});
