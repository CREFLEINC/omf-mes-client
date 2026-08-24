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
  plantListResponse,
  scopeItemsResponse,
  scopeProcessesResponse,
  uomListResponse,
} from './fixtures';
import { CollectionChannelScreen } from './screen';
import type { CollectionChannel } from './types';

const t = messages.collectionChannel;
const ta = t.activation;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

/** 켜져 있는 줄과 꺼져 있는 줄을 함께 둔다 — 방향이 줄마다 다르다. */
const rows: CollectionChannel[] = [
  makeChannel(7001, 'CYCLE_TIME', {
    signalName: '사이클 타임',
    unitCode: 'SEC',
    inspectionItemId: 5001,
  }),
  makeChannel(7002, 'PAUSED', { signalName: '멈춘 채널', isActive: false }),
];

interface Options {
  writes?: Request[];
  /** 상세 응답. 「지금 값」이 여기서 온다 */
  detail?: CollectionChannel;
  writeStatus?: number;
  writeBody?: unknown;
  /** 상세를 영영 주지 않는다 — 잠금이 걸리는지 본다 */
  detailPending?: boolean;
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
    match: (request) =>
      request.method === 'PUT' && isPath(request, '/maintenance/collection-channels/7001'),
    respond: (request) => {
      options.writes?.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeChannel(7001, 'CYCLE_TIME', { isActive: false }))
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) =>
      request.method === 'PUT' && isPath(request, '/maintenance/collection-channels/7002'),
    respond: (request) => {
      options.writes?.push(request);

      return jsonResponse(makeChannel(7002, 'PAUSED', { isActive: true }));
    },
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels/7001'),
    respond: () =>
      jsonResponse(options.detail ?? (rows[0] as CollectionChannel), {
        headers: { ETag: 'W/"11"' },
      }),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels/7002'),
    respond: () => jsonResponse(rows[1] as CollectionChannel, { headers: { ETag: 'W/"12"' } }),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
    respond: () => jsonResponse(observationListResponse()),
  },
  {
    match: (request) => isPath(request, '/maintenance/collection-channels'),
    respond: () => jsonResponse(channelListResponse(rows)),
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

/** 「미사용 포함」을 켜야 꺼진 줄이 보인다. */
const pickEquipment = async (includeInactive = false): Promise<void> => {
  const user = userEvent.setup();
  const first = equipmentItems[0];

  if (first === undefined) throw new Error('설비 표본이 비어 있습니다.');

  await user.click(
    await screen.findByRole('button', {
      name: t.equipment.selectLabel(first.equipmentCode, first.equipmentName),
    }),
  );
  await within(channelPane()).findByText('CYCLE_TIME');

  if (includeInactive) {
    await user.click(
      within(channelPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );
  }
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

describe('W-05-07 ⑤ — 줄마다 방향이 다르다', () => {
  it('켜져 있는 줄에는 끄는 단추가 선다', async () => {
    renderScreen();
    await pickEquipment();

    expect(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    ).toBeInTheDocument();
  });

  /** ⭐ 형제 화면과 갈리는 자리 — 여기서는 계약이 되살리는 것도 허용한다. */
  it('꺼져 있는 줄에는 켜는 단추가 선다', async () => {
    renderScreen();
    await pickEquipment(true);

    expect(
      await within(channelPane()).findByRole('button', { name: ta.resumeLabel('PAUSED') }),
    ).toBeInTheDocument();
  });

  /** 줄이 여럿일 때 「사용 중지」만으로는 어느 채널인지 알 수 없다. */
  it('단추의 접근 이름에 대상이 담긴다', async () => {
    renderScreen();
    await pickEquipment();

    const button = within(channelPane()).getByRole('button', {
      name: ta.deactivateLabel('CYCLE_TIME'),
    });

    expect(button).toHaveTextContent(ta.deactivateAction);
  });
});

describe('W-05-07 ⑤ — 확인 창', () => {
  const openDeactivate = async (): Promise<void> => {
    const user = userEvent.setup();

    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
  };

  it('끄기 전에 확인을 묻고 대상을 말한다', async () => {
    renderScreen();
    await openDeactivate();

    expect(screen.getByRole('dialog', { name: ta.deactivateTitle })).toBeInTheDocument();
    expect(dialog().getByText(ta.target('CYCLE_TIME'))).toBeInTheDocument();
  });

  /** ⭐ 되돌릴 수 있다는 사실을 밝힌다 — 형제 화면과 여기가 갈리는 자리다. */
  it('되돌릴 수 있다고 밝힌다', async () => {
    renderScreen();
    await openDeactivate();

    expect(dialog().getByText(ta.deactivateReversible)).toBeInTheDocument();
  });

  /**
   * ⚠ **모르는 것을 단정하지 않는다.** 사용 안 함이 수집까지 멈추는지 아직 확인되지 않았다 —
   * 단정하면 사용자는 그 말을 믿고 라인을 세우거나 세우지 않는다.
   */
  it('값이 버려진다고도 담긴다고도 말하지 않는다', async () => {
    renderScreen();
    await openDeactivate();

    const text = screen.getByRole('dialog').textContent ?? '';

    expect(text).not.toContain('버려집니다');
    expect(text).toContain(ta.deactivateImpact);
  });

  it('켜는 창은 다른 말을 한다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickEquipment(true);
    await user.click(
      await within(channelPane()).findByRole('button', { name: ta.resumeLabel('PAUSED') }),
    );

    expect(await screen.findByRole('dialog', { name: ta.resumeTitle })).toBeInTheDocument();
    expect(dialog().getByText(ta.resumeImpact)).toBeInTheDocument();
    expect(dialog().queryByText(ta.deactivateImpact)).not.toBeInTheDocument();
  });

  it('취소하면 아무것도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openDeactivate();
    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});

describe('W-05-07 ⑤ — 끄고 켠다', () => {
  /**
   * ⛔ **이 슬라이스에서 가장 중요한 감지기다.** 사용 중지가 전용 경로가 아니라 «수정
   * 요청»이라, `isActive` 만 실어 보내면 서버가 그것을 「나머지를 비우라」로 읽을 수 있고
   * **이름·단위·이어 둔 항목이 함께 지워진다.**
   */
  it('지금 값을 통째로 되보내며 사용 여부만 바꾼다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await bodyOf(onlyWrite(writes))).toEqual({
      signalName: '사이클 타임',
      unitCode: 'SEC',
      inspectionItemId: 5001,
      /* ⭐ 조건도 «지금 값»으로 되보낸다 — 빠뜨리면 유일 범위가 달라진다. */
      itemId: null,
      processId: null,
      isActive: false,
    });
  });

  it('켜는 쪽은 참을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickEquipment(true);
    await user.click(
      await within(channelPane()).findByRole('button', { name: ta.resumeLabel('PAUSED') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.resumeAction }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((await bodyOf(onlyWrite(writes))).isActive).toBe(true);
  });

  /** ⭐ 잠금 토큰은 «상세» 경로에 보관된다 — 쓰기 경로로 꺼내면 늘 비어 있다. */
  it('잠금 토큰이 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('If-Match')).toBe('W/"11"');
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('성공하면 창이 닫힌다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('실패하면 창이 남고 이유가 선다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 409,
      writeBody: { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
    });
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      await dialog().findByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });
});

