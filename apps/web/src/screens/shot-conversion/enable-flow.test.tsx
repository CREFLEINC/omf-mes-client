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
  makeEnabled,
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
import type { OperationPolicy } from './types';

const t = messages.shotConversion;
const te = t.enabled;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

interface Options {
  writes?: Request[];
  enabled?: OperationPolicy[];
  ratios?: OperationPolicy[];
  enabledStatus?: number;
  writeStatus?: number;
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
    match: (request) =>
      request.method !== 'GET' &&
      new URL(request.url).pathname.startsWith('/app/operation-policies'),
    respond: (request) => {
      options.writes?.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeEnabled(8001, true), { status: 201 })
        : jsonResponse({ errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) =>
      isPath(request, '/app/operation-policies') &&
      policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
    respond: () =>
      options.enabledStatus === undefined
        ? jsonResponse(enabledListResponse(options.enabled ?? []))
        : jsonResponse({ errors: [] }, { status: options.enabledStatus }),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies'),
    respond: () => jsonResponse(ratioListResponse(options.ratios ?? ratioItems)),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies/effective'),
    respond: () => jsonResponse(effectiveResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/molds'),
    respond: () => jsonResponse(moldListResponse()),
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

const pane = (): HTMLElement => screen.getByRole('region', { name: te.paneTitle });
const toggle = (): HTMLElement => within(pane()).getByRole('switch', { name: te.switchLabel });

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

describe('W-05-01 ④ — 상태가 셋이다', () => {
  it('켜져 있으면 스위치가 켜져 있다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, true)] });

    await waitFor(() => expect(toggle()).toBeChecked());
  });

  it('꺼져 있으면 스위치가 꺼져 있다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, false)] });

    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(within(pane()).queryByText(te.notSetTitle)).not.toBeInTheDocument();
  });

  /** ⛔ 아직 정하지 않은 것을 「끔」으로 그리지 않는다(G-9). */
  it('정한 적이 없으면 그 사실을 밝힌다', async () => {
    renderScreen({ enabled: [] });

    expect(await within(pane()).findByText(te.notSetTitle)).toBeInTheDocument();
    expect(within(pane()).getByText(te.notSet)).toBeInTheDocument();
  });

  it('값이 오지 않아도 정하지 않은 것으로 본다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, null)] });

    expect(await within(pane()).findByText(te.notSetTitle)).toBeInTheDocument();
  });
});

/**
 * ⛔ **켜도 손 입력이 사라지지 않는다**(스펙 §5-4 · QA #12). 손 입력이 기본 경로이고
 * 환산은 보조다 — 적지 않으면 **켜는 순간 손 입력이 막히는 줄 안다.**
 */
/**
 * ⚠ **기준일을 비워 부른다** — 끝난 것까지 함께 받아야 「정한 적이 있는가」를 알 수 있다.
 * 좁혀 부르면 **끝난 정책과 정한 적 없는 것이 같아 보이고**, 화면은 아무도 정한 적 없다고
 * 말하게 된다(공유계약 G-9).
 */
describe('W-05-01 ④ — 사용 여부 조회', () => {
  it('기준일을 싣지 않는다', async () => {
    const reads: Request[] = [];
    const spied: StubRoute[] = [
      {
        match: (request) =>
          isPath(request, '/app/operation-policies') &&
          policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
        respond: (request) => {
          reads.push(request);

          return jsonResponse(enabledListResponse());
        },
      },
      ...routes({}),
    ];

    renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(spied) });
    await within(pane()).findByText(te.notSetTitle);

    const first = reads[0];

    if (first === undefined) throw new Error('사용 여부 조회가 나가지 않았습니다.');
    expect(new URL(first.url).searchParams.has('effectiveOn')).toBe(false);
  });
});

