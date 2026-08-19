import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  notificationEventListBody,
  notificationFixture,
  notificationFixtures,
  notificationListBody,
} from './fixtures';
import { titleIdOf } from './notification-card';
import { defaultPeriod } from './period';
import { notificationKeys } from './queries';
import { NotificationCenterScreen, describeMarkAllReadReason } from './screen';

const t = messages.notificationCenter;

/** 픽스처가 푸는 이름 둘. 셋째(`SYN-EVENT-03`)는 유형 목록에 없어 원문으로 낙하한다. */
const EVENT_NAME_01 = '합성 이벤트 가';
const EVENT_NAME_02 = '합성 이벤트 나';

const LIST_PATH = '/app/notifications';
const EVENTS_PATH = '/app/notification-events';

/**
 * 경로가 겹친다 — 유형 목록 경로가 목록 경로로 시작하지 않지만, 두 조회를 가르지 않으면
 * 「목록을 몇 번 불렀나」가 유형 조회 한 번에 어긋난다. `pathname`을 **정확히** 견준다.
 */
const isList = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === LIST_PATH;

const isEvents = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === EVENTS_PATH;

const listRoute = (
  items = notificationFixtures,
  page: Partial<{ page: number; size: number; total: number }> = {},
): StubRoute => ({
  match: isList,
  respond: () => jsonResponse(notificationListBody(items, page)),
});

const eventsRoute: StubRoute = {
  match: isEvents,
  respond: () => jsonResponse(notificationEventListBody()),
};

const failingEventsRoute: StubRoute = {
  match: isEvents,
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
};

const UNREAD_COUNT_PATH = '/app/notifications/unread-count';
const READ_ALL_PATH = '/app/notifications:read-all';

const isUnreadCount = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === UNREAD_COUNT_PATH;

/** 읽음 처리 경로. 번호가 경로 조각이라 접두로 가른다 — `:read-all`과 겹치지 않게 형태를 본다. */
const isMarkRead = (request: Request): boolean =>
  request.method === 'POST' &&
  /\/app\/notifications\/\d+:read$/.test(new URL(request.url).pathname);

const isMarkAllRead = (request: Request): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === READ_ALL_PATH;

const unreadCountRoute = (unreadCount = 2): StubRoute => ({
  match: isUnreadCount,
  respond: () => jsonResponse({ unreadCount }),
});

/** 계약의 성공 응답은 **204이고 본문이 없다.** */
const markReadRoute = (status = 204): StubRoute => ({
  match: isMarkRead,
  respond: () =>
    status === 204 ? new Response(null, { status }) : jsonResponse({ message: '' }, { status }),
});

const markAllReadRoute = (readCount = 5): StubRoute => ({
  match: isMarkAllRead,
  respond: () => jsonResponse({ readCount }),
});

/**
 * 목록 규칙에 **곁 조회·쓰기를 늘 함께 둔다** — 스텁에 없는 요청은 하네스가 던진다.
 * 각 시험이 겨누는 것만 갈아 끼우고 나머지는 정상 경로로 둔다.
 */
const routesWith = (...routes: StubRoute[]): StubRoute[] => [
  ...routes,
  eventsRoute,
  unreadCountRoute(),
  markReadRoute(),
  markAllReadRoute(),
];

const failingRoute = (status = 500, message = '합성 서버 사유'): StubRoute => ({
  match: isList,
  respond: () => jsonResponse({ message }, { status }),
});

/**
 * 부를 때마다 **내용까지 달라지는** 스텁 — 두 번째 조회에서 첫 건이 빠진다.
 *
 * 같은 구조를 되돌리는 스텁으로는 「목록이 갱신됐다」와 「아무 일도 없었다」가 구분되지 않아
 * 아래 DOM 동일성 감지기가 헛통과한다(사본 체크리스트 12행).
 */
const shrinkingRoute = (): StubRoute => {
  let calls = 0;

  return {
    match: isList,
    respond: () => {
      calls += 1;

      return jsonResponse(
        notificationListBody(calls === 1 ? notificationFixtures : notificationFixtures.slice(1)),
      );
    },
  };
};

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다.
 *
 * `hold`가 참을 돌려주면 **기록한 뒤 응답을 붙잡아 둔다.** 「조회가 끝나기 전에 화면이
 * 무엇을 그리고 있나」를 재려면 그 구간이 실제로 멈춰 있어야 한다 — `findBy…`로 최종 상태만
 * 기다리는 시험은 그 사이에 무엇이 번쩍였는지 영영 보지 못한다.
 */
const recordingFetch = (
  routes: StubRoute[],
  hold?: (request: Request) => boolean,
): { fetch: StubFetch; urls: URL[]; requests: Request[]; release: () => void } => {
  const urls: URL[] = [];
  /** 쓰기는 **나간 요청 자체**를 봐야 한다 — 메서드·경로 조각·헤더가 주소에 담기지 않는다. */
  const requests: Request[] = [];
  const stub = createStubFetch(routes);
  const holders: Array<() => void> = [];

  return {
    urls,
    requests,
    release: () => {
      holders.forEach((resolve) => {
        resolve();
      });
      holders.length = 0;
    },
    fetch: async (request) => {
      urls.push(new URL(request.url));
      requests.push(request);

      if (hold?.(request) === true) {
        await new Promise<void>((resolve) => {
          holders.push(resolve);
        });
      }

      return stub(request);
    },
  };
};

const listUrls = (urls: URL[]): URL[] => urls.filter((url) => url.pathname === LIST_PATH);

/** 주소를 읽어 내는 탐침. 기간이 실제로 심겼는지 잴 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

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

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
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
  route = '/',
  routes: StubRoute[] = routesWith(listRoute()),
  navigateTo = '',
  hold?: (request: Request) => boolean,
) => {
  const { fetch, urls, requests, release } = recordingFetch(routes, hold);
  const result = renderWithProviders(
    <>
      <NotificationCenterScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route },
  );

  return { ...result, urls, requests, release, user: userEvent.setup() };
};

/**
 * 카드가 실제로 섰음을 잡는 시점. 음성 단언은 이 시점 뒤에 잰다.
 *
 * **푼 이름으로 찾는다** — 코드로 찾으면 이름 풀이가 통째로 죽어도 이 대기가 통과한다.
 */
const waitForCards = async (): Promise<void> => {
  await screen.findByRole('button', { name: EVENT_NAME_01 });
};

/** 알림 번호가 가리키는 카드의 목록 항목. DOM 노드 동일성을 재기 위한 자리다. */
const rowOf = (notificationId: number): Element | null =>
  document.getElementById(titleIdOf(notificationId))?.closest('li') ?? null;

const seededPeriod = defaultPeriod(new Date());
const seededSearch = `?from=${seededPeriod.from}&to=${seededPeriod.to}`;

