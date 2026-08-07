import { messages } from '@omf-mes/i18n';
import type { components } from '@omf-mes/api-client';
import { act, screen, waitFor, within } from '@testing-library/react';
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
import type { CodeValue } from './code-value-types';
import { JudgmentCodeScreen } from './judgment-code-screen';
import { JUDGMENT_TYPE_GROUP_CODE } from './judgment-group';
import type { CodeGroup } from './types';

type Editability = components['schemas']['Editability'];

/**
 * W-06-04 판정유형 코드 마스터의 화면 검사(omf-mes-client#16).
 *
 * 이 화면의 로직은 거의 전부 **「요청이 나가는가」와 「주소가 어떻게 바뀌는가」**에 있다 —
 * 편집기 자체는 공통코드 화면이 만든 한 벌을 그대로 쓰고 이번에 한 줄도 고치지 않는다.
 * 그래서 여기서는 스텁이 받은 요청과 주소를 정본으로 판정한다.
 *
 * **재사용 동작(코드 잠금·행별 저장)도 여기서 덮는다.** 한 벌은 공통코드 화면과 공유하므로,
 * 그쪽 사정으로 한 벌이 바뀌면 이 화면이 조용히 깨질 수 있다. 그때 빨개질 자리가 필요하다.
 *
 * 픽스처 값은 전부 지어낸 합성값이다(`SYN-` 계열).
 */

const ROUTE = '/master-data/judgment-code';
const CODE_GROUPS_PATH = '/mdm/code-groups';
const CODE_VALUES_PATH = '/mdm/code-values';

const t = messages.judgmentCode;
const tv = messages.commonCode.codeValue;

/** 판정유형 코드 그룹. **목록의 첫 항목이 아니다** — 첫 항목을 쓰는 구현이 통과하면 안 된다. */
const JUDGMENT_GROUP: CodeGroup = {
  codeGroupId: 1205,
  groupCode: JUDGMENT_TYPE_GROUP_CODE,
  groupName: '합성 판정유형 그룹',
  description: null,
  isActive: true,
};

/**
 * 부분 검색(`q`)이 함께 돌려주는 그룹들. 넷 다 **판정유형 그룹이 아니다** —
 * 상수를 앞에 담은 것 · 뒤에 담은 것 · 대소문자만 다른 것 · 그룹명만 같은 것.
 */
const DECOY_GROUPS: CodeGroup[] = [
  {
    codeGroupId: 1201,
    groupCode: `SYN-${JUDGMENT_TYPE_GROUP_CODE}`,
    groupName: '합성 코드그룹 A',
    description: null,
    isActive: true,
  },
  {
    codeGroupId: 1202,
    groupCode: `${JUDGMENT_TYPE_GROUP_CODE}-SYN`,
    groupName: '합성 코드그룹 B',
    description: null,
    isActive: true,
  },
  {
    codeGroupId: 1203,
    groupCode: JUDGMENT_TYPE_GROUP_CODE.toLowerCase(),
    groupName: '합성 코드그룹 C',
    description: null,
    isActive: true,
  },
  {
    codeGroupId: 1204,
    groupCode: 'SYN-GRP-90',
    groupName: JUDGMENT_TYPE_GROUP_CODE,
    description: null,
    isActive: true,
  },
];

/**
 * 판정유형 코드 그룹의 코드값 3건.
 *
 * **정렬 순서를 일부러 뒤섞어 둔다**(30·10·20). 2103은 미사용이고 유효기간이 한쪽만 있다.
 * 세 코드 모두 자리표시 상수에 없다 — 상수로 거르는 구현이면 표가 비어야 한다.
 */
const CODE_VALUES: CodeValue[] = [
  {
    codeValueId: 2101,
    codeGroupId: JUDGMENT_GROUP.codeGroupId,
    code: 'SYN-JDG-01',
    codeName: '합성 판정유형 A',
    displayOrder: 30,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    isActive: true,
  },
  {
    codeValueId: 2102,
    codeGroupId: JUDGMENT_GROUP.codeGroupId,
    code: 'SYN-JDG-02',
    codeName: '합성 판정유형 B',
    displayOrder: 10,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
  },
  {
    codeValueId: 2103,
    codeGroupId: JUDGMENT_GROUP.codeGroupId,
    code: 'SYN-JDG-03',
    codeName: '합성 판정유형 C',
    displayOrder: 20,
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    isActive: false,
  },
];

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

interface PageStub {
  page: number;
  size: number;
  total: number;
}

/** 코드그룹 목록 — 화면이 그룹코드로 조회한 결과다. */
const groupListRoute = (items: CodeGroup[] = [...DECOY_GROUPS, JUDGMENT_GROUP]): StubRoute => ({
  match: (request) => isGet(request, CODE_GROUPS_PATH),
  respond: () =>
    jsonResponse({ items, page: { page: 1, size: 50, total: items.length } satisfies PageStub }),
});

const failingGroupListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, CODE_GROUPS_PATH),
  respond: () => jsonResponse(body, { status }),
});

const codeValueListRoute = (
  items: CodeValue[] = CODE_VALUES,
  pageMeta: PageStub = { page: 1, size: 50, total: CODE_VALUES.length },
): StubRoute => ({
  match: (request) => isGet(request, CODE_VALUES_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/**
 * 코드값 상세 — `ETag`가 함께 온다(계약 실측).
 * 코드값의 코드는 참조 건수를 셀 수 없어 늘 잠긴 상태로 온다(계약).
 */
const codeValueDetailRoute = (
  codeValueId = 2101,
  editability: Editability = {
    codeEditable: false,
    reason: 'NOT_COUNTABLE',
    referenceCount: null,
  },
): StubRoute => ({
  match: (request) => isGet(request, `${CODE_VALUES_PATH}/${String(codeValueId)}`),
  respond: () =>
    jsonResponse(
      {
        codeValue: CODE_VALUES.find((row) => row.codeValueId === codeValueId),
        editability,
      },
      { headers: { ETag: 'W/"5"' } },
    ),
});

/**
 * 뒤로가기를 눌러 보기 위한 탐침.
 *
 * 하네스가 `MemoryRouter`라 브라우저 히스토리가 없다 — 라우터가 쌓은 칸을 보려면
 * 트리 안에서 `navigate(-1)`을 부르고 그때의 주소를 읽는 수밖에 없다.
 */
let probeNavigate: ((delta: number) => void) | null = null;
let probeSearch = '';

const RouterProbe = () => {
  const location = useLocation();

  probeNavigate = useNavigate();
  probeSearch = location.search;

  return null;
};

interface HistoryProbe {
  search: () => string;
  back: () => void;
}

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  probeNavigate = null;
  probeSearch = '';

  renderWithProviders(
    <>
      <JudgmentCodeScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  const history: HistoryProbe = {
    search: () => probeSearch,
    back: () => {
      act(() => {
        probeNavigate?.(-1);
      });
    },
  };

  return { requests, history, user: userEvent.setup() };
};

/**
 * 응답을 붙잡아 두는 렌더. 「그룹 조회를 기다리는 동안」을 실제로 만들어야
 * 그 사이에 코드값 요청이 나가는지 판정할 수 있다.
 */
const renderScreenAwaitingResponse = (routes: StubRoute[], search = '') => {
  const { fetch: recording, requests } = createRecordingFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    await gate;

    return recording(request);
  };

  renderWithProviders(<JudgmentCodeScreen />, { fetch, route: `${ROUTE}${search}` });

  return { requests, release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const groupRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_GROUPS_PATH);

/** 코드값 목록 조회. 상세·쓰기는 경로가 더 길어 여기 걸리지 않는다. */
const codeValueRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, CODE_VALUES_PATH);

/** 코드값을 상대로 나간 **모든** 요청. 「어느 번호로 무엇이 나갔는가」를 전수로 본다. */
const codeValueTraffic = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(CODE_VALUES_PATH));

const codeValuePane = (): HTMLElement => screen.getByRole('region', { name: tv.paneTitle });

describe('JudgmentCodeScreen — 페이지 머리', () => {
  it('제목과 경로 표시가 보인다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);

    expect(await screen.findByRole('heading', { name: t.title })).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation', { name: '탐색 경로' });
    expect(within(breadcrumb).getByText(t.breadcrumbRoot)).toBeInTheDocument();
  });

});

describe('JudgmentCodeScreen — 그룹 조회', () => {
  it('진입하면 그룹코드를 실어 한 번만 조회한다', async () => {
    const { requests } = renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    const lookups = groupRequests(requests);
    expect(lookups).toHaveLength(1);
    expect(lookups[0]?.url.searchParams.get('q')).toBe(JUDGMENT_TYPE_GROUP_CODE);
  });

  /* 미사용 그룹도 찾아내야 「이 그룹은 미사용입니다」를 안내할 수 있다. */
  it('미사용 그룹도 받도록 includeInactive를 싣는다', async () => {
    const { requests } = renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(groupRequests(requests)[0]?.url.searchParams.get('includeInactive')).toBe('true');
  });

  it('그룹을 기다리는 동안 자리표시를 내고 코드값을 조회하지 않는다', async () => {
    const { requests, release } = renderScreenAwaitingResponse([
      groupListRoute(),
      codeValueListRoute(),
    ]);

    expect(await screen.findByRole('status', { name: t.loading.group })).toBeInTheDocument();
    expect(codeValueTraffic(requests)).toHaveLength(0);
    expect(screen.queryByText(t.empty.groupNotFoundTitle)).not.toBeInTheDocument();

    release();
    await screen.findByRole('button', { name: 'SYN-JDG-01' });
  });

  /* 딥링크로 들어와도 그룹을 확인하기 전에는 코드값을 조회하지 않는다. */
  it('주소에 선택·등록이 실려 있어도 대기 중에는 코드값을 조회하지 않는다', async () => {
    const { requests, release } = renderScreenAwaitingResponse(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?sel=2101&new=1',
    );

    expect(await screen.findByRole('status', { name: t.loading.group })).toBeInTheDocument();
    expect(codeValueTraffic(requests)).toHaveLength(0);

    release();
    await screen.findByRole('button', { name: 'SYN-JDG-01' });
  });
});

