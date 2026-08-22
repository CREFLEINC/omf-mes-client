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
  channelListResponse,
  equipmentItems,
  equipmentListResponse,
  makeChannel,
  observationListResponse,
  planListResponse,
  plantListResponse,
  specListResponse,
  uomListResponse,
  versionListResponse,
} from './fixtures';
import { CollectionChannelScreen } from './screen';
import type { CollectionChannel } from './types';

const t = messages.collectionChannel;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

const queryOf = (request: Request): URLSearchParams => new URL(request.url).searchParams;

interface Options {
  writes?: Request[];
  reads?: Request[];
  channels?: CollectionChannel[];
  /** 이 경로를 500으로 되돌린다 */
  failPath?: string;
  /** 항목 목록을 비운다 */
  emptySpecs?: boolean;
  /** 단위 목록을 실패시킨다 — 옮길 표가 비어 「모른다」가 선다 */
  failUoms?: boolean;
}

const channels: CollectionChannel[] = [
  makeChannel(7001, 'CYCLE_TIME', { signalName: '사이클 타임', unitCode: 'SEC' }),
  makeChannel(7002, 'LINKED', { unitCode: 'SEC', inspectionItemId: 5001 }),
];

const routes = (options: Options): StubRoute[] => {
  const track = (request: Request): void => {
    options.reads?.push(request);
  };
  const fail = (path: string): boolean => options.failPath === path;

  return [
    {
      match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
      respond: () => jsonResponse(observationListResponse()),
    },
    {
      match: (request) =>
        request.method !== 'GET' && isPath(request, '/maintenance/collection-channels'),
      respond: (request) => {
        options.writes?.push(request);

        return jsonResponse(makeChannel(7100, 'NEW'), { status: 201 });
      },
    },
    {
      match: (request) =>
        request.method === 'PUT' && isPath(request, '/maintenance/collection-channels/7002'),
      respond: (request) => {
        options.writes?.push(request);

        return jsonResponse(makeChannel(7002, 'LINKED'));
      },
    },
    {
      match: (request) => isPath(request, '/maintenance/collection-channels/7002'),
      respond: () => jsonResponse(makeChannel(7002, 'LINKED'), { headers: { ETag: 'W/"5"' } }),
    },
    {
      match: (request) => isPath(request, '/maintenance/collection-channels'),
      respond: () => jsonResponse(channelListResponse(options.channels ?? channels)),
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
      respond: () =>
        options.failUoms === true
          ? jsonResponse({ errors: [] }, { status: 500 })
          : jsonResponse(uomListResponse()),
    },
    {
      match: (request) => isPath(request, '/quality/inspection-plans'),
      respond: (request) => {
        track(request);

        return fail('/quality/inspection-plans')
          ? jsonResponse({ errors: [] }, { status: 500 })
          : jsonResponse(planListResponse());
      },
    },
    {
      match: (request) => isPath(request, '/quality/inspection-plan-versions/4101/items'),
      respond: (request) => {
        track(request);

        return jsonResponse(specListResponse(options.emptySpecs === true ? [] : undefined));
      },
    },
    {
      match: (request) => isPath(request, '/quality/inspection-plan-versions'),
      respond: (request) => {
        track(request);

        return jsonResponse(versionListResponse());
      },
    },
  ];
};

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(routes(options)) });

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

/** 선택칸에서 한 값을 고른다. DS `Select` 는 트리거를 눌러야 목록이 열린다. */
const choose = async (label: string, optionName: string | RegExp): Promise<void> => {
  const user = userEvent.setup();

  await user.click(dialog().getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: optionName }));
};

const openCreate = async (): Promise<void> => {
  const user = userEvent.setup();

  await pickFirstEquipment();
  await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));
  await screen.findByRole('dialog');
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

