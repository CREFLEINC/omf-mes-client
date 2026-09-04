import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it, onTestFinished } from 'vitest';

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
  DECIDED_STATUS_CODE,
  FIRST_LINE_OF_MULTILINE_REASON,
  SAMPLE_DECISION_CODE_A,
  SECOND_LINE_OF_MULTILINE_REASON,
  contradictoryDetail,
  decidedDetail,
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
 *
 * **번호 자리에서 쌍점을 뺀다.** 결재 액션 경로(`…/9001:approve`)가 번호 자리에 쌍점을 달고
 * 오므로, 빼지 않으면 **쓰기가 상세 조회로 세어져** 「성공 뒤 상세를 다시 부른다」가 자기
 * 자신을 세며 늘 통과한다.
 */
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/:]+$/.test(pathname);

/**
 * 결재로 나간 요청. **번호를 가리지 않고 경로 모양으로 센다** — 잘못된 번호로 나간 쓰기도
 * 「나갔다」로 잡혀야 한다.
 */
const isApprovePath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+:approve$/.test(pathname);
const isRejectPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+:reject$/.test(pathname);

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

const approveRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isApprovePath(request.url.pathname));

const rejectRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isRejectPath(request.url.pathname));

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
 * 상세 200이 실어 오는 **잠금 토큰**.
 *
 * 이 리소스에서 `ETag`를 주는 응답은 **상세 하나뿐이다**(계약 실측) — 목록에는 없다.
 * 그래서 목록 스텁에는 이 헤더를 붙이지 않는다.
 */
const DETAIL_ETAG = '"9"';

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
      : jsonResponse(detail, { headers: { ETag: DETAIL_ETAG } });
  },
});

/** 상세만 특정 상태 코드로 실패시킨다. 목록은 그대로 성공한다. */
const failingDetailRoute = (status: number): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 결재 200이 실어 오는 토큰. **상세의 것과 다르다** — 쓰기의 `ETag`가 액션 경로에 앉아
 * 상세 토큰이 낡는다는 사실이 이 값의 존재 이유다.
 */
const DECIDED_ETAG = '"10"';

const approveRoute = (): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => jsonResponse(decidedDetail, { headers: { ETag: DECIDED_ETAG } }),
});

const rejectRoute = (): StubRoute => ({
  match: (request) => isRejectPath(new URL(request.url).pathname),
  respond: () => jsonResponse(decidedDetail, { headers: { ETag: DECIDED_ETAG } }),
});

const failingApproveRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => jsonResponse(body, { status }),
});

/** 응답 자체가 오지 않는 실패. **상태 코드가 없는 갈래**라 던져서 만든다. */
const offlineApproveRoute = (): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => {
    throw new TypeError('네트워크가 끊겼습니다');
  },
});

/** 목록 + 상세. 상세를 부르는 회차의 기본 스텁 묶음이다. */
const defaultRoutes = (
  items: unknown[] = requestFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute[] => [listRoute(items, page), detailRoute()];

/** 결재까지 여는 기본 스텁 한 벌. **앞에 놓은 규칙이 먼저 걸린다.** */
const decisionRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  detailRoute(),
  approveRoute(),
  rejectRoute(),
];

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

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
 */
const SearchProbe = ({ to }: { to: string }) => {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        setSearchParams(new URLSearchParams(to));
      }}
    >
      주소 이동
    </button>
  );
};

