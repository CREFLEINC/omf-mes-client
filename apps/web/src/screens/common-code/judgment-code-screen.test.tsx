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
import { codeGroupKeys } from './code-group-queries';
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

const INACTIVE_JUDGMENT_GROUP: CodeGroup = { ...JUDGMENT_GROUP, isActive: false };

/** 등록 성공으로 새로 생긴 코드값. 목록 픽스처에는 없다 — 방금 만들어진 자원이다. */
const CREATED_CODE_VALUE: CodeValue = {
  codeValueId: 2104,
  codeGroupId: JUDGMENT_GROUP.codeGroupId,
  code: 'SYN-JDG-04',
  codeName: '합성 판정유형 D',
  displayOrder: 40,
  effectiveFrom: null,
  effectiveTo: null,
  isActive: true,
};

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

/**
 * 처음 한 번만 성공하고 그다음부터 실패하는 그룹 조회.
 *
 * **재조회 실패**를 만드는 유일한 방법이다 — 그때 지난 자료가 캐시에 남아 있어,
 * 「받은 자료가 있는가」로 갈래를 판정하는 구현은 본문과 배너가 서로 다른 갈래에 선다.
 */
const flakyGroupListRoute = (items: CodeGroup[]): StubRoute => {
  let served = 0;

  return {
    match: (request) => isGet(request, CODE_GROUPS_PATH),
    respond: () => {
      served += 1;

      return served === 1
        ? jsonResponse({
            items,
            page: { page: 1, size: 50, total: items.length } satisfies PageStub,
          })
        : jsonResponse({ message: '' }, { status: 500 });
    },
  };
};

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
        codeValue: [...CODE_VALUES, CREATED_CODE_VALUE].find(
          (row) => row.codeValueId === codeValueId,
        ),
        editability,
      },
      { headers: { ETag: 'W/"5"' } },
    ),
});

/** 코드값 수정. **어느 번호로 나갔는지**가 판정의 핵심이라 경로를 열어 두고 받는다. */
const codeValueUpdateRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname.startsWith(`${CODE_VALUES_PATH}/`),
  respond: (request) => {
    const codeValueId = Number(new URL(request.url).pathname.split('/').at(-1));

    return jsonResponse(CODE_VALUES.find((row) => row.codeValueId === codeValueId));
  },
});

const codeValueCreateRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === CODE_VALUES_PATH,
  respond: () => jsonResponse(CREATED_CODE_VALUE, { status: 201 }),
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

  const { queryClient } = renderWithProviders(
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

  return { requests, history, queryClient, user: userEvent.setup() };
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

const codeValueFormPane = (): HTMLElement => screen.getByRole('region', { name: tv.formPaneTitle });

/**
 * 그 문구를 담은 경고(`role="alert"`). 이 화면에는 경고가 둘 이상 함께 설 수 있어
 * `getByRole('alert')` 하나로는 어느 경고인지 가릴 수 없다.
 */
const alertWithText = (text: string): HTMLElement | undefined =>
  screen.queryAllByRole('alert').find((element) => element.textContent?.includes(text));

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

  /**
   * 같은 주소로 다시 옮기면 뒤로가기가 제자리에서 한 번 헛돈다.
   *
   * **이것은 실제 사용자 경로다** — 한 벌의 목록은 이미 고른 행에도 버튼을 그대로 둔다
   * (표시만 `aria-current`로 갈릴 뿐 비활성이 아니다). 같은 행을 두 번 누르는 일이 실제로 있다.
   */
  it('이미 고른 코드값을 다시 눌러도 히스토리가 늘지 않는다', async () => {
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

    await user.click(screen.getByRole('button', { name: 'SYN-JDG-01' }));

    expect(history.search()).toBe('?sel=2101');

    // 한 칸만 쌓였다면 뒤로가기 한 번으로 처음 주소에 닿는다.
    history.back();

    expect(history.search()).toBe('');
  });
});

