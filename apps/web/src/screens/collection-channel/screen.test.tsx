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
  channelItems,
  channelListResponse,
  equipmentItems,
  equipmentListResponse,
  makeChannel,
  observationListResponse,
  plantListResponse,
  scopeItemsResponse,
  scopeProcessesResponse,
  uomListResponse,
} from './fixtures';
import { CHANNEL_PAGE_SIZE } from './queries';
import { CollectionChannelScreen } from './screen';
import type { CollectionChannel, Equipment } from './types';

const t = messages.collectionChannel;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

interface StubOptions {
  equipments?: Equipment[];
  equipmentTotal?: number;
  channels?: CollectionChannel[];
  channelTotal?: number;
  channelStatus?: number;
  equipmentStatus?: number;
  /** 나간 채널 조회를 담아 두는 곳. 조건이 실제로 실렸는지 본다 */
  channelRequests?: Request[];
}

const stub = (options: StubOptions = {}): StubRoute[] => [
  {
    match: (request) => isPath(request, '/mdm/items'),
    respond: () => jsonResponse(scopeItemsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/processes'),
    respond: () => jsonResponse(scopeProcessesResponse()),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
    respond: () => jsonResponse(observationListResponse()),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels'),
    respond: (request) => {
      options.channelRequests?.push(request);

      if (options.channelStatus !== undefined) {
        return jsonResponse({ errors: [] }, { status: options.channelStatus });
      }

      return jsonResponse(
        channelListResponse(options.channels ?? channelItems, options.channelTotal),
      );
    },
  },
  {
    match: (request) => isPath(request, '/mdm/equipments'),
    respond: () =>
      options.equipmentStatus !== undefined
        ? jsonResponse({ errors: [] }, { status: options.equipmentStatus })
        : jsonResponse(
            equipmentListResponse(options.equipments ?? equipmentItems, options.equipmentTotal),
          ),
  },
  {
    match: (request) => isPath(request, '/mdm/plants'),
    respond: () => jsonResponse(plantListResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/uoms'),
    respond: () => jsonResponse(uomListResponse()),
  },
];

const renderScreen = (options: StubOptions = {}) =>
  renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(stub(options)) });

const equipmentPane = (): HTMLElement =>
  screen.getByRole('region', { name: t.equipment.paneTitle });
const channelPane = (): HTMLElement => screen.getByRole('region', { name: t.channels.paneTitle });

/** 첫 설비를 고른다. 채널 페인은 이것이 없으면 아무것도 조회하지 않는다. */
const pickFirstEquipment = async (): Promise<void> => {
  const user = userEvent.setup();
  const first = equipmentItems[0];

  if (first === undefined) throw new Error('설비 표본이 비어 있습니다.');

  await user.click(
    await screen.findByRole('button', {
      name: t.equipment.selectLabel(first.equipmentCode, first.equipmentName),
    }),
  );
};

/** 이름으로 설비를 고른다. 첫 행만 고르면 「고른 것을 붙들지 않는다」를 잴 수 없다. */
const pickEquipmentAt = async (index: number): Promise<void> => {
  const user = userEvent.setup();
  const target = equipmentItems[index];

  if (target === undefined) throw new Error('설비 표본이 모자랍니다.');

  await user.click(
    await screen.findByRole('button', {
      name: t.equipment.selectLabel(target.equipmentCode, target.equipmentName),
    }),
  );
};

/** 첫 요청 하나를 꺼낸다. 비어 있으면 「나가지 않았다」를 침묵으로 통과시키지 않는다. */
const only = (requests: readonly Request[], index = 0): Request => {
  const found = requests[index];

  if (found === undefined) throw new Error(`나간 요청이 ${String(index + 1)}건에 못 미칩니다.`);

  return found;
};