describe('W-05-01 ④ — 손 입력은 그대로', () => {
  it('켜져 있으면 손 입력이 그대로라고 말한다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, true)] });

    expect(await within(pane()).findByText(te.stillManual)).toBeInTheDocument();
  });

  it('꺼져 있으면 손으로만 입력한다고 말한다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, false)] });

    expect(await within(pane()).findByText(te.offNote)).toBeInTheDocument();
    expect(within(pane()).queryByText(te.stillManual)).not.toBeInTheDocument();
  });
});

describe('W-05-01 ④ — 켜 두었는데 비율이 없으면', () => {
  /** ⚠ 막지 않고 알린다 — 정책은 나중에 더할 수 있다(G-12·G-15). */
  it('동작하지 않는다고 알리되 막지 않는다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, true)], ratios: [] });

    expect(await within(pane()).findByText(te.noRatioWarning)).toBeInTheDocument();
    /* 잠금 토큰을 받고 나면 열린다 — 비율이 없다는 것이 막는 이유가 되지 않는다. */
    await waitFor(() => expect(toggle()).toBeEnabled());
  });

  it('비율이 있으면 알리지 않는다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, true)] });

    await waitFor(() => expect(toggle()).toBeChecked());
    expect(within(pane()).queryByText(te.noRatioTitle)).not.toBeInTheDocument();
  });

  it('꺼져 있으면 알리지 않는다', async () => {
    renderScreen({ enabled: [makeEnabled(8001, false)], ratios: [] });

    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(within(pane()).queryByText(te.noRatioTitle)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **셀 수 없을 때 「없다」고 단정하지 않는다.** 기준일로 좁힌 목록이 비었다고 정책이
   * 없는 것은 아니다 — 단정하면 **있는 정책을 두고 없다고 말하게 된다**(G-9).
   */
  it('기준일로 좁혀 목록이 비었을 때는 알리지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ enabled: [makeEnabled(8001, true)], ratios: [] });
    await within(pane()).findByText(te.noRatioWarning);

    const listPane = screen.getByRole('region', { name: t.ratioList.paneTitle });

    await user.type(within(listPane).getByLabelText(t.ratioList.effectiveOnLabel), '2026-08-23');
    await user.click(within(listPane).getByRole('button', { name: messages.common.search }));

    await waitFor(() => expect(within(pane()).queryByText(te.noRatioWarning)).toBeNull());
  });
});

describe('W-05-01 ④ — 켜고 끈다', () => {
  /** ⭐ 정한 적이 없으면 만든다 — 계약에 켜고 끄는 전용 경로가 없다. */
  it('정한 적이 없으면 전체 범위 정책을 새로 만든다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [] });
    await within(pane()).findByText(te.notSetTitle);

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);
    const body = await bodyOf(request);

    expect(request.method).toBe('POST');
    expect(body.policyCode).toBe('SHOT_CONVERSION_ENABLED');
    expect(body.valueBoolean).toBe(true);
    /* 전체 범위다 — 네 축을 다 비운다. */
    expect(body.itemId).toBeNull();
    expect(body.processId).toBeNull();
    expect(body.plantId).toBeNull();
    expect(body.businessUnitId).toBeNull();
  });

  /** ⭐ 정한 적이 있으면 고친다 — 같은 코드로 두 건을 만들면 어느 것이 이기는지 흐려진다. */
  it('정한 적이 있으면 그 정책을 고친다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [makeEnabled(8001, true, { effectiveFrom: '2026-02-01' })] });
    await waitFor(() => expect(toggle()).toBeChecked());

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(new URL(request.url).pathname).toBe('/app/operation-policies/8001');
    expect(await bodyOf(request)).toEqual({
      valueBoolean: false,
      valueText: null,
      valueNumeric: null,
      effectiveFrom: '2026-02-01',
      effectiveTo: null,
    });
  });

  /** ⛔ 값 칸 셋 중 하나만 쓴다 — 수정은 이미 있는 행을 덮으므로 나머지를 못박는다. */
  it('쓰지 않는 값 칸을 비우도록 실어 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [makeEnabled(8001, false)] });
    await waitFor(() => expect(toggle()).not.toBeChecked());

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(onlyWrite(writes));

    expect(body.valueNumeric).toBeNull();
    expect(body.valueText).toBeNull();
  });

  it('멱등 키가 실리고 잠금 토큰은 실리지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [] });
    await within(pane()).findByText(te.notSetTitle);

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
    expect(onlyWrite(writes).headers.get('If-Match')).toBeNull();
  });

  it('저장이 실패하면 그 사실을 페인에 세운다', async () => {
    const user = userEvent.setup();

    renderScreen({ enabled: [], writeStatus: 500 });
    await within(pane()).findByText(te.notSetTitle);

    await user.click(toggle());

    expect(await within(pane()).findByText(messages.httpError.description)).toBeInTheDocument();
  });
});