/**
 * 주소 키 표의 **「유지」 방향**을 한 바퀴 돈다.
 *
 * 앞의 검사들은 「무엇이 지워지는가」를 본다. 그것만으로는 **지나치게 지우는 구현**이 통과한다 —
 * 예를 들어 2쪽에서 「미사용 포함」을 켜 놓고 행을 고를 때 조건과 쪽까지 함께 지우면,
 * 사용자는 방금 고른 행이 목록에서 사라지는 것을 본다.
 *
 * 그래서 네 키가 **전부 실려 있는 딥링크**에서 조작을 하나씩 하고 **결과 주소를 통째로** 단언한다.
 * 통째로 보면 「지움」과 「유지」가 한 번에 판정되어 표의 20칸이 다섯 검사로 덮인다.
 */
describe('JudgmentCodeScreen — 주소 키 표의 유지 방향', () => {
  /** 네 키가 다 실린 자리. 쪽은 2쪽이고 「미사용 포함」이 켜져 있다. */
  const DEEP_LINK = '?sel=2101&inactive=1&page=2';
  const SECOND_PAGE: PageStub = { page: 2, size: 3, total: 7 };

  const renderAt = (search: string) =>
    renderScreen(
      [
        groupListRoute(),
        codeValueListRoute(CODE_VALUES, SECOND_PAGE),
        codeValueDetailRoute(2101),
        codeValueDetailRoute(2102),
      ],
      search,
    );

  it('고르면 선택만 바뀌고 쪽과 미사용 포함은 남는다', async () => {
    const { history, user } = renderAt(DEEP_LINK);
    await screen.findByRole('button', { name: 'SYN-JDG-02' });

    await user.click(screen.getByRole('button', { name: 'SYN-JDG-02' }));

    await waitFor(() => {
      expect(history.search()).toBe('?sel=2102&inactive=1&page=2');
    });
  });

  it('등록을 열면 선택만 빠지고 쪽과 미사용 포함은 남는다', async () => {
    const { history, user } = renderAt(DEEP_LINK);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: tv.actions.add }));

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1&page=2&new=1');
    });
  });

  it('등록을 닫으면 등록만 빠지고 선택·쪽·미사용 포함은 남는다', async () => {
    const { history, user } = renderAt(`${DEEP_LINK}&new=1`);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(
      within(codeValueFormPane()).getByRole('button', { name: messages.common.cancel }),
    );

    await waitFor(() => {
      expect(history.search()).toBe(DEEP_LINK);
    });
  });

  /* 보이는 행이 통째로 달라지는 조작이라 선택·쪽·등록 폼이 함께 정리된다. */
  it('미사용 포함을 끄면 선택·쪽·등록이 함께 빠진다', async () => {
    const { history, user } = renderAt(`${DEEP_LINK}&new=1`);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('checkbox', { name: messages.common.includeInactive }));

    await waitFor(() => {
      expect(history.search()).toBe('');
    });
  });

  it('첫 쪽으로 돌아가면 쪽 키가 빠지고 등록도 함께 닫힌다', async () => {
    const { history, user } = renderAt(`${DEEP_LINK}&new=1`);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(
      within(screen.getByRole('navigation', { name: tv.pageNavLabel })).getByRole('button', {
        name: messages.commonCode.actions.prevPage,
      }),
    );

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1');
    });
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

