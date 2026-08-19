import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor } from '@testing-library/react';
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
import { notificationFixture, notificationFixtures, notificationListBody } from './fixtures';
import { titleIdOf } from './notification-card';
import { defaultPeriod } from './period';
import { notificationKeys } from './queries';
import { NotificationCenterScreen } from './screen';

const t = messages.notificationCenter;

const LIST_PATH = '/app/notifications';

const isList = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === LIST_PATH;

const listRoute = (items = notificationFixtures): StubRoute => ({
  match: isList,
  respond: () => jsonResponse(notificationListBody(items)),
});

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

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

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

const renderScreen = (route = '/', routes: StubRoute[] = [listRoute()], navigateTo = '') => {
  const { fetch, urls } = recordingFetch(routes);
  const result = renderWithProviders(
    <>
      <NotificationCenterScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route },
  );

  return { ...result, urls, user: userEvent.setup() };
};

/** 카드가 실제로 섰음을 잡는 시점. 음성 단언은 이 시점 뒤에 잰다. */
const waitForCards = async (): Promise<void> => {
  await screen.findByRole('group', { name: 'SYN-EVENT-01' });
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

  it('주소에 있던 기간은 덮지 않는다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(currentLocation()).toBe('/?from=2026-08-01&to=2026-08-07');
    expect(listUrls(urls)).toHaveLength(1);
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
    const { user } = renderScreen('/?from=2026-08-01&to=2026-08-07', [listRoute()], '');

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

  it('한쪽만 채운 기간도 막는다', async () => {
    const { urls } = renderScreen('/?from=2026-08-01');

    expect(await screen.findByText(t.reasons.periodInvalid)).toBeInTheDocument();
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
  it('알림마다 이벤트 코드 · 시각 · 본문 · 읽음 표시를 그린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07');

    await waitForCards();

    expect(screen.getByText('SYN-EVENT-01')).toBeInTheDocument();
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
    expect(screen.getByRole('group', { name: 'SYN-EVENT-02' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'SYN-EVENT-03' })).toBeInTheDocument();
  });

  /**
   * ⭐ **T1-7.** 카드 목록의 key가 배열 인덱스면 앞 카드가 빠질 때 뒤 카드가 앞 카드의 DOM
   * 자리로 옮겨 붙는다 — 그 자리에 있던 포커스와 상태가 다른 알림의 것이 된다.
   * 뒤따르는 회차의 「모두 읽음」이 정확히 그 경로를 만든다.
   */
  it('앞 카드가 빠져도 뒤 카드의 DOM 노드가 그대로다', async () => {
    const { queryClient } = renderScreen('/?from=2026-08-01&to=2026-08-07', [shrinkingRoute()]);

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
      expect(screen.queryByRole('group', { name: 'SYN-EVENT-01' })).not.toBeInTheDocument();
    });

    expect(rowOf(7102)).toBe(before);
  });

  it('결과가 0건이면 알림이 없다고 말한다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', [listRoute([])]);

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
  });

  it('한 건만 와도 목록으로 그린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', [
      listRoute([notificationFixture({ eventCode: 'SYN-EVENT-09' })]),
    ]);

    expect(await screen.findByRole('group', { name: 'SYN-EVENT-09' })).toBeInTheDocument();
  });
});

describe('NotificationCenterScreen — 조회 실패', () => {
  it('실패를 빈 상태로 오인시키지 않고 배너로 알린다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', [failingRoute()]);

    expect(await screen.findByText('합성 서버 사유')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noneTitle)).not.toBeInTheDocument();
  });

  it('상태 코드에 따라 문구가 갈린다 — 권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen('/?from=2026-08-01&to=2026-08-07', [failingRoute(403)]);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('다시 시도를 누르면 같은 조건으로 다시 부른다', async () => {
    const { urls, user } = renderScreen('/?from=2026-08-01&to=2026-08-07', [failingRoute()]);

    await screen.findByText('합성 서버 사유');
    const before = listUrls(urls).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listUrls(urls).length).toBe(before + 1);
    });
    expect(listUrls(urls).at(-1)?.searchParams.get('occurredFrom')).toContain('2026-08-01');
  });
});