describe('W-05-07 ③ — 세 칸을 차례로 좁힌다', () => {
  /**
   * ⭐ **창을 열기 전에는 세 조회가 돌지 않는다.** 목록만 보는 사람에게는 쓸 일이 없는
   * 자료라, 화면을 열자마자 부르면 아무도 안 볼 것을 받아 온다.
   */
  it('창을 열기 전에는 검사기준을 조회하지 않는다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await pickFirstEquipment();

    expect(reads).toHaveLength(0);
  });

  it('창을 열면 검사기준을 조회한다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await openCreate();

    await waitFor(() => expect(reads.length).toBeGreaterThan(0));
    expect(new URL(reads[0]?.url ?? '').pathname).toBe('/quality/inspection-plans');
  });

  /** 계약이 `inspectionPlanId` 를 필수로 두었다 — 고르기 전에는 부를 수 없다. */
  it('기준을 고르기 전에는 버전 칸이 사유와 함께 잠긴다', async () => {
    renderScreen();
    await openCreate();

    expect(dialog().getByRole('combobox', { name: t.itemPicker.versionLabel })).toBeDisabled();
    expect(dialog().getByText(t.itemPicker.versionNeedsPlan)).toBeInTheDocument();
  });

  it('버전을 고르기 전에는 항목 칸이 사유와 함께 잠긴다', async () => {
    renderScreen();
    await openCreate();

    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeDisabled();
    expect(dialog().getByText(t.itemPicker.itemNeedsVersion)).toBeInTheDocument();
  });

  it('기준을 고르면 그 기준의 버전만 조회한다', async () => {
    const reads: Request[] = [];

    renderScreen({ reads });
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);

    await waitFor(() =>
      expect(reads.some((request) => isPath(request, '/quality/inspection-plan-versions'))).toBe(
        true,
      ),
    );

    const versionRead = reads.find((request) =>
      isPath(request, '/quality/inspection-plan-versions'),
    );

    expect(queryOf(versionRead as Request).get('inspectionPlanId')).toBe('4001');
  });

  it('버전을 고르면 그 버전의 항목을 조회한다', async () => {
    renderScreen();
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);

    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeEnabled();
    await choose(t.itemPicker.itemLabel, /사이클 타임/);

    expect(dialog().getByText(t.itemPicker.mappedKnown('사이클 타임'))).toBeInTheDocument();
  });

  /**
   * ⭐ **위 칸을 바꾸면 아래 칸이 함께 풀린다.** 기준을 바꿨는데 앞 기준에서 고른 버전이
   * 남으면, 화면은 새 기준을 보이면서 **옛 기준의 항목을 이어 두게 된다.**
   */
  it('기준을 바꾸면 고른 버전이 풀린다', async () => {
    renderScreen();
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeEnabled();

    await choose(t.itemPicker.planLabel, /IP-102/);

    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeDisabled();
  });

  /**
   * ⛔ **길을 남기면 앞 채널의 기준·버전이 다음 창에 그대로 보인다.** 창은 「어느 항목인지
   * 확인할 수 없습니다」라고 말해 놓고 그 아래에 엉뚱한 길을 펼쳐 두는 셈이 된다.
   */
  it('창을 다시 열면 좁혀 둔 길이 처음으로 돌아간다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeEnabled();

    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(channelPane()).getByRole('button', { name: /^LINKED( \(미사용\))?$/ }));
    await screen.findByRole('dialog');

    expect(dialog().getByRole('combobox', { name: t.itemPicker.versionLabel })).toBeDisabled();
    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeDisabled();
  });

  /** 반대 방향도 같다 — 수정 창에서 좁혀 둔 길이 등록 창에 딸려 오지 않는다. */
  it('수정 창에서 좁힌 길이 등록 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: /^LINKED( \(미사용\))?$/ }));
    await screen.findByRole('dialog');

    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    expect(dialog().getByRole('combobox', { name: t.itemPicker.itemLabel })).toBeEnabled();

    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));
    await screen.findByRole('dialog');

    expect(dialog().getByRole('combobox', { name: t.itemPicker.versionLabel })).toBeDisabled();
  });

  it('버전에 항목이 없으면 그 사실을 말한다', async () => {
    renderScreen({ emptySpecs: true });
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);

    expect(await dialog().findByText(t.itemPicker.noItems)).toBeInTheDocument();
  });

  it('검사기준을 불러오지 못하면 그 사실을 말한다', async () => {
    renderScreen({ failPath: '/quality/inspection-plans' });
    await openCreate();

    expect(await dialog().findByText(t.itemPicker.plansLoadFailed)).toBeInTheDocument();
  });
});