describe('JudgmentCodeScreen — 안내와 경고', () => {
  it('편집기가 코드값 어휘를 쓰는 이유를 머리에서 밝힌다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);

    expect(await screen.findByText(t.notices.editorScope)).toBeInTheDocument();
  });

  it('판정유형 목록이 확정되기 전에는 임시 목록 안내를 낸다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);

    expect(await screen.findByText(t.notices.provisionalList)).toBeInTheDocument();
  });

  /*
   * 안내는 「지금 보이는 값이 전부가 아닐 수 있다」는 뜻이다 — 보이는 값이 없는 화면에서는
   * 가리킬 대상이 없다. 목록이 선 갈래에서만 낸다.
   */
  it('그룹을 찾지 못하면 임시 목록 안내를 내지 않는다', async () => {
    renderScreen([groupListRoute(DECOY_GROUPS), codeValueListRoute()]);
    await screen.findByText(t.empty.groupNotFoundTitle);

    expect(screen.queryByText(t.notices.provisionalList)).not.toBeInTheDocument();
  });

  /**
   * **본문과 배너가 같은 갈래에 선다.**
   *
   * 재조회가 실패하면 지난 그룹이 캐시에 남는다. 갈래를 「받은 자료가 있는가」로 판정하면
   * 본문은 조회 실패 배너인데 그 위에 경고·안내가 그대로 살아남아, 사용자는 실패한 화면에서
   * 「값을 추가하면 다른 화면에 나타난다」는 경고를 읽는다.
   */
  it('재조회에 실패하면 본문과 함께 안내·경고도 사라진다', async () => {
    const { queryClient } = renderScreen(
      [flakyGroupListRoute([...DECOY_GROUPS, INACTIVE_JUDGMENT_GROUP]), codeValueListRoute()],
      '?new=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    /* 스텁이 갈리기 전 상태 — 셋이 실제로 서 있어야 뒤의 부재 단언이 뜻을 갖는다. */
    expect(screen.getByText(t.notices.provisionalList)).toBeInTheDocument();
    expect(screen.getByText(t.notices.groupInactive)).toBeInTheDocument();
    expect(alertWithText(t.notices.addAffectsOtherScreens)).toBeDefined();

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: codeGroupKeys.all });
    });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.notices.provisionalList)).not.toBeInTheDocument();
    expect(screen.queryByText(t.notices.groupInactive)).not.toBeInTheDocument();
    expect(screen.queryByText(t.notices.addAffectsOtherScreens)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: tv.paneTitle })).not.toBeInTheDocument();
  });

  /* 그룹이 꺼져 있어도 값은 그대로 있다 — 편집기를 막으면 왜 막혔는지 알 수 없다. */
  it('찾은 그룹이 미사용이면 경고를 내되 편집기는 연다', async () => {
    renderScreen([
      groupListRoute([...DECOY_GROUPS, INACTIVE_JUDGMENT_GROUP]),
      codeValueListRoute(),
    ]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(screen.getByText(t.notices.groupInactive)).toBeInTheDocument();
    expect(within(codeValuePane()).getByText('SYN-JDG-01')).toBeInTheDocument();
  });

  it('그룹이 사용 중이면 미사용 경고를 내지 않는다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(screen.queryByText(t.notices.groupInactive)).not.toBeInTheDocument();
  });

  /*
   * 값 추가 경고 — 여기서 늘린 값이 다른 화면 전체에 나타난다는 사실.
   * **등록 폼이 열려 있는 동안에만** 낸다. 늘 보이는 경고는 읽히지 않는다.
   */
  it('등록 폼이 열려 있는 동안 값 추가 경고를 낸다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()], '?new=1');
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(alertWithText(t.notices.addAffectsOtherScreens)).toBeDefined();
  });

  it('등록 폼이 닫혀 있으면 값 추가 경고를 내지 않는다', async () => {
    renderScreen([groupListRoute(), codeValueListRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    expect(screen.queryByText(t.notices.addAffectsOtherScreens)).not.toBeInTheDocument();
  });

  it('등록 폼을 열고 닫으면 경고도 함께 사라진다', async () => {
    const { user } = renderScreen([groupListRoute(), codeValueListRoute(), codeValueDetailRoute()]);
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.click(screen.getByRole('button', { name: tv.actions.add }));
    await waitFor(() => {
      expect(alertWithText(t.notices.addAffectsOtherScreens)).toBeDefined();
    });

    await user.click(
      within(codeValueFormPane()).getByRole('button', { name: messages.common.cancel }),
    );

    await waitFor(() => {
      expect(screen.queryByText(t.notices.addAffectsOtherScreens)).not.toBeInTheDocument();
    });
  });

  /* 그룹이 없으면 등록 폼도 서지 않는다 — 열리지 않은 폼의 경고를 낼 수 없다. */
  it('그룹을 찾지 못하면 new=1이 실려 있어도 값 추가 경고를 내지 않는다', async () => {
    renderScreen([groupListRoute(DECOY_GROUPS), codeValueListRoute()], '?new=1');
    await screen.findByText(t.empty.groupNotFoundTitle);

    expect(screen.queryByText(t.notices.addAffectsOtherScreens)).not.toBeInTheDocument();
  });
});