describe('W-05-07 수집 채널 매핑 — 첫 조회', () => {
  /** ⛔ 빈 조건을 보내지 않는다 — 「빈 낱말로 찾아라」와 「조건 없음」은 다른 요청이다. */
  it('조건을 걸지 않은 첫 조회에는 검색어가 실리지 않는다', async () => {
    const requests: Request[] = [];
    const spied: StubRoute[] = [
      {
        match: (request) => isPath(request, '/mdm/equipments'),
        respond: (request) => {
          requests.push(request);

          return jsonResponse(equipmentListResponse());
        },
      },
      ...stub(),
    ];

    renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(spied) });
    await screen.findByText('EQ-101');

    expect(queryOf(only(requests)).has('q')).toBe(false);
    expect(queryOf(only(requests)).has('plantId')).toBe(false);
  });

  it('설비 목록이 그려진다', async () => {
    renderScreen();

    expect(await screen.findByText('EQ-101')).toBeInTheDocument();
    expect(within(equipmentPane()).getByText('가상 성형기 2호')).toBeInTheDocument();
  });

  /** 사용 여부는 칸이 아니라 이름에 붙는 표식이다 — 좁은 페인에 칸을 더 두지 않는다. */
  it('미사용 설비는 이름에 표식이 붙는다', async () => {
    renderScreen();

    expect(
      await within(equipmentPane()).findByText(`가상 검사기 1호${t.values.inactiveSuffix}`),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **설비를 고르기 전에는 채널을 조회하지 않는다** — 계약이 조건으로 두었고, 조건 없이
   * 부르면 모든 설비의 채널이 한 표에 섞인다.
   */
  it('설비를 고르기 전에는 채널 조회가 나가지 않는다', async () => {
    const channelRequests: Request[] = [];

    renderScreen({ channelRequests });

    expect(await screen.findByText('EQ-101')).toBeInTheDocument();
    expect(channelRequests).toHaveLength(0);
  });

  it('설비를 고르기 전에는 빈 표가 아니라 무엇을 해야 하는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.channels.noEquipmentTitle)).toBeInTheDocument();
  });
});

