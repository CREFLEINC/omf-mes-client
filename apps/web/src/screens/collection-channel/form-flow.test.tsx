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
} from './fixtures';
import { CollectionChannelScreen } from './screen';
import type { CollectionChannel } from './types';

const t = messages.collectionChannel;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

const detailPath = (id: number): string => `/maintenance/collection-channels/${String(id)}`;

const uomListResponse = () => ({
  items: [
    { uomId: 1, uomCode: 'SEC', uomName: '초', decimalScale: 2, isActive: true },
    { uomId: 2, uomCode: 'CEL', uomName: '섭씨', decimalScale: 1, isActive: true },
  ],
  page: { page: 1, size: 100, total: 2 },
});

interface WriteStubOptions {
  /** 나간 쓰기를 담는 곳 */
  writes: Request[];
  channels?: CollectionChannel[];
  /** 쓰기 응답 상태. 200 이 아니면 본문을 오류로 낸다 */
  writeStatus?: number;
  writeBody?: unknown;
  /** 상세 응답에 실을 잠금 토큰 */
  etag?: string;
  detail?: CollectionChannel;
}

const stub = (options: WriteStubOptions): StubRoute[] => [
  {
    match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
    respond: () => jsonResponse(observationListResponse()),
  },
  {
    /* 쓰기가 GET 보다 앞선다 — 같은 경로를 메서드로 가른다 */
    match: (request) =>
      request.method !== 'GET' && isPath(request, '/maintenance/collection-channels'),
    respond: (request) => {
      options.writes.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeChannel(7100, 'NEW'), { status: 201 })
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) => request.method === 'PUT' && isPath(request, detailPath(7003)),
    respond: (request) => {
      options.writes.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeChannel(7003, 'BARREL_TEMP'))
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) => request.method === 'GET' && isPath(request, detailPath(7003)),
    respond: () =>
      jsonResponse(
        options.detail ??
          makeChannel(7003, 'BARREL_TEMP', { signalName: '배럴 온도', unitCode: 'CEL' }),
        { headers: { ETag: options.etag ?? 'W/"7"' } },
      ),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels'),
    respond: () => jsonResponse(channelListResponse(options.channels ?? channelItems)),
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

const renderScreen = (options: WriteStubOptions) =>
  renderWithProviders(<CollectionChannelScreen />, { fetch: createStubFetch(stub(options)) });

const channelPane = (): HTMLElement => screen.getByRole('region', { name: t.channels.paneTitle });
const formDialog = (): HTMLElement => screen.getByRole('dialog');

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

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