describe('NotificationCenterScreen — 기간을 주소에 심는다', () => {
  /**
   * **T1-1.** 계약이 기간을 필수로 두어 심지 않으면 첫 진입이 곧 400이다.
   * 저장소의 조회형 골격이 규율로 세운 「기본 기간을 심지 않는다」가 여기서만 거짓인 자리다.
   */
  it('주소에 기간이 없으면 오늘 포함 7일을 채우고 조회한다', async () => {
    const { urls } = renderScreen();

    await waitFor(() => {
      expect(currentLocation()).toBe(`/${seededSearch}`);
    });

    await waitForCards();
    expect(listUrls(urls)).toHaveLength(1);
  });

  it('심은 값이 오늘을 마지막 날로 둔 7일이다 — 값을 재지 않으면 며칠이든 통과한다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(currentLocation()).toContain(`from=${seededPeriod.from}`);
    });

    expect(currentLocation()).toContain(`to=${seededPeriod.to}`);
  });

  /**
   * ⭐ **기대값을 구현 함수에서 얻지 않고 주소에서 직접 센다.**
   *
   * 바로 위 시험의 `seededPeriod`는 `defaultPeriod(new Date())`에서 나온다 — 자기 참조라
   * 상수가 30일로 바뀌면 기대값도 함께 바뀌어 **울지 않는다**(`period.test.ts`의 하드코딩
   * 날짜가 그 자리를 맡지만, 화면 쪽에는 잣대가 없었다).
   */
  it('심은 기간의 길이가 오늘 포함 7일이다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(currentLocation()).toContain('from=');
    });

    const params = new URLSearchParams(currentLocation().split('?')[1] ?? '');
    const from = new Date(`${params.get('from') ?? ''}T00:00:00`);
    const to = new Date(`${params.get('to') ?? ''}T00:00:00`);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

    expect(days).toBe(7);
  });

  it('주소에 있던 기간은 덮지 않는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(currentLocation()).toBe('/?from=2026-08-01&to=2026-08-07');
    expect(listUrls(urls)).toHaveLength(1);
  });

  /**
   * ⭐ **키는 있고 값이 빈 주소는 사용자의 뜻이다.** 값만 보면 「키가 없다」와 같은 빈
   * 문자열이라, 두 사태를 접으면 화면이 곧바로 기본값으로 덮는다 — 그러면 기간을 비울 수단이
   * 아예 없어진다. 전례 둘(`master-change` · `integration-sync`)이 `has()`로 갈라 둔 자리다.
   */
  it('키는 있고 값이 빈 주소를 덮지 않고 사유를 보인다', async () => {
    const { urls } = renderScreen('/?from=&to=');

    expect(await screen.findByText(t.reasons.periodIncomplete)).toBeInTheDocument();
    expect(currentLocation()).toBe('/?from=&to=');
    expect(listUrls(urls)).toHaveLength(0);
  });

  it('한쪽 키만 있어도 덮지 않는다 — 넣은 쪽이 사라지면 안 된다', async () => {
    renderScreen('/?from=2026-08-01');

    expect(await screen.findByText(t.reasons.periodIncomplete)).toBeInTheDocument();
    expect(currentLocation()).toBe('/?from=2026-08-01');
  });

  it('기간을 채우면서 다른 조건 키를 지우지 않는다', async () => {
    /*
     * 뒤따르는 회차가 조건을 늘릴수록 손실이 커진다 — 지금 잡아 두지 않으면
     * 「기본값을 채웠더니 걸어 둔 조건이 사라졌다」가 그때 처음 드러난다.
     */
    renderScreen('/?unread=1');

    await waitFor(() => {
      expect(currentLocation()).toContain(`from=${seededPeriod.from}`);
    });

    expect(currentLocation()).toContain('unread=1');
  });

  /**
   * ⭐ **T1-2.** 「늘지 않았다」를 **자기 치유가 만들 수 없는 값으로** 잰다.
   *
   * 채우기가 밀어 넣기였다면 한 칸 뒤는 기간 없는 주소이고, 그 자리에서 **채우기가 다시 돌아**
   * 같은 모양의 주소를 만든다 — 「기간이 있다」만 기다리면 통과하고 **사용자만 그 자리에 갇힌다.**
   * 그래서 채우기 이전의 자리(손으로 넣은 다른 기간)를 기다린다. 그 값은 자기 치유가 만들지 못한다.
   */
  it('기간을 채워도 뒤로가기 기록이 늘지 않는다', async () => {
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute()), '');

    await waitForCards();

    /* 기간 없는 주소로 옮겨 채우기를 일으킨다 — 여기까지가 칸 하나다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    /* 짝 양성 — 채우기가 실제로 돌았다. */
    await waitFor(() => {
      expect(currentLocation()).toBe(`/${seededSearch}`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe('/?from=2026-08-01&to=2026-08-07');
    });
  });
});

describe('NotificationCenterScreen — 요청에 실리는 기간', () => {
  /**
   * **T1-3.** 계약이 `date-time`을 받는다. 날짜만 보내는 형태(전례 두 화면의 규율)를 그대로
   * 베끼면 목이 관대해 통과했다가 실서버에서 깨진다. **문자 단위로** 잰다.
   */
  it('시작은 그날 00:00:00, 종료는 그날 23:59:59로 실린다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    const zone = listUrls(urls)[0]?.searchParams.get('occurredFrom')?.slice(19) ?? '';

    expect(listUrls(urls)[0]?.searchParams.get('occurredFrom')).toBe(`2026-08-01T00:00:00${zone}`);
    expect(listUrls(urls)[0]?.searchParams.get('occurredTo')).toBe(`2026-08-07T23:59:59${zone}`);
    /* 시간대가 붙어 있어야 같은 글자가 지역마다 다른 순간을 가리키지 않는다. */
    expect(zone).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it('날짜만 보내지 않는다 — 계약의 자료형이 date-time이다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(listUrls(urls)[0]?.searchParams.get('occurredFrom')).not.toBe('2026-08-01');
  });

  it('쪽 크기를 싣지 않는다 — 서버 기본값을 쓴다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(listUrls(urls)[0]?.searchParams.has('size')).toBe(false);
  });
});