describe('W-05-07 — 설비를 고르면', () => {
  it('그 설비의 채널이 그려진다', async () => {
    renderScreen();
    await pickFirstEquipment();

    expect(await within(channelPane()).findByText('CYCLE_TIME')).toBeInTheDocument();
    expect(within(channelPane()).getByText('배럴 온도')).toBeInTheDocument();
  });

  /** 좌우가 멀어지면 무엇을 골랐는지 잊는다 — 고른 줄 자체에도 표식을 남긴다. */
  it('고른 설비의 줄에 표식이 남는다', async () => {
    renderScreen();
    await pickFirstEquipment();

    const chosen = await screen.findByRole('button', {
      name: t.equipment.selectLabel('EQ-101', '가상 성형기 1호'),
    });

    expect(chosen).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getByRole('button', { name: t.equipment.selectLabel('EQ-102', '가상 성형기 2호') }),
    ).not.toHaveAttribute('aria-current');
  });

  it('고른 설비를 페인 머리에 남긴다', async () => {
    renderScreen();
    await pickFirstEquipment();

    expect(
      await screen.findByRole('heading', { name: t.channels.paneOf('EQ-101', '가상 성형기 1호') }),
    ).toBeInTheDocument();
  });

  it('조회 조건에 고른 설비가 실린다', async () => {
    const channelRequests: Request[] = [];

    renderScreen({ channelRequests });
    await pickFirstEquipment();

    await waitFor(() => expect(channelRequests).toHaveLength(1));
    expect(queryOf(only(channelRequests)).get('equipmentId')).toBe('3001');
  });

  /**
   * ⛔ **쪽 크기를 서버 기본값에 맡기지 않는다.** 계약 기본은 50이라, 싣지 않으면 51번째부터
   * 조용히 잘린다 — 미매핑 건수도 미매핑만 보기도 화면이 세는 것이라 **반쪽이 된 줄도 모른다.**
   */
  it('조회에 쪽 크기를 싣는다', async () => {
    const channelRequests: Request[] = [];

    renderScreen({ channelRequests });
    await pickFirstEquipment();

    await waitFor(() => expect(channelRequests).toHaveLength(1));
    expect(queryOf(only(channelRequests)).get('size')).toBe(String(CHANNEL_PAGE_SIZE));
  });

  /** 잘림 판정은 「쪽이 꽉 찼는가」다 — 조회에 실은 크기와 판정에 쓰는 크기가 같아야 성립한다. */
  it('전체 건수가 오지 않고 쪽이 꽉 차면 더 있을 수 있다고 말한다', async () => {
    const full = Array.from({ length: CHANNEL_PAGE_SIZE }, (_unused, index) =>
      makeChannel(8000 + index, `CH_${String(index)}`, { inspectionItemId: 5001 }),
    );

    renderScreen({ channels: full });
    await pickFirstEquipment();

    expect(await screen.findByText(t.channels.mayHaveMore(CHANNEL_PAGE_SIZE))).toBeInTheDocument();
  });

  /** ⛔ 거짓인 참·거짓 조건을 싣지 않는다 — `isActive=false` 는 미사용«만» 달라는 뜻이 된다. */
  it('미사용을 빼고 볼 때는 사용 중만 달라고 보낸다', async () => {
    const channelRequests: Request[] = [];

    renderScreen({ channelRequests });
    await pickFirstEquipment();

    await waitFor(() => expect(channelRequests).toHaveLength(1));
    expect(queryOf(only(channelRequests)).get('isActive')).toBe('true');
  });

  it('미사용 포함을 켜면 사용 여부 조건 자체를 뺀다', async () => {
    const user = userEvent.setup();
    const channelRequests: Request[] = [];

    renderScreen({ channelRequests });
    await pickFirstEquipment();
    await waitFor(() => expect(channelRequests).toHaveLength(1));

    await user.click(
      within(channelPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    await waitFor(() => expect(channelRequests).toHaveLength(2));
    expect(queryOf(only(channelRequests, 1)).has('isActive')).toBe(false);
  });
});

describe('W-05-07 — 받아도 버려지는 채널', () => {
  /** ⭐ 이 화면이 있는 이유다. 「매핑 없음」만으로는 결과를 알 수 없다(스펙 §9-2). */
  it('미매핑 건수와 값이 버려진다는 사실을 함께 말한다', async () => {
    renderScreen();
    await pickFirstEquipment();

    expect(await screen.findByText(t.channels.unmappedSummary(2))).toBeInTheDocument();
  });

  it('전부 이어 두었으면 경고를 세우지 않는다', async () => {
    renderScreen({ channels: [makeChannel(7001, 'CYCLE_TIME', { inspectionItemId: 5001 })] });
    await pickFirstEquipment();

    expect(await within(channelPane()).findByText('CYCLE_TIME')).toBeInTheDocument();
    expect(screen.queryByText(t.channels.unmappedSummaryTitle)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **건수만 세지 않는다.** 이어 둔 것과 아닌 것이 같은 수면 표식을 통째로 뒤바꿔도
   * 합계는 그대로다 — 어느 «줄»에 붙었는지를 봐야 한다.
   */
  it('이어 두지 않은 채널의 줄에만 표식이 붙는다', async () => {
    renderScreen();
    await pickFirstEquipment();

    await within(channelPane()).findByText('CYCLE_TIME');

    const rowOf = (channelKey: string): HTMLElement => {
      const cell = within(channelPane()).getByText(channelKey);
      const row = cell.closest('tr');

      if (row === null) throw new Error(`${channelKey} 줄을 찾지 못했습니다.`);

      return row;
    };

    expect(within(rowOf('CYCLE_TIME')).getByText(t.mapping.mapped)).toBeInTheDocument();
    expect(within(rowOf('CYCLE_TIME')).queryByText(t.mapping.unmapped)).not.toBeInTheDocument();
    expect(within(rowOf('BARREL_TEMP')).getByText(t.mapping.unmapped)).toBeInTheDocument();
    expect(within(rowOf('BARREL_TEMP')).queryByText(t.mapping.mapped)).not.toBeInTheDocument();
  });

  /** 값이 오지 않은 칸을 빈 칸으로 두지 않는다 — 없는 것인지 못 받은 것인지 구별이 안 된다. */
  it('신호 이름·단위가 오지 않으면 기록 없음이라 적는다', async () => {
    renderScreen();
    await pickFirstEquipment();

    const cell = await within(channelPane()).findByText('PRESS_FORCE');
    const row = cell.closest('tr');

    if (row === null) throw new Error('PRESS_FORCE 줄을 찾지 못했습니다.');
    expect(within(row).getAllByText(t.fields.notRecorded)).toHaveLength(2);
  });

  /** ⛔ 이름을 지어 붙이지 않는다 — 계약이 이름을 내려주지 않는다. 그 사실을 밝힌다. */
  it('연결된 항목의 이름을 모른다는 사실을 밝힌다', async () => {
    renderScreen();
    await pickFirstEquipment();

    expect(await within(channelPane()).findByText(t.mapping.nameUnavailable)).toBeInTheDocument();
  });

  /** ⭐ 설명할 것이 보일 때만 설명한다 — 「연결됨」이 한 줄도 없으면 무엇을 두고 하는 말인지 모른다. */
  it('표에 연결된 채널이 한 줄도 없으면 그 안내를 세우지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickFirstEquipment();
    await within(channelPane()).findByText('CYCLE_TIME');

    await user.click(
      within(channelPane()).getByRole('checkbox', { name: t.channels.unmappedOnly }),
    );

    expect(within(channelPane()).queryByText(t.mapping.nameUnavailable)).not.toBeInTheDocument();
  });

  it('미매핑만 보기를 켜면 이어 둔 채널이 표에서 빠진다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickFirstEquipment();
    await within(channelPane()).findByText('CYCLE_TIME');

    await user.click(
      within(channelPane()).getByRole('checkbox', { name: t.channels.unmappedOnly }),
    );

    expect(within(channelPane()).queryByText('CYCLE_TIME')).not.toBeInTheDocument();
    expect(within(channelPane()).getByText('BARREL_TEMP')).toBeInTheDocument();
  });

  /** 화면이 거르는 조건이라 목록이 잘리면 반쪽이 된다 — 그 사실을 감추지 않는다. */
  it('목록이 잘린 채로 미매핑만 보기를 켜면 반쪽이라고 말한다', async () => {
    const user = userEvent.setup();

    renderScreen({ channelTotal: 40 });
    await pickFirstEquipment();
    await within(channelPane()).findByText('CYCLE_TIME');

    expect(screen.queryByText(t.channels.unmappedOnLoadedOnly)).not.toBeInTheDocument();

    await user.click(
      within(channelPane()).getByRole('checkbox', { name: t.channels.unmappedOnly }),
    );

    expect(screen.getByText(t.channels.unmappedOnLoadedOnly)).toBeInTheDocument();
  });

  it('목록이 잘리면 몇 건 중 몇 건인지 말한다', async () => {
    renderScreen({ channelTotal: 40 });
    await pickFirstEquipment();

    expect(await screen.findByText(t.channels.listTruncated(4, 40))).toBeInTheDocument();
  });
});

describe('W-05-07 — 조회 조건과 빈 상태', () => {
  it('검색어를 넣고 조회하면 조건이 실린다', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    const routes = stub();
    const spied: StubRoute[] = [
      {
        match: (request) => isPath(request, '/mdm/equipments'),
        respond: (request) => {
          requests.push(request);

          return jsonResponse(equipmentListResponse());
        },
      },
      ...routes,
    ];

    renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(spied) });
    await screen.findByText('EQ-101');

    await user.type(
      within(equipmentPane()).getByRole('searchbox', { name: t.equipment.searchLabel }),
      '성형',
    );
    await user.click(within(equipmentPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => expect(requests.length).toBeGreaterThan(1));
    expect(queryOf(only(requests, requests.length - 1)).get('q')).toBe('성형');
  });

  it('고른 공장이 조회 조건에 실린다', async () => {
    const user = userEvent.setup();
    const requests: Request[] = [];
    const spied: StubRoute[] = [
      {
        match: (request) => isPath(request, '/mdm/equipments'),
        respond: (request) => {
          requests.push(request);

          return jsonResponse(equipmentListResponse());
        },
      },
      ...stub(),
    ];

    renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(spied) });
    await screen.findByText('EQ-101');

    const pane = within(equipmentPane());

    await user.click(pane.getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: '가상 1공장' }));
    await user.click(pane.getByRole('button', { name: messages.common.search }));

    await waitFor(() => expect(requests.length).toBeGreaterThan(1));
    expect(queryOf(only(requests, requests.length - 1)).get('plantId')).toBe('11');
  });

  it('설비가 하나도 없으면 등록을 권한다', async () => {
    renderScreen({ equipments: [] });

    expect(await screen.findByText(t.equipment.emptyTitle)).toBeInTheDocument();
  });

  it('설비 목록이 잘리면 조건을 좁히라고 말한다', async () => {
    renderScreen({ equipmentTotal: 300 });

    expect(await screen.findByText(t.equipment.truncated(3, 300))).toBeInTheDocument();
  });

  /** 다 보이고 있으면 아무 말도 하지 않는다 — 늘 세우면 안내가 배경 소음이 된다. */
  it('설비 목록이 온전하면 잘림 안내를 세우지 않는다', async () => {
    renderScreen();

    expect(await screen.findByText('EQ-101')).toBeInTheDocument();
    expect(screen.queryByText(t.equipment.truncated(3, 3))).not.toBeInTheDocument();
  });

  it('채널이 하나도 없으면 등록을 권한다', async () => {
    renderScreen({ channels: [] });
    await pickFirstEquipment();

    expect(await within(channelPane()).findByText(t.channels.emptyTitle)).toBeInTheDocument();
  });

  it('조건 때문에 비었으면 조건을 줄이라고 말한다', async () => {
    const user = userEvent.setup();

    renderScreen({ channels: [makeChannel(7001, 'CYCLE_TIME', { inspectionItemId: 5001 })] });
    await pickFirstEquipment();
    await within(channelPane()).findByText('CYCLE_TIME');

    await user.click(
      within(channelPane()).getByRole('checkbox', { name: t.channels.unmappedOnly }),
    );

    expect(within(channelPane()).getByText(t.channels.noMatchTitle)).toBeInTheDocument();
  });
});