describe('W-05-07 ③ — 잇고 끊는다', () => {
  it('고른 항목이 등록 요청에 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();
    await user.type(dialog().getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /사이클 타임/);
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((await bodyOf(onlyWrite(writes))).inspectionItemId).toBe(5001);
  });

  /** ⭐ 이어 둔 데 없이도 등록할 수 있다(스펙 §5-2) — 항목이 아직 없어도 채널은 먼저 만든다. */
  it('잇지 않고도 등록할 수 있고 그때는 아예 싣지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();
    await user.type(dialog().getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect('inspectionItemId' in (await bodyOf(onlyWrite(writes)))).toBe(false);
  });

  it('잇지 않은 채널의 창은 값이 버려진다고 말한다', async () => {
    renderScreen();
    await openCreate();

    expect(dialog().getByText(t.itemPicker.unmapped)).toBeInTheDocument();
  });

  /** ⛔ 아는 척하지 않는다 — 이어 둔 것이 «무엇인지» 계약으로는 되찾을 수 없다. */
  it('이어 둔 채널의 창은 어느 항목인지 모른다고 밝힌다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: /^LINKED( \(미사용\))?$/ }));

    expect(await dialog().findByText(t.itemPicker.mappedUnknown)).toBeInTheDocument();
  });

  /**
   * ⛔ **찾은 뒤에도 「모른다」고 하지 않는다.** 바로 옆에 이름을 적어 두고 모른다고 말하면
   * 사용자는 둘 중 어느 쪽을 믿어야 할지 알 수 없다. 브라우저 확인에서 실제로 그렇게 보였다.
   */
  it('아래에서 골라 이름을 알게 되면 그 이름으로 말한다', async () => {
    renderScreen();
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /사이클 타임/);

    expect(dialog().getByText(t.itemPicker.mappedKnown('사이클 타임'))).toBeInTheDocument();
    expect(dialog().queryByText(t.itemPicker.mappedUnknown)).not.toBeInTheDocument();
  });

  it('연결 해제를 누르면 끊긴 상태로 저장된다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: /^LINKED( \(미사용\))?$/ }));
    await screen.findByRole('dialog');

    await user.click(dialog().getByRole('button', { name: t.itemPicker.unmapAction }));
    expect(dialog().getByText(t.itemPicker.unmapped)).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((await bodyOf(onlyWrite(writes))).inspectionItemId).toBeNull();
  });

  /** 끊을 것이 없으면 누를 자리도 없다 — 눌러도 아무 일도 없는 컨트롤을 두지 않는다(G-23). */
  it('이어 둔 데가 없으면 연결 해제가 잠긴다', async () => {
    renderScreen();
    await openCreate();

    expect(dialog().getByRole('button', { name: t.itemPicker.unmapAction })).toBeDisabled();
  });
});

describe('W-05-07 ③ — 단위가 다르면', () => {
  /** ⛔ 자동 변환하지 않는다 — 틀리면 측정값이 조용히 어긋난다(스펙 §5-5). */
  it('경고하고 두 단위를 함께 말한다', async () => {
    renderScreen();
    await openCreate();
    await choose('단위', 'SEC · 초');
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /배럴 온도/);

    expect(dialog().getByText(t.unitMatch.mismatch('SEC', 'CEL'))).toBeInTheDocument();
  });

  it('같으면 아무 말도 하지 않는다', async () => {
    renderScreen();
    await openCreate();
    await choose('단위', 'SEC · 초');
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /사이클 타임/);

    expect(dialog().queryByText(t.unitMatch.mismatchTitle)).not.toBeInTheDocument();
    expect(dialog().queryByText(t.unitMatch.unknown)).not.toBeInTheDocument();
  });

  /** ⛔ 「모른다」를 「같다」로 접지 않는다 — 침묵하면 맞는 것으로 읽힌다(G-9). */
  it('항목의 단위를 옮기지 못하면 모른다고 말한다', async () => {
    renderScreen();
    await openCreate();
    await choose('단위', 'SEC · 초');
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /단위 미지정 항목/);

    expect(dialog().getByText(t.unitMatch.unknown)).toBeInTheDocument();
  });

  it('채널에 단위가 없으면 견주지 않는다', async () => {
    renderScreen();
    await openCreate();
    await choose(t.itemPicker.planLabel, /IP-101/);
    await choose(t.itemPicker.versionLabel, /Rev 2/);
    await choose(t.itemPicker.itemLabel, /배럴 온도/);

    expect(dialog().queryByText(t.unitMatch.mismatchTitle)).not.toBeInTheDocument();
  });
});