describe('NotificationCenterScreen — 보낼 수 없는 기간', () => {
  /**
   * **T1-4.** 사용자가 주소를 손으로 고친 경우다. 조용히 기본값으로 덮으면 무엇이 왜 달라졌는지
   * 화면 어디에도 남지 않는다(공유계약 G-9).
   */
  it('없는 날짜면 조회하지 않고 사유를 보인다', async () => {
    const { urls } = renderScreen('/?from=2026-02-31&to=2026-08-07');

    expect(await screen.findByText(t.reasons.periodInvalid)).toBeInTheDocument();
    expect(listUrls(urls)).toHaveLength(0);
    /* 덮지 않는다 — 고칠 값이 주소에 그대로 남아야 사용자가 무엇을 넣었는지 안다. */
    expect(currentLocation()).toBe('/?from=2026-02-31&to=2026-08-07');
  });

  it('뒤집힌 기간이면 조회하지 않고 다른 사유를 보인다', async () => {
    const { urls } = renderScreen('/?from=2026-08-07&to=2026-08-01');

    expect(await screen.findByText(t.reasons.periodReversed)).toBeInTheDocument();
    expect(listUrls(urls)).toHaveLength(0);
  });

  it('한쪽만 채운 기간도 막는다 — 다만 날짜 탓으로 말하지 않는다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01');

    /*
     * ⭐ 넣은 날짜는 멀쩡하다. 「올바른 날짜가 아닙니다」로 말하면 사실도 아니고,
     * 성한 쪽까지 다시 고르라는 말이 된다(공유계약 G-9).
     */
    expect(await screen.findByText(t.reasons.periodIncomplete)).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.periodInvalid)).not.toBeInTheDocument();
    expect(listUrls(urls)).toHaveLength(0);
  });

  it('막힌 사유를 알림이 없는 것으로 말하지 않는다', async () => {
    renderScreen('/?from=2026-08-07&to=2026-08-01');

    /* 짝 양성 뒤에 잰다 — 사유가 실제로 섰다. */
    expect(await screen.findByText(t.reasons.periodReversed)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 목록', () => {
  it('알림마다 제목 · 시각 · 본문 · 읽음 표시를 그린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByText(EVENT_NAME_01)).toBeInTheDocument();
    expect(screen.getByText('08-17 14:05')).toBeInTheDocument();
    expect(screen.getByText('합성 알림 문구 가입니다.')).toBeInTheDocument();
    expect(screen.getByText(t.card.read)).toBeInTheDocument();
    expect(screen.getAllByText(t.card.unread)).toHaveLength(2);
  });

  it('본문이 공백뿐인 알림은 빈 자리 대신 안내를 그린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByText(t.card.emptyMessage)).toBeInTheDocument();
  });

  it('카드마다 자기 제목을 이름으로 든다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(
      within(screen.getByRole('region', { name: t.panes.list })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.getByRole('button', { name: EVENT_NAME_02 })).toBeInTheDocument();
    /* 유형 목록에 없는 코드는 원문 그대로가 이름이다. */
    expect(screen.getByRole('button', { name: 'SYN-EVENT-03' })).toBeInTheDocument();
  });

  /**
   * ⭐ **T1-7.** 카드 목록의 key가 배열 인덱스면 앞 카드가 빠질 때 뒤 카드가 앞 카드의 DOM
   * 자리로 옮겨 붙는다 — 그 자리에 있던 포커스와 상태가 다른 알림의 것이 된다.
   * 뒤따르는 회차의 「모두 읽음」이 정확히 그 경로를 만든다.
   */
  it('앞 카드가 빠져도 뒤 카드의 DOM 노드가 그대로다', async () => {
    const { queryClient } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(shrinkingRoute()),
    );

    await waitForCards();
    const before = rowOf(7102);
    expect(before).not.toBeNull();

    /*
     * 조건은 그대로 두고 **같은 조회를 다시 부른다.** 조건을 바꾸면 목록 구획이 통째로 대기
     * 상태로 돌아가 DOM이 어차피 새로 서고, key 전략의 차이가 그 안에 묻힌다.
     * 뒤따르는 회차의 「모두 읽음」이 실제로 만드는 경로가 이것이다.
     */
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });

    /* 짝 양성 — 앞 카드가 실제로 빠졌다. */
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: EVENT_NAME_01 })).not.toBeInTheDocument();
    });

    expect(rowOf(7102)).toBe(before);
  });

  it('결과가 0건이면 알림이 없다고 말한다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute([])));

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
  });

  /**
   * ⭐ **「빈 상태로 오인시키지 않는다」의 세 번째 갈래 — 대기.**
   *
   * 실패 갈래와 막힌 기간 갈래는 이미 감지기가 있다. 대기 갈래만 비어 있으면, 빈 상태 판정을
   * 대기 판정보다 앞으로 옮겨도 아무도 울지 않는다 — 시험이 `findBy…`로 **최종 상태만**
   * 기다리기 때문이다. 그 사이에 「받은 알림이 없습니다」가 번쩍이면 사용자는 조건이 잘못된
   * 줄 알고 되돌린다. 첫 진입과 조건 변경마다 반드시 지나는 구간이다.
   *
   * 응답을 붙잡아 그 구간을 실제로 멈춰 세운 뒤 잰다 — 음성 단언(「없다」)을 짝 양성(대기
   * 표시가 서 있다)과 **같은 시점**에 둔다.
   */
  it('조회가 끝나기 전에는 알림이 없다고 말하지 않는다', async () => {
    const { release } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isList,
    );

    expect(await screen.findByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();

    release();

    /* 붙잡은 것을 놓으면 정상 경로로 이어진다 — 대기 표시가 카드로 바뀐다. */
    await waitForCards();
    expect(screen.queryByRole('status', { name: t.loading.list })).not.toBeInTheDocument();
  });

  it('기간이 없는 주소로 들어와도 알림이 없다고 말하지 않는다', async () => {
    /*
     * 첫 진입은 「기간 심기 → 요청 → 응답」이라 대기 구간이 두 번이지만, 이 시험이 잡는 것은
     * **요청을 붙잡은 뒤의 구간 하나**다(심기는 한 순간에 끝나 붙잡을 수단이 없다).
     * 그래도 값이 있다 — 기간 키가 없는 주소에서 출발해도 같은 규율이 지켜지는지 잰다.
     */
    const { release } = renderScreen('/', routesWith(listRoute()), '', isList);

    expect(await screen.findByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();

    release();
    await waitForCards();
  });

  it('한 건만 와도 목록으로 그린다', async () => {
    renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute([notificationFixture({ eventCode: 'SYN-EVENT-09' })])),
    );

    expect(await screen.findByRole('button', { name: 'SYN-EVENT-09' })).toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 조회 실패', () => {
  it('실패를 빈 상태로 오인시키지 않고 배너로 알린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(failingRoute()));

    expect(await screen.findByText('합성 서버 사유')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();
  });

  it('상태 코드에 따라 문구가 갈린다 — 권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(failingRoute(403)));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('다시 시도를 누르면 같은 조건으로 다시 부른다', async () => {
    const { urls, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(failingRoute()),
    );

    await screen.findByText('합성 서버 사유');
    const before = listUrls(urls).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBe(before + 1);
    });
    expect(listUrls(urls).at(-1)?.searchParams.get('occurredFrom')).toContain('2026-08-01');
  });
});

