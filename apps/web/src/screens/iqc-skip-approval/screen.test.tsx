import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickRange } from '../../test/date-picker';
import { IQC_SKIP_APPROVAL_TYPE_CODE } from './code-options';
import {
  FIRST_LINE_OF_MULTILINE_REASON,
  SAMPLE_DECISION_CODE_A,
  SECOND_LINE_OF_MULTILINE_REASON,
  contradictoryDetail,
  detailOf,
  finishedDetail,
  requestFixtures,
} from './fixtures';
import { requestDetailPath } from './queries';
import { IqcSkipApprovalScreen } from './screen';

const t = messages.iqcSkipApproval;

/**
 * 라우트에 붙지 않은 회차라 주소는 시험이 정한다. **계획이 정한 경로를 그대로 쓴다** —
 * 라우트가 붙는 회차에 이 값이 곧 그 경로가 된다.
 */
const ROUTE = '/logistics/iqc-skip-approval';
const REQUESTS_PATH = '/app/approval-requests';

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  /** 보낸 본문(JSON). 본문이 없으면 `undefined`다 — 「빈 객체」와 구분한다. */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * **경로를 가리지 않고 전부 기록한다** — 「부르지 않았다」를 증명하려면 잘못된 경로로 나간
 * 요청도 잡혀야 한다.
 *
 * `hold`가 참을 내는 요청은 **기록한 뒤에** 붙잡아 둔다 — 「응답을 기다리는 동안 무엇이
 * 보이는가」를 재려면 요청이 나간 사실은 이미 보여야 한다. 고정 지연을 쓰지 않고 **문**으로
 * 두는 이유는 부하·타이밍에 기대는 시험을 만들지 않기 위해서다(#52·#99).
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: (request: Request) => boolean = () => false,
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const text = await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body: text === '' ? undefined : (JSON.parse(text) as unknown),
    });

    if (hold(request)) await gate;

    return stub(request);
  };

  return { fetch, requests, release };
};

/**
 * 상세로 나간 요청. **경로 전체로 센다** — 번호가 무엇이든, 고르기 전에 나갔든 잡힌다.
 *
 * **정규식으로 잡는 이유**: 「부르지 않았다」를 증명하려면 **잘못된 번호로 나간 요청도**
 * 잡혀야 한다. 고른 번호의 경로만 세면 `/app/approval-requests/0`처럼 성립하지 않는 요청이
 * 세어지지 않아, 감지기가 잰 것이 「부르지 않았다」가 아니라 「그 번호로는 부르지 않았다」가 된다.
 */
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+$/.test(pathname);

/**
 * 목록으로 나간 요청. **경로 전체로 센다** — 조건이 무엇이든, 잘못된 경로로 나갔든 잡힌다.
 */
const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === REQUESTS_PATH);

const detailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isDetailPath(request.url.pathname));

/**
 * 목록도 상세도 아닌 요청 **전부**. 「이 둘 말고는 아무것도 부르지 않는다」를 재는 자리다 —
 * 참조 조회가 0건이라는 사실이 회차가 늘어도 그대로인지 본다.
 */
const otherRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.url.pathname !== REQUESTS_PATH && !isDetailPath(request.url.pathname),
  );

/** 쓰기로 나간 요청 전부. **경로를 가리지 않고 센다** — 잘못된 경로로 나간 쓰기도 잡아야 한다. */
const writeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method !== 'GET');

const lastListQuery = (requests: RecordedRequest[]): URLSearchParams | undefined =>
  listRequests(requests).at(-1)?.url.searchParams;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 20, total: items.length, ...page } });

/**
 * 목록. **방법을 가리지 않고 응답한다** — 「쓰기를 보내지 않았다」를 증명하려면 쓰기가
 * 나갔을 때 그것이 **기록되고 응답까지 받아야** 한다. 방법으로 거르면 잘못 나간 쓰기가
 * 스텁 누락으로 터져, 감지기가 잰 것이 「쓰기가 없다」가 아니라 「스텁이 없다」가 된다.
 */
const listRoute = (
  items: unknown[] = requestFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === REQUESTS_PATH,
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status = 500): StubRoute => ({
  match: (request) => new URL(request.url).pathname === REQUESTS_PATH,
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 상세. **어느 번호로 와도 응답한다** — 「고르기 전에는 부르지 않는다」를 증명하려면 그때
 * 나간 요청이 **기록되고 응답까지 받아야** 한다. 번호로 거르면 잘못 나간 요청이 스텁 누락으로
 * 터져, 감지기가 잰 것이 「부르지 않았다」가 아니라 「스텁이 없다」가 된다.
 *
 * 픽스처에 없는 번호는 **404**다 — 그것이 서버가 답하는 방식이고, 이 화면의 S2 갈래다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: (request) => {
    const requestedId = Number(new URL(request.url).pathname.split('/').at(-1));
    const detail = detailOf(requestedId);

    return detail === undefined
      ? jsonResponse({ message: '' }, { status: 404 })
      : jsonResponse(detail);
  },
});