describe('W-05-01 ④ — 조회가 실패하면', () => {
  it('그 사실을 페인에 세우고 다시 시도할 자리를 준다', async () => {
    renderScreen({ enabledStatus: 500 });

    expect(await within(pane()).findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(within(pane()).getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /** 스위치를 그리지 않는다 — 지금 상태를 모르는 채로 켜면 남의 값을 덮는다. */
  it('스위치를 그리지 않는다', async () => {
    renderScreen({ enabledStatus: 500 });

    await within(pane()).findByText(messages.httpError.loadTitle);

    expect(within(pane()).queryByRole('switch')).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **스위치도 잠금 토큰을 싣는다** — 단, 새로 만드는 길에는 잠글 것이 없다.
 *
 * ⛔ **창이 없는 조작이라 토큰을 «미리» 받아 둔다.** 누른 뒤에 받을 틈이 없고, 못 받은 채
 * 누르면 「잠시 뒤 다시 저장하세요」로 되돌아와 사용자가 무엇을 기다리는지 알 수 없다.
 */
describe('W-05-01 ④ — 낙관적 잠금', () => {
  it('정한 적이 있으면 잠금 토큰을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [makeEnabled(8001, true)] });
    await waitFor(() => expect(toggle()).toBeEnabled());

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('If-Match')).toBe(POLICY_ETAG);
  });

  /** 새로 만드는 길에는 잠글 것이 없다 — 없는 헤더를 지어내 보내지 않는다. */
  it('정한 적이 없으면 잠금 토큰을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, enabled: [] });
    await within(pane()).findByText(te.notSetTitle);

    await user.click(toggle());

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('If-Match')).toBeNull();
  });

  /** ⭐ 충돌은 다시 불러와야 풀린다 — 스위치도 그 자리를 갖는다. */
  it('충돌하면 다시 불러올 자리를 준다', async () => {
    const user = userEvent.setup();
    const custom: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'PUT' &&
          new URL(request.url).pathname.startsWith('/app/operation-policies/'),
        respond: () =>
          jsonResponse(
            { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
            { status: 409 },
          ),
      },
      ...routes({ enabled: [makeEnabled(8001, true)] }),
    ];

    renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(custom) });
    await waitFor(() => expect(toggle()).toBeEnabled());

    await user.click(toggle());

    expect(
      await within(pane()).findByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });

  /** ⛔ 토큰을 못 받았으면 아예 누르지 못하게 한다 — 「모르면 잠근다」. */
  it('토큰을 받지 못하면 스위치가 잠긴다', async () => {
    const custom: StubRoute[] = [
      {
        match: (request) => request.method === 'GET' && isPolicyDetailPath(request),
        respond: () => jsonResponse({ errors: [] }, { status: 500 }),
      },
      ...routes({ enabled: [makeEnabled(8001, true)] }),
    ];

    renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(custom) });

    await waitFor(() => expect(toggle()).toBeInTheDocument());
    /*
     * ⚠ **조회가 끝나기를 기다린 «뒤»에 잰다.** 실패로 끝나면 「불러오는 중」은 거짓이 되지만
     * **토큰은 여전히 없다** — 가라앉기 전에 재면 두 판정이 같아 보여 감지기가 헛돈다.
     */
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(toggle()).toBeDisabled();
  });
});