describe('W-05-07 — 조회가 실패하면', () => {
  it('설비 조회 실패는 배너로 세우고 다시 시도할 자리를 준다', async () => {
    renderScreen({ equipmentStatus: 500 });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(
      within(equipmentPane()).getByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
  });

  it('채널 조회가 실패하면 미매핑 요약을 세우지 않는다', async () => {
    renderScreen({ channelStatus: 500 });
    await pickFirstEquipment();

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.channels.unmappedSummaryTitle)).not.toBeInTheDocument();
  });
});

/**
 * 조회 조건의 두 축 — **초안(모아서 적용)과 적용값**.
 *
 * ⛔ **한 벌을 나눠 갖지 않는다.** 형제 화면 셋에서 실제로 났던 결함(client#314·#316)이
 * 여기 오지 않았음을 네 방향 중 «이 화면에 있는 두 방향»으로 확인한다 — 이 페인에는 아직
 * 즉시 적용되는 조건이 없어 나머지 둘은 잴 자리가 없다.
 */
describe('W-05-07 — 조회 조건의 두 축', () => {
  it('적용하지 않은 입력도 초기화가 거둔다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await screen.findByText('EQ-101');

    const box = within(equipmentPane()).getByRole('searchbox', { name: t.equipment.searchLabel });

    await user.type(box, '성형');
    await user.click(within(equipmentPane()).getByRole('button', { name: messages.common.reset }));

    expect(box).toHaveValue('');
  });

  it('칩으로 검색어를 거둬도 고른 공장은 남는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await screen.findByText('EQ-101');

    const pane = within(equipmentPane());

    await user.type(pane.getByRole('searchbox', { name: t.equipment.searchLabel }), '성형');
    await user.click(pane.getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: '가상 1공장' }));
    await user.click(pane.getByRole('button', { name: messages.common.search }));

    await screen.findByText(t.equipment.chipKeyword('성형'));

    await user.click(screen.getByRole('button', { name: t.equipment.chipRemoveKeyword }));

    expect(screen.getByText(t.equipment.chipPlant('가상 1공장'))).toBeInTheDocument();
    expect(screen.queryByText(t.equipment.chipKeyword('성형'))).not.toBeInTheDocument();
  });

  /**
   * ⭐ **밖에서 거둔 조건은 입력칸에서도 사라져야 한다.** 칩만 사라지고 칸에 낱말이 남으면
   * 다음에 「조회」를 누르는 순간 **거둔 줄 알았던 조건이 되살아난다.**
   */
  it('칩으로 검색어를 거두면 입력칸도 함께 비워진다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await screen.findByText('EQ-101');

    const pane = within(equipmentPane());
    const box = pane.getByRole('searchbox', { name: t.equipment.searchLabel });

    await user.type(box, '성형');
    await user.click(pane.getByRole('button', { name: messages.common.search }));
    await screen.findByText(t.equipment.chipKeyword('성형'));

    await user.click(screen.getByRole('button', { name: t.equipment.chipRemoveKeyword }));

    expect(box).toHaveValue('');
  });
});