describe('NotificationCenterScreen — 조건 두 축', () => {
  /**
   * ⭐ **「안 읽음만」이 켜진 채로 시작한다**(스펙 §4). 형제 화면들의 boolean 조건은 꺼짐이
   * 기본이라, 그 형태를 그대로 베끼면 이 기본값이 조용히 뒤집힌 채 아무도 울지 않는다.
   */
  it('첫 조회에 안 읽음만 조건이 실린다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(listUrls(urls)[0]?.searchParams.get('unreadOnly')).toBe('true');
  });

  it('「안 읽음만」을 끄면 요청에서 키 자체가 빠진다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('checkbox', { name: t.fields.unreadOnly }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBeGreaterThan(1);
    });

    /* 「전체」에 `unreadOnly=false`를 실으면 요청 URL이 조건이 걸린 것처럼 보인다. */
    expect(listUrls(urls).at(-1)?.searchParams.has('unreadOnly')).toBe(false);
    expect(currentLocation()).toContain('unread=0');
  });

  it('유형을 고르면 그 코드가 요청에 실린다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: EVENT_NAME_02 }));

    await waitFor(() => {
      expect(listUrls(urls).at(-1)?.searchParams.get('eventCode')).toBe('SYN-EVENT-02');
    });
    expect(currentLocation()).toContain('ev=SYN-EVENT-02');
  });

  it('「전체」로 되돌리면 유형 키가 요청에서 빠진다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07&ev=SYN-EVENT-02');

    await waitForCards();

    /* 짝 양성 — 처음에는 실제로 실려 있었다. */
    expect(listUrls(urls)[0]?.searchParams.get('eventCode')).toBe('SYN-EVENT-02');

    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: t.filters.all }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBeGreaterThan(1);
    });
    expect(listUrls(urls).at(-1)?.searchParams.has('eventCode')).toBe(false);
  });

  /** ⭐ 화면이 코드 목록을 지어내면 계약이 바뀌어도 아무도 모른다(스펙 §5-1). */
  it('유형 선택지가 계약 조회에서 온다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));

    expect(await screen.findByRole('option', { name: EVENT_NAME_01 })).toBeInTheDocument();
    expect(urls.some((url) => url.pathname === EVENTS_PATH)).toBe(true);
  });

  /**
   * ⭐ **유형 목록이 없어도 알림 목록은 그려진다.** 화면 전체를 오류로 두면 과잉이다 —
   * 실패한 것은 이름 풀이뿐이고 제목은 원본 코드로 낙하할 뿐이다.
   */
  it('유형 목록 조회가 실패해도 목록은 그려지고 제목이 코드로 낙하한다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', [listRoute(), failingEventsRoute]);

    expect(await screen.findByRole('button', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: t.panes.list })).getAllByRole('listitem'),
    ).toHaveLength(3);
    /* 실패는 조건 줄이 밝힌다 — 목록 자리에 오류 배너를 세우지 않는다. */
    expect(screen.getByText(t.filters.eventsFailed)).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  it('주소로 들어온 유형이 목록에 없어도 조건을 풀 수 있다', async () => {
    /* 스텁은 조건과 무관하게 같은 목록을 준다 — 여기서 재는 것은 선택칸의 내용이다. */
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07&ev=SYN-EVENT-99');

    await waitForCards();
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));

    /* 남기지 않으면 그 조건을 해제할 방법이 선택칸 안에 없어진다. */
    expect(await screen.findByRole('option', { name: 'SYN-EVENT-99' })).toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 쪽 이동', () => {
  const paged = (page: number, total = 137, shown = 50): StubRoute =>
    listRoute(notificationFixtures.slice(0, Math.min(shown, notificationFixtures.length)), {
      page,
      size: 50,
      total,
    });

  it('범위 표기가 응답의 쪽 메타에서 나온다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(paged(1)));

    await waitForCards();

    expect(screen.getByText(t.pageNav.range(1, 3, 137))).toBeInTheDocument();
  });

  it('다음을 누르면 쪽이 주소와 요청에 함께 실린다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(paged(1)));

    await waitForCards();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });
    expect(listUrls(urls).at(-1)?.searchParams.get('page')).toBe('2');
  });

  it('첫 쪽에서는 이전이 잠긴다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(paged(1)));

    await waitForCards();

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
  });

  /** ⭐ 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보인다. */
  it('조건을 바꾸면 쪽이 1로 돌아간다', async () => {
    const { urls, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07&page=3',
      routesWith(paged(3)),
    );

    await waitForCards();
    /* 짝 양성 — 처음에는 실제로 3쪽이었다. */
    expect(listUrls(urls)[0]?.searchParams.get('page')).toBe('3');

    await user.click(screen.getByRole('checkbox', { name: t.fields.unreadOnly }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBeGreaterThan(1);
    });
    expect(listUrls(urls).at(-1)?.searchParams.has('page')).toBe(false);
    expect(currentLocation()).not.toContain('page=');
  });

  it('기간을 바꿔도 쪽이 1로 돌아간다', async () => {
    const { urls, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07&ev=SYN-EVENT-02&page=3',
      routesWith(paged(3)),
    );

    await waitForCards();
    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: t.filters.all }));

    await waitFor(() => {
      expect(listUrls(urls).at(-1)?.searchParams.has('page')).toBe(true);
    }).catch(() => undefined);

    expect(listUrls(urls).at(-1)?.searchParams.has('page')).toBe(false);
  });

  /**
   * ⭐ **결과가 있는데 이 쪽에 없는 것은 0건과 다르다.** 같은 안내로 두면 사용자가 조건을
   * 헛되이 넓힌다 — 넓혀도 그 쪽에는 여전히 아무것도 없다.
   */
  it('결과가 있는데 이 쪽에 없으면 0건과 다른 안내가 선다', async () => {
    renderScreen(
      '/?from=2026-08-01&to=2026-08-07&page=9',
      routesWith(listRoute([], { page: 9, size: 50, total: 137 })),
    );

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();
  });

  it('넘어선 쪽에서 첫 쪽으로 되돌릴 수 있다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07&page=9',
      routesWith(listRoute([], { page: 9, size: 50, total: 137 })),
    );

    await screen.findByText(t.empty.beyondLastTitle);
    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('page=');
    });
  });

  it('0건에는 넘어선 쪽 안내를 내지 않는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute([])));

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  /** ⭐ 주소는 손으로 고쳐지는 자리다. 22자리는 자바스크립트가 지수 표기로 바꿔 서버가 못 읽는다. */
  it('이상한 쪽 번호는 요청에 실리지 않는다', async () => {
    for (const raw of ['0', '-1', 'abc', '1111111111111111111111']) {
      const { urls, unmount } = renderScreen(`/?from=2026-08-01&to=2026-08-07&page=${raw}`);

      await waitForCards();

      expect(listUrls(urls)[0]?.searchParams.has('page')).toBe(false);
      unmount();
    }
  });
});

describe('NotificationCenterScreen — 기준 시각', () => {
  it('응답이 도착하면 기준 시각이 선다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByText(/^기준 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  /** ⭐ 아직 받은 자료가 없으면 `dataUpdatedAt`이 `0`이다 — 그리면 1970년이 선다. */
  it('조회가 끝나기 전에는 기준 시각을 내지 않는다', async () => {
    const { release } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isList,
    );

    /* 짝 양성 — 대기 구간을 실제로 잡았다. */
    expect(await screen.findByRole('status', { name: t.loading.list })).toBeInTheDocument();
    expect(screen.queryByText(/^기준 /)).not.toBeInTheDocument();

    release();
    await waitForCards();
  });

  it('조회에 실패하면 기준 시각을 내지 않는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(failingRoute()));

    await screen.findByText('합성 서버 사유');

    expect(screen.queryByText(/^기준 /)).not.toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 조건 줄의 수명', () => {
  /**
   * ⭐ **조회에 실패해도 조건 줄은 남는다.** T1은 조건 줄이 없어 실패 시 구획 자체를 그리지
   * 않았는데, 이제 감추면 **사용자가 실패에서 빠져나올 수단이 사라진다** — 기간을 좁히거나
   * 조건을 푸는 것이 그 자리에서 할 수 있는 유일한 조치다.
   */
  it('조회에 실패해도 조건 줄이 남는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(failingRoute()));

    await screen.findByText('합성 서버 사유');

    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
  });

  it('막힌 기간에서도 조건 줄이 남는다', async () => {
    renderScreen('/?from=2026-08-07&to=2026-08-01');

    expect(await screen.findByText(t.reasons.periodReversed)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.period)).toBeInTheDocument();
  });

  it('결과가 0건이어도 조건 줄이 남는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute([])));

    await screen.findByText(t.empty.noneTitle);

    expect(screen.getByRole('combobox', { name: t.fields.eventCode })).toBeInTheDocument();
  });

  it('막힌 기간의 사유가 보조 기술에 알려진다', async () => {
    renderScreen('/?from=2026-08-07&to=2026-08-01');

    /*
     * 조건 줄이 생겨 이 안내는 화면 안에서 동적으로 나타난다 — `live`가 없으면 알려지지 않는다.
     * 사유가 **그 live 구획 안에** 있어야 뜻이 있다(밖에 있으면 낭독되지 않는다).
     */
    const status = await within(screen.getByRole('region', { name: t.panes.list })).findByRole(
      'status',
    );

    expect(status).toHaveTextContent(t.empty.blockedTitle);
    expect(status).toHaveTextContent(t.reasons.periodReversed);
  });

  it('조회에 실패하면 쪽 이동을 내지 않는다 — 옮길 쪽이 없다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(failingRoute()));

    await screen.findByText('합성 서버 사유');

    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).not.toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 화면과 조건 줄의 이음매', () => {
  /**
   * ⭐ **주소 → prop 이음매를 화면 수준에서 잰다.**
   *
   * 부품 시험은 **prop → 표시**를 고정하고, 다른 화면 시험들은 **주소 → 요청**을 고정한다.
   * 그 사이의 「주소 → prop」만 아무도 재지 않으면, 조건 줄에 고정값을 넘겨도 전부 통과한다 —
   * 사용자에게는 **공유받은 주소를 열었을 때 목록은 그 조건으로 조회되는데 조건 줄은 기본
   * 상태로 보이는** 것으로 나타난다. 컨트롤이 현재 조건을 거짓으로 말하는 상태다.
   */
  it('조건이 걸린 주소로 들어오면 조건 줄이 그 값을 되비춘다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07&unread=0&ev=SYN-EVENT-02');

    await waitForCards();

    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: t.fields.eventCode })).toHaveTextContent(
      EVENT_NAME_02,
    );
  });

  it('기본 조건으로 들어오면 조건 줄도 기본 상태다 — 짝 양성', async () => {
    /* 위 단언이 「늘 꺼져 보인다」로도 통과하지 않게, 반대 상태를 같은 방법으로 잰다. */
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByRole('checkbox', { name: t.fields.unreadOnly })).toBeChecked();
    expect(screen.getByRole('combobox', { name: t.fields.eventCode })).toHaveTextContent(
      t.filters.all,
    );
  });

  it('주소의 기간이 조건 줄에 그대로 선다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByLabelText(t.fields.period)).toHaveTextContent('2026-08-01');
    expect(screen.getByLabelText(t.fields.period)).toHaveTextContent('2026-08-07');
  });
});

