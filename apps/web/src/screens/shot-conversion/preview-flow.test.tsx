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
  POLICY_ETAG,
  businessUnitsResponse,
  effectiveResponse,
  enabledListResponse,
  isPolicyDetailPath,
  itemsResponse,
  makeMold,
  makeRatio,
  moldListResponse,
  plantsResponse,
  policyCodeOf,
  policyIdOf,
  processesResponse,
  ratioItems,
  ratioListResponse,
} from './fixtures';
import { ShotConversionScreen } from './screen';
import type { OperationPolicyEffective } from './types';

const t = messages.shotConversion;
const tp = t.preview;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

interface Options {
  reads?: Request[];
  effective?: OperationPolicyEffective;
  effectiveStatus?: number;
  cavity?: number;
}

const routes = (options: Options): StubRoute[] => [
  /*
   * ⭐ **상세 조회가 잠금 토큰을 준다** — 이 응답의 `ETag` 가 다음 쓰기의 `If-Match` 로 나간다.
   * 단일 행 경로라 두 목록 조회와 갈라야 한다.
   */
  {
    match: (request) => request.method === 'GET' && isPolicyDetailPath(request),
    respond: (request) =>
      jsonResponse(makeRatio(policyIdOf(request), 0.25), { headers: { ETag: POLICY_ETAG } }),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies/effective'),
    respond: (request) => {
      options.reads?.push(request);

      return options.effectiveStatus === undefined
        ? jsonResponse(options.effective ?? effectiveResponse())
        : jsonResponse({ errors: [] }, { status: options.effectiveStatus });
    },
  },
  {
    match: (request) => isPath(request, '/mdm/molds'),
    respond: () =>
      jsonResponse(moldListResponse([makeMold(7001, 'MLD-0207', options.cavity ?? 4)])),
  },
  {
    match: (request) =>
      isPath(request, '/app/operation-policies') &&
      policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
    respond: () => jsonResponse(enabledListResponse()),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies'),
    respond: () => jsonResponse(ratioListResponse(ratioItems)),
  },
  {
    match: (request) => isPath(request, '/mdm/items'),
    respond: () => jsonResponse(itemsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/processes'),
    respond: () => jsonResponse(processesResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/plants'),
    respond: () => jsonResponse(plantsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/business-units'),
    respond: () => jsonResponse(businessUnitsResponse()),
  },
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(routes(options)) });

const pane = (): HTMLElement => screen.getByRole('region', { name: tp.paneTitle });

const only = (requests: readonly Request[], index = 0): Request => {
  const found = requests[index];

  if (found === undefined) throw new Error(`나간 요청이 ${String(index + 1)}건에 못 미칩니다.`);

  return found;
};

/**
 * ⛔ **범위 해석을 화면이 다시 구현하지 않는다**(공유계약 B-17). 고른 축을 그대로 보내고
 * 서버가 답한다 — 화면이 다시 짜면 같은 표가 화면마다 다르게 읽힌다.
 */
describe('W-05-01 ⑤ — 판정을 서버에 묻는다', () => {
  it('비율 코드로 묻는다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText('0.25');

    expect(new URL(only(reads).url).searchParams.get('policyCode')).toBe('SHOT_CONVERSION_RATIO');
  });

  /** ⭐ 축을 하나도 고르지 않아도 묻는다 — 「전체 범위 정책이 있는가」도 알고 싶은 답이다. */
  it('축을 고르지 않아도 묻고, 그때는 축을 싣지 않는다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText('0.25');

    const query = new URL(only(reads).url).searchParams;

    expect(query.has('itemId')).toBe(false);
    expect(query.has('processId')).toBe(false);
  });

  it('고른 축을 그대로 싣는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];

    renderScreen({ reads });
    await within(pane()).findByText('0.25');

    await user.click(within(pane()).getByRole('combobox', { name: tp.itemLabel }));
    await user.click(await screen.findByRole('option', { name: 'ITM-201 · 가상 하우징' }));

    await waitFor(() => expect(reads.length).toBeGreaterThan(1));
    expect(new URL(only(reads, reads.length - 1).url).searchParams.get('itemId')).toBe('21');
  });

  /** ⭐ 서버가 「어느 축으로 이겼는가」를 함께 준다 — 그것이 왜 이 값인지의 설명이다. */
  it('어느 축으로 맞았는지 함께 보인다', async () => {
    renderScreen();

    expect(await within(pane()).findByText(tp.matchedBy('품목'))).toBeInTheDocument();
  });
});