/** 상세만 특정 상태 코드로 실패시킨다. 목록은 그대로 성공한다. */
const failingDetailRoute = (status: number): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 목록 + 상세. 상세를 부르는 회차의 기본 스텁 묶음이다. */
const defaultRoutes = (
  items: unknown[] = requestFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute[] => [listRoute(items, page), detailRoute()];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/** 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다. */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

const renderScreen = (
  routes: StubRoute[],
  search = '',
  hold?: (request: Request) => boolean,
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <IqcSkipApprovalScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const requestTable = (): HTMLElement => screen.getByRole('table');

const pendingCheckbox = (): HTMLElement =>
  screen.getByRole('checkbox', { name: t.fields.pendingOnly });

/**
 * 목록이 도착할 때까지 기다린다.
 *
 * **표 안에서 찾는다** — 요청번호가 아래 구획에도 설 회차가 오면 화면 전체에서 찾는 것이
 * 「목록이 왔다」와 「상세가 왔다」를 서로 가리게 된다.
 */
const waitForList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(requestTable()).getByText('SYNTH-REQ-001')).toBeInTheDocument();
  });
};

describe('첫 진입', () => {
  it('목록을 한 번만 부른다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    expect(listRequests(requests)).toHaveLength(1);
  });

  /** 이 화면은 **판정하는 자리**다 — 내가 승인자인 것만 대상이며 사용자가 풀 수 없다. */
  it('고정 축 `assignedToMe`와 기본으로 켜진 `pendingOnly`를 싣는다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('assignedToMe')).toBe('true');
    expect(query?.get('pendingOnly')).toBe('true');
    expect(pendingCheckbox()).toBeChecked();
  });

  it('이 화면에 없는 축을 싣지 않는다 — 상신하지 않고 대기 건수도 세지 않는다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('requestedByMe')).toBeNull();
    expect(query?.get('myTurnOnly')).toBeNull();
    expect(query?.get('size')).toBeNull();
  });

  it('조건이 없으면 조건을 싣지 않는다 — 생략이 곧 「거르지 않음」이다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    expect([...(lastListQuery(requests)?.keys() ?? [])].sort()).toEqual([
      'assignedToMe',
      'pendingOnly',
    ]);
  });

  it('목록 값이 화면에 보인다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    const table = within(requestTable());

    expect(table.getByText('SAMPLE-TYPE-B')).toBeInTheDocument();
    expect(table.getAllByText('합성 상신자1').length).toBe(2);
    /* 상신 일시는 **시각까지** 보인다 — 날짜만 그리면 여기서 멈춘다. */
    expect(table.getByText('2026-08-06 14:20')).toBeInTheDocument();
    /*
     * 사유는 첫 줄만 온다.
     *
     * **짝 양성이 먼저다.** 「둘째 줄이 없다」만 두면 전문을 그대로 넣는 구현이 그대로
     * 지나간다 — 그때 그 칸의 글자는 두 줄이 이어 붙은 **한 문자열**이라 둘째 줄만으로는
     * 걸리지 않는다(뮤테이션으로 확인했다). 첫 줄이 **그 칸의 전부**여야 통과하는 단언을
     * 앞에 두어야 그 구현이 여기서 멈춘다.
     */
    expect(table.getByText(FIRST_LINE_OF_MULTILINE_REASON)).toBeInTheDocument();
    expect(screen.queryByText(SECOND_LINE_OF_MULTILINE_REASON)).not.toBeInTheDocument();
  });

  /**
   * 확정 열 구성을 화면 수준에서도 고정한다 — 부품 시험만으로는 컨테이너가 다른 표를
   * 끼워 넣어도 드러나지 않는다.
   */
  it('목록이 확정된 여섯 열로만 그려진다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    const headers = within(requestTable())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    expect(headers).toEqual([
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.target,
      t.fields.reason,
      t.fields.requestedByName,
      t.fields.requestedAt,
    ]);
  });

  it('목록 말고는 아무것도 부르지 않는다 — 참조 조회가 0건이다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    expect(otherRequests(requests)).toHaveLength(0);
    /* 고르지 않았으니 상세도 없다 — 회차가 늘어도 이 상태에서 나가는 조회는 목록 하나다. */
    expect(detailRequests(requests)).toHaveLength(0);
  });
});