const renderScreen = (
  routes: StubRoute[],
  search = '',
  hold?: (request: Request) => boolean,
  navigateTo = '',
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
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * 화면에 **한때라도** 나타난 글자를 프레임마다 남긴다.
 *
 * 갈래 하나가 **정리 전 한 프레임에만** 서는 경우가 있어, 가라앉은 뒤의 화면만 보면 그 갈래가
 * 무엇이었는지 알 수 없다 — `findBy*`·`waitFor`는 「나타날 때까지」만 기다려 스쳐 지나간 것을
 * 놓친다. 이 기록기는 **바뀔 때마다** 담을 뿐이라 고정 지연도 도착 순서 가정도 두지 않는다.
 *
 * 렌더 전에 세워야 첫 프레임부터 잡힌다.
 *
 * **정리를 시험 수명에 맨다.** `stop()`은 호출자 코드 끝에 있어, 그 앞의 기다림이 타임아웃으로
 * 던지면 닿지 못한다. `document.body`는 이 파일의 시험들이 나눠 쓰므로 그때 관측자가 남아
 * **뒤따르는 시험의 DOM 변경마다** 아무도 읽지 않는 배열에 글자를 쌓는다 — 판정을 바꾸지는
 * 않지만 실패 원인을 흐린다.
 */
const watchRenderedText = (): { stop: () => string[] } => {
  const frames: string[] = [document.body.textContent ?? ''];
  const observer = new MutationObserver(() => {
    frames.push(document.body.textContent ?? '');
  });

  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  onTestFinished(() => {
    observer.disconnect();
  });

  return {
    stop: () => {
      observer.disconnect();

      return frames;
    },
  };
};

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

  it('사용자 조건이 없어도 화면 고정 승인 유형은 싣는다', async () => {
    const { requests } = renderScreen([listRoute()]);

    await waitForList();

    expect([...(lastListQuery(requests)?.keys() ?? [])].sort()).toEqual([
      'approvalTypeCode',
      'assignedToMe',
      'pendingOnly',
    ]);
    expect(lastListQuery(requests)?.get('approvalTypeCode')).toBe('IQC_SKIP');
  });

  it('목록 값이 화면에 보인다', async () => {
    renderScreen([listRoute()]);

    await waitForList();

    const table = within(requestTable());

    expect(table.getByText('INVENTORY_ADJUSTMENT')).toBeInTheDocument();
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
    expect(table.getAllByText('GOODS_ISSUE_DISPOSAL').length).toBe(2);
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

    const pane = within(screen.getByRole('region', { name: t.panes.detail }));

    expect(pane.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
    /*
     * **짝 방향 — 이것은 라이브 리전이 아니다.** 들어오자마자 늘 서 있는 안내라 읽어 줄 변화가
     * 없다. 이 단언이 없으면 「전부 라이브 리전」도 통과하고, 그러면 404·403 쪽 구분이 무의미해진다.
     *
     * **구획 안에서 본다** — 목록 위 유형 코드 안내도 라이브 리전이라(그쪽은 조회 결과에 따라
     * 서고 사라진다) 화면 전체에서 세면 무엇을 잰 것인지 흐려진다.
     */
    expect(pane.queryByRole('status')).not.toBeInTheDocument();
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
   * **응답을 기다리다 나타난 안내는 라이브 리전이어야 한다.**
   *
   * 404 안내는 사용자의 조작 없이 **응답이 온 뒤** 선다 — 화면을 보고 있지 않은 사람에게는
   * 아무 일도 일어나지 않은 것과 같다. 그래서 이 화면은 정적인 「고르세요」에는 라이브 리전을
   * 주지 않고 **나타나는 안내에만** 준다(디자인 시스템이 그 구분을 `live`로 둔다).
   *
   * 그 구분을 재는 자리가 없으면 리팩터링이 조용히 지워도 아무도 모른다 — 화면은 그대로 보이고
   * 읽어 주는 것만 사라진다.
   */
  it('404 안내가 라이브 리전으로 선다', async () => {
    renderScreen(defaultRoutes(), '?rq=9999');

    const pane = within(await screen.findByRole('region', { name: t.panes.detail }));

    /*
     * **안내가 선 뒤에 그 자리의 역할을 본다.** 불러오는 중의 뼈대도 라이브 리전이라
     * (그것도 나타나는 것이라 옳다) 역할만 먼저 찾으면 뼈대를 집는다.
     */
    expect(await pane.findByText(t.empty.notFoundTitle)).toBeVisible();
    expect(pane.getByRole('status')).toHaveTextContent(t.empty.notFoundTitle);
  });

  it('403 안내도 라이브 리전으로 선다', async () => {
    renderScreen([listRoute(), failingDetailRoute(403)], '?rq=9001');

    const pane = within(await screen.findByRole('region', { name: t.panes.detail }));

    expect(await pane.findByText(t.empty.forbiddenTitle)).toBeVisible();
    expect(pane.getByRole('status')).toHaveTextContent(t.empty.forbiddenTitle);
  });

  /**
   * **정리가 가라앉은 뒤에도 「찾을 수 없습니다」가 남는다** — 갈래 **차례**가 그것을 정한다.
   *
   * 정리가 끝나면 고른 요청이 없어져 「고르세요」 갈래의 조건이 참이 된다. 그것을 먼저 보면
   * 안내가 「고르세요」로 바뀌어 **사용자가 방금 무슨 일이 있었는지 화면에서 사라진다** —
   * 없는 요청을 열려 했다는 사실이 한때 스쳐 지나갈 뿐 남지 않는다.
   *
   * **앞선 404 시험들은 이 자리를 재지 못한다.** 그것들은 `findBy*`로 안내가 **나타나는**
   * 순간까지만 기다려 **정리 직전의 한때 렌더**만으로 만족된다. 여기서는 **주소가 가라앉기를
   * 먼저 기다린 뒤 동기로** 화면을 본다 — 그 시점에 ①을 세우는 조건은 `isRequestMissing`
   * 하나뿐이라, 차례를 뒤집거나 그 조건을 빼면 곧바로 갈린다.
   */
  it('정리가 끝난 뒤에도 찾을 수 없다는 안내가 남는다 — 「고르세요」로 바뀌지 않는다', async () => {
    renderScreen(defaultRoutes(), '?rq=9999');

    await waitForList();
    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeVisible();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /**
   * **정리가 가라앉기 전에도 404는 404다** — 그 한때에 오류 배너가 스치지 않는다.
   *
   * 갈래 ①이 `isRequestNotFound`와 `isRequestMissing`을 **둘 다** 보는 이유가 이것이다.
   * 앞엣것만 빼면 응답이 온 순간부터 정리가 끝나기까지 한 프레임 동안 「그 밖의 실패」 갈래가
   * 서서 **누를 수 있는 「다시 시도」가 스쳐 지나간다** — 그 사이 눌리면 없는 요청을 다시 부른다.
   *
   * **가라앉은 뒤의 화면만 보면 그 프레임이 보이지 않는다.** `findBy*`·`waitFor`는 「나타날
   * 때까지」만 기다려 스쳐 지나간 것을 놓친다. 그래서 **바뀔 때마다 기록해** 지나간 프레임을
   * 함께 본다 — 고정 지연도, 도착 순서 가정도 쓰지 않는다(#52·#99).
   */
  it('404가 오면 정리 전에도 안내다 — 「다시 시도」가 한때도 서지 않는다', async () => {
    const frames = watchRenderedText();

    renderScreen(defaultRoutes(), '?rq=9999');

    await waitForList();
    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    const seen = frames.stop();

    /* 짝 양성 — 안내는 실제로 그려졌다. 「아무것도 안 보였다」로는 통과하지 않는다. */
    expect(seen.some((frame) => frame.includes(t.empty.notFoundTitle))).toBe(true);
    expect(seen.every((frame) => !frame.includes(messages.common.retry))).toBe(true);
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
 * **조회만 하는 조작으로는 쓰기가 나가지 않는다.** 목록·상세가 어떤 방법으로 오든 스텁이
 * 응답하므로, 여기서 세는 것은 「스텁이 없다」가 아니라 **실제로 나간 쓰기**다.
 *
 * 결재가 붙은 뒤에도 이 자리가 남는 이유: 쓰기가 **버튼을 지나서만** 나가야 하고, 고르기·
 * 조건 변경·새로고침이 그 길을 건드리지 않아야 한다.
 */
describe('조회만 하는 조작', () => {
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

/* =========================================================================
 * 결재 — 되돌릴 수 없는 쓰기 둘.
 *
 * 부품 시험이 잰 것은 「컨트롤이 잠기는가」였다. 여기서 재는 것은 그 너머다 —
 * **요청이 실제로 나갔는가 · 몇 번 · 어느 경로로 · 어떤 헤더와 본문을 싣고 · 성공한 뒤
 * 무엇이 다시 불리는가.** 단위로는 잡을 수 없는 것들이다.
 * ====================================================================== */

/** 결재할 수 있는 상태(9001 · 서버가 「내 차례」라고 한 요청)까지 세운다. */
const renderDecision = async (
  routes: StubRoute[] = decisionRoutes(),
  search = '?rq=9001',
  hold?: (request: Request) => boolean,
  navigateTo = '',
): Promise<ReturnType<typeof renderScreen>> => {
  const rendered = renderScreen(routes, search, hold, navigateTo);

  await screen.findByRole('group', { name: t.panes.decision });

  return rendered;
};

const decisionPane = (): HTMLElement => screen.getByRole('group', { name: t.panes.decision });
const outcomePane = (): HTMLElement =>
  within(decisionPane()).getByRole('group', { name: t.panes.approvalOutcome });
const approveButton = (): HTMLElement =>
  within(decisionPane()).getByRole('button', { name: t.decision.approve });
const rejectButton = (): HTMLElement =>
  within(decisionPane()).getByRole('button', { name: t.decision.reject });
const commentBox = (): HTMLElement => screen.getByLabelText(t.decision.commentLabel);
const confirmDialog = (): HTMLElement => screen.getByRole('dialog');
const confirmButton = (label: string): HTMLElement =>
  within(confirmDialog()).getByRole('button', { name: label });

/** 의견을 적고 반려 창을 연다 — 반려 갈래가 되풀이하는 채비다. */
const openRejectDialog = async (
  user: ReturnType<typeof userEvent.setup>,
  comment = '합성 반려 사유',
): Promise<void> => {
  await user.type(commentBox(), comment);
  await user.click(rejectButton());
};

/** 결재를 붙잡아 둔다. **조회까지 붙잡으면 구획이 서기도 전에 멈춘다.** */
const holdApprove = (request: Request): boolean => isApprovePath(new URL(request.url).pathname);

/**
 * 《승인 시 결과》 — **이 화면 고유의 구획이고 사라지는 자리에 두지 않는다.**
 *
 * 화면 이름이 「한도승인」이라 승인이 곧 검사 생략의 실행이나 입고 처리로 읽히기 쉽다.
 * 세 문장이 서로 다른 오해를 하나씩 막으므로 **셋을 각각** 잰다.
 */
describe('결재 — 《승인 시 결과》 구획', () => {
  const outcomeSentences = [
    t.decision.outcome.statusOnly,
    t.decision.outcome.noErpDocument,
    t.decision.outcome.inspectionPending,
  ];

  it('버튼 위 상시 자리에 서고 내 차례가 아니어도 사라지지 않는다', async () => {
    await renderDecision(decisionRoutes(), '?rq=9002');

    for (const sentence of outcomeSentences) {
      expect(within(outcomePane()).getByText(sentence)).toBeVisible();
    }
    /* 짝 방향 — 그 상태에서 버튼이 실제로 잠겨 있다(문구만 남고 잠금이 풀린 것이 아니다). */
    expect(approveButton()).toBeDisabled();
  });

  it('결재에 성공한 뒤 알림에는 그 문장이 없다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    const toast = await screen.findByText(t.toast.approved);
    const toastText = toast.closest('[role="status"], [role="alert"]')?.textContent ?? '';

    for (const sentence of outcomeSentences) {
      expect(toastText).not.toContain(sentence);
    }
    /* 사라지지 않는 자리에는 그대로 있다 — 「어디에도 없다」로 통과하지 않게 짝을 둔다. */
    expect(within(outcomePane()).getByText(t.decision.outcome.statusOnly)).toBeVisible();
  });

  /**
   * **처리 결과 구획을 만들지 않는다**(계획 §13-10). 이 화면의 쓰기는 결재 기록만 남기고
   * 전표를 만들지 않아 담을 값이 「결재됨」 하나뿐이다 — 빈 구획이 된다.
   * 결과는 **성공 알림과 갱신된 상세**가 말한다.
   */
  it('결재 뒤에도 사후 결과 구획이 새로 서지 않는다', async () => {
    const { user } = await renderDecision();

    const before = within(await screen.findByRole('region', { name: t.panes.detail }))
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'));

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await screen.findByText(t.toast.approved);

    const after = within(screen.getByRole('region', { name: t.panes.detail }))
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'));

    expect(after).toEqual(before);
  });
});

describe('결재 — 내 차례 판정(첫째 겹)', () => {
  /**
   * **서버 값을 따른다.** 9002는 단계 배열로 다시 계산하면 「내 차례」가 되는데
   * 서버가 아니라고 했다 — 배열을 훑는 코드가 들어오면 여기서 드러난다.
   */
  it('서버가 아니라고 하면 배열로 맞아도 잠기고 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(decisionRoutes(), '?rq=9002');

    expect(approveButton()).toBeDisabled();
    expect(rejectButton()).toBeDisabled();
    expect(approveButton()).toHaveAccessibleDescription(
      t.decision.blockedNotMyTurn(t.decision.approve),
    );

    await user.click(approveButton());
    await user.click(rejectButton());

    expect(writeRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /** 짝 방향 — 서버가 맞다고 하면 배열로 아니어도 열린다(9001은 배열로는 미결 단계가 없다). */
  it('서버가 맞다고 하면 배열로 아니어도 승인이 열린다', async () => {
    await renderDecision();

    expect(approveButton()).toBeEnabled();
  });

  /** 승인자 이름이 없어 멈춘 요청도 **오류가 아니라 잠긴 안내**다 — 기다리는 것이 정상이다. */
  it('멈춘 요청에서도 경보를 세우지 않고 사유만 붙인다', async () => {
    await renderDecision(decisionRoutes(), '?rq=9003');

    expect(within(decisionPane()).queryByRole('alert')).toBeNull();
    expect(rejectButton()).toHaveAccessibleDescription(
      t.decision.blockedNotMyTurn(t.decision.reject),
    );
  });
});

describe('결재 — 확인 창', () => {
  it('승인을 눌러도 확인하기 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());

    expect(confirmDialog()).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('반려도 확인하기 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);

    expect(confirmDialog()).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **오결재 방어의 마지막 자리**(계획 §13-2 셋째 방어 · M60).
   *
   * 승인 유형 코드가 미확정인 동안 이 화면에는 다른 유형의 요청이 섞여 온다 — 창이 다섯 값을
   * 다시 보이지 않으면 목록에서 한 줄 잘못 누른 것이 그대로 결재된다. **값을 하나씩** 잰다.
   */
  it('승인 창이 대상 요약 다섯 값을 다시 보인다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());

    const summary = within(confirmDialog()).getByRole('group', { name: t.panes.decisionSubject });

    expect(within(summary).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(summary).getByText('GOODS_ISSUE_DISPOSAL')).toBeVisible();
    expect(within(summary).getByText('합성 대상 문서 나')).toBeVisible();
    expect(within(summary).getByText('합성 상신자1')).toBeVisible();
    expect(within(summary).getByText(FIRST_LINE_OF_MULTILINE_REASON)).toBeVisible();
  });

  it('반려 창도 같은 다섯 값을 다시 보인다', async () => {
    const { user } = await renderDecision();

    await openRejectDialog(user);

    const summary = within(confirmDialog()).getByRole('group', { name: t.panes.decisionSubject });

    expect(within(summary).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(summary).getByText('GOODS_ISSUE_DISPOSAL')).toBeVisible();
    expect(within(summary).getByText('합성 대상 문서 나')).toBeVisible();
    expect(within(summary).getByText('합성 상신자1')).toBeVisible();
    expect(within(summary).getByText(FIRST_LINE_OF_MULTILINE_REASON)).toBeVisible();
  });

  /**
   * **요약이 상세에서 온다 — 목록 행이 아니다.** 목록은 지금 보는 쪽·조건에 걸린 일부라
   * 주소로 들어온 선택이 거기 없을 수 있고, 그때 목록에서 요약을 꺼내면 창이 빈 값을 보인다.
   */
  it('목록에 없는 요청이어도 창이 요약을 채운다', async () => {
    const { user } = await renderDecision(decisionRoutes([listRoute([])]), '?rq=9001');

    await user.click(approveButton());

    const summary = within(confirmDialog()).getByRole('group', { name: t.panes.decisionSubject });

    expect(within(summary).getByText('SYNTH-REQ-001')).toBeVisible();
    expect(within(summary).getByText('GOODS_ISSUE_DISPOSAL')).toBeVisible();
  });

  /** 창이 보여 주는 것과 나가는 것이 같은 값에서 온다 — 갈리면 확인의 뜻이 없다. */
  it('창이 구획에 적은 의견을 그대로 보여 준다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '  합성 승인 의견  ');
    await user.click(approveButton());

    expect(within(confirmDialog()).getByText('합성 승인 의견')).toBeVisible();
  });

  /**
   * **공백만 친 것은 적지 않은 것과 같다** — 창이 그 사실을 말한다.
   *
   * 창이 입력값을 날것 그대로 보이면 이 자리에 빈 칸이 서서 「무언가 적힌 채 승인된다」로
   * 읽힌다. 실제로 나가는 본문에는 `comment` 키가 없다.
   */
  it('공백만 친 의견은 승인 창이 「의견 없음」으로 말한다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '   ');
    await user.click(approveButton());

    expect(within(confirmDialog()).getByText(t.dialog.noComment)).toBeVisible();
    expect(within(confirmDialog()).queryByText(t.dialog.commentHeading)).toBeNull();
  });

  /** 창 안에 선택칸을 두지 않는다(`omf-mes#45` — 창 본문이 펼침 목록을 자른다). */
  it('두 창 어디에도 선택칸이 없다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);

    await user.click(confirmButton(messages.common.cancel));
    await openRejectDialog(user);

    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **창을 닫는 것은 고치러 나가는 길이다**(수명 표 12행). 초안을 비우면 사용자가 방금 적은
   * 반려 사유를 **취소를 누른 대가로** 잃는다.
   */
  it('창을 닫아도 적어 둔 의견이 남는다', async () => {
    const { user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(messages.common.cancel));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(commentBox()).toHaveValue('합성 반려 사유');
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 규율은 「닫히지 않게」가 아니라 「닫혀도 무너지지 않게」다.
   */
  it('Escape로 닫혀도 의견이 남고 요청은 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);
    /*
     * jsdom은 Escape를 native `<dialog>`의 취소로 잇지 않는다 — 브라우저가 내는
     * `cancel` 이벤트를 직접 만들어 **디자인 시스템이 그것을 닫기로 잇는 길**을 잰다.
     */
    fireEvent(confirmDialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(commentBox()).toHaveValue('합성 반려 사유');
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **보내는 자리가 스스로 한 번 더 본다.** 창이 열린 사이 상세가 다시 와 내 차례가
   * 끝났는데 확인이 그대로 나가면, 서버는 400으로 되돌리고 사용자는 **이유를 알 수 없는
   * 거절**을 본다.
   */
  it('창이 열린 사이 내 차례가 끝나면 보내지 않고 창을 닫는다', async () => {
    let decided = false;
    const flippingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        const body = decided ? decidedDetail : contradictoryDetail;

        decided = true;

        return jsonResponse(body, { headers: { ETag: DETAIL_ETAG } });
      },
    };

    const { requests, user } = await renderDecision(decisionRoutes([flippingDetail]));

    await user.click(approveButton());
    expect(confirmDialog()).toBeInTheDocument();

    /* 창이 열린 채 상세가 다시 온다 — 그 사이 앞 단계가 움직였다. */
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(t.progress.notMyTurn);

    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 짝 방향 — 상태가 그대로면 확인이 그대로 나간다. 안 그러면 「아무것도 안 보낸다」와 같다. */
  it('상태가 그대로면 확인이 요청을 보낸다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
  });
});

describe('결재 — 본문과 헤더', () => {
  it('승인 본문에 빈 의견을 싣지 않는다 — 키 자체가 없다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
    expect(approveRequests(requests)[0]?.body).toEqual({});
  });

  /** 짝 방향 — 「늘 빈 객체」로도 위가 통과하므로 차 있는 쪽을 함께 잰다. */
  it('승인 의견이 차 있으면 다듬은 값을 싣는다', async () => {
    const { requests, user } = await renderDecision();

    await user.type(commentBox(), '  합성 승인 의견  ');
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
    expect(approveRequests(requests)[0]?.body).toEqual({ comment: '합성 승인 의견' });
  });

  it('반려 본문이 다듬은 의견을 싣는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user, '  합성 반려 사유  ');
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(rejectRequests(requests)).toHaveLength(1);
    });
    expect(rejectRequests(requests)[0]?.body).toEqual({ comment: '합성 반려 사유' });
    /* 승인 경로로 새지 않는다 — 두 조작이 같은 창을 쓰므로 갈림을 함께 잰다. */
    expect(approveRequests(requests)).toHaveLength(0);
  });

  /**
   * **막는 곳이 화면뿐이다.** 목 서버가 공백만인 반려 의견을 200으로 받는다 —
   * 버튼이 이미 막지만 창이 열린 사이 값이 비면 보내는 자리가 걸러야 한다.
   */
  it('창이 열린 사이 의견이 비면 보내지 않고 인라인 오류를 낸다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);

    /* 창 뒤의 입력칸을 화면 밖 경로로 비운다 — 버튼이 만들지 못하는 상태다. */
    fireEvent.change(commentBox(), { target: { value: '   ' } });
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.decision.commentRequired)).toBeVisible();
  });

  /**
   * **잠금 토큰은 상세 경로에서만 온다.** 액션 경로로 꺼내면 그 경로의 토큰이 비어 있어
   * 훅이 요청을 만들지 않고 멈춘다 — 「눌러도 아무 일이 없다」가 그 증상이다.
   */
  it('If-Match가 상세 200이 준 토큰이고 멱등 키가 uuid로 실린다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    const sent = approveRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    /* 액션 경로가 주는 토큰이 실리면 안 된다 — 그 값은 이 요청 뒤에야 생긴다. */
    expect(sent?.headers.get('If-Match')).not.toBe(DECIDED_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('반려도 같은 토큰 규약을 지킨다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(rejectRequests(requests)).toHaveLength(1);
    });
    expect(rejectRequests(requests)[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
  });

  /** 결재가 고른 요청의 경로로 나간다 — 번호를 지어내면 남의 요청이 결재된다. */
  it('고른 요청의 경로로 나간다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
    expect(approveRequests(requests)[0]?.url.pathname).toBe(`${requestDetailPath(9001)}:approve`);
  });
});

describe('결재 — 성공한 뒤', () => {
  /**
   * **목록과 상세가 함께 갱신된다**(뿌리 키 하나로 무효화한다). 목록만 무효화하면 상세가
   * 낡아 **방금 승인한 요청의 승인 버튼이 다시 활성으로 남고**, 다음 쓰기가 낡은 토큰으로
   * 나가 조용히 409가 된다.
   */
  it('목록과 상세를 모두 다시 부른다', async () => {
    const { requests, user } = await renderDecision();

    const before = {
      list: listRequests(requests).length,
      detail: detailRequests(requests).length,
    };

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before.detail);
    });
  });

  it('반려에 성공한 뒤에도 둘을 모두 다시 부른다', async () => {
    const { requests, user } = await renderDecision();

    const before = {
      list: listRequests(requests).length,
      detail: detailRequests(requests).length,
    };

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before.detail);
    });
  });

  /**
   * **선택을 유지한다**(계획 결정 14). 승인하면 그 요청은 「결재 대기」에서 빠지는데, 그때
   * `rq`까지 비우면 사용자가 **방금 자기가 무엇을 했는지 확인할 자리**를 잃는다.
   */
  it('고른 요청이 그대로 남고 창이 닫히며 알림이 뜬다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    expect(await screen.findByText(t.toast.approved)).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(currentLocation()).toContain('rq=9001');
  });

  /**
   * **응답이 정본이다.** 무효화가 부른 재조회가 도착하기 전까지의 빈 구간을 응답이 메운다 —
   * 그 재조회를 붙잡아 두어 **응답만으로 갱신됐는지**를 가른다.
   */
  it('상세가 결재 응답 그대로 갱신된다 — 재조회를 기다리지 않는다', async () => {
    let served = 0;
    const countingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(contradictoryDetail, { headers: { ETag: DETAIL_ETAG } });
      },
    };

    const { release, user } = await renderDecision(
      decisionRoutes([countingDetail]),
      '?rq=9001',
      /* 첫 조회는 통과시키고 **무효화가 부른 재조회만** 붙잡는다. */
      (request) => isDetailPath(new URL(request.url).pathname) && served >= 1,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    /* 재조회가 아직 오지 않았는데도 결재 응답의 값이 보인다. */
    expect(await screen.findByText('합성 결재를 마친 의견')).toBeVisible();
    expect(screen.getByText(DECIDED_STATUS_CODE)).toBeVisible();
    /* 《승인 시 결과》는 결재 뒤에도 그대로다 — 상시 구획의 뜻이 그것이다. */
    expect(within(outcomePane()).getByText(t.decision.outcome.statusOnly)).toBeVisible();

    release();
  });

  it('성공한 뒤 의견 입력칸이 비워진다', async () => {
    const { user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await screen.findByText(t.toast.rejected);
    expect(commentBox()).toHaveValue('');
  });
});