/**
 * ⭐ **고른 설비는 «지금 목록»에서 찾는다.**
 *
 * 식별자만 들고 첫 행을 붙들면 첫 설비를 골랐을 때는 우연히 맞아 아무 표시도 나지 않는다.
 * 그래서 **첫 행이 아닌 것을 고르는** 시험이 필요하다.
 */
describe('W-05-07 — 고른 설비를 붙드는 자리', () => {
  it('첫 행이 아닌 설비를 골라도 그 설비의 채널이 열린다', async () => {
    renderScreen();
    await pickEquipmentAt(1);

    expect(
      await screen.findByRole('heading', { name: t.channels.paneOf('EQ-102', '가상 성형기 2호') }),
    ).toBeInTheDocument();
  });

  /**
   * 조건을 좁혀 그 설비가 목록 밖으로 나가면 오른쪽도 함께 돌아간다 —
   * 목록에 없는 설비의 채널을 계속 보이면 좌우가 다른 말을 한다.
   */
  it('고른 설비가 조회 결과에서 빠지면 오른쪽도 고르라는 말로 돌아간다', async () => {
    const user = userEvent.setup();
    let narrowed = false;
    const routes: StubRoute[] = [
      {
        match: (request) => isPath(request, '/maintenance/collection-channels'),
        respond: () => jsonResponse(channelListResponse()),
      },
      {
        match: (request) => isPath(request, '/mdm/equipments'),
        respond: () =>
          jsonResponse(
            equipmentListResponse(narrowed ? [] : equipmentItems, narrowed ? 0 : undefined),
          ),
      },
      {
        match: (request) => isPath(request, '/mdm/plants'),
        respond: () => jsonResponse(plantListResponse()),
      },
    ];

    renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(routes) });
    await pickEquipmentAt(0);
    await within(channelPane()).findByText('CYCLE_TIME');

    narrowed = true;
    await user.type(
      within(equipmentPane()).getByRole('searchbox', { name: t.equipment.searchLabel }),
      '없는설비',
    );
    await user.click(within(equipmentPane()).getByRole('button', { name: messages.common.search }));

    expect(await screen.findByText(t.channels.noEquipmentTitle)).toBeInTheDocument();
  });
});