/**
 * **전환 감지기**(M06·M07의 화면 몫).
 *
 * 단언을 상수에 매어 두면 **자리표시를 채우는 순간 기대가 함께 뒤집힌다** — 조건 부착이나
 * 안내 거둠을 상수로 굳힌 구현은 그때 곧바로 걸린다. 지금(코드가 `null`)은 「조건이 실리지
 * 않고 안내가 선다」를 재고, 값이 차면 「그 값이 실리고 안내가 사라진다」를 잰다.
 */
describe('G1 — 승인 유형 코드 자리표시', () => {
  it('조건 부착이 자리표시를 따른다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    expect(lastListQuery(requests)?.get('approvalTypeCode')).toBe(IQC_SKIP_APPROVAL_TYPE_CODE);
  });

  it('안내가 자리표시를 따른다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    expect(screen.queryByText(t.typePendingNote) !== null).toBe(
      IQC_SKIP_APPROVAL_TYPE_CODE === null,
    );
  });

  /** 잠기는 것이 **없다** — 잠그면 사용자가 결재함으로 옮겨 가 판단 근거 없이 결재한다. */
  it('코드가 비어도 조회·조건·쪽·고르기가 전부 열려 있다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeEnabled();
    expect(pendingCheckbox()).toBeEnabled();
    expect(screen.getByRole('button', { name: /SYNTH-REQ-001/ })).toBeEnabled();
  });

  /** 오결재 방어 ② — 유형 열이 목록에서 사라지면 무엇을 결재하려는지 가릴 단서가 없다. */
  it('유형 열이 코드 그대로 서 있다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    const table = within(requestTable());

    expect(
      table.getByRole('columnheader', { name: t.fields.approvalTypeCode }),
    ).toBeInTheDocument();
    expect(table.getAllByText('SAMPLE-TYPE-A').length).toBe(2);
  });
});

describe('「결재 대기만 보기」', () => {
  it('끄면 그 조건만 빠지고 고정 축은 남는다', async () => {
    const { requests, user } = renderScreen([listRoute()]);

    await waitForList();
    await user.click(pendingCheckbox());

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    const query = lastListQuery(requests);

    expect(query?.get('pendingOnly')).toBeNull();
    expect(query?.get('assignedToMe')).toBe('true');
  });

  it('끈 상태가 주소에 남는다 — 켠 것은 기본값이라 적지 않는다', async () => {
    const { user } = renderScreen([listRoute()]);

    await waitForList();
    await user.click(pendingCheckbox());

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?pd=0`);
    });

    await user.click(pendingCheckbox());

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('주소로 꺼진 채 들어오면 그 조건 없이 조회한다', async () => {
    const { requests } = renderScreen([listRoute()], '?pd=0');

    await waitForList();

    expect(lastListQuery(requests)?.get('pendingOnly')).toBeNull();
    expect(pendingCheckbox()).not.toBeChecked();
  });

  /* 수명 표 3행 — 조건은 유지하고 쪽과 선택만 되돌린다. */
  it('전환이 조건을 남기고 쪽과 고른 요청을 비운다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?q=SYNTH&page=3&rq=9001');

    await waitForList();
    await user.click(pendingCheckbox());

    await waitFor(() => {
      expect(currentLocation()).toContain('pd=0');
    });

    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).not.toContain('page=');
    expect(currentLocation()).not.toContain('rq=');
    expect(lastListQuery(requests)?.get('q')).toBe('SYNTH');
  });

  it('전환 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen([listRoute()], '?page=3');

    await waitForList();
    await user.click(pendingCheckbox());

    await waitFor(() => {
      expect(currentLocation()).toContain('pd=0');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=3`);
    });
  });
});