describe('결재 — 실패 갈래', () => {
  const failing = (status: number, body?: unknown): StubRoute[] =>
    decisionRoutes([failingApproveRoute(status, body)]);

  /** 실패해도 **적은 의견이 남는다** — 다시 치게 만들면 되돌릴 수 없는 조작이 더 위험해진다. */
  const sendAndFail = async (routes: StubRoute[]): Promise<ReturnType<typeof userEvent.setup>> => {
    const { user } = await renderDecision(routes);

    await user.type(commentBox(), '합성 승인 의견');
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    return user;
  };

  it('필드 오류는 그 입력칸에 붙고 의견이 남는다', async () => {
    await sendAndFail(
      failing(400, {
        errors: [{ scope: 'field', field: 'comment', code: 'INVALID', message: '합성 필드 오류' }],
      }),
    );

    expect(await screen.findByText('합성 필드 오류')).toBeVisible();
    expect(commentBox()).toHaveValue('합성 승인 의견');
    /* 창은 닫힌다 — 고칠 자리가 구획이라 열어 두면 손댈 수 없다. */
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('다시 읽어도 풀리지 않는 상태는 그렇게 말한다', async () => {
    await sendAndFail(
      failing(400, {
        errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '합성 잠금 사유' }],
      }),
    );

    expect(await screen.findByText(messages.stateLocked.title)).toBeVisible();
    expect(screen.getByText('합성 잠금 사유')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  it('권한 없음은 다른 문구로 말한다', async () => {
    await sendAndFail(failing(403));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.queryByText(messages.stateLocked.description)).toBeNull();
  });

  it('대상 없음은 일반 실패 문구로 말한다', async () => {
    await sendAndFail(failing(404));

    expect(await screen.findByText(messages.httpError.description)).toBeVisible();
  });

  /** **409에만 「최신 불러오기」가 붙는다** — 다른 실패에 권하면 적어 둔 의견만 버리게 된다. */
  it('충돌에는 최신 불러오기가 붙는다', async () => {
    await sendAndFail(failing(409, { conflictCause: 'user', message: '' }));

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.conflict.reloadAction })).toBeVisible();
  });

  /**
   * **응답을 받지 못한 요청만이 「갔는지 모르는」 요청이다.** 400·403·409는 서버가 답한
   * 것이라 결재가 일어나지 않았음이 확실하다 — 거기까지 이 문장을 붙이면 없는 불안을 만든다.
   */
  it('네트워크 갈래에만 전달 여부 안내가 붙는다', async () => {
    const { user } = await renderDecision(decisionRoutes([offlineApproveRoute()]));

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    expect(await screen.findByText(messages.httpError.offline)).toBeVisible();
    expect(screen.getByText(t.decision.deliveryUnknown)).toBeVisible();
  });

  it('충돌에는 전달 여부 안내가 붙지 않는다', async () => {
    await sendAndFail(failing(409, { conflictCause: 'user', message: '' }));

    await screen.findByText(messages.conflict.user);
    expect(screen.queryByText(t.decision.deliveryUnknown)).toBeNull();
  });

  /**
   * **409 뒤의 길이 실제로 열린다.** 「최신 불러오기」가 상세를 다시 불러 **새 토큰**을
   * 확보하지 않으면 다음 시도가 또 409다 — 같은 값이 두 번 실리는지로 판정한다.
   */
  it('최신 불러오기가 상세를 다시 불러 다음 요청의 토큰이 달라진다', async () => {
    let served = 0;
    const rotatingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(contradictoryDetail, {
          headers: { ETag: `"token-${String(served)}"` },
        });
      },
    };

    const requestsRef: RecordedRequest[][] = [];
    const conflictOnce: StubRoute = {
      match: (request) => isApprovePath(new URL(request.url).pathname),
      respond: () =>
        approveRequests(requestsRef[0] ?? []).length === 1
          ? jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })
          : jsonResponse(decidedDetail, { headers: { ETag: DECIDED_ETAG } }),
    };

    const { requests, user } = await renderDecision(decisionRoutes([rotatingDetail, conflictOnce]));

    requestsRef[0] = requests;

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    const reload = await screen.findByRole('button', { name: messages.conflict.reloadAction });
    const beforeDetail = detailRequests(requests).length;

    await user.click(reload);

    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(2);
    });

    const [first, second] = approveRequests(requests);

    expect(first?.headers.get('If-Match')).toBe('"token-1"');
    expect(second?.headers.get('If-Match')).not.toBe(first?.headers.get('If-Match'));
  });
});

