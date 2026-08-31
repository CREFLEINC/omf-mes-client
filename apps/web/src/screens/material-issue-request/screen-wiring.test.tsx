import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  locationFixtures,
  reasonCodeValueFixtures,
  shortageFixtures,
  uomFixtures,
  warehouseFixtures,
  workOrderFixtures,
} from './fixtures';
import { MaterialIssueRequestScreen } from './screen';

const t = messages.materialIssueRequest;

/**
 * 집중 갈래 — **화면 배선.** 단위 감지기가 닿지 못한 두 이음매만 연다.
 *
 * ⛔ **흐름 스위트가 아니다.** 갈래가 둘뿐이고, 둘 다 「부품은 옳은데 이어 붙인 곳이 틀린」
 * 자리를 겨눈다. 앞 회차에는 순수 함수와 공통 훅에만 감지기가 있어 **그 사이의 배선을 끊어도
 * 16,856개 시험이 전부 통과했다**(검증 발견 1·4).
 *
 * | 갈래 | 끊기면 무슨 일이 나나 |
 * | --- | --- |
 * | **D-5 발행** | 재시도마다 새 멱등 키가 나가고, 서버가 중복을 막지 않아(스펙 §6) 같은 전표가 둘 쌓인다. 화면에는 아무 이상이 안 보이고 취소 경로가 없다 |
 * | **D-6 불러오기 재실행** | 서버 값이 그대로면 버튼이 먹지 않는다. 단위 감지기는 「되돌아간다」를 단언하는데 실물은 반대였다 |
 *
 * ⚠ **시각을 실제로 밀어 놓고 본다.** 두 번의 누름이 같은 초 안에 일어나면 배선이 끊겨 있어도
 * `occurredAt` 이 우연히 같아 감지기가 통과해 버린다.
 */

const WORK_ORDER = workOrderFixtures[0]!;
const WORK_ORDER_LABEL = t.values.workOrderOption(
  WORK_ORDER.workOrderNo,
  WORK_ORDER.routingOperationName ?? '',
  WORK_ORDER.itemCode ?? '',
);

const pageOf = (items: readonly unknown[]) => ({
  page: 1,
  size: items.length,
  total: items.length,
});

interface PostCapture {
  keys: string[];
}

const routesFor = (capture: PostCapture): StubRoute[] => {
  const get = (pathname: string, body: unknown): StubRoute => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
    respond: () => jsonResponse(body),
  });

  return [
    get('/production/work-orders', { items: [WORK_ORDER], page: pageOf([WORK_ORDER]) }),
    get('/mdm/warehouses', { items: warehouseFixtures, page: pageOf(warehouseFixtures) }),
    get('/mdm/locations', { items: locationFixtures, page: pageOf(locationFixtures) }),
    get('/mdm/locations/7301', {
      location: locationFixtures[0],
      editability: { editableFields: [], readOnlyFields: [] },
    }),
    get('/mdm/items', { items: itemFixtures, page: pageOf(itemFixtures) }),
    get('/mdm/uoms', { items: uomFixtures, page: pageOf(uomFixtures) }),
    get('/mdm/code-values', {
      items: reasonCodeValueFixtures,
      page: pageOf(reasonCodeValueFixtures),
    }),
    get('/logistics/material-issue-requests/shortage', { items: shortageFixtures }),
    get('/logistics/material-issue-requests', { items: [], page: pageOf([]) }),
    {
      match: (request) =>
        request.method === 'POST' &&
        new URL(request.url).pathname === '/logistics/material-issue-requests',
      respond: (request) => {
        capture.keys.push(request.headers.get('Idempotency-Key') ?? '');

        /* 통신이 끊긴 갈래를 흉내 낸다 — 적용됐는지 모르는 실패라 키가 살아 있어야 한다. */
        return jsonResponse({ message: '합성 서버 오류' }, { status: 500 });
      },
    },
  ];
};

type User = ReturnType<typeof userEvent.setup>;

/** ① 대상 W/O — 고르면 창고·도착 위치가 기본 재공 위치로 자동으로 채워진다. */
const selectWorkOrder = async (user: User): Promise<void> => {
  await user.click(await screen.findByLabelText(t.formFields.workOrder));
  await user.click(await screen.findByRole('option', { name: WORK_ORDER_LABEL }));

  await waitFor(() => {
    expect(screen.getByLabelText(t.formFields.destinationLocation)).toHaveTextContent(
      'SAMPLE-LOC-01',
    );
  });
};

/** ② 요청 품목 — 불러오기 한 번으로 요청 수량 기본값이 부족량으로 선다. */
const loadShortage = async (user: User): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));

  await waitFor(() => {
    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('80');
  });
};

/**
 * ⛔ **정리 대상이 아니다 — 이 setup 이 감지의 전부를 짊어진다.**
 *
 * 시계를 손에 쥐지 않으면 두 누름이 같은 초 안에 일어나 `occurredAt` 이 우연히 같아지고,
 * **배선이 끊긴 채로도 아래 갈래가 전부 통과한다.** 재검증이 실측했다 — 결함을 심어 둔 채
 * 밀기 한 줄만 빼니 4갈래가 그대로 통과했다.
 *
 * `toFake` 를 `Date` 로 좁힌 이유는 따로 있다 — `setTimeout` 까지 가짜로 만들면 사용자 조작과
 * 조회가 멎는다.
 */
const useFrozenClock = (): void => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 1, 0, 12, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
};