describe('JudgmentCodeScreen — 그룹 조회 실패', () => {
  it('실패하면 배너와 다시 시도를 내고 코드값을 조회하지 않는다', async () => {
    const { requests } = renderScreen([failingGroupListRoute(500), codeValueListRoute()]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(codeValueTraffic(requests)).toHaveLength(0);
  });

  /* 실패를 「그룹을 찾지 못했습니다」로 뭉개면 사용자가 등록하러 간다 — 원인이 다르다. */
  it('실패는 그룹 없음과 다른 화면이다', async () => {
    renderScreen([failingGroupListRoute(500), codeValueListRoute()]);
    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.groupNotFoundTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: tv.paneTitle })).not.toBeInTheDocument();
  });

  it('권한이 없으면 권한 안내를 낸다', async () => {
    renderScreen([failingGroupListRoute(403), codeValueListRoute()]);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
  });

  /* 서버가 빈 message를 주는 일이 실제로 있다 — 배너 본문이 비면 안 된다. */
  it('빈 message를 받아도 배너 본문을 채운다', async () => {
    renderScreen([failingGroupListRoute(500, { message: '' }), codeValueListRoute()]);

    expect(await screen.findByText(messages.httpError.description)).toBeInTheDocument();
  });

  it('다시 시도를 누르면 그룹을 다시 조회한다', async () => {
    const { requests, user } = renderScreen([failingGroupListRoute(500), codeValueListRoute()]);
    await screen.findByText(messages.httpError.loadTitle);
    expect(groupRequests(requests)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(groupRequests(requests)).toHaveLength(2);
    });
  });
});

describe('JudgmentCodeScreen — 그룹 없음', () => {
  it('일치하는 그룹이 없으면 편집기를 렌더하지 않고 코드값도 조회하지 않는다', async () => {
    const { requests } = renderScreen([groupListRoute(DECOY_GROUPS), codeValueListRoute()]);

    expect(await screen.findByText(t.empty.groupNotFoundTitle)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: tv.paneTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(codeValueTraffic(requests)).toHaveLength(0);
  });

  /* 무엇을 등록해야 하는지 알 수 있어야 한다 — 찾던 그룹코드를 안내가 밝힌다. */
  it('안내가 찾던 그룹코드를 밝힌다', async () => {
    renderScreen([groupListRoute(DECOY_GROUPS), codeValueListRoute()]);

    expect(
      await screen.findByText(t.empty.groupNotFoundDescription(JUDGMENT_TYPE_GROUP_CODE)),
    ).toBeInTheDocument();
  });

  it('목록이 0건이어도 같은 안내를 낸다', async () => {
    const { requests } = renderScreen([groupListRoute([]), codeValueListRoute()]);

    expect(await screen.findByText(t.empty.groupNotFoundTitle)).toBeInTheDocument();
    expect(codeValueTraffic(requests)).toHaveLength(0);
  });
});

describe('JudgmentCodeScreen — 그룹 찾음', () => {
  it('찾은 그룹의 번호로 코드값을 조회한다', async () => {
    const { requests } = renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    const list = codeValueRequests(requests);
    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.get('codeGroupId')).toBe(String(JUDGMENT_GROUP.codeGroupId));
  });

  /* 부분 일치·대소문자·그룹명만 같은 항목의 번호가 실리면 다른 업무의 코드값을 고치게 된다. */
  it('목록에 있는 다른 그룹의 번호로는 조회하지 않는다', async () => {
    const { requests } = renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    const decoyIds = DECOY_GROUPS.map((group) => String(group.codeGroupId));
    for (const request of codeValueRequests(requests)) {
      expect(decoyIds).not.toContain(request.url.searchParams.get('codeGroupId'));
    }
  });

  it('서버가 준 코드값을 상수로 거르지 않는다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    for (const row of CODE_VALUES) {
      expect(within(codeValuePane()).getByText(row.code)).toBeInTheDocument();
    }
  });
});

