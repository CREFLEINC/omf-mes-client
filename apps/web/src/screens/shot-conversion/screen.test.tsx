import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  businessUnitsResponse,
  enabledListResponse,
  itemsResponse,
  makeRatio,
  plantsResponse,
  policyCodeOf,
  processesResponse,
  ratioItems,
  ratioListResponse,
} from './fixtures';
import { POLICY_PAGE_SIZE } from './queries';
import { ShotConversionScreen } from './screen';
import type { OperationPolicy } from './types';

const t = messages.shotConversion;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

interface Options {
  reads?: Request[];
  policies?: OperationPolicy[];
  total?: number;
  listStatus?: number;
  /** 이름 풀이 하나를 실패시킨다 */
  failLookup?: string;
  /** 이름 풀이 하나를 잘린 것으로 만든다 */
  truncateLookup?: string;
}

const lookupBody = (path: string, options: Options) => {
  const bodies: Record<
    string,
    () => { items: unknown[]; page: { page: number; size: number; total: number } }
  > = {
    '/mdm/items': itemsResponse,
    '/mdm/processes': processesResponse,
    '/mdm/plants': plantsResponse,
    '/mdm/business-units': businessUnitsResponse,
  };
  const body = bodies[path]?.() ?? { items: [], page: { page: 1, size: 100, total: 0 } };

  return options.truncateLookup === path
    ? { ...body, page: { ...body.page, total: body.page.total + 9 } }
    : body;
};

const routes = (options: Options): StubRoute[] => [
  /*
   * ⭐ **두 조회가 같은 경로를 쓴다** — 정책 코드로 갈라 주지 않으면 사용 여부 조회가
   * 비율 정책을 받아 「아직 정하지 않음」이 엉뚱한 근거로 서고, 실패도 함께 난다.
   */
  {
    match: (request) =>
      isPath(request, '/app/operation-policies') &&
      policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
    respond: () => jsonResponse(enabledListResponse()),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies'),
    respond: (request) => {
      options.reads?.push(request);

      return options.listStatus === undefined
        ? jsonResponse(ratioListResponse(options.policies ?? ratioItems, options.total))
        : jsonResponse({ errors: [] }, { status: options.listStatus });
    },
  },
  ...['/mdm/items', '/mdm/processes', '/mdm/plants', '/mdm/business-units'].map((path) => ({
    match: (request: Request) => isPath(request, path),
    respond: () =>
      options.failLookup === path
        ? jsonResponse({ errors: [] }, { status: 500 })
        : jsonResponse(lookupBody(path, options)),
  })),
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(routes(options)) });

const pane = (): HTMLElement => screen.getByRole('region', { name: t.ratioList.paneTitle });

const only = (requests: readonly Request[], index = 0): Request => {
  const found = requests[index];

  if (found === undefined) throw new Error(`나간 요청이 ${String(index + 1)}건에 못 미칩니다.`);

  return found;
};