describe('NotificationCenterScreen — 쪽 이동은 쪽만 바꾼다', () => {
  const CONDITIONED = '/?from=2026-08-01&to=2026-08-07&unread=0&ev=SYN-EVENT-02&page=2';

  const pagedRoute = (): StubRoute =>
    listRoute(notificationFixtures, { page: 2, size: 50, total: 137 });

  /**
   * ⭐ **주소 키 수명 표 5행의 「그대로」 절반.**
   *
   * 4행(조건 변경 → 쪽 1로)은 감지기가 있는데 역방향이 비어 있었다 — 쪽을 옮기며 조건을
   * 함께 풀어도 아무도 울지 않았다. 사용자에게는 「다음을 눌렀더니 걸어 둔 유형이 사라졌다」로
   * 나타나고, 뒤따르는 회차가 조건·쪽에 매어 둘 상태(읽음 집합)의 수명까지 함께 흔들린다.
   */
  it('다음을 눌러도 두 조건이 요청에 그대로 실린다', async () => {
    const { urls, user } = renderScreen(CONDITIONED, routesWith(pagedRoute()));

    await waitForCards();

    /*
     * 짝 양성 — 처음부터 두 조건이 **주소가 말한 대로** 요청에 반영돼 있었다.
     * 「안 읽음만」은 꺼진 상태라 **키가 없는 것**이 그 반영이고(전체에는 키를 싣지 않는다),
     * 유형은 값이 실린 것이 그 반영이다. 둘의 모양이 다르므로 각각 그 모양으로 잰다.
     */
    expect(listUrls(urls)[0]?.searchParams.has('unreadOnly')).toBe(false);
    expect(listUrls(urls)[0]?.searchParams.get('eventCode')).toBe('SYN-EVENT-02');

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(listUrls(urls).at(-1)?.searchParams.get('page')).toBe('3');
    });

    const last = listUrls(urls).at(-1);
    expect(last?.searchParams.get('eventCode')).toBe('SYN-EVENT-02');
    expect(last?.searchParams.has('unreadOnly')).toBe(false);
  });

  it('이전을 눌러도 두 조건이 요청에 그대로 실린다', async () => {
    const { urls, user } = renderScreen(CONDITIONED, routesWith(pagedRoute()));

    await waitForCards();
    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBeGreaterThan(1);
    });

    const last = listUrls(urls).at(-1);
    expect(last?.searchParams.get('eventCode')).toBe('SYN-EVENT-02');
    expect(last?.searchParams.has('unreadOnly')).toBe(false);
  });

  it('쪽을 옮겨도 조건 두 키가 주소에 남는다', async () => {
    const { user } = renderScreen(CONDITIONED, routesWith(pagedRoute()));

    await waitForCards();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=3');
    });

    expect(currentLocation()).toContain('unread=0');
    expect(currentLocation()).toContain('ev=SYN-EVENT-02');
  });

  /** 6행 — 「첫 쪽으로」도 조건을 건드리지 않는다. 쪽만 되돌린다. */
  it('첫 쪽으로 되돌려도 두 조건이 남는다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07&unread=0&ev=SYN-EVENT-02&page=9',
      routesWith(listRoute([], { page: 9, size: 50, total: 137 })),
    );

    await screen.findByText(t.empty.beyondLastTitle);
    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('page=');
    });

    expect(currentLocation()).toContain('unread=0');
    expect(currentLocation()).toContain('ev=SYN-EVENT-02');
  });
});

/** 나간 쓰기 요청만 고른다. 주소만 보면 메서드가 안 담겨 조회와 섞인다. */
const writesOf = (requests: Request[], match: (request: Request) => boolean): Request[] =>
  requests.filter(match);

