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
  makeObservation,
  observationItems,
  observationListResponse,
  plantListResponse,
  scopeItemsResponse,
  scopeProcessesResponse,
  uomListResponse,
} from './fixtures';
import { CollectionChannelScreen } from './screen';
import type { CollectionChannelObservation } from './types';

const t = messages.collectionChannel;
const ti = t.importLog;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

interface Options {
  writes?: Request[];
  reads?: Request[];
  observations?: CollectionChannelObservation[];
  observationsError?: boolean;
}

const routes = (options: Options): StubRoute[] => [
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
    respond: (request) => {
      options.reads?.push(request);

      return options.observationsError === true
        ? jsonResponse({ errors: [] }, { status: 500 })
        : jsonResponse(observationListResponse(options.observations ?? observationItems));
    },
  },
  {
    match: (request) =>
      request.method === 'POST' && isPath(request, '/maintenance/collection-channels'),
    respond: (request) => {
      options.writes?.push(request);

      return jsonResponse(makeChannel(7100, 'NEW'), { status: 201 });
    },
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels'),
    respond: () => jsonResponse(channelListResponse(channelItems)),
  },
  {
    match: (request) => isPath(request, '/mdm/equipments'),
    respond: () => jsonResponse(equipmentListResponse()),
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

const renderScreen = (options: Options = {}, custom?: StubRoute[]) =>
  renderWithProviders(<CollectionChannelScreen />, {
    fetch: createStubFetch(custom ?? routes(options)),
  });

const channelPane = (): HTMLElement => screen.getByRole('region', { name: t.channels.paneTitle });
const dialog = () => within(screen.getByRole('dialog'));

const pickFirstEquipment = async (): Promise<void> => {
  const user = userEvent.setup();
  const first = equipmentItems[0];

  if (first === undefined) throw new Error('설비 표본이 비어 있습니다.');

  await user.click(
    await screen.findByRole('button', {
      name: t.equipment.selectLabel(first.equipmentCode, first.equipmentName),
    }),
  );
  await within(channelPane()).findByText('CYCLE_TIME');
};

const openImport = async (): Promise<void> => {
  const user = userEvent.setup();

  await pickFirstEquipment();
  await waitFor(() =>
    expect(
      within(channelPane()).getByRole('button', { name: t.actions.importFromLog }),
    ).toBeEnabled(),
  );
  await user.click(within(channelPane()).getByRole('button', { name: t.actions.importFromLog }));
  await screen.findByRole('dialog');
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

describe('W-05-07 ④ — 가져오기 단추', () => {
  /**
   * ⚠ **받은 기록이 없으면 감추지 않고 사유와 함께 잠근다**(공유계약 G-2 · 착수 이슈 §4).
   * 이 설비에서 아직 아무 신호도 오지 않았다는 사실 자체가 알아야 할 정보다.
   */
  it('수신 기록이 없으면 잠기고 사유가 함께 선다', async () => {
    renderScreen({ observations: [] });
    await pickFirstEquipment();

    await waitFor(() =>
      expect(
        within(channelPane()).getByRole('button', { name: t.actions.importFromLog }),
      ).toBeDisabled(),
    );
    expect(within(channelPane()).getByText(ti.noObservationsReason)).toBeInTheDocument();
  });

  it('수신 기록이 있으면 열린다', async () => {
    renderScreen();
    await pickFirstEquipment();

    await waitFor(() =>
      expect(
        within(channelPane()).getByRole('button', { name: t.actions.importFromLog }),
      ).toBeEnabled(),
    );
    expect(within(channelPane()).queryByText(ti.noObservationsReason)).not.toBeInTheDocument();
  });

  /** ⭐ 손 입력을 막지 않는다(스펙 §9-1) — 아직 안 온 채널을 미리 등록할 수 있어야 한다. */
  it('가져오기가 잠겨도 채널 추가는 열려 있다', async () => {
    renderScreen({ observations: [] });
    await pickFirstEquipment();

    expect(within(channelPane()).getByRole('button', { name: t.actions.addChannel })).toBeEnabled();
  });
});

describe('W-05-07 ④ — 고르는 창', () => {
  it('아직 잇지 않은 것만 보는 조건으로 열린다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await openImport();

    await waitFor(() =>
      expect(reads.some((request) => queryOf(request).get('unmappedOnly') === 'true')).toBe(true),
    );
  });

  /** ⭐ 거르는 일을 서버가 한다 — 화면이 받아 온 것만 거르면 잘렸을 때 반쪽이 된다. */
  it('조건을 끄면 서버에 조건 없이 다시 묻는다', async () => {
    const user = userEvent.setup();
    const reads: Request[] = [];

    renderScreen({ reads });
    await openImport();

    const before = reads.length;

    await user.click(dialog().getByRole('checkbox', { name: ti.unmappedOnly }));

    await waitFor(() => expect(reads.length).toBeGreaterThan(before));
    expect(queryOf(reads[reads.length - 1] as Request).has('unmappedOnly')).toBe(false);
  });

  /** ⛔ 이미 등록된 것을 감추지 않는다 — 보이되 고르지 못하게 한다(G-2). */
  it('이미 등록된 신호는 보이되 고를 수 없다', async () => {
    renderScreen();
    await openImport();

    expect(await dialog().findByText(`CYCLE_TIME (${ti.alreadyMapped})`)).toBeInTheDocument();
    expect(dialog().getByRole('checkbox', { name: 'CYCLE_TIME' })).toBeDisabled();
  });

  /** ⭐ 이름만으로는 무엇인지 모른다 — 최근 값이 판단 근거다(스펙 §9-1). */
  it('최근 값과 받은 시각을 함께 보인다', async () => {
    renderScreen();
    await openImport();

    expect(await dialog().findByText('182.4')).toBeInTheDocument();
    /* ⛔ 보는 사람의 시간대로 옮기지 않는다 — 이것은 «설비가 있는 곳»의 시각이다. */
    expect(dialog().getAllByText('2026-08-20 09:40').length).toBeGreaterThan(0);
  });

  it('최근 값이 오지 않은 신호는 기록 없음이라 적는다', async () => {
    renderScreen({ observations: [observationItems[3] as CollectionChannelObservation] });
    await openImport();

    expect(await dialog().findByText(ti.notRecorded)).toBeInTheDocument();
  });

  it('고르기 전에는 만들 수 없다', async () => {
    renderScreen();
    await openImport();

    expect(dialog().getByRole('button', { name: ti.confirm })).toBeDisabled();
  });

  /**
   * ⛔ **화면에 보이지 않는 것이 저장 대상에 남지 않는다.**
   *
   * 조건을 껐다 켜는 사이에 그 신호가 «이미 등록됨»으로 바뀔 수 있다(다른 사람이 먼저
   * 만들었거나, 방금 만든 것이 되돌아왔거나). 골라 둔 채로 남기면 사용자는 **보이지도 고르지도
   * 못하는 것이 만들어지기를 기다리게** 된다.
   */
  it('고른 신호가 이미 등록됨으로 바뀌면 골라 둔 데서 빠진다', async () => {
    const user = userEvent.setup();
    const custom: StubRoute[] = [
      {
        match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
        respond: (request) =>
          jsonResponse(
            observationListResponse(
              queryOf(request).get('unmappedOnly') === 'true'
                ? [makeObservation('SCREW_RPM', { lastValue: '182.4' })]
                : [makeObservation('SCREW_RPM', { lastValue: '182.4', alreadyMapped: true })],
            ),
          ),
      },
      ...routes({}),
    ];

    renderScreen({}, custom);
    await openImport();

    await user.click(await dialog().findByRole('checkbox', { name: 'SCREW_RPM' }));
    expect(dialog().getByText(ti.selectedCount(1))).toBeInTheDocument();

    await user.click(dialog().getByRole('checkbox', { name: ti.unmappedOnly }));

    await waitFor(() => expect(dialog().getByText(ti.selectedCount(0))).toBeInTheDocument());
    expect(dialog().getByRole('button', { name: ti.confirm })).toBeDisabled();
  });

  it('고른 건수를 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openImport();

    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));

    expect(dialog().getByText(ti.selectedCount(1))).toBeInTheDocument();
  });

  it('불러오지 못하면 그 사실을 말한다', async () => {
    const user = userEvent.setup();

    /* 단추를 열어 두려면 첫 조회는 성공해야 한다 — 창을 연 뒤부터 실패시킨다. */
    let failing = false;
    const reads: Request[] = [];
    const custom: StubRoute[] = [
      {
        match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
        respond: (request) => {
          reads.push(request);

          return failing && queryOf(request).get('unmappedOnly') === 'true'
            ? jsonResponse({ errors: [] }, { status: 500 })
            : jsonResponse(observationListResponse());
        },
      },
      ...routes({}),
    ];

    renderScreen({}, custom);
    await pickFirstEquipment();
    await waitFor(() =>
      expect(
        within(channelPane()).getByRole('button', { name: t.actions.importFromLog }),
      ).toBeEnabled(),
    );

    failing = true;
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.importFromLog }));

    expect(await screen.findByText(ti.loadFailed)).toBeInTheDocument();
  });
});

