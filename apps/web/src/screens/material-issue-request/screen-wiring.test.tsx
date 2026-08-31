import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor } from '@testing-library/react';
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
import { materialIssueRequestKeys } from './queries';
import { MaterialIssueRequestScreen } from './screen';
import { HEADER_FORM_FIELDS } from './validation';

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

/** 기본은 「적용됐는지 모르는 실패」다 — 키가 살아 있어야 하는 갈래를 흉내 낸다. */
const SERVER_ERROR = (): Response => jsonResponse({ message: '합성 서버 오류' }, { status: 500 });

/** 서버가 필드 하나를 거부한 400. 그 문구가 화면 어딘가에 서는지 보는 데 쓴다. */
const fieldRejection = (field: string, message: string) => (): Response =>
  jsonResponse({ errors: [{ scope: 'field', field, code: 'INVALID', message }] }, { status: 400 });

const routesFor = (
  capture: PostCapture,
  respondToPost: () => Response = SERVER_ERROR,
): StubRoute[] => {
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

        return respondToPost();
      },
    },
  ];
};

/** 소요 조회만 빼고 나머지 스텁을 준다 — 그 자리에 갈래마다 다른 응답을 끼운다. */
const routesWithoutShortage = (): StubRoute[] =>
  routesFor({ keys: [] }).filter(
    (route) =>
      !route.match(
        new Request('http://api.test/logistics/material-issue-requests/shortage?workOrderId=7101'),
      ),
  );

/**
 * ⛔ **반영이 늦게 오더라도 잡는다.** 여기서 쉬지 않으면 「아직 안 덮은 것」을 「안 덮는다」로
 * 읽어, **결함이 있어도 통과한다**(4회차에 실제로 그렇게 헛통과했다).
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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

/**
 * 집중 갈래 — **거부가 침묵하지 않는가**(리뷰 M-1).
 *
 * 공용 쓰기 훅은 화면이 아는 이름(`HEADER_FORM_FIELDS`)을 **배너용 목록에서 빼내** 인라인으로
 * 넘긴다. 넘겨받은 화면에 그릴 자리가 없으면 그 오류는 배너에도 칸에도 서지 않고 **통째로
 * 사라진다** — 사용자에게는 「발행을 눌렀는데 아무 일도 안 일어난다」로 보인다. 이 화면의 유일한
 * 되돌릴 수 없는 쓰기에서 거부가 침묵하는 것이다.
 *
 * ⛔ **이름마다 한 갈래씩 돈다.** 앞선 시험은 그리는 자리가 **있는** 필드 하나만 봐서, 이름을
 * 올려놓고 자리는 만들지 않은 둘(`reasonCode`·`lines`)이 그대로 통과했다. 목록에 이름을 더하는
 * 사람이 자리도 함께 만들도록, 판정 기준을 목록 자체에서 끌어온다.
 */