describe('NotificationCenterScreen — 읽음 처리', () => {
  /** 첫 알림(7101)은 안 읽음, 둘째(7102)는 읽음이다 — 픽스처가 두 갈래를 함께 담는다. */
  const UNREAD_CARD = EVENT_NAME_01;
  const READ_CARD = EVENT_NAME_02;

  it('안 읽은 카드를 누르면 그 번호로 읽음 처리를 보낸다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    await waitFor(() => {
      expect(writesOf(requests, isMarkRead)).toHaveLength(1);
    });

    const sent = writesOf(requests, isMarkRead)[0];
    expect(new URL(sent?.url ?? '').pathname).toBe('/app/notifications/7101:read');
    expect(sent?.method).toBe('POST');
  });

  /** 계약이 전 쓰기에 멱등 키를 요구한다. 같은 시도의 재시도가 새 키를 얻으면 다른 요청이 된다. */
  it('멱등 키를 UUID로 실어 보낸다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    await waitFor(() => {
      expect(writesOf(requests, isMarkRead)).toHaveLength(1);
    });

    expect(writesOf(requests, isMarkRead)[0]?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  /**
   * ⭐ **T3-2 — 성공해도 목록을 다시 부르지 않는다**(결정 ⑤).
   *
   * 기본 조건이 「안 읽음만」이라 무효화는 곧 **방금 누른 카드의 사라짐**이다. 게다가 캐시 키가
   * 바뀌면 목록 구획이 통째로 다시 서서 앞 회차가 세운 DOM 보증(T1-7)까지 무너진다.
   */
  it('성공해도 목록을 다시 부르지 않고 그 카드가 남는다', async () => {
    const { urls, requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    const listCallsBefore = listUrls(urls).length;
    const cardBefore = rowOf(7101);

    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    await waitFor(() => {
      expect(writesOf(requests, isMarkRead)).toHaveLength(1);
    });
    /* 읽음 표시가 실제로 바뀐 뒤에 잰다 — 음성 단언이 「아직 안 왔다」로 헛통과하지 않게. */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.read).length).toBeGreaterThan(1);
    });

    expect(listUrls(urls).length).toBe(listCallsBefore);
    expect(screen.getByRole('button', { name: UNREAD_CARD })).toBeInTheDocument();
    /* 카드가 새로 서지도 않았다 — 같은 DOM 노드 그대로다. */
    expect(rowOf(7101)).toBe(cardBefore);
  });

  it('성공하면 그 카드만 읽음으로 바뀐다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    /* 짝 양성 — 처음에는 안 읽음이 둘이다(7101 · 7103). */
    expect(screen.getAllByText(t.card.unread)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });
    expect(writesOf(requests, isMarkRead)).toHaveLength(1);
  });

  /** ⭐ T3-3 — 음성 단언을 **짝 양성 뒤 시점**에 잰다. */
  it('이미 읽은 카드를 눌러도 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    /* 짝 양성 — 안 읽은 카드는 실제로 요청을 낸다. */
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));
    await waitFor(() => {
      expect(writesOf(requests, isMarkRead)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: READ_CARD }));
    /* 방금 읽음으로 바뀐 카드도 같다 — 서버 값이 아니라 화면 판정으로 막는다. */
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    expect(writesOf(requests, isMarkRead)).toHaveLength(1);
  });

  /** ⭐ T3-5 — 진행 중인 카드만 잠기고 다른 카드는 계속 누를 수 있다. */
  it('나가는 중에는 그 카드만 잠긴다', async () => {
    const { release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkRead,
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: UNREAD_CARD })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    /* 다른 카드는 잠기지 않는다 — 불리언 하나로 두면 여기가 함께 잠긴다. */
    expect(screen.getByRole('button', { name: 'SYN-EVENT-03' })).not.toHaveAttribute(
      'aria-disabled',
    );

    release();
  });

  /** ⭐ T3-6 — 실패하면 배너가 서고 **그 카드의 읽음 표시가 바뀌지 않는다.** */
  it('실패하면 배너가 서고 읽음 표시가 바뀌지 않는다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadRoute(403)),
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.getByText(t.writeError.readTitle)).toBeInTheDocument();
    /* 성공한 것만 집합에 든다 — 안 읽음 둘이 그대로다. */
    expect(screen.getAllByText(t.card.unread)).toHaveLength(2);
  });

  it('없는 알림에는 다른 사유를 낸다 — 목록이 낡았을 때 나는 갈래다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadRoute(404)),
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    expect(await screen.findByText(t.writeError.notFound)).toBeInTheDocument();
  });

  /** ⭐ T3-4 — 조건이 바뀌면 「이 회차에 읽음 처리한 번호」가 비워진다. */
  it('조건이 바뀌면 읽음 집합이 비워지고 서버 값이 정본이 된다', async () => {
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('button', { name: UNREAD_CARD }));

    /* 짝 양성 — 집합이 실제로 얹혔다(안 읽음이 둘에서 하나로). */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });

    await user.click(screen.getByRole('combobox', { name: t.fields.eventCode }));
    await user.click(await screen.findByRole('option', { name: EVENT_NAME_02 }));

    /* 새 결과가 왔다 — 서버 값 그대로 안 읽음이 둘이다. */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(2);
    });
  });
});

