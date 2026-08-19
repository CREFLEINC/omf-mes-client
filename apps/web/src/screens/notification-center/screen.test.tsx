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
import { NotificationCenterScreen } from './screen';

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

/** 목록 규칙에 유형 조회를 **늘 함께 둔다** — 스텁에 없는 요청은 하네스가 던진다. */
const routesWith = (...routes: StubRoute[]): StubRoute[] => [...routes, eventsRoute];

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
): { fetch: StubFetch; urls: URL[]; release: () => void } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);
  const holders: Array<() => void> = [];

  return {
    urls,
    release: () => {
      holders.forEach((resolve) => {
        resolve();
      });
      holders.length = 0;
    },
    fetch: async (request) => {
      urls.push(new URL(request.url));

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
  const { fetch, urls, release } = recordingFetch(routes, hold);
  const result = renderWithProviders(
    <>
      <NotificationCenterScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route },
  );

  return { ...result, urls, release, user: userEvent.setup() };
};

/**
 * 카드가 실제로 섰음을 잡는 시점. 음성 단언은 이 시점 뒤에 잰다.
 *
 * **푼 이름으로 찾는다** — 코드로 찾으면 이름 풀이가 통째로 죽어도 이 대기가 통과한다.
 */
const waitForCards = async (): Promise<void> => {
  await screen.findByRole('group', { name: EVENT_NAME_01 });
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

    expect(screen.getAllByRole('group')).toHaveLength(3);
    expect(screen.getByRole('group', { name: EVENT_NAME_02 })).toBeInTheDocument();
    /* 유형 목록에 없는 코드는 원문 그대로가 이름이다. */
    expect(screen.getByRole('group', { name: 'SYN-EVENT-03' })).toBeInTheDocument();
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
      expect(screen.queryByRole('group', { name: EVENT_NAME_01 })).not.toBeInTheDocument();
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

    expect(await screen.findByRole('group', { name: 'SYN-EVENT-09' })).toBeInTheDocument();
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

    expect(await screen.findByRole('group', { name: 'SYN-EVENT-01' })).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(3);
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