describe('거부가 침묵하지 않는다 — 아는 이름마다 문구가 선다 (M-1)', () => {
  useFrozenClock();

  for (const field of HEADER_FORM_FIELDS) {
    it(`400 의 field 가 ${field} 여도 서버 문구가 화면에 선다`, async () => {
      const message = `합성 거부 문구 ${field}`;
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithProviders(<MaterialIssueRequestScreen />, {
        fetch: createStubFetch(routesFor({ keys: [] }, fieldRejection(field, message))),
      });

      await selectWorkOrder(user);
      await loadShortage(user);
      await user.click(screen.getAllByRole('radio')[0]!);

      const publishButton = screen.getByRole('button', { name: t.actions.publish });

      await waitFor(() => {
        expect(publishButton).toBeEnabled();
      });

      await user.click(publishButton);

      /* 어디에 서는지는 자리마다 다르다 — 「어딘가에 선다」만 본다. */
      await waitFor(() => {
        expect(screen.getAllByText(message).length).toBeGreaterThan(0);
      });
    });
  }
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

  /**
   * ⛔ **반대 방향이 이 갈래의 요점이다** — 「누르면 반영된다」만 단언하면 **누르지 않았는데
   * 반영되는** 경로가 잡히지 않는다(리뷰 M-2).
   *
   * 앱 기본값이 `refetchOnReconnect` 를 덮지 않으므로(`app/providers.tsx`) 연결이 끊겼다 돌아오면
   * 이 조회가 **사용자가 아무것도 하지 않아도** 다시 나간다. 그때 초안이 통째로 다시 서면 친
   * 수량과 포커스가 사라지고, 줄이 새로 서는 것만으로 지문이 갈려 **새 멱등 키**까지 나간다 —
   * 통신이 끊겼다 돌아와 다시 누르는 바로 그 순간이라 방어선이 가장 필요한 자리에서 풀린다.
   *
   * ⚠ **호출마다 값이 달라지는 스텁**을 쓴다(`po-register` 의 같은 부류 시험이 남긴 교훈).
   * 같은 값을 다시 주면 조회 캐시가 구조를 공유해 참조가 그대로라, 축이 무엇이든 아무 일도
   * 일어나지 않아 결함을 잡지 못한다.
   */
  it('누르지 않은 배경 재조회는 친 수량을 되돌리지 않는다', async () => {
    let call = 0;
    const changingShortage: StubRoute = {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === '/logistics/material-issue-requests/shortage',
      respond: () => {
        call += 1;

        /* 둘째 응답은 부족량이 달라진다 — 반영되면 눈에 띈다. */
        return jsonResponse({
          items: shortageFixtures.map((row, index) =>
            index === 0 ? { ...row, shortageQty: call === 1 ? 80 : 55 } : row,
          ),
        });
      },
    };

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { queryClient } = renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch([changingShortage, ...routesWithoutShortage()]),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    const requestedQty = screen.getByLabelText(t.lineTable.requestedQtyLabel(1));

    await user.clear(requestedQty);
    await user.type(requestedQty, '999');

    /*
     * ⛔ **시계를 밀어 두는 것이 여기서도 감지의 조건이다.** `Date` 가 멈춰 있으면 재조회가
     * 끝난 시각(`dataUpdatedAt`)이 앞과 같아져, 그 값을 축으로 삼은 **결함이 있어도 초안이
     * 흔들리지 않는다** — 감지기가 결함을 놓친다.
     */
    vi.setSystemTime(new Date(2026, 8, 1, 0, 20, 0));

    /* 사용자는 아무것도 누르지 않는다 — 배경에서 조회만 다시 돈다. */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: materialIssueRequestKeys.shortage(7101),
      });
    });

    /* 짝 양성 — 재조회가 실제로 일어났고 바뀐 값이 도착했다. */
    expect(call).toBe(2);

    await settle();

    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('999');
  });

  /**
   * ⛔ **정문을 잠그고 옆문을 열어 두지 않는다**(리뷰 R2-1).
   *
   * 앞 판은 누름을 「대기 표식」으로 세우고 **아무 성공이나** 그 표식을 소비하게 두었다. 그래서
   * 불러오기가 **실패하면 표식이 참으로 굳고**, 그 구간에 사용자가 누르지 않은 배경 재조회가
   * 표식을 소비해 편집을 덮었다.
   *
   * ⚠ **연결이 불안정하면 실패와 재접속은 붙어서 일어난다** — M-2 가 겨눈 바로 그 상황이다.
   * 지금은 반영이 누름이 쥔 약속에 매여 있어, 실패한 누름은 아무것도 반영하지 못한 채 끝난다.
   */
  it('불러오기가 실패한 뒤 배경 재조회가 편집을 덮지 않는다', async () => {
    let call = 0;
    const flakyShortage: StubRoute = {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === '/logistics/material-issue-requests/shortage',
      respond: () => {
        call += 1;

        /* ① 성공(80) → ② 사용자가 누른 재실행이 실패 → ③ 배경 재조회는 성공(55) */
        if (call === 2) return jsonResponse({ message: '합성 서버 오류' }, { status: 500 });

        return jsonResponse({
          items: shortageFixtures.map((row, index) =>
            index === 0 ? { ...row, shortageQty: call === 1 ? 80 : 55 } : row,
          ),
        });
      },
    };

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { queryClient } = renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch([flakyShortage, ...routesWithoutShortage()]),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    const requestedQty = screen.getByLabelText(t.lineTable.requestedQtyLabel(1));

    await user.clear(requestedQty);
    await user.type(requestedQty, '999');

    /* ② 사용자가 누른 재실행이 실패한다 — 편집은 그대로 남아야 한다. */
    await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));

    await waitFor(() => {
      expect(call).toBe(2);
    });
    await settle();

    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('999');

    /* ③ 그 구간에서 누르지 않은 배경 재조회가 성공한다. */
    vi.setSystemTime(new Date(2026, 8, 1, 0, 20, 0));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: materialIssueRequestKeys.shortage(7101) });
    });

    expect(call).toBe(3);
    await settle();

    expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('999');
  });

  /**
   * 리뷰가 권한 갈래 — 축을 갈아 끼우며 **재실행이 새 서버 값을 반영하는지**가 렌더 순서에
   * 기대고 있었다. 약속이 결과를 직접 들고 오므로 이제 순서에 기대지 않는다.
   */
  it('서버 값이 달라져 있으면 재실행이 그 새 값을 반영한다 — 옛 캐시가 아니다', async () => {
    let call = 0;
    const changingShortage: StubRoute = {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === '/logistics/material-issue-requests/shortage',
      respond: () => {
        call += 1;

        return jsonResponse({
          items: shortageFixtures.map((row, index) =>
            index === 0 ? { ...row, shortageQty: call === 1 ? 80 : 55 } : row,
          ),
        });
      },
    };

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<MaterialIssueRequestScreen />, {
      fetch: createStubFetch([changingShortage, ...routesWithoutShortage()]),
    });

    await selectWorkOrder(user);
    await loadShortage(user);

    await user.click(screen.getByRole('button', { name: t.actions.loadShortage }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.lineTable.requestedQtyLabel(1))).toHaveValue('55');
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