/**
 * ⛔ **지금 값을 모르는 채로는 보내지 않는다.** 모르는 채 보내면 이름·단위·이어 둔 항목이
 * 함께 지워진다 — 「모르면 잠근다」가 여기서 값을 한다.
 */
describe('W-05-07 ⑤ — 대상의 지금 값을 못 받았으면', () => {
  it('실행이 잠기고 잠긴 이유가 함께 선다', async () => {
    const user = userEvent.setup();
    const pendingDetail: StubRoute[] = [
      {
        match: (request) => isPath(request, '/maintenance/collection-channels/7001'),
        respond: () => jsonResponse({ errors: [] }, { status: 500 }),
      },
      ...routes({}),
    ];

    renderScreen({}, pendingDetail);
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');

    expect(dialog().getByRole('button', { name: ta.deactivateAction })).toBeDisabled();
    expect(dialog().getByText(ta.loadingTarget)).toBeInTheDocument();
  });
});

/**
 * ⛔ **끈 뒤에는 목록을 다시 받는다.** 받지 않으면 방금 끈 줄이 여전히 켜져 있는 것처럼
 * 남아, 사용자는 **끄기가 안 먹은 줄 알고 한 번 더 누른다.**
 */
describe('W-05-07 ⑤ — 끈 뒤 목록', () => {
  it('바뀐 상태를 다시 받아 그린다', async () => {
    const user = userEvent.setup();
    let deactivated = false;
    const custom: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'PUT' && isPath(request, '/maintenance/collection-channels/7001'),
        respond: () => {
          deactivated = true;

          return jsonResponse(makeChannel(7001, 'CYCLE_TIME', { isActive: false }));
        },
      },
      {
        match: (request) => isPath(request, '/maintenance/collection-channels/7001'),
        respond: () => jsonResponse(rows[0] as CollectionChannel, { headers: { ETag: 'W/"11"' } }),
      },
      {
        match: (request) => isPath(request, '/maintenance/collection-channels/observations'),
        respond: () => jsonResponse(observationListResponse()),
      },
      {
        match: (request) => isPath(request, '/maintenance/collection-channels'),
        respond: () =>
          /* 끈 뒤에는 「미사용 포함」이 꺼져 있어 그 줄이 목록에서 빠진다. */
          jsonResponse(channelListResponse(deactivated ? [] : rows)),
      },
      ...routes({}),
    ];

    renderScreen({}, custom);
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));

    await waitFor(() =>
      expect(within(channelPane()).queryByText('CYCLE_TIME')).not.toBeInTheDocument(),
    );
  });

  /** 창을 닫으면 앞서 실패한 저장의 배너가 다음 창에 남지 않는다. */
  it('앞서 실패한 저장의 배너가 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      writeStatus: 400,
      writeBody: {
        errors: [{ scope: 'screen', code: 'INVALID', message: '지금은 바꿀 수 없습니다.' }],
      },
    });
    await pickEquipment();
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');
    await user.click(dialog().getByRole('button', { name: ta.deactivateAction }));
    expect(await screen.findByText('지금은 바꿀 수 없습니다.')).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(
      within(channelPane()).getByRole('button', { name: ta.deactivateLabel('CYCLE_TIME') }),
    );
    await screen.findByRole('dialog');

    expect(screen.queryByText('지금은 바꿀 수 없습니다.')).not.toBeInTheDocument();
  });
});