/**
 * ⛔ **「1.0」으로 채우지 않는다**(G-9) — 없는 정책을 있는 것으로 만들면 계산이 조용히 돌고
 * 사용자는 환산이 되는 줄 안다.
 */
describe('W-05-01 ⑤ — 적용 정책이 없으면', () => {
  it('환산 불가라고 말하고 계산하지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ effective: effectiveResponse({ resolved: false, valueNumeric: null }) });

    expect(await within(pane()).findByText(tp.unresolvedTitle)).toBeInTheDocument();

    await user.type(within(pane()).getByRole('textbox', { name: tp.quantityLabel }), '500');

    expect(within(pane()).queryByText(tp.shotLabel)).not.toBeInTheDocument();
  });

  it('값이 실려 와도 맞지 않았다면 쓰지 않는다', async () => {
    renderScreen({ effective: effectiveResponse({ resolved: false, valueNumeric: 1 }) });

    expect(await within(pane()).findByText(tp.unresolvedTitle)).toBeInTheDocument();
  });
});

describe('W-05-01 ⑤ — 타발수를 센다', () => {
  it('수량을 넣으면 셈을 그대로 보인다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await within(pane()).findByText('0.25');

    await user.type(within(pane()).getByRole('textbox', { name: tp.quantityLabel }), '500');

    expect(within(pane()).getByText(tp.shotCount(125))).toBeInTheDocument();
    expect(within(pane()).getByText(/500 × 0.25 = 125/)).toBeInTheDocument();
  });

  it('수량을 넣기 전에는 넣으라고 말한다', async () => {
    renderScreen();

    expect(await within(pane()).findByText(tp.needsQuantity)).toBeInTheDocument();
  });

  it('수량이 수가 아니면 그렇게 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await within(pane()).findByText('0.25');

    await user.type(within(pane()).getByRole('textbox', { name: tp.quantityLabel }), '오백');

    expect(within(pane()).getByText(tp.quantityNumber)).toBeInTheDocument();
  });
});

describe('W-05-01 ⑤ — 캐비티 수', () => {
  it('툴을 고르면 캐비티 수를 보인다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await within(pane()).findByText('0.25');

    await user.click(within(pane()).getByRole('combobox', { name: tp.toolLabel }));
    await user.click(await screen.findByRole('option', { name: /MLD-0207/ }));

    expect(within(pane()).getByText('4')).toBeInTheDocument();
    expect(within(pane()).getByText(tp.cavitySource)).toBeInTheDocument();
  });

  /** ⭐ 스펙의 「캐비티 미등록」 예외는 계약이 닫았다 — 남는 「없음」은 안 고른 것뿐이다. */
  it('툴을 고르기 전에는 고르라고만 말한다', async () => {
    renderScreen();

    expect(await within(pane()).findByText(tp.cavityNeedsTool)).toBeInTheDocument();
  });

  /**
   * ⭐ **비율 = 1 / 캐비티 수.** 두 값이 서로 다른 곳에 있어 어긋날 수 있고,
   * ⛔ **어긋나면 타발수가 조용히 틀린다.** 고쳐 주지 않고 알리기만 한다.
   */
  it('캐비티 수와 비율이 어긋나면 기대값을 담아 알린다', async () => {
    const user = userEvent.setup();

    renderScreen({ cavity: 2 });
    await within(pane()).findByText('0.25');

    await user.click(within(pane()).getByRole('combobox', { name: tp.toolLabel }));
    await user.click(await screen.findByRole('option', { name: /MLD-0207/ }));

    expect(within(pane()).getByText(tp.cavityMismatch(2, '0.5'))).toBeInTheDocument();
  });

  it('맞으면 알리지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ cavity: 4 });
    await within(pane()).findByText('0.25');

    await user.click(within(pane()).getByRole('combobox', { name: tp.toolLabel }));
    await user.click(await screen.findByRole('option', { name: /MLD-0207/ }));

    expect(within(pane()).getByText('4')).toBeInTheDocument();
    expect(within(pane()).queryByText(tp.cavityMismatch(4, '0.25'))).not.toBeInTheDocument();
  });
});

describe('W-05-01 ⑤ — 판정을 받지 못하면', () => {
  it('그 사실을 말하고 계산하지 않는다', async () => {
    renderScreen({ effectiveStatus: 500 });

    expect(await within(pane()).findByText(tp.loadFailed)).toBeInTheDocument();
    expect(within(pane()).queryByText(tp.unresolvedTitle)).not.toBeInTheDocument();
  });
});