describe('W-05-01 ① — 비율 정책을 본다', () => {
  /**
   * ⭐ **코드로 좁혀 부른다.** 같은 표를 다른 화면도 쓰므로(작업 통제 · 경미 정지 임계),
   * 좁히지 않으면 **남의 정책이 이 화면의 표에 섞인다.**
   */
  it('비율 코드로 좁혀 조회한다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText(t.scope.all);

    expect(queryOf(only(reads)).get('policyCode')).toBe('SHOT_CONVERSION_RATIO');
  });

  /** ⚠ 기준일을 비우면 끝난 것까지 함께 온다 — 그것이 기본이다. */
  it('첫 조회에는 기준일을 싣지 않는다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText(t.scope.all);

    expect(queryOf(only(reads)).has('effectiveOn')).toBe(false);
  });

  it('네 정책이 서로 다른 범위로 그려진다', async () => {
    renderScreen();

    expect(await within(pane()).findByText(t.scope.all)).toBeInTheDocument();
    expect(
      within(pane()).getByText(t.scope.entry(t.scope.plantId, '가상 1공장')),
    ).toBeInTheDocument();
    expect(
      within(pane()).getByText(t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징')),
    ).toBeInTheDocument();
  });

  /** ⭐ 수가 아니라 무엇을 뜻하는지를 보인다. */
  it('계산식을 함께 보인다', async () => {
    renderScreen();

    expect(await within(pane()).findByText(t.formula(0.25))).toBeInTheDocument();
  });

  it('끝이 없는 기간과 있는 기간을 갈라 그린다', async () => {
    renderScreen();

    expect(await within(pane()).findAllByText(t.period.open('2026-01-01'))).not.toHaveLength(0);
    expect(
      within(pane()).getByText(t.period.closed('2026-01-01', '2026-12-31')),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **겹치는 것이 정상이다.** 규칙을 곁에 적지 않으면 사람마다 다르게 읽는다.
   * ⛔ 그리고 **화면이 판정하지 않는다**는 사실도 함께 말한다.
   */
  it('겹칠 때의 규칙과 판정하는 자리를 함께 말한다', async () => {
    renderScreen();
    await within(pane()).findByText(t.scope.all);

    expect(within(pane()).getByText(t.ratioList.overlapNote)).toBeInTheDocument();
    expect(within(pane()).getByText(t.ratioList.resolvedElsewhere)).toBeInTheDocument();
  });
});

describe('W-05-01 ① — 기준일로 좁힌다', () => {
  it('고른 날을 조건으로 싣는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText(t.scope.all);

    const box = within(pane()).getByLabelText(t.ratioList.effectiveOnLabel);

    await user.type(box, '2026-08-23');
    await user.click(within(pane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => expect(reads.length).toBeGreaterThan(1));
    expect(queryOf(only(reads, reads.length - 1)).get('effectiveOn')).toBe('2026-08-23');
  });

  /** ⛔ 적용하지 않은 입력도 초기화가 거둔다 — 남으면 다음 조회에서 되살아난다. */
  it('적용하지 않은 입력도 초기화가 거둔다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await within(pane()).findByText(t.scope.all);

    const box = within(pane()).getByLabelText(t.ratioList.effectiveOnLabel);

    await user.type(box, '2026-08-23');
    await user.click(within(pane()).getByRole('button', { name: messages.common.reset }));

    expect(box).toHaveValue('');
  });

  it('그 날에 유효한 것이 없으면 비우라고 말한다', async () => {
    const user = userEvent.setup();

    renderScreen({ policies: [] });
    await within(pane()).findByText(t.ratioList.emptyTitle);

    await user.type(within(pane()).getByLabelText(t.ratioList.effectiveOnLabel), '2026-08-23');
    await user.click(within(pane()).getByRole('button', { name: messages.common.search }));

    expect(await within(pane()).findByText(t.ratioList.noMatchTitle)).toBeInTheDocument();
  });
});

describe('W-05-01 ① — 끝난 정책', () => {
  /**
   * ⛔ **감추지 않고 표식을 붙인다.** 이 화면에는 지우는 길이 없어 끝난 것이 곧 이력이다 —
   * 감추면 「왜 지금 값이 이것인지」를 되짚을 수 없다.
   */
  it('끝난 정책에 표식이 붙는다', async () => {
    renderScreen({
      policies: [makeRatio(9001, 1, { plantId: 11, effectiveTo: '2020-01-01' })],
    });

    expect(await within(pane()).findByText(t.ratioList.ended)).toBeInTheDocument();
  });

  it('끝나지 않은 정책에는 붙지 않는다', async () => {
    renderScreen({ policies: [makeRatio(9001, 1, { plantId: 11 })] });

    await within(pane()).findByText(t.scope.entry(t.scope.plantId, '가상 1공장'));

    expect(within(pane()).queryByText(t.ratioList.ended)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **범위 칸에 붙이지 않는다.** 범위는 축을 이어 만든 조립된 문장이고 값 이름에 괄호가
   * 들어갈 수 있어, 거기 붙이면 **값 이름의 일부로 읽힌다**(브라우저 확인에서 실제로 그랬다).
   */
  it('표식이 범위 문구에 섞이지 않는다', async () => {
    renderScreen({
      policies: [makeRatio(9001, 1, { plantId: 11, effectiveTo: '2020-01-01' })],
    });

    await within(pane()).findByText(t.ratioList.ended);

    expect(
      within(pane()).getByText(t.scope.entry(t.scope.plantId, '가상 1공장')),
    ).toBeInTheDocument();
  });
});

describe('W-05-01 ① — 빈 상태와 실패', () => {
  /** ⭐ 정책이 없으면 환산이 동작하지 않는다 — 빈 상태가 그 사실을 말한다. */
  it('정책이 하나도 없으면 그 결과까지 말한다', async () => {
    renderScreen({ policies: [] });

    expect(await within(pane()).findByText(t.ratioList.emptyTitle)).toBeInTheDocument();
    expect(within(pane()).getByText(t.ratioList.emptyDescription)).toBeInTheDocument();
  });

  /**
   * ⛔ **쪽 크기를 서버 기본값에 맡기지 않는다.** 싣지 않으면 기본값 너머가 조용히 잘리고,
   * 이 표는 **겹치는 정책을 함께 봐야** 무엇이 이길지 짐작할 수 있으므로 반쪽이면 오독한다.
   */
  it('조회에 쪽 크기를 싣는다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText(t.scope.all);

    expect(queryOf(only(reads)).get('size')).toBe(String(POLICY_PAGE_SIZE));
  });

  it('목록이 잘리면 좁히라고 말한다', async () => {
    renderScreen({ total: 300 });

    expect(await within(pane()).findByText(t.ratioList.listTruncated(4, 300))).toBeInTheDocument();
  });

  it('목록이 온전하면 잘림 안내를 세우지 않는다', async () => {
    renderScreen();
    await within(pane()).findByText(t.scope.all);

    expect(within(pane()).queryByText(t.ratioList.listTruncated(4, 4))).not.toBeInTheDocument();
  });

  it('조회가 실패하면 배너와 다시 시도할 자리를 준다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await within(pane()).findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(within(pane()).getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });
});

describe('W-05-01 ① — 이름 풀이의 한계', () => {
  it('하나라도 실패하면 그 사실을 말한다', async () => {
    renderScreen({ failLookup: '/mdm/items' });

    expect(await screen.findByText(t.optionsLoadFailed)).toBeInTheDocument();
  });

  /** ⭐ 실패가 잘림보다 앞선다 — 아무것도 못 받은 것이 더 큰 사실이다. */
  it('잘렸을 뿐이면 잘렸다고만 말한다', async () => {
    renderScreen({ truncateLookup: '/mdm/plants' });

    expect(await screen.findByText(t.optionsTruncated)).toBeInTheDocument();
    expect(screen.queryByText(t.optionsLoadFailed)).not.toBeInTheDocument();
  });

  /** ⛔ 이름을 못 받아도 범위 칸이 비지 않는다 — 값을 그대로 둔다(G-9). */
  it('이름을 못 받아도 값이 그대로 선다', async () => {
    renderScreen({ failLookup: '/mdm/items', policies: [makeRatio(9003, 0.25, { itemId: 21 })] });

    expect(
      await within(pane()).findByText(t.scope.entry(t.scope.itemId, '21')),
    ).toBeInTheDocument();
  });
});
