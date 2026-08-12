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
  SECOND_LINE_OF_MULTILINE_REASON,
  requestFixtures,
} from './fixtures';
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
 */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const text = await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body: text === '' ? undefined : (JSON.parse(text) as unknown),
    });

    return stub(request);
  };

  return { fetch, requests };
};

/**
 * 목록으로 나간 요청. **경로 전체로 센다** — 조건이 무엇이든, 잘못된 경로로 나갔든 잡힌다.
 */
const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === REQUESTS_PATH);

/** 이 슬라이스가 낸 요청 **전부**. 「목록 말고는 아무것도 부르지 않는다」를 재는 자리다. */
const otherRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname !== REQUESTS_PATH);

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
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <IqcSkipApprovalScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
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
    const { requests, user } = renderScreen([listRoute()], '?q=SYNTH&page=3&rq=9001');

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
    const { user } = renderScreen([listRoute()], '?page=2&rq=9001');

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
    const { requests, user } = renderScreen([listRoute()], '?q=SYNTH&pd=0&page=2&rq=9001');

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
    const { requests } = renderScreen([listRoute()], '?rq=9001');

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('rq')).toBeNull();
    expect(query?.get('approvalRequestId')).toBeNull();
  });
});

describe('쪽 이동', () => {
  it('쪽만 옮기고 고른 요청을 비운다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { page: 1, size: 2, total: 8 })],
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
    const { user } = renderScreen([listRoute()]);

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
  });

  it('같은 요청을 다시 누르면 해제된다', async () => {
    const { user } = renderScreen([listRoute()], '?rq=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 수명 표 5행 — 고르는 것은 보이는 행을 바꾸지 않는다. */
  it('고르기가 조건·범위·쪽을 건드리지 않는다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { page: 2, size: 2, total: 8 })],
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

  /** 이 회차에는 상세가 없다 — 고르면 「고르세요」가 사라지는 것이 「아직 없다」의 정직한 모습이다. */
  it('고른 뒤에는 「고르세요」 안내가 사라진다', async () => {
    renderScreen([listRoute()], '?rq=9001');

    await waitForList();

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.detail })).not.toBeInTheDocument();
  });
});

describe('다시 조회', () => {
  /* 수명 표 10행 — 새로고침은 같은 조회를 다시 하는 것이다. */
  it('보고 있는 조회를 다시 부르고 주소는 하나도 바꾸지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute()], '?q=SYNTH&pd=0&page=2&rq=9001');

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before);
    });

    expect(currentLocation()).toBe(`${ROUTE}?q=SYNTH&pd=0&page=2&rq=9001`);
  });
});

/**
 * **이 회차는 읽기 전용이다.** 목록이 어떤 방법으로 오든 스텁이 응답하므로,
 * 여기서 세는 것은 「스텁이 없다」가 아니라 **실제로 나간 쓰기**다.
 */
describe('읽기 전용', () => {
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen([listRoute()]);

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