describe('결재 — 실패 배너가 매인 대상', () => {
  const failOnce = (): StubRoute[] =>
    decisionRoutes([failingApproveRoute(409, { conflictCause: 'user', message: '' })]);

  const sendFailingApprove = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await screen.findByText(messages.conflict.user);
  };

  /** **안 지움** — 대상이 바뀌면 앞 요청의 판정이 남아 있어서는 안 된다. */
  it('다른 요청으로 옮기면 사라진다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));

    await waitFor(() => {
      expect(screen.queryByText(messages.conflict.user)).toBeNull();
    });
  });

  /**
   * **너무 지움** — 정리 의존성에 초안을 넣으면 의견을 한 글자 칠 때마다 사유가 사라진다.
   * 사용자는 그 사유를 **보면서** 고쳐야 한다(`omf-mes#43`의 형태).
   */
  it('의견을 고쳐도 남는다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);
    await user.type(commentBox(), '가');

    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });

  /**
   * **창을 여닫아도 남는다**(수명 표 11·12행). 지난 시도가 실패한 것은 아직 참이고,
   * 보낼 때 공통 쓰기 훅이 스스로 지운다 — 열자마자 지우면 창을 닫은 뒤 **왜 다시 보내려
   * 했는지**가 사라지고, 닫을 때 지우면 취소를 누른 대가로 사유를 잃는다.
   */
  it('창을 다시 열고 닫아도 남는다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);

    await user.click(approveButton());
    expect(within(confirmDialog()).queryByText(messages.conflict.user)).toBeNull();
    expect(screen.getByText(messages.conflict.user)).toBeVisible();

    await user.click(confirmButton(messages.common.cancel));

    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });

  /**
   * **늘 지움** — 정리 의존성에 응답 객체를 넣거나 배열을 없애면 배너가 아예 보이지 않는다.
   *
   * **다시 그려진 것을 눈으로 확인한 뒤에 잰다.** 「요청이 늘었다」까지만 기다리면 응답이
   * 도착하기 전에 단언이 끝나, 정리가 도는 자리를 지나치지 않은 채 통과할 수 있다.
   */
  it('다시 조회로 상세가 새로 와도 남는다', async () => {
    let served = 0;
    const changingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(
          served === 1
            ? contradictoryDetail
            : {
                ...contradictoryDetail,
                steps: [
                  { ...contradictoryDetail.steps[0], decisionComment: '합성 재조회 뒤 의견' },
                ],
              },
          { headers: { ETag: DETAIL_ETAG } },
        );
      },
    };

    const { user } = await renderDecision(
      decisionRoutes([
        changingDetail,
        failingApproveRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await sendFailingApprove(user);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 새 상세가 실제로 그려졌다 — 여기까지 와야 정리 effect가 도는 자리를 지났다. */
    expect(await screen.findByText('합성 재조회 뒤 의견')).toBeVisible();
    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });
});