describe('조회 조건', () => {
  it('조건이 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen([listRoute()]);

    await waitForList();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH-REQ-002');
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-07-20', '2026-07-25');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    expect(currentLocation()).toContain('q=SYNTH-REQ-002');
    expect(currentLocation()).toContain('from=2026-07-20');

    const query = lastListQuery(requests);

    expect(query?.get('q')).toBe('SYNTH-REQ-002');
    expect(query?.get('requestedAtFrom')).toBe('2026-07-20');
    expect(query?.get('requestedAtTo')).toBe('2026-07-25');
  });

  it('주소로 들어오면 같은 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      [listRoute()],
      '?st=SAMPLE-STATUS-OPEN&q=SYNTH&from=2026-08-01&to=2026-08-31',
    );

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('statusCode')).toBe('SAMPLE-STATUS-OPEN');
    expect(query?.get('q')).toBe('SYNTH');
    expect(query?.get('requestedAtFrom')).toBe('2026-08-01');
    expect(query?.get('requestedAtTo')).toBe('2026-08-31');
  });

  it('조건 변경이 첫 쪽으로 되돌리고 고른 요청을 비운다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?page=2&rq=9001');

    await waitForList();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SYNTH');
    });
    expect(currentLocation()).not.toContain('page=');
    expect(currentLocation()).not.toContain('rq=');
  });

  it('조건 변경 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen([listRoute()], '?page=3');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SYNTH');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=3`);
    });
  });

  /* 수명 표 1행 — 조건을 고쳐도 보고 있던 범위는 그대로다. */
  it('조건을 바꿔도 확인칸은 그대로다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?pd=0');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SYNTH');
    });

    expect(currentLocation()).toContain('pd=0');
    expect(lastListQuery(requests)?.get('pendingOnly')).toBeNull();
    expect(pendingCheckbox()).not.toBeChecked();
  });

  /* 수명 표 2행 — 「처음 상태」에는 켜진 확인칸도 든다. */
  it('초기화가 조건을 비우고 확인칸을 되켠다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?q=SYNTH&pd=0&page=2&rq=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(pendingCheckbox()).toBeChecked();
    await waitFor(() => {
      expect(lastListQuery(requests)?.get('pendingOnly')).toBe('true');
    });
  });

  /** 칩의 ×도 조건 변경이다 — 수명 표 1행을 그대로 지난다(범위 유지 · 첫 쪽 · 선택 비움). */
  it('조건 칩의 ×가 그 조건만 풀고 범위는 남긴 채 쪽과 선택을 비운다', async () => {
    const { user } = renderScreen(
      [listRoute()],
      '?q=SYNTH&from=2026-08-01&to=2026-08-31&pd=0&page=2&rq=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePeriod }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('from=');
    });

    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).toContain('pd=0');
    expect(currentLocation()).not.toContain('page=');
    expect(currentLocation()).not.toContain('rq=');
  });
});

describe('보내기 전에 거르는 값', () => {
  /** 계약의 목록 응답에 400이 없다 — 서버가 이런 값에 무엇을 하는지 정해져 있지도 않다. */
  it('실존하지 않는 날짜는 요청에도 주소에도 남지 않는다', async () => {
    const { requests } = renderScreen([listRoute()], '?from=2026-02-31&to=2026-08-31');

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('requestedAtFrom')).toBeNull();
    expect(query?.get('requestedAtTo')).toBe('2026-08-31');
  });

  it('정수가 아닌 쪽은 첫 쪽으로 본다', async () => {
    const { requests } = renderScreen([listRoute()], '?page=0');

    await waitForList();

    expect(lastListQuery(requests)?.get('page')).toBeNull();
  });

  it('공백만인 검색어는 실리지 않는다', async () => {
    const { requests } = renderScreen([listRoute()], '?q=%20%20');

    await waitForList();

    expect(lastListQuery(requests)?.get('q')).toBeNull();
  });

  /** `rq`는 조회 조건이 아니다 — 뒤 회차의 상세 조회가 쓰는 뿌리이며 목록에 실리지 않는다. */
  it('고른 요청은 목록 조건이 되지 않는다', async () => {
    const { requests } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('rq')).toBeNull();
    expect(query?.get('approvalRequestId')).toBeNull();
  });
});

describe('쪽 이동', () => {
  it('쪽만 옮기고 고른 요청을 비운다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { page: 1, size: 2, total: 8 }), detailRoute()],
      /*
       * **확인칸을 꺼 둔 채로 옮긴다.** 켠 채로 재면 `pd`가 주소에 적히지 않아
       * 「쪽 이동이 범위를 유지한다」 칸이 어느 구현에서도 같아 보인다(수명 표 4행).
       */
      '?q=SYNTH&pd=0&rq=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).toContain('pd=0');
    expect(currentLocation()).not.toContain('rq=');
    await waitFor(() => {
      expect(lastListQuery(requests)?.get('page')).toBe('2');
    });
    expect(lastListQuery(requests)?.get('pendingOnly')).toBeNull();
  });
});

describe('빈 상태 세 갈래', () => {
  it('결과가 없으면 표 안의 빈 자리가 맡는다', async () => {
    renderScreen([listRoute([], { total: 0 })]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    /* 바깥에서 0건을 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('쪽 밖은 다른 안내이고 첫 쪽으로 돌려보낸다', async () => {
    const { user } = renderScreen([listRoute([], { page: 9, size: 20, total: 45 })], '?page=9');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('고르기 전에는 아래 구획이 「고르세요」를 낸다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    expect(
      within(screen.getByRole('region', { name: t.panes.detail })).getByText(
        t.empty.noSelectionTitle,
      ),
    ).toBeInTheDocument();
  });
});

/**
 * **부품에 로딩 상태를 잇는 배선을 재는 자리.**
 *
 * 부품 시험은 `isLoading`을 받아 무엇을 그리는지까지만 보고, **컨테이너가 그 값에 무엇을
 * 매는지**는 보지 않는다 — 그 자리를 상수 거짓으로 굳혀도 부품 시험은 전건 통과한다
 * (독립 검증이 실제로 그렇게 확인했다). 그때 화면은 응답이 오기 전에 **빈 표**를 그려
 * 「조건에 맞는 승인 요청이 없습니다」라고 말하고, 사용자는 자료가 없는 줄 알고 조건을 넓힌다.
 *
 * 그래서 여기서는 **응답을 붙잡아 둔 채** 무엇이 서는지 보고, 놓아 준 뒤 무엇이 바뀌는지를
 * 짝으로 잰다. 고정 지연을 쓰지 않는다 — 기다림은 문을 여는 것으로만 끝난다(#52·#99).
 */
describe('불러오는 중', () => {
  it('응답이 오기 전에는 뼈대가 서고 빈 상태 문구도 표도 없다', async () => {
    const { release } = renderScreen([listRoute()], '', () => true);

    expect(await screen.findByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    /* 짝 양성 — 도착하면 뼈대가 사라지고 표가 선다. 이것이 없으면 「영영 뼈대」도 통과한다. */
    release();

    await waitForList();

    expect(screen.queryByRole('status', { name: t.loading.list })).not.toBeInTheDocument();
  });
});

describe('조회 실패', () => {
  it('실패는 빈 상태가 아니다 — 배너를 세우고 「없습니다」를 내지 않는다', async () => {
    renderScreen([failingListRoute(500)]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('실패해도 조건을 고칠 수단은 남는다', async () => {
    renderScreen([failingListRoute(500)]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(pendingCheckbox()).toBeEnabled();
  });

  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500)]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before);
    });
  });

  /** 계약이 이 목록의 실패 갈래를 403 하나로 두었다 — 실제로 도달하는 자리다. */
  it('권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403)]);

    /* 선행 단언 — 사유가 보여야 「버튼이 없다」가 뜻을 갖는다. */
    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('고르기', () => {
  it('요청번호를 누르면 주소에 그 요청이 선다', async () => {
    const { user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
  });

  it('같은 요청을 다시 누르면 해제된다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 수명 표 5행 — 고르는 것은 보이는 행을 바꾸지 않는다. */
  it('고르기가 조건·범위·쪽을 건드리지 않는다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { page: 2, size: 2, total: 8 }), detailRoute()],
      '?q=SYNTH&pd=0&page=2',
    );

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });

    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).toContain('pd=0');
    expect(currentLocation()).toContain('page=2');
    /* 조회 조건이 그대로라 목록을 다시 부르지 않는다 — 고르기는 조회가 아니다. */
    expect(listRequests(requests)).toHaveLength(before);
  });

  /**
   * **구획은 사라지지 않고 안이 바뀐다.** 「고르세요」가 물러나고 그 자리에 고른 요청이 온다 —
   * 구획 자체가 사라지면 무엇을 골랐는지도 화면이 말하지 않는다.
   */
  it('고른 뒤에는 「고르세요」 안내가 물러나고 그 자리에 요청 정보가 선다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();

    const pane = within(await screen.findByRole('region', { name: t.panes.detail }));

    expect(await pane.findByRole('group', { name: t.panes.request })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });
});

describe('다시 조회', () => {
  /* 수명 표 10행 — 새로고침은 같은 조회를 다시 하는 것이다. */
  it('보고 있는 조회를 다시 부르고 주소는 하나도 바꾸지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?q=SYNTH&pd=0&page=2&rq=9001');

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before);
    });

    expect(currentLocation()).toBe(`${ROUTE}?q=SYNTH&pd=0&page=2&rq=9001`);
  });

  /**
   * **목록만 다시 부르면 갱신된 목록과 낡은 상세가 한 화면에 섞인다**(W-01-07이 남긴 결함).
   * 그래서 **경로별로 각각** 는 것을 잰다 — 합계만 보면 목록이 두 번 나가도 통과한다.
   */
  it('목록과 상세를 함께 부른다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    const before = { list: listRequests(requests).length, detail: detailRequests(requests).length };

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBe(before.list + 1);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBe(before.detail + 1);
    });
  });

  it('고르지 않았으면 상세는 부를 대상이 없다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });
    expect(detailRequests(requests)).toHaveLength(0);
  });
});

/**
 * **상세 조회 하나가 요청 정보·대상·결재 진행을 모두 데려온다.**
 *
 * 여기서 재는 것은 「언제 나가고 언제 나가지 않는가」다. **경로를 가리지 않고 세므로**
 * 성립하지 않는 번호로 나간 요청(`…/0`)도 이 감지기에 잡힌다.
 */
describe('상세 조회', () => {
  it('고르기 전에는 상세를 부르지 않는다 — 경로를 가리지 않고 센다', async () => {
    const { requests } = renderScreen(defaultRoutes());

    await waitForList();

    /* 짝 방향 — 목록은 실제로 나갔다. 「아무것도 안 나갔다」로는 통과하지 않는다. */
    expect(listRequests(requests)).toHaveLength(1);
    expect(detailRequests(requests)).toHaveLength(0);
  });

  it('고르면 그 요청의 상세를 한 번 부른다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    /*
     * **토큰을 꺼낼 경로가 곧 이 조회가 지나간 경로다.** 둘이 갈리면 결재가 토큰을 찾지
     * 못해 요청이 아예 나가지 않는다(「눌러도 아무 일이 없다」).
     */
    expect(detailRequests(requests)[0]?.url.pathname).toBe(requestDetailPath(9001));
  });

  /** 주소로 들어와도 같다 — 고른 것은 주소가 소유한다. */
  it('주소에 고른 요청이 있으면 들어오자마자 상세를 부른다', async () => {
    const { requests } = renderScreen(defaultRoutes(), '?rq=9002');

    await waitForList();

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    expect(detailRequests(requests)[0]?.url.pathname).toBe(requestDetailPath(9002));
  });

  it('식별자가 아닌 고른 요청 번호로는 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(defaultRoutes(), '?rq=xyz');

    await waitForList();

    expect(listRequests(requests)).toHaveLength(1);
    expect(detailRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });

  it('고르기를 풀면 상세를 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
    expect(detailRequests(requests)).toHaveLength(1);
  });

  it('다른 요청을 고르면 그 요청의 상세를 부른다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-002/ }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(2);
    });
    expect(detailRequests(requests)[1]?.url.pathname).toBe(requestDetailPath(9002));
  });

  /** 목록이 상세를 겸하지 않는다 — 고른 요청이 지금 보는 쪽에 없을 수 있다. */
  it('고르기가 목록을 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    expect(listRequests(requests)).toHaveLength(before);
  });
});

/**
 * **「고른 것」과 「읽을 수 있는 것」은 다르다.** 그 판정을 **읽는 자리(상세 조회)** 가 한다 —
 * 목록을 훑어 「없는 번호면 지운다」로 가르지 않는다.
 */
describe('상세를 읽을 수 없을 때', () => {
  it('404면 찾을 수 없다는 안내가 서고 고른 번호가 주소에서 정리된다', async () => {
    renderScreen(defaultRoutes(), '?q=SYNTH&rq=9999');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeVisible();

    await waitFor(() => {
      expect(currentLocation()).not.toContain('rq=');
    });
    /* 조건은 그대로다 — 정리되는 것은 고른 번호 하나뿐이다(수명 표 6행). */
    expect(currentLocation()).toContain('q=SYNTH');
  });

  /**
   * **정리가 히스토리를 늘리면 사용자가 갇힌다.**
   *
   * 늘리면 한 칸 뒤가 **없는 요청을 가리킨 주소**라, 뒤로 누를 때마다 그 자리로 돌아가
   * 같은 404와 같은 정리가 되풀이된다 — 화면을 벗어날 수 없다.
   *
   * **주소로는 그 갇힘이 보이지 않는다.** 되돌아간 순간 다시 정리돼 주소가 같아지기
   * 때문이다. **되돌아가면서 그 요청을 다시 부른다**는 사실이 유일하게 남는 자국이라,
   * 그 경로의 요청 수로 잰다.
   */
  it('404 정리가 히스토리를 늘리지 않는다 — 뒤로 눌러도 없는 요청을 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute(), failingDetailRoute(404)]);

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeVisible();
    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    /* 선행 단언 — 그 요청은 실제로 한 번 나갔다. */
    const before = detailRequests(requests).length;

    expect(before).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
    expect(detailRequests(requests)).toHaveLength(before);
  });

  /** 안내는 **그 조건으로 보고 있던 동안**만 산다 — 조건이 바뀌면 무엇에 대한 말인지 없어진다. */
  it('404 안내는 조건을 바꾸면 사라진다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?rq=9999');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeVisible();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });

  it('403이면 권한 안내가 서고 고른 번호가 남으며 다시 시도가 없다', async () => {
    renderScreen([listRoute(), failingDetailRoute(403)], '?rq=9001');

    expect(await screen.findByText(t.empty.forbiddenTitle)).toBeVisible();
    expect(currentLocation()).toContain('rq=9001');
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /** 두 갈래를 한 문구로 뭉개면 「없는 것」과 「내 것이 아닌 것」이 구분되지 않는다. */
  it('404와 403이 서로 다른 안내다', async () => {
    expect(t.empty.notFoundTitle).not.toBe(t.empty.forbiddenTitle);
    expect(t.empty.notFoundDescription).not.toBe(t.empty.forbiddenDescription);

    renderScreen([listRoute(), failingDetailRoute(403)], '?rq=9001');

    expect(await screen.findByText(t.empty.forbiddenTitle)).toBeVisible();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  it('그 밖의 실패는 배너이고 다시 시도가 그 경로를 다시 부른다', async () => {
    const { requests, user } = renderScreen([listRoute(), failingDetailRoute(500)], '?rq=9001');

    await waitForList();

    const retry = await screen.findByRole('button', { name: messages.common.retry });
    const before = detailRequests(requests).length;

    /* 실패는 빈 상태가 아니다 — 「고르세요」·「찾을 수 없습니다」가 함께 서지 않는다. */
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();

    await user.click(retry);

    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before);
    });
  });

  /** 상세가 무너져도 목록은 그대로 쓸 수 있어야 한다 — 조건을 고칠 수단이 사라지지 않는다. */
  it('상세가 실패해도 목록과 조건 줄은 그대로 산다', async () => {
    renderScreen([listRoute(), failingDetailRoute(500)], '?rq=9001');

    await waitForList();

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeVisible();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(within(requestTable()).getByText('SYNTH-REQ-002')).toBeInTheDocument();
  });

  it('응답이 오기 전에는 뼈대가 서고 빈 상태 문구가 함께 서지 않는다', async () => {
    const { release } = renderScreen(defaultRoutes(), '?rq=9001', (request) =>
      isDetailPath(new URL(request.url).pathname),
    );

    expect(await screen.findByRole('status', { name: t.loading.detail })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: t.panes.request })).not.toBeInTheDocument();

    /* 짝 양성 — 도착하면 뼈대가 물러나고 구획이 선다. 없으면 「영영 뼈대」도 통과한다. */
    release();

    expect(await screen.findByRole('group', { name: t.panes.request })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.detail })).not.toBeInTheDocument();
  });
});

/**
 * **S1 — 고른 요청이 선다.** 세 구획이 한 응답에서 온다.
 *
 * 여기서 재는 것은 **배선**이다: 부품 시험은 받은 값을 어떻게 그리는지까지만 보고,
 * 컨테이너가 **응답의 어느 값을 넘기는지**는 보지 않는다.
 */
describe('고른 요청의 아래 구획', () => {
  const detailPane = async (): Promise<ReturnType<typeof within>> =>
    within(await screen.findByRole('region', { name: t.panes.detail }));

  it('요청 정보·대상·결재 진행 세 구획이 함께 선다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();

    expect(await pane.findByRole('group', { name: t.panes.request })).toBeInTheDocument();
    expect(pane.getByRole('group', { name: t.panes.target })).toBeInTheDocument();
    expect(pane.getByRole('group', { name: t.panes.progress })).toBeInTheDocument();
  });

  it('사유 전문이 보인다 — 목록의 첫 줄 규칙이 상세에는 걸리지 않는다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();

    expect(await pane.findByText(FIRST_LINE_OF_MULTILINE_REASON)).toBeVisible();
    expect(pane.getByText(SECOND_LINE_OF_MULTILINE_REASON)).toBeVisible();
    /* 목록에는 여전히 첫 줄뿐이다 — 두 자리의 규칙이 서로 옮겨붙지 않는다. */
    expect(
      within(requestTable()).queryByText(SECOND_LINE_OF_MULTILINE_REASON),
    ).not.toBeInTheDocument();
  });

  /**
   * **모순 픽스처 — 서버 값과 배열 재계산이 어긋난다**(계획 M19·M20의 화면 몫).
   *
   * 단계가 하나뿐인데 서버는 「2 / 3 단계」라 하고, 미결 단계가 없는데 「내 차례」라 한다.
   * 배열을 훑어 다시 계산하는 구현은 여기서 곧바로 갈린다.
   */
  it('현재 단계와 내 차례가 서버 값 그대로다 — 배열과 어긋나도 서버를 따른다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();

    expect(contradictoryDetail.steps).toHaveLength(1);
    expect(await pane.findByText(t.progress.position(2, 3))).toBeVisible();
    expect(pane.queryByText(t.progress.position(1, 1))).not.toBeInTheDocument();
    expect(pane.getByText(t.progress.myTurn)).toBeVisible();
  });

  it('반대 방향에서도 서버 값을 따른다 — 배열로는 내 차례인데 서버가 아니라고 한다', async () => {
    renderScreen(defaultRoutes(), '?rq=9002');

    const pane = await detailPane();

    expect(finishedDetail.steps[1]?.isCurrent).toBe(true);
    expect(finishedDetail.steps[1]?.isMine).toBe(true);
    expect(await pane.findByText(t.progress.notMyTurn)).toBeVisible();
    expect(pane.getByText(t.progress.finished(2))).toBeVisible();
  });

  it('결재 결과 코드가 응답 값 그대로 서고 결재된 단계의 노드가 서버 단계 번호다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();

    expect(await pane.findByText(SAMPLE_DECISION_CODE_A)).toBeVisible();
    expect(pane.getByText('2026-08-06 15:02')).toBeVisible();
    expect(pane.getByText('합성 결재 의견 하나')).toBeVisible();
  });

  it('한도 구간이 아직 보이지 않는다는 사실이 결재 진행 구획에 선다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();

    expect(await pane.findByText(t.progress.limitRangeNote)).toBeVisible();
  });

  it('대상 표시명이 그대로 서고 열기는 사유와 함께 잠긴다', async () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    const pane = await detailPane();
    const target = within(await pane.findByRole('group', { name: t.panes.target }));

    expect(target.getByText('합성 대상 문서 나')).toBeVisible();
    /* 매핑표가 비어 있고 이 대상에는 화면 ID도 없다 — 두 사실 가운데 앞엣것이 이긴다. */
    expect(target.getByRole('button', { name: t.target.open })).toBeDisabled();
    expect(target.getByText(t.target.blockedNoScreenId)).toBeVisible();
    expect(target.getByText(t.target.note)).toBeVisible();
  });

  it('계약이 열 수 없다고 한 대상은 다른 사유로 잠긴다', async () => {
    renderScreen(defaultRoutes(), '?rq=9002');

    const pane = await detailPane();
    const target = within(await pane.findByRole('group', { name: t.panes.target }));

    expect(target.getByText(t.target.blockedNotOpenable)).toBeVisible();
    expect(target.queryByText(t.target.blockedNoScreenId)).not.toBeInTheDocument();
  });

  /** #44 — 이름 자리가 비어도 번호가 새지 않는다. 짝으로 「대체 문구가 실제로 보인다」를 둔다. */
  it('아래 구획 어디에도 내부 번호가 없다', async () => {
    renderScreen(defaultRoutes(), '?rq=9003');

    const region = await screen.findByRole('region', { name: t.panes.detail });
    const pane = within(region);

    expect(await pane.findByText(t.values.unknownRequester)).toBeVisible();
    expect(pane.getByText(t.values.unknownTarget)).toBeVisible();
    expect(pane.getByText(t.values.unknownApprover)).toBeVisible();

    const text = region.textContent ?? '';

    for (const hidden of ['9003', '9303', '9405', '9503']) {
      expect(text).not.toContain(hidden);
    }
  });

  it('단계가 오지 않아도 구획은 그 사실을 적는다', async () => {
    renderScreen(defaultRoutes(), '?rq=9004');

    const pane = await detailPane();

    expect(await pane.findByText(t.progress.noSteps)).toBeVisible();
  });
});

/**
 * **이 회차는 읽기 전용이다.** 목록·상세가 어떤 방법으로 오든 스텁이 응답하므로,
 * 여기서 세는 것은 「스텁이 없다」가 아니라 **실제로 나간 쓰기**다.
 */
describe('읽기 전용', () => {
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();

    await user.click(pendingCheckbox());
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    expect(writeRequests(requests)).toHaveLength(0);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });
});