describe('NotificationCenterScreen — 모두 읽음', () => {
  const markAllButton = () => screen.getByRole('button', { name: t.actions.markAllRead });

  /** ⭐ T3-7 — 판정이 **전용 조회**에서 온다. 목록을 세면 다른 쪽의 안 읽음이 빠진다. */
  it('안 읽은 수가 0이면 잠기고 사유가 보인다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute(), unreadCountRoute(0)));

    await waitForCards();

    expect(markAllButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.nothingUnread)).toBeInTheDocument();
  });

  it('안 읽은 수가 1 이상이면 열린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(listRoute(), unreadCountRoute(3)));

    await waitForCards();

    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    expect(screen.queryByText(t.actionReasons.nothingUnread)).not.toBeInTheDocument();
  });

  it('전용 조회를 부른다 — 목록을 세지 않는다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    await waitFor(() => {
      expect(urls.some((url) => url.pathname === UNREAD_COUNT_PATH)).toBe(true);
    });
  });

  it('안 읽은 수를 아직 받지 못했으면 잠긴 채로 둔다', async () => {
    const { release } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isUnreadCount,
    );

    await waitForCards();

    /* 근거 없이 여는 것은 안 읽은 것이 있는지 모르는데 조작을 허락하는 일이다. */
    expect(markAllButton()).toBeDisabled();

    release();
  });

  it('누르면 멱등 키를 실어 보낸다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    await user.click(markAllButton());

    await waitFor(() => {
      expect(writesOf(requests, isMarkAllRead)).toHaveLength(1);
    });
    expect(writesOf(requests, isMarkAllRead)[0]?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}/i,
    );
  });

  /** ⭐ T3-8 — 성공하면 **서버가 준 건수**를 알린다. 화면이 세면 다른 쪽의 건이 빠진다. */
  it('성공하면 바뀐 건수를 알린다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markAllReadRoute(7)),
    );

    await waitForCards();
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    await user.click(markAllButton());

    expect(await screen.findByText(t.toast.allRead(7))).toBeInTheDocument();
  });

  /**
   * ⭐ **T3-8·T3-9 — 여기서는 무효화한다(읽음 처리 하나와 반대다).**
   *
   * 재조회 스텁이 **호출 횟수에 따라 내용까지** 달라진다 — 같은 구조를 되돌리는 스텁으로는
   * 「목록을 다시 불렀다」와 「아무 일도 없었다」가 구분되지 않아 이 감지기가 헛통과한다.
   */
  it('성공하면 목록과 안 읽은 수를 다시 부르고 내용이 갱신된다', async () => {
    let listCalls = 0;
    const shrinkingList: StubRoute = {
      match: isList,
      respond: () => {
        listCalls += 1;

        return jsonResponse(
          notificationListBody(
            listCalls === 1 ? notificationFixtures : [notificationFixture({ read: true })],
          ),
        );
      },
    };
    let countCalls = 0;
    const drainingCount: StubRoute = {
      match: isUnreadCount,
      respond: () => {
        countCalls += 1;

        return jsonResponse({ unreadCount: countCalls === 1 ? 2 : 0 });
      },
    };

    const { urls, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(shrinkingList, drainingCount),
    );

    await waitForCards();
    const listCallsBefore = listUrls(urls).length;
    /* 짝 양성 — 처음에는 카드가 셋이고 버튼이 열려 있다. */
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });

    await user.click(markAllButton());

    await waitFor(() => {
      expect(listUrls(urls).length).toBeGreaterThan(listCallsBefore);
    });
    /* 내용까지 달라졌다 — 카드가 하나로 줄고 안 읽음이 사라졌다. */
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: t.panes.list })).getAllByRole('listitem'),
      ).toHaveLength(1);
    });
    expect(screen.queryByText(t.card.unread)).not.toBeInTheDocument();
    /* 안 읽은 수도 다시 불러 버튼이 잠긴다 — 두지 않으면 눌러도 열린 채로 남는다. */
    await waitFor(() => {
      expect(markAllButton()).toBeDisabled();
    });
  });

  it('나가는 중에는 잠기고 그 사유가 보인다', async () => {
    const { release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkAllRead,
    );

    await waitForCards();
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    await user.click(markAllButton());

    await waitFor(() => {
      expect(screen.getByText(t.actionReasons.markingAllRead)).toBeInTheDocument();
    });
    expect(markAllButton()).toBeDisabled();

    release();
  });

  it('실패하면 다른 제목의 배너가 선다', async () => {
    const failingAll: StubRoute = {
      match: isMarkAllRead,
      respond: () => jsonResponse({ message: '합성 쓰기 사유' }, { status: 500 }),
    };
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), failingAll),
    );

    await waitForCards();
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    await user.click(markAllButton());

    expect(await screen.findByText(t.writeError.allReadTitle)).toBeInTheDocument();
    expect(screen.getByText('합성 쓰기 사유')).toBeInTheDocument();
    /* 읽음 처리 실패와 제목이 갈린다 — 어느 조작이 막혔는지 알 수 있어야 한다. */
    expect(screen.queryByText(t.writeError.readTitle)).not.toBeInTheDocument();
  });

  /** ⭐ T3-11 — 모두 읽음 뒤 안 읽음 목록이 비어도 화면이 무너지지 않는다. */
  it('모두 읽음 뒤 목록이 비면 빈 상태가 선다', async () => {
    let listCalls = 0;
    const emptyingList: StubRoute = {
      match: isList,
      respond: () => {
        listCalls += 1;

        return jsonResponse(notificationListBody(listCalls === 1 ? notificationFixtures : []));
      },
    };
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', routesWith(emptyingList));

    await waitForCards();
    await waitFor(() => {
      expect(markAllButton()).toBeEnabled();
    });
    await user.click(markAllButton());

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 앞 조회에 매인 진술의 수명', () => {
  const failingRead = (): StubRoute[] => routesWith(listRoute(), markReadRoute(403));

  /**
   * ⭐ **실패 진술은 「그 목록의 그 알림」에 대한 말이다.**
   *
   * 조건이 바뀌어 그 알림이 화면에 없는데 배너만 남으면, 사용자는 **지금 보이는 것들이
   * 실패한 줄로** 읽는다. 거두는 자리는 `resetIfIdle`을 지난다 — 나가는 중인 쓰기의
   * 되먹임을 끊지 않기 위해서다.
   */
  it('조건이 바뀌면 읽음 처리 실패 배너가 거둬진다', async () => {
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', failingRead());

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    /* 짝 양성 — 배너가 실제로 섰다. */
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: t.fields.unreadOnly }));

    await waitFor(() => {
      expect(screen.queryByText(t.writeError.readTitle)).not.toBeInTheDocument();
    });
  });

  it('쪽을 옮겨도 실패 배너가 거둬진다', async () => {
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', [
      listRoute(notificationFixtures, { page: 1, size: 50, total: 137 }),
      ...failingRead().slice(1),
    ]);

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(screen.queryByText(t.writeError.readTitle)).not.toBeInTheDocument();
    });
  });

  /** 같은 조회 안에서는 남는다 — 거두는 조건이 「조회가 바뀌었을 때」임을 가른다. */
  it('같은 조회 안에서는 실패 배너가 남는다', async () => {
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', failingRead());

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    /* 다른 카드를 눌러도 조회는 그대로다 — 배너가 사라지면 사용자가 실패를 놓친다. */
    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));

    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 나가는 중인 쓰기를 끊지 않는다', () => {
  /**
   * ⭐ **T3-10 — 거둠이 진행 중인 쓰기를 건드리면 안 된다**(사본 체크리스트 · `omf-mes#96`).
   *
   * 조건이 바뀌면 화면은 앞 조회에 매인 진술을 거두는데, 그 거둠이 **나가는 중인 쓰기의
   * 되먹임까지 끊으면** 서버는 읽음으로 바꿨는데 화면은 없던 일로 친다. 그 알림은 그때부터
   * **안 읽음으로 보이는데 다시 눌러도 아무 일도 일어나지 않는** 상태가 된다(서버에는 이미
   * 읽음이라 다시 눌러도 표시가 바뀔 근거가 없다).
   *
   * 요청을 붙잡아 **그 사이에 조건을 바꾸고** 놓아 준 뒤, 되먹임이 살아 있었는지를 잰다.
   */
  it('나가는 중에 조건이 바뀌어도 성공 되먹임이 살아 있다', async () => {
    const { release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkRead,
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    /* 짝 양성 — 요청이 실제로 붙잡혀 있다(그 카드가 잠겼다). */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: EVENT_NAME_01 })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    /* 나가는 중에 조건이 바뀐다 — 거둠이 여기서 돈다. */
    await user.click(screen.getByRole('checkbox', { name: t.fields.unreadOnly }));

    release();

    /*
     * 되먹임이 살아 있으면 그 알림이 읽음으로 바뀐다. 끊겼다면 안 읽음인 채로 남는다 —
     * 서버는 이미 바꿨는데 화면만 모르는 상태다.
     */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });
  });
});

/** 번호별로 다른 답을 주는 스텁. 「어느 카드의 결과인가」를 가르려면 답이 갈려야 한다. */
const markReadByIdRoute = (failing: readonly number[]): StubRoute => ({
  match: isMarkRead,
  respond: (request) => {
    const id = Number(/\/(\d+):read$/.exec(new URL(request.url).pathname)?.[1] ?? '0');

    return failing.includes(id)
      ? jsonResponse({ message: '' }, { status: 403 })
      : new Response(null, { status: 204 });
  },
});

/** 두 번째 시도부터 붙잡는다 — 「다시 보내는 중」의 화면을 잡기 위한 자리다. */
let attempts = 0;