/**
 * 초안이 매인 대상 — **배너와 같은 축(`decisionTargetKey`)이지만 다른 값이다.**
 *
 * 배너는 「보낸 대상과 지금 대상이 같은가」로도 한 번 걸러지지만 초안은 그렇지 않다 —
 * 정리가 도는 자리가 없으면 **앞 요청에 쓴 반려 사유가 다음 요청에 그대로 실린다.**
 */
describe('결재 — 의견 초안이 매인 대상', () => {
  it('다른 요청으로 옮기면 적어 둔 의견이 남지 않는다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '9001에만 해당하는 합성 반려 사유');
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });
    expect(commentBox()).toHaveValue('');
  });

  /** 짝 방향 — 같은 요청을 보는 동안에는 지워지지 않는다(응답이 다시 와도 그렇다). */
  it('같은 요청을 보는 동안 다시 조회해도 의견이 남는다', async () => {
    const { requests, user } = await renderDecision();

    await user.type(commentBox(), '합성 반려 사유');

    const before = detailRequests(requests).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before);
    });

    expect(commentBox()).toHaveValue('합성 반려 사유');
  });

  /** 앞 요청의 창이 살아남으면 **그 창이 다음 요청을 결재한다** — 대상이 바뀌면 닫는다. */
  it('창이 열린 채 주소로 대상이 바뀌면 창이 닫히고 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      undefined,
      'rq=9002',
    );

    await openRejectDialog(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
    expect(commentBox()).toHaveValue('');
  });
});