describe('발행 배선 — 같은 제출을 두 번 시도하면 같은 멱등 키가 나간다 (D-5)', () => {
  useFrozenClock();

  it('실패 뒤 아무것도 고치지 않고 다시 누르면 같은 키가 나간다', async () => {
    const capture: PostCapture = { keys: [] };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch(routesFor(capture)),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    /* ③ 사유 — 하나 고르면 발행이 열린다(라인 1건 이상 AND (사유 또는 비고)). */
    await user.click(screen.getAllByRole('radio')[0]!);

    const publishButton = screen.getByRole('button', { name: t.actions.publish });

    await waitFor(() => {
      expect(publishButton).toBeEnabled();
    });

    await user.click(publishButton);

    await waitFor(() => {
      expect(capture.keys).toHaveLength(1);
    });
    await waitFor(() => {
      expect(publishButton).toBeEnabled();
    });

    /*
     * ⛔ **이 한 줄을 지우면 감지기가 죽는다.** 90초를 밀어야 배선이 끊겼을 때 `occurredAt` 이
     * 갈린다 — 밀지 않으면 두 누름이 같은 초에 들어 **결함을 심어도 이 갈래가 통과한다**
     * (재검증 실측). 「불필요한 setup」으로 보이지만 감지의 전부다.
     */
    vi.setSystemTime(new Date(2026, 8, 1, 0, 14, 0));

    /*
     * 그 사이 **사유를 바꿨다가 되돌린다** — 보낼 값이 첫 시도와 완전히 같아진 상태다. 값이
     * 같으면 같은 키가 나가야 한다(검증 발견 3의 갈래). 배선이 끊겨 제출 순간을 다시 뜨면 새
     * 키가 나가고, 앞 시도가 실제로 적용됐다면 같은 전표가 둘 쌓인다.
     */

    await user.click(screen.getAllByRole('radio')[1]!);
    await user.click(screen.getAllByRole('radio')[0]!);

    await user.click(publishButton);

    await waitFor(() => {
      expect(capture.keys).toHaveLength(2);
    });

    expect(capture.keys[0]).toBeTruthy();
    expect(capture.keys[1]).toBe(capture.keys[0]);
  });

  it('진입 직후에는 도착 위치 오류가 서지 않는다 — 아직 아무 일도 하지 않았다', () => {
    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch(routesFor({ keys: [] })),
    });

    expect(screen.queryByText(t.errors.destinationRequired)).not.toBeInTheDocument();
  });

  /**
   * ⚠ **화면이 연쇄로 비운 칸은 만짐이 아니다**(재검증 R2-1).
   *
   * 창고를 바꾸면 그 창고에 없는 위치가 남지 않게 **화면이** 도착 위치를 비운다. 그것까지
   * 만짐으로 적으면 사용자가 건드리지도 않은 칸이 그 자리에서 붉어져, 「만진 칸만 붉힌다」는
   * 규칙이 바로 그 경로에서 깨진다.
   */
  it('창고를 바꿔 화면이 도착 위치를 비워도 그 칸이 붉어지지 않는다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch(routesFor({ keys: [] })),
    });

    await selectWorkOrder(user);

    await user.click(screen.getByLabelText(t.formFields.warehouse));
    await user.click(await screen.findByRole('option', { name: 'SAMPLE-WH-02 · 합성 부품창고' }));

    /* 도착 위치가 실제로 비워졌는지 먼저 본다 — 비워지지 않았으면 이 갈래가 성립하지 않는다. */
    await waitFor(() => {
      expect(screen.getByLabelText(t.formFields.destinationLocation)).not.toHaveTextContent(
        'SAMPLE-LOC-01',
      );
    });

    expect(screen.queryByText(t.errors.destinationRequired)).not.toBeInTheDocument();

    /*
     * ⭐ **감춘 것은 표시이지 판정이 아니다.** 발행은 닫혀 있고 그 사유가 버튼 옆에 글자로 선다 —
     * 사용자는 무엇을 해야 하는지 알 수 있고, 아직 만지지 않은 칸만 조용하다.
     */
    expect(screen.getByRole('button', { name: t.actions.publish })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noDestination)).toBeInTheDocument();
  });
});

describe('불러오기 재실행 배선 — 서버 값이 같아도 누름이 반영된다 (D-6)', () => {
  useFrozenClock();

  /**
   * ⚠ **참조 비교로 가드하면 이 갈래가 조용히 죽는다.** react-query 는 내용이 같은 응답에 같은
   * 참조를 돌려주므로, 앞 회차에는 서버 값이 그대로일 때 「불러오기」를 다시 눌러도 아무 일도
   * 일어나지 않았다 — 단위 감지기(`line-draft.test.ts`)는 「되돌아간다」를 단언하는데 실물이
   * 반대였다(검증 발견 4).
   */
  it('고쳐 둔 요청 수량이 다시 부족량으로 선다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch(routesFor({ keys: [] })),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    const requestedQty = screen.getByLabelText(t.lineTable.requestedQtyLabel(1));

    await user.clear(requestedQty);
    await user.type(requestedQty, '999');

    expect(requestedQty).toHaveValue('999');

    await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('80');
    });
  });

  it('손으로 더한 줄은 재실행에도 남는다', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch(routesFor({ keys: [] })),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    /* 소요 3줄 + 손으로 더한 1줄 */
    await waitFor(() => {
      expect(screen.getByLabelText(t.lineTable.itemLabel(4))).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('80');
    });

    expect(screen.getByLabelText(t.lineTable.itemLabel(4))).toBeInTheDocument();
  });
});