/**
 * 재사용한 편집기의 동작을 **이 화면에서 독립적으로** 덮는다.
 *
 * 한 벌은 공통코드 화면과 공유한다 — 그쪽 사정으로 한 벌이 바뀌면 이 화면만 조용히 깨질 수 있다.
 * 아래 둘은 이 화면의 완료 조건이기도 하므로 여기에 방어선을 따로 둔다.
 */
describe('JudgmentCodeScreen — 재사용한 편집기의 동작', () => {
  const openCodeValueForm = async (extraRoutes: StubRoute[] = []) => {
    const rendered = renderScreen(
      [groupListRoute(), codeValueListRoute(), codeValueDetailRoute(), ...extraRoutes],
      '?sel=2101',
    );
    await screen.findByLabelText(tv.fields.codeName);

    return rendered;
  };

  /* 판정유형은 참조 관계로 이어져 있지 않아 참조 건수를 셀 수 없다 — 서버가 그렇게 준다. */
  it('코드 칸이 잠기고 셀 수 없다는 사유가 보인다', async () => {
    await openCodeValueForm();

    expect(screen.getByLabelText(tv.fields.code)).toBeDisabled();
    expect(screen.getByText(messages.editability.notCountable(null))).toBeInTheDocument();
  });

  /* 계약이 두 곳에서 못 박았다 — `display_order`에 유일 제약이 없어 전체 치환이 필요 없다. */
  it('정렬 순서를 고쳐 저장하면 그 행 하나만 보낸다', async () => {
    const { requests, user } = await openCodeValueForm([codeValueUpdateRoute()]);

    await user.clear(screen.getByLabelText(tv.fields.displayOrder));
    await user.type(screen.getByLabelText(tv.fields.displayOrder), '15');
    await user.click(
      within(codeValueFormPane()).getByRole('button', { name: messages.common.save }),
    );

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true);
    });

    const writes = codeValueTraffic(requests).filter((request) => request.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.url.pathname).toBe(`${CODE_VALUES_PATH}/2101`);
  });

  /*
   * 등록에 성공하면 한 벌은 **고르기 콜백만 한 번** 부른다.
   * 화면이 그것을 주소 갱신 한 번으로 끝내야 뒤로가기가 중간 상태로 떨어지지 않는다.
   */
  it('등록에 성공하면 새 코드값으로 옮겨 가고 주소를 한 번만 고친다', async () => {
    const { history, user } = renderScreen(
      [
        groupListRoute(),
        codeValueListRoute(),
        codeValueCreateRoute(),
        codeValueDetailRoute(CREATED_CODE_VALUE.codeValueId),
      ],
      '?new=1',
    );
    await screen.findByRole('button', { name: 'SYN-JDG-01' });

    await user.type(screen.getByLabelText(tv.fields.code), CREATED_CODE_VALUE.code);
    await user.type(screen.getByLabelText(tv.fields.codeName), CREATED_CODE_VALUE.codeName);
    await user.type(screen.getByLabelText(tv.fields.displayOrder), '40');
    await user.click(within(codeValueFormPane()).getByRole('button', { name: tv.actions.add }));

    await waitFor(() => {
      expect(history.search()).toBe(`?sel=${String(CREATED_CODE_VALUE.codeValueId)}`);
    });

    history.back();

    expect(history.search()).toBe('?new=1');
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