describe('결재 — 전송 중', () => {
  /**
   * **「닫혀도 나가는 요청이 무너지지 않게」의 본체.**
   *
   * 두 창의 주석이 규율을 그렇게 적었다 — Escape는 막을 수 없으므로(native `<dialog>`가
   * `cancel`을 내고 디자인 시스템이 그것을 닫기로 무조건 잇는다) 규율은 「닫히지 않게」가
   * 아니라 **「닫혀도 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽에 있다.
   *
   * **보내기 전 Escape와 다른 자리다.** 앞의 시험(「Escape로 닫혀도 의견이 남고 요청은 나가지
   * 않는다」)은 아직 아무것도 나가지 않은 때를 잰다. 규율이 실제로 걸리는 것은 **나가는 중**
   * 이다 — 그때 `closeDecisionDialog`가 `reset()`을 부르면 옵저버가 떨어져 **무효화도 성공도
   * 잠금 해제도 오지 않는다.** 그 함수가 창만 내린다는 사실에 잣대가 없으면, 다음 사람이
   * 거기에 「닫으면 정리한다」를 더해도 시험이 조용히 통과한다.
   */
  it('전송 중 Escape로 창이 닫혀도 무효화와 성공이 살아 있다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      holdApprove,
    );

    await user.type(commentBox(), '합성 승인 의견');
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    /* jsdom은 Escape를 native `<dialog>`의 취소로 잇지 않는다 — 브라우저가 내는 이벤트를 직접 만든다. */
    fireEvent(confirmDialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /* ① 창을 닫는 것이 요청을 다시 내지도, 되돌리지도 않는다. */
    expect(approveRequests(requests)).toHaveLength(1);
    /* ② 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(approveButton()).toBeDisabled();

    const beforeList = listRequests(requests).length;

    release();

    /* ③ 성공이 사라지지 않는다. */
    expect(await screen.findByText(t.toast.approved)).toBeVisible();
    /* ④ 무효화가 살아 있다 — 없으면 다음 결재가 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(beforeList);
    });
    /* ⑤ 성공 뒤 정리는 그대로 일어난다 — 창을 닫은 것이 그 길을 끊지 않았다. */
    await waitFor(() => {
      expect(commentBox()).toHaveValue('');
    });
  });

  /**
   * **승인·반려 대칭** — 규율의 몸통은 `closeDecisionDialog` 하나지만 창마다 그것을 받는
   * 배선이 따로 있다. 한쪽만 재면 다른 창이 다른 `onClose`를 받아도 드러나지 않는다.
   */
  it('반려도 전송 중 Escape에 같은 규율을 지킨다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      (request) => isRejectPath(new URL(request.url).pathname),
    );

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));
    await waitFor(() => {
      expect(rejectRequests(requests)).toHaveLength(1);
    });

    fireEvent(confirmDialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(rejectRequests(requests)).toHaveLength(1);

    const beforeList = listRequests(requests).length;

    release();

    expect(await screen.findByText(t.toast.rejected)).toBeVisible();
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(beforeList);
    });
  });

  /**
   * **연타해도 요청은 1회다.** 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어(`omf-mes#55`)
   * 두 번 나가면 서버에는 **다른 요청 둘**로 보인다 — 화면의 잠금이 그 자리를 막는 첫째 겹이다.
   */
  it('연타해도 요청이 1회이고 컨트롤이 잠긴다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    /* 첫째 겹 — 눈에 보이는 컨트롤이 닫혔다. */
    expect(commentBox()).toBeDisabled();
    expect(approveButton()).toBeDisabled();
    expect(rejectButton()).toBeDisabled();
    expect(confirmButton(t.decision.approve)).toBeDisabled();

    await user.click(confirmButton(t.decision.approve));

    expect(approveRequests(requests)).toHaveLength(1);

    release();
    await screen.findByText(t.toast.approved);
  });

  /**
   * **둘째 겹** — 조건 칩·목록 행·쪽·확인칸은 잠금을 받지 않는다. 그 길로 대상이 바뀌면
   * 나가는 중인 결재의 결과가 **다른 요청의 맥락에** 나타난다.
   */
  it('목록 행·쪽·「결재 대기만 보기」로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await renderDecision(
      [listRoute(requestFixtures, { total: 120 }), detailRoute(), approveRoute()],
      '?rq=9001',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    await user.click(pendingCheckbox());

    expect(currentLocation()).toContain('rq=9001');
    expect(currentLocation()).not.toContain('page=2');
    expect(currentLocation()).not.toContain('pd=0');

    release();
    await screen.findByText(t.toast.approved);
  });

  /**
   * **조건 칩도 같은 문을 지난다.** 위 시험과 갈라 두는 이유: 한 시험에 여러 길을 몰아넣으면
   * 먼저 오는 단언이 먼저 터져 **칩 하나만 문 밖에 있어도 드러나지 않는다.**
   * 칩은 고른 요청을 건드리지 않고 조건만 푸는 길이라 잣대도 조건 쪽에 둔다.
   */
  it('전송 중 조건 칩으로도 조건이 풀리지 않는다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      /* 조건 하나를 걸어 둔다 — 칩이 서 있어야 그 길을 잴 수 있다. */
      '?rq=9001&q=SYNTH',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveKeyword }));

    expect(currentLocation()).toContain('q=SYNTH');

    release();
    await screen.findByText(t.toast.approved);

    /* 짝 방향 — 잠금이 풀리면 같은 칩이 그 조건을 실제로 푼다(늘 남는 것이 아니다). */
    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveKeyword }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('q=SYNTH');
    });
  });

  /**
   * **바깥에서 주소가 바뀌는 길** — 뒤로가기·앞으로가기·주소 직접 편집은 잠금 문을 지나지
   * 않는다. 그때 창·배너 정리가 깨어나는데, 그 정리가 **나가는 중인 요청까지 끊으면**
   * 무효화·성공·잠금 해제가 통째로 사라진다(`omf-mes#96`). 서버에는 이미 갔는데 화면만
   * 없던 일로 친다.
   */
  it('전송 중 주소로 대상이 바뀌어도 무효화와 성공이 살아 있다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      holdApprove,
      'rq=9002',
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });

    /* ① 창이 닫혔다 — 열린 채로 두면 다음 요청을 결재하는 창이 된다. */
    expect(screen.queryByRole('dialog')).toBeNull();
    /* ② 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(approveButton()).toBeDisabled();

    const beforeList = listRequests(requests).length;

    release();

    /* ③ 성공이 사라지지 않는다. */
    expect(await screen.findByText(t.toast.approved)).toBeVisible();
    /* ④ 무효화가 살아 있다 — 없으면 다음 결재가 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(beforeList);
    });
    /* ⑤ 남의 결과를 새 대상에 찍지 않는다. */
    expect(screen.queryByText('합성 결재를 마친 의견')).toBeNull();
  });

  /**
   * **실패도 자기 대상보다 오래 살지 않는다.**
   *
   * 나가는 중인 쓰기는 끊지 않으므로(`resetIfIdle`) 대상이 바뀐 뒤에 실패가 도착한다.
   * 그것을 그대로 그리면 **9001의 거절 사유가 9002를 보는 화면에** 선다 — 사용자는 자기가
   * 건드린 적 없는 요청이 거절된 줄 안다.
   */
  it('전송 중 대상이 바뀌면 뒤늦게 온 실패가 새 대상에 서지 않는다', async () => {
    /*
     * **옮겨 간 대상도 결재할 수 있는 상태로 둔다.** 그래야 「잠금이 풀렸다」로 실패가 도착한
     * 시점을 알 수 있다 — 새 대상이 애초에 잠겨 있으면 무엇을 기다려야 할지가 없어져,
     * 도착 전에 단언이 끝나고 **아무 구현이나 통과한다.**
     */
    const alwaysMyTurnDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => jsonResponse(contradictoryDetail, { headers: { ETag: DETAIL_ETAG } }),
    };

    const { requests, release, user } = await renderDecision(
      decisionRoutes([
        alwaysMyTurnDetail,
        failingApproveRoute(409, { conflictCause: 'user', message: '' }),
      ]),
      '?rq=9001',
      holdApprove,
      'rq=9002',
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });

    release();

    /* 잠금이 풀린 것으로 실패가 도착한 것을 안다 — 도착 전에 단언하면 늘 통과한다. */
    await waitFor(() => {
      expect(approveButton()).toBeEnabled();
    });
    expect(screen.queryByText(messages.conflict.user)).toBeNull();
  });
});