describe('NotificationCenterScreen — 여러 장을 동시에 처리한다', () => {
  const keysOf = (requests: Request[]): (string | null)[] =>
    requests.filter(isMarkRead).map((request) => request.headers.get('Idempotency-Key'));

  /**
   * ⭐ **T3-5의 나머지 절반.** 앞 회차는 「다른 카드가 잠기지 않는다」만 재고 **누르지
   * 않았다** — 그래서 잠기지 않은 카드의 클릭이 훅에서 조용히 버려지는 것을 아무도 잡지
   * 못했다(검증이 탐침으로 실측). 잠그지 않음으로써 「누를 수 있다」고 말해 놓고 아무 일도
   * 하지 않는 것은 되먹임이 없는 결함이다.
   */
  it('나가는 중에 다른 카드를 누르면 그 요청도 나간다', async () => {
    const { requests, release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkRead,
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    /* 짝 양성 — 첫 요청이 실제로 붙잡혀 그 카드가 잠겼다. */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: EVENT_NAME_01 })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
    /* 다른 카드는 잠기지 않았다 — 그러니 눌리면 나가야 한다. */
    expect(screen.getByRole('button', { name: 'SYN-EVENT-03' })).not.toHaveAttribute(
      'aria-disabled',
    );

    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));

    await waitFor(() => {
      expect(requests.filter(isMarkRead)).toHaveLength(2);
    });

    release();
  });

  it('둘째 카드도 자기 것만 잠근다', async () => {
    const { release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkRead,
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SYN-EVENT-03' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
    /* 읽은 카드는 애초에 나갈 일이 없어 잠기지 않는다 — 전역 잠금이면 여기가 함께 잠긴다. */
    expect(screen.getByRole('button', { name: EVENT_NAME_02 })).not.toHaveAttribute(
      'aria-disabled',
    );

    release();
  });

  /**
   * ⭐ **Z2 — 멱등 키의 유일성.**
   *
   * 앞 회차는 형식(UUID 정규식)만 쟀다. 두 알림이 같은 키를 쓰면 서버가 두 번째를 **앞 요청의
   * 재생으로 삼켜** 그 알림은 바뀌지 않는데 화면은 바뀌었다고 말한다.
   */
  it('카드마다 다른 멱등 키를 쓴다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    await waitFor(() => {
      expect(requests.filter(isMarkRead)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));
    await waitFor(() => {
      expect(requests.filter(isMarkRead)).toHaveLength(2);
    });

    const keys = keysOf(requests);
    expect(keys[0]).not.toBe(keys[1]);
    expect(new Set(keys).size).toBe(2);
  });

  /** 성공·실패가 **그 번호의 카드에만** 반영된다 — 집합으로 바꾼 형태의 요점이다. */
  it('한 장이 실패해도 다른 장의 성공은 그대로 반영된다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadByIdRoute([7101])),
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));

    /* 실패한 쪽은 배너가 서고 안 읽음으로 남는다. */
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();
    /* 성공한 쪽만 읽음으로 바뀐다 — 안 읽음이 둘에서 하나로. */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });
    expect(screen.getByRole('button', { name: EVENT_NAME_01 })).toBeInTheDocument();
  });

  /**
   * ⭐ **Z5 — 끝나면 그 번호가 집합에서 빠진다.**
   *
   * 빠지지 않으면 그 카드가 잠긴 채로 남아 **다시 누를 수 없고**, 쓰기 실패 배너가
   * 「다시 시도」를 두지 않은 전제(카드를 다시 누르면 된다)가 무너진다.
   */
  it('실패한 카드를 다시 누를 수 있다', async () => {
    const { requests, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadRoute(403)),
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    /* 짝 양성 — 실패가 실제로 났다. */
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    /* 잠기지 않았다 — 그래야 다시 누를 수 있다. */
    expect(screen.getByRole('button', { name: EVENT_NAME_01 })).not.toHaveAttribute(
      'aria-disabled',
    );

    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    await waitFor(() => {
      expect(requests.filter(isMarkRead)).toHaveLength(2);
    });
  });

  it('성공한 카드는 다시 눌러도 나가지 않는다 — 잠금이 아니라 상태로 막는다', async () => {
    const { requests, user } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });
    /* 끝났으므로 잠기지 않는다. 그래도 요청이 늘지 않는 것은 이미 읽음이기 때문이다. */
    expect(screen.getByRole('button', { name: EVENT_NAME_01 })).not.toHaveAttribute(
      'aria-disabled',
    );

    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    expect(requests.filter(isMarkRead)).toHaveLength(1);
  });

  /**
   * ⭐ **「모두 읽음」과 개별 읽음 처리의 경계.**
   *
   * 그 조작이 곧 **모든 카드를 읽음으로 바꾸므로** 개별 클릭은 무의미하고, 두 조작이 겹치면
   * 어느 것의 결과인지 사용자가 가릴 수 없다. 그래서 **잠근다 — 다만 잠긴 것이 보이게** 잠근다.
   * 조용히 버리는 형태(잠기지 않았는데 눌러도 아무 일이 없다)가 이 회차가 고친 결함이다.
   */
  it('「모두 읽음」이 나가는 중에는 카드가 잠긴다', async () => {
    const { requests, release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute()),
      '',
      isMarkAllRead,
    );

    await waitForCards();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.markAllRead })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: t.actions.markAllRead }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: EVENT_NAME_01 })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    expect(requests.filter(isMarkRead)).toHaveLength(0);

    release();
  });
});

describe('describeMarkAllReadReason', () => {
  it('안 읽은 것이 있으면 열린다', () => {
    expect(describeMarkAllReadReason(false, 3)).toBeUndefined();
  });

  it('안 읽은 수가 0이면 그 사유로 잠근다', () => {
    expect(describeMarkAllReadReason(false, 0)).toBe(t.actionReasons.nothingUnread);
  });

  it('아직 그 수를 받지 못했으면 잠근다 — 없는 근거로 조작을 허락하지 않는다', () => {
    expect(describeMarkAllReadReason(false, undefined)).toBe(t.actionReasons.nothingUnread);
  });

  it('나가는 중이면 그 사유로 잠근다', () => {
    expect(describeMarkAllReadReason(true, 3)).toBe(t.actionReasons.markingAllRead);
  });

  /**
   * ⭐ **순서가 뜻을 정한다 — 나가는 중이 안 읽은 수보다 앞선다.**
   *
   * 보낸 직후에는 아직 그 수가 갱신되지 않아 둘이 함께 참일 수 있다. 그때 「안 읽은 알림이
   * 없습니다」라고 말하면 방금 누른 조작이 **이미 끝난 것처럼** 읽힌다. 화면 조작으로는 이
   * 조합에 닿기가 매우 좁아(쓰기 진행 중 재조회가 0을 돌려주는 순간) 여기서 규격을 고정한다.
   */
  it('둘이 함께 참이면 나가는 중이 이긴다', () => {
    expect(describeMarkAllReadReason(true, 0)).toBe(t.actionReasons.markingAllRead);
    expect(describeMarkAllReadReason(true, undefined)).toBe(t.actionReasons.markingAllRead);
  });
});

describe('NotificationCenterScreen — 실패 진술은 그 알림의 것이다', () => {
  /**
   * ⭐ **전례의 「새 시도가 앞 시도의 진술을 지운다」가 여기서 거짓인 자리.**
   *
   * 그 규율이 참인 이유는 그 화면들의 쓰기가 **한 번에 하나**라 앞 진술이 늘 같은 대상에 대한
   * 말이기 때문이다. 여러 장이 동시에 나가는 이 화면에서는, 다른 카드를 누른 것이 앞 실패를
   * 지우면 사용자는 자기가 본 실패가 왜 사라졌는지 알 수 없다.
   */
  it('다른 카드를 눌러도 앞 카드의 실패 진술이 남는다', async () => {
    const { user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadByIdRoute([7101])),
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'SYN-EVENT-03' }));

    /* 성공한 쪽이 반영된 뒤에도 앞 실패는 그 자리에 있다. */
    await waitFor(() => {
      expect(screen.getAllByText(t.card.unread)).toHaveLength(1);
    });
    expect(screen.getByText(t.writeError.readTitle)).toBeInTheDocument();
  });

  it('같은 카드를 다시 누르면 앞 진술이 지워진다', async () => {
    const { release, user } = renderScreen(
      '/?from=2026-08-01&to=2026-08-07',
      routesWith(listRoute(), markReadRoute(403)),
      '',
      (request) => isMarkRead(request) && attempts > 0,
    );

    await waitForCards();
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));
    expect(await screen.findByText(t.writeError.readTitle)).toBeInTheDocument();

    attempts = 1;
    await user.click(screen.getByRole('button', { name: EVENT_NAME_01 }));

    /* 다시 보내는 중에는 앞 판정이 남아 있지 않다 — 방금 누른 것에 대한 말이 아니다. */
    await waitFor(() => {
      expect(screen.queryByText(t.writeError.readTitle)).not.toBeInTheDocument();
    });

    release();
  });
});