describe('W-05-07 ② — 채널을 더한다', () => {
  /** ⭐ 계약이 설비를 요구한다 — 고르기 전에는 더할 자리 자체가 없다. */
  it('설비를 고르기 전에는 채널 추가가 서지 않는다', async () => {
    renderScreen({ writes: [] });

    expect(await screen.findByText(t.channels.noEquipmentTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.addChannel })).not.toBeInTheDocument();
  });

  it('채널 추가를 누르면 등록 창이 열린다', async () => {
    const user = userEvent.setup();

    renderScreen({ writes: [] });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    expect(await screen.findByRole('dialog', { name: t.form.createTitle })).toBeInTheDocument();
  });

  /** 좌우가 멀어지면 무엇에 더하는지 잊는다 — 창이 스스로 말한다. */
  it('등록 창이 어느 설비에 더하는지 말하고 옮길 수 없다고 밝힌다', async () => {
    const user = userEvent.setup();

    renderScreen({ writes: [] });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(await screen.findByRole('dialog'));

    expect(
      dialog.getByText(t.form.equipmentFixed('EQ-101', '가상 성형기 1호')),
    ).toBeInTheDocument();
    expect(dialog.getByText(t.actionReasons.equipmentFixed)).toBeInTheDocument();
  });

  it('채널명 없이 저장하면 막고 그 칸에 표시한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));
    await user.click(within(formDialog()).getByRole('button', { name: messages.common.save }));

    expect(within(formDialog()).getByRole('textbox', { name: /채널명/ })).toBeInvalid();
    expect(writes).toHaveLength(0);
  });

  it('고른 설비에 매인 등록 요청이 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);

    expect(request.method).toBe('POST');
    expect(await bodyOf(request)).toEqual({ equipmentId: 3001, channelKey: 'NEW_CHANNEL' });
  });

  /** 계약이 전 쓰기에 멱등 키를 요구한다. */
  it('등록에 멱등 키가 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
  });

  /** ⛔ 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다. */
  it('등록에는 잠금 토큰을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('If-Match')).toBeNull();
  });

  it('저장에 성공하면 창이 닫힌다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('W-05-07 ② — 채널을 고친다', () => {
  const openEdit = async (): Promise<void> => {
    const user = userEvent.setup();

    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: /^BARREL_TEMP/ }));
  };

  it('채널명을 누르면 수정 창이 그 값으로 열린다', async () => {
    renderScreen({ writes: [] });
    await openEdit();

    const dialog = within(await screen.findByRole('dialog', { name: t.form.editTitle }));

    expect(dialog.getByRole('textbox', { name: /신호 이름/ })).toHaveValue('배럴 온도');
  });

  /** ⭐ 채널명은 등록에서만 정한다 — 잠긴 입력칸이 아니라 값 표기 + 사유로 낸다. */
  it('수정 창의 채널명은 입력칸이 아니라 값 표기다', async () => {
    renderScreen({ writes: [] });
    await openEdit();

    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.queryByRole('textbox', { name: /채널명/ })).not.toBeInTheDocument();
    expect(dialog.getByText(t.actionReasons.channelKeyFixed)).toBeInTheDocument();
  });

  /** ⭐ 잠금 토큰은 «상세» 경로에 보관된다 — 쓰기 경로로 꺼내면 늘 비어 있다. */
  it('수정에 상세가 준 잠금 토큰이 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, etag: 'W/"42"' });
    await openEdit();

    const dialog = within(await screen.findByRole('dialog'));

    await user.clear(dialog.getByRole('textbox', { name: /신호 이름/ }));
    await user.type(dialog.getByRole('textbox', { name: /신호 이름/ }), '배럴 온도 3구역');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(request.headers.get('If-Match')).toBe('W/"42"');
  });

  /**
   * ⭐ **이 슬라이스에서 가장 중요한 감지기다.** 뺀 필드를 서버가 「비우라」로 읽으면
   * 이름만 고쳤는데 이어 둔 검사 항목이 조용히 끊긴다 — 목록의 「미매핑」이 하나 늘어야
   * 비로소 드러나는 결함이다.
   */
  it('이름만 고쳐도 이어 둔 검사 항목과 사용 여부가 그대로 실려 나간다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    const linked = makeChannel(7003, 'BARREL_TEMP', {
      signalName: '배럴 온도',
      unitCode: 'CEL',
      inspectionItemId: 5009,
      isActive: false,
    });

    renderScreen({
      writes,
      /* ⭐ 폼은 «목록 행»에서 시작한다 — 상세를 기다리는 동안 빈 창을 보이지 않기 위해서다. */
      channels: [channelItems[0] as CollectionChannel, linked],
      detail: linked,
    });
    await openEdit();

    const dialog = within(await screen.findByRole('dialog'));

    await user.type(dialog.getByRole('textbox', { name: /신호 이름/ }), ' 3구역');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await bodyOf(onlyWrite(writes))).toEqual({
      signalName: '배럴 온도 3구역',
      unitCode: 'CEL',
      inspectionItemId: 5009,
      isActive: false,
    });
  });

  /** ⚠ 계약이 이 칸을 널 허용으로 두지 않아, 빼면 한번 적은 이름을 지울 수 없다. */
  it('신호 이름을 비우면 빈 값으로 보내 지운다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEdit();

    const dialog = within(await screen.findByRole('dialog'));

    await user.clear(dialog.getByRole('textbox', { name: /신호 이름/ }));
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((await bodyOf(onlyWrite(writes))).signalName).toBe('');
  });
});