/**
 * 주소 키 4종(`sel`·`page`·`inactive`·`new`)의 여닫음.
 *
 * 화면 파일의 규칙 표와 **짝을 이룬다** — 표에 「지운다」가 있으면 여기에 「지워진다」가,
 * 「유지」가 있으면 「남는다」가 있다. 한쪽만 검사하면 지나치게 지우는 구현이 통과한다.
 */
describe('JudgmentCodeScreen — 주소 키', () => {
  it('코드값을 고르면 sel이 실리고 new가 지워진다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?new=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-JDG-01' }));

    await waitFor(() => {
      expect(history.search()).toBe('?sel=2101');
    });
  });

  it('등록 폼을 열면 new가 실리고 sel이 지워진다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?sel=2101',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: tv.actions.add }));

    await waitFor(() => {
      expect(history.search()).toBe('?new=1');
    });
  });

  it('등록 폼을 닫으면 new만 지워지고 나머지는 남는다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?sel=2101&inactive=1&new=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    await waitFor(() => {
      expect(history.search()).toBe('?sel=2101&inactive=1');
    });
  });

  it('미사용 포함을 바꾸면 선택과 쪽을 비운다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?sel=2101&page=2',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('checkbox', { name: messages.common.includeInactive }));

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1');
    });
  });

  it('쪽을 옮기면 선택을 비우고 미사용 포함은 남긴다', async () => {
    const { history, user } = renderScreen(
      [
        groupListRoute(),
        codeValueListRoute(CODE_VALUES, { page: 1, size: 3, total: 7 }),
        codeValueDetailRoute(),
      ],
      '?sel=2101&inactive=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(
      within(screen.getByRole('navigation', { name: tv.pageNavLabel })).getByRole('button', {
        name: messages.commonCode.actions.nextPage,
      }),
    );

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1&page=2');
    });
  });

  /* 첫 쪽·꺼짐을 값으로 실으면 「없음」과 「기본값을 명시」 두 상태가 생겨 주소가 갈린다. */
  it('첫 쪽과 꺼진 미사용 포함은 주소에 싣지 않는다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?inactive=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('checkbox', { name: messages.common.includeInactive }));

    await waitFor(() => {
      expect(history.search()).toBe('');
    });
  });

  /*
   * 그룹이 없으면 이 키들은 아무것도 가리키지 않아 해가 없다. 지우면 그룹이 생겼을 때
   * 공유받은 딥링크가 이미 사라진 뒤다.
   */
  it('그룹을 찾지 못해도 주소를 지우지 않는다', async () => {
    const { history } = renderScreen(
      [groupListRoute(DECOY_GROUPS), codeValueListRoute()],
      '?sel=2101&new=1',
    );
    await screen.findByText(t.empty.groupNotFoundTitle);

    expect(history.search()).toBe('?sel=2101&new=1');
  });

  it('코드값을 고른 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen([
      groupListRoute(),
      codeValueListRoute(),
      codeValueDetailRoute(),
    ]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: 'SYN-JDG-01' }));
    await waitFor(() => {
      expect(history.search()).toBe('?sel=2101');
    });

    history.back();

    expect(history.search()).toBe('');
  });

  it('등록 폼을 연 뒤 뒤로가기 한 번이면 직전 주소로 돌아간다', async () => {
    const { history, user } = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute()],
      '?sel=2101',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: tv.actions.add }));
    await waitFor(() => {
      expect(history.search()).toBe('?new=1');
    });

    history.back();

    expect(history.search()).toBe('?sel=2101');
  });
});

describe('JudgmentCodeScreen — 주소가 조회 조건이 된다', () => {
  it('미사용 포함이 꺼져 있으면 includeInactive를 싣지 않는다', async () => {
    const { requests } = renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(codeValueRequests(requests)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  it('주소의 미사용 포함과 쪽이 조회에 실린다', async () => {
    const { requests } = renderScreen(
      [groupListRoute(), codeValueListRoute(CODE_VALUES, { page: 2, size: 3, total: 7 })],
      '?inactive=1&page=2',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    const query = codeValueRequests(requests)[0]?.url.searchParams;
    expect(query?.get('includeInactive')).toBe('true');
    expect(query?.get('page')).toBe('2');
    expect(query?.get('codeGroupId')).toBe(String(JUDGMENT_GROUP.codeGroupId));
  });
});

describe('JudgmentCodeScreen — 만들지 않은 것', () => {
  it('통제 속성 입력칸을 두지 않는다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    /* 「미사용 포함」 하나뿐이다 — 통제 속성 확인칸이 늘면 여기서 걸린다. */
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('이력 탭·상태 축 표시를 두지 않는다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
  });
});