/**
 * **상세를 더는 읽을 수 없게 된 뒤의 확인 창** — 결재함(PR #105) 리뷰 Major가 짚은 자리.
 *
 * 조회 라이브러리는 재조회가 실패해도 **마지막 성공 자료를 남긴다.** 그래서 「자료가 있는가」만
 * 묻는 조건은 「지금 읽을 수 있는가」를 묻지 않는다. 그 틈에서 화면은 「권한이 없습니다」라고
 * 말하면서 그 위에 **되돌릴 수 없는 승인 창**을 세운 채였다.
 */
describe('결재 — 상세를 읽을 수 없게 된 뒤', () => {
  /** 첫 조회는 통과시키고 **두 번째부터** 실패시킨다 — 창을 열 상태는 서야 한다. */
  const failingSecondDetail = (status: number): StubRoute => {
    let served = 0;

    return {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return served === 1
          ? jsonResponse(contradictoryDetail, { headers: { ETag: DETAIL_ETAG } })
          : jsonResponse({ message: '' }, { status });
      },
    };
  };

  it('승인 창이 열린 사이 상세가 500이면 창이 사라지고 쓰기가 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(decisionRoutes([failingSecondDetail(500)]));

    await user.click(approveButton());
    expect(confirmDialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** **승인·반려 대칭** — 한쪽만 막으면 다른 쪽이 같은 자리로 샌다. */
  it('반려 창이 열린 사이 상세가 500이면 창이 사라지고 쓰기가 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(decisionRoutes([failingSecondDetail(500)]));

    await openRejectDialog(user);
    expect(confirmDialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **403은 결재 구획을 걷어 내고 「볼 권한이 없습니다」를 세운다.** 그 위에 창이 남으면
   * 화면이 볼 수 없다고 말하는 요청을 사용자가 결재하게 된다.
   */
  it('상세가 403이면 안내가 서고 창이 남지 않는다', async () => {
    const { requests, user } = await renderDecision(decisionRoutes([failingSecondDetail(403)]));

    await user.click(approveButton());
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(t.empty.forbiddenTitle);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **창이 스스로 되살아나지 않는다.** 숨기기만 하고 상태를 내려 두지 않으면, 사용자가
   * 「다시 시도」로 상세를 되찾는 순간 **누른 적 없는 확인 창**이 다시 떠 있다.
   */
  it('다시 시도로 상세가 돌아와도 창이 되살아나지 않는다', async () => {
    let served = 0;
    const flakyDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return served === 2
          ? jsonResponse({ message: '' }, { status: 500 })
          : jsonResponse(contradictoryDetail, { headers: { ETag: DETAIL_ETAG } });
      },
    };

    const { user } = await renderDecision(decisionRoutes([flakyDetail]));

    await user.click(approveButton());
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(messages.httpError.loadTitle);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    await screen.findByRole('group', { name: t.panes.decision });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