describe('W-05-07 ② — 저장이 실패하면', () => {
  it('유일 위반은 채널명 칸에 붙는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 400,
      writeBody: {
        errors: [
          {
            scope: 'field',
            field: 'channelKey',
            code: 'DUPLICATE',
            message: '이 설비에 같은 이름의 채널이 이미 있습니다.',
          },
        ],
      },
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'CYCLE_TIME');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    expect(
      await dialog.findByText('이 설비에 같은 이름의 채널이 이미 있습니다.'),
    ).toBeInTheDocument();
    expect(dialog.getByRole('textbox', { name: /채널명/ })).toBeInvalid();
  });

  it('창이 열린 채로 남는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes, writeStatus: 500 });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /** ⭐ 「다시 불러오기」는 다시 불러와야 풀리는 갈래에만 둔다 — 등록에는 토큰 자체가 없다. */
  it('등록 실패에는 다시 불러오기를 내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 409,
      writeBody: { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(
      dialog.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  /** ⭐ 짝을 함께 잰다 — 수정에는 불러올 토큰이 있으니 그 갈래에는 «있어야» 한다. */
  it('수정에서 충돌하면 다시 불러올 자리를 준다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 409,
      writeBody: { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: /^BARREL_TEMP/ }));

    const dialog = within(await screen.findByRole('dialog'));

    await user.type(dialog.getByRole('textbox', { name: /신호 이름/ }), ' 3구역');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));

    expect(
      await dialog.findByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **서버가 붙인 오류도 고치는 즉시 거둔다.** 화면 검증이 붙인 것만 거두면, 유일 위반을
   * 고치려고 이름을 바꿔 치는 동안 **「이미 있습니다」가 새 이름 옆에 계속 붙어 있다.**
   */
  it('서버가 붙인 오류도 그 칸을 고치면 사라진다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 400,
      writeBody: {
        errors: [
          {
            scope: 'field',
            field: 'channelKey',
            code: 'DUPLICATE',
            message: '이 설비에 같은 이름의 채널이 이미 있습니다.',
          },
        ],
      },
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());
    const box = dialog.getByRole('textbox', { name: /채널명/ });

    await user.type(box, 'CYCLE_TIME');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));
    expect(
      await dialog.findByText('이 설비에 같은 이름의 채널이 이미 있습니다.'),
    ).toBeInTheDocument();

    await user.type(box, '_2');

    expect(box).not.toBeInvalid();
    expect(
      dialog.queryByText('이 설비에 같은 이름의 채널이 이미 있습니다.'),
    ).not.toBeInTheDocument();
  });

  /** 고친 자리에 옛 오류가 남으면 사용자가 헛돈다. */
  it('칸을 고치면 그 칸의 오류가 사라진다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.click(dialog.getByRole('button', { name: messages.common.save }));
    expect(dialog.getByRole('textbox', { name: /채널명/ })).toBeInvalid();

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'N');

    expect(dialog.getByRole('textbox', { name: /채널명/ })).not.toBeInvalid();
  });
});

/**
 * ⭐ **창을 닫으면 끝난 쓰기를 거둔다.**
 *
 * 거두지 않으면 앞서 실패한 저장의 배너가 캐시처럼 남아, **다음에 창을 열자마자 아직 아무것도
 * 누르지 않았는데 「저장하지 못했습니다」가 서 있다.**
 */
describe('W-05-07 ② — 창 안의 선택 목록', () => {
  /** 고를 목록이 반쪽이면 선택칸이 이유 없이 비어 보인다 — 감추지 않는다. */
  it('단위 목록을 불러오지 못하면 창이 그 사실을 말한다', async () => {
    const user = userEvent.setup();
    const routes = stub({ writes: [] }).map((route) => route);
    const withFailingUoms: StubRoute[] = [
      {
        match: (request) => isPath(request, '/mdm/uoms'),
        respond: () => jsonResponse({ errors: [] }, { status: 500 }),
      },
      ...routes,
    ];

    renderWithProviders(<CollectionChannelScreen />, {
      fetch: createStubFetch(withFailingUoms),
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    expect(await within(formDialog()).findByText(t.optionsLoadFailed)).toBeInTheDocument();
  });
});

describe('W-05-07 ② — 창을 닫으면', () => {
  it('앞서 실패한 저장의 배너가 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 400,
      writeBody: {
        errors: [{ scope: 'screen', code: 'INVALID', message: '저장할 수 없는 값입니다.' }],
      },
    });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    const dialog = within(formDialog());

    await user.type(dialog.getByRole('textbox', { name: /채널명/ }), 'NEW_CHANNEL');
    await user.click(dialog.getByRole('button', { name: messages.common.save }));
    expect(await screen.findByText('저장할 수 없는 값입니다.')).toBeInTheDocument();

    await user.click(within(formDialog()).getByRole('button', { name: messages.common.cancel }));
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    expect(screen.queryByText('저장할 수 없는 값입니다.')).not.toBeInTheDocument();
  });

  /** 앞서 친 값도 남지 않는다 — 남으면 다음 등록이 앞 등록의 흔적에서 시작한다. */
  it('앞서 친 값이 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ writes: [] });
    await pickFirstEquipment();
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    await user.type(within(formDialog()).getByRole('textbox', { name: /채널명/ }), 'TYPED');
    await user.click(within(formDialog()).getByRole('button', { name: messages.common.cancel }));
    await user.click(within(channelPane()).getByRole('button', { name: t.actions.addChannel }));

    expect(within(formDialog()).getByRole('textbox', { name: /채널명/ })).toHaveValue('');
  });
});