/**
 * 고를 목록의 한계는 감추지 않는다 — 선택칸이 이유 없이 비어 보이면
 * 사용자는 값이 «없다»고 읽는다.
 */
describe('W-05-07 — 공장 선택 목록', () => {
  const withPlants = (respond: () => Response): StubRoute[] => [
    {
      match: (request) => isPath(request, '/maintenance/collection-channels'),
      respond: () => jsonResponse(channelListResponse()),
    },
    {
      match: (request) => isPath(request, '/mdm/equipments'),
      respond: () => jsonResponse(equipmentListResponse()),
    },
    { match: (request) => isPath(request, '/mdm/plants'), respond },
  ];

  it('불러오지 못하면 그 사실을 말한다', async () => {
    renderWithProviders(<CollectionChannelScreen />, {
      fetch: createStubFetch(withPlants(() => jsonResponse({ errors: [] }, { status: 500 }))),
    });

    expect(await screen.findByText(t.optionsLoadFailed)).toBeInTheDocument();
  });

  /** ⭐ 실패가 잘림보다 앞선다 — 아무것도 못 받은 것이 더 큰 사실이다. */
  it('잘렸을 뿐이면 잘렸다고만 말한다', async () => {
    renderWithProviders(<CollectionChannelScreen />, {
      fetch: createStubFetch(
        withPlants(() =>
          jsonResponse({
            items: [{ plantId: 11, plantCode: 'P1', plantName: '가상 1공장', isActive: true }],
            page: { page: 1, size: 100, total: 9 },
          }),
        ),
      ),
    });

    expect(await screen.findByText(t.optionsTruncated)).toBeInTheDocument();
    expect(screen.queryByText(t.optionsLoadFailed)).not.toBeInTheDocument();
  });
});