describe('W-05-07 ④ — 채널로 만든다', () => {
  it('고른 신호마다 한 건씩 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openImport();

    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    await user.click(dialog().getByRole('checkbox', { name: 'MOLD_TEMP' }));
    await user.click(dialog().getByRole('button', { name: ti.confirm }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(await bodyOf(writes[0] as Request)).toEqual({
      equipmentId: 3001,
      channelKey: 'SCREW_RPM',
      /* 가져오기는 늘 「전체」다 — 그 사실을 빼지 않고 값으로 적는다. */
      itemId: null,
      processId: null,
    });
    expect(await bodyOf(writes[1] as Request)).toEqual({
      equipmentId: 3001,
      channelKey: 'MOLD_TEMP',
      /* 가져오기는 늘 「전체」다 — 그 사실을 빼지 않고 값으로 적는다. */
      itemId: null,
      processId: null,
    });
  });

  /**
   * ⭐ **건마다 새 멱등 키를 준다.** 하나로 돌려 쓰면 두 번째부터 서버가 첫 응답을 되돌려
   * 주어 **만들어지지 않았는데 만들어진 것처럼 보인다.**
   */
  it('건마다 다른 멱등 키가 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openImport();

    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    await user.click(dialog().getByRole('checkbox', { name: 'MOLD_TEMP' }));
    await user.click(dialog().getByRole('button', { name: ti.confirm }));

    await waitFor(() => expect(writes).toHaveLength(2));

    const keys = writes.map((request) => request.headers.get('Idempotency-Key'));

    expect(keys[0]).not.toBeNull();
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('다 되면 만든 건수를 말한다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openImport();

    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    await user.click(dialog().getByRole('button', { name: ti.confirm }));

    expect(await screen.findByText(ti.createdCount(1))).toBeInTheDocument();
  });
});

/**
 * ⭐ **일부만 되는 것이 정상이다.**
 *
 * 계약에 일괄 등록이 없어 한 건씩 나가므로, 셋을 골랐는데 둘만 되는 일이 실제로 일어난다.
 * 「다 됐다」로 뭉개면 사용자는 안 만들어진 채널을 만들어진 것으로 믿고, 그 채널의 값은
 * 계속 버려진다.
 */
describe('W-05-07 ④ — 일부만 됐을 때', () => {
  /** 본문을 동기로 읽을 수 없어 «몇 번째»로 가른다 — 한 건씩 차례로 나가므로 결정적이다. */
  const failingNth = (
    nth: number,
    writes: Request[],
    failure: { code: string; message: string } = {
      code: 'DUPLICATE',
      message: '같은 이름의 채널이 이미 있습니다.',
    },
  ): StubRoute[] => [
    {
      match: (request) =>
        request.method === 'POST' && isPath(request, '/maintenance/collection-channels'),
      respond: (request) => {
        writes.push(request);

        return writes.length === nth
          ? jsonResponse(
              {
                errors: [{ scope: 'screen', ...failure }],
              },
              { status: 400 },
            )
          : jsonResponse(makeChannel(7100, 'NEW'), { status: 201 });
      },
    },
    ...routes({}),
  ];

  const pickTwoAndImport = async (): Promise<void> => {
    const user = userEvent.setup();

    await openImport();
    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    await user.click(dialog().getByRole('checkbox', { name: 'MOLD_TEMP' }));
    await user.click(dialog().getByRole('button', { name: ti.confirm }));
  };

  it('된 수와 못 된 줄을 함께 말한다', async () => {
    const writes: Request[] = [];

    renderScreen({}, failingNth(2, writes));
    await pickTwoAndImport();

    expect(await screen.findByText(ti.createdCount(1))).toBeInTheDocument();
    expect(screen.getByText(ti.failedCount(1))).toBeInTheDocument();
    /* ⭐ 서버 문구가 아니라 «유일 범위를 담은» 문구가 선다 — 창의 등록과 같은 규칙이다. */
    expect(
      screen.getByText(ti.failedRow('MOLD_TEMP', t.validation.duplicateScope('MOLD_TEMP'))),
    ).toBeInTheDocument();
  });

  /** ⛔ 되말하는 것은 중복뿐이다 — 다른 사유까지 삼키면 서버 말을 지운다. */
  it('중복이 아닌 사유는 서버 말 그대로 낸다', async () => {
    const writes: Request[] = [];

    renderScreen({}, failingNth(2, writes, { code: 'RANGE', message: '값이 범위를 벗어납니다.' }));
    await pickTwoAndImport();

    expect(
      await screen.findByText(ti.failedRow('MOLD_TEMP', '값이 범위를 벗어납니다.')),
    ).toBeInTheDocument();
  });

  /** ⭐ 한 건이 실패해도 멈추지 않는다 — 멈추면 뒤엣것이 왜 안 됐는지 알 수 없다. */
  it('앞에서 실패해도 뒤엣것을 계속 보낸다', async () => {
    const writes: Request[] = [];

    renderScreen({}, failingNth(1, writes));
    await pickTwoAndImport();

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(await screen.findByText(ti.createdCount(1))).toBeInTheDocument();
  });

  /**
   * ⭐ **성공한 것은 골라 둔 데서 빠진다.** 그대로 두면 다시 눌렀을 때 같은 채널을 또
   * 만들려 하고, 서버는 유일 위반으로 되받는다 — 사용자는 무엇이 진짜 문제인지 알 수 없다.
   */
  it('다시 시도할 때 성공한 것을 또 보내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({}, failingNth(2, writes));
    await pickTwoAndImport();
    await screen.findByText(ti.createdCount(1));

    expect(dialog().getByText(ti.selectedCount(1))).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: ti.confirm }));

    await waitFor(() => expect(writes).toHaveLength(3));
    expect(await bodyOf(writes[2] as Request)).toEqual({
      equipmentId: 3001,
      channelKey: 'MOLD_TEMP',
      /* 가져오기는 늘 「전체」다 — 그 사실을 빼지 않고 값으로 적는다. */
      itemId: null,
      processId: null,
    });
  });
});

/**
 * ⛔ **창을 다시 열면 앞 회차의 흔적이 없어야 한다.**
 *
 * 결과 배너가 남으면 아직 아무것도 안 눌렀는데 「1건을 만들었습니다」가 서 있고, 고른 것이
 * 남으면 **눌러 본 적 없는 저장이 한 번 눌리면 나간다.**
 */
describe('W-05-07 ④ — 창을 다시 열면', () => {
  it('앞 회차의 결과와 선택이 남지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openImport();

    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    await user.click(dialog().getByRole('button', { name: ti.confirm }));
    expect(await screen.findByText(ti.createdCount(1))).toBeInTheDocument();

    /* 창에 「닫기」가 둘이다(머리의 X · 바닥의 액션) — 바닥의 것을 고른다. */
    await user.click(
      within(screen.getByRole('dialog').querySelector('footer') as HTMLElement).getByRole(
        'button',
        { name: messages.common.close },
      ),
    );
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.importFromLog }));
    await screen.findByRole('dialog');

    expect(dialog().queryByText(ti.resultTitle)).not.toBeInTheDocument();
    expect(dialog().getByText(ti.selectedCount(0))).toBeInTheDocument();
  });

  /** 보내지 않고 닫은 선택도 남지 않는다 — 저장이 한 번 눌리면 그대로 나간다. */
  it('보내지 않고 닫은 선택도 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openImport();
    await user.click(dialog().getByRole('checkbox', { name: 'SCREW_RPM' }));
    expect(dialog().getByText(ti.selectedCount(1))).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('dialog').querySelector('footer') as HTMLElement).getByRole(
        'button',
        { name: messages.common.close },
      ),
    );
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.importFromLog }));
    await screen.findByRole('dialog');

    expect(dialog().getByText(ti.selectedCount(0))).toBeInTheDocument();
    expect(dialog().getByRole('checkbox', { name: 'SCREW_RPM' })).not.toBeChecked();
  });
});
