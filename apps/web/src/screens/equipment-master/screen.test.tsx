import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  groupById,
  groupDetail,
  groupItems,
  groupsResponse,
  lockedCode,
  makeGroup,
  pageOf,
  plantsResponse,
} from './fixtures';
import { EquipmentMasterScreen } from './screen';
import type { EquipmentGroup } from './types';

const t = messages.equipmentMaster;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const isUnder = (request: Request, prefix: string): boolean =>
  new URL(request.url).pathname.startsWith(prefix);

/** 경로 끝의 식별자. 스텁이 늘 같은 건을 돌려주지 않게 한다. */
const idOf = (request: Request): number => Number(new URL(request.url).pathname.split('/').at(-1));

interface RenderOptions {
  route?: string;
  respondGroups?: (request: Request) => Response;
  respondPlants?: () => Response;
  respondDetail?: (request: Request) => Response;
  respondWrite?: (request: Request) => Response;
}

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 주소가 조건을 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  /** 쓰기 요청 원본 — 본문과 헤더를 그대로 본다 */
  const writes: Request[] = [];

  const defaultDetail = (request: Request): Response => {
    const found = groupById(idOf(request));
    return found === undefined
      ? jsonResponse({ message: '없는 그룹' }, { status: 404 })
      : jsonResponse(groupDetail(found), { headers: { ETag: '7' } });
  };

  const defaultWrite = (request: Request): Response =>
    jsonResponse(makeGroup(901, 'GRP-NEW'), { status: request.method === 'POST' ? 201 : 200 });

  const view = renderWithProviders(<EquipmentMasterScreen />, {
    route: options.route ?? '/',
    fetch: createStubFetch([
      {
        match: (request) => request.method === 'GET' && isPath(request, '/mdm/equipment-groups'),
        respond: (request) => {
          sent.push(new URL(request.url));
          return (options.respondGroups ?? (() => jsonResponse(groupsResponse())))(request);
        },
      },
      {
        match: (request) => request.method === 'POST' && isPath(request, '/mdm/equipment-groups'),
        respond: (request) => {
          writes.push(request.clone());
          return (options.respondWrite ?? defaultWrite)(request);
        },
      },
      {
        match: (request) => request.method === 'GET' && isUnder(request, '/mdm/equipment-groups/'),
        respond: (request) => (options.respondDetail ?? defaultDetail)(request),
      },
      {
        match: (request) => request.method === 'PUT' && isUnder(request, '/mdm/equipment-groups/'),
        respond: (request) => {
          writes.push(request.clone());
          return (options.respondWrite ?? defaultWrite)(request);
        },
      },
      {
        match: (request) => isPath(request, '/mdm/plants'),
        respond: () => (options.respondPlants ?? (() => jsonResponse(plantsResponse())))(),
      },
    ]),
  });

  return { ...view, sent, writes };
};

/** 마지막 쓰기 요청의 본문. 무엇을 실어 갔는지는 이것으로만 증명된다. */
const lastWriteBody = async (writes: Request[]): Promise<Record<string, unknown>> => {
  const last = writes.at(-1);
  if (last === undefined) throw new Error('쓰기 요청이 한 번도 나가지 않았습니다.');
  return (await last.json()) as Record<string, unknown>;
};

/** 마지막으로 나간 목록 조회의 질의 문자열. */
const lastQuery = (sent: URL[]): URLSearchParams => {
  const last = sent.at(-1);
  if (last === undefined) throw new Error('목록 조회가 한 번도 나가지 않았습니다.');
  return last.searchParams;
};

describe('EquipmentMasterScreen', () => {
  it('설비 그룹 목록을 계층 순서로 그린다', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: 'GRP-A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GRP-A-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GRP-A-02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GRP-B' })).toBeInTheDocument();
  });

  /*
   * 하위를 가진 노드를 기본으로 펼쳐 둔다. 접힌 상태를 기본으로 두면 조회 결과에 있는
   * 하위 그룹이 표에 나오지 않아 사용자가 「없다」는 잘못된 답을 얻는다.
   */
  it('하위를 가진 그룹은 처음부터 펼쳐져 있다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });
    expect(screen.getByRole('button', { name: t.groupTable.collapse })).toBeInTheDocument();
  });

  it('접으면 하위가 사라지고 다시 펼치면 돌아온다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });
    await user.click(screen.getByRole('button', { name: t.groupTable.collapse }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'GRP-A-01' })).toBeNull();
    });
    // 접혔어도 상위는 그대로 있고 펼칠 수단이 남는다.
    expect(screen.getByRole('button', { name: 'GRP-A' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.groupTable.expand }));

    expect(await screen.findByRole('button', { name: 'GRP-A-01' })).toBeInTheDocument();
  });

  /* 조회 조건은 URL이 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 내야 한다. */
  it('주소의 조건을 그대로 서버로 보낸다', async () => {
    const { sent } = renderScreen({ route: '/?q=GRP&plant=12&inactive=1' });

    await screen.findByRole('button', { name: 'GRP-A' });

    const query = lastQuery(sent);
    expect(query.get('q')).toBe('GRP');
    expect(query.get('plantId')).toBe('12');
    expect(query.get('includeInactive')).toBe('true');
  });

  it('조건이 없으면 빈 값을 실어 보내지 않는다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });

    const query = lastQuery(sent);
    expect(query.has('q')).toBe(false);
    expect(query.has('plantId')).toBe(false);
    expect(query.get('includeInactive')).toBe('false');
  });

  /*
   * 계층 전체를 받아 화면이 접었다 편다. 좁혀 받으면 상위가 빠져 계층이 성립하지 않는다.
   */
  /*
   * 조회 조건을 URL이 소유하므로 사람이 손으로 고친 주소가 그대로 들어온다.
   * 읽을 수 없는 값을 그대로 실어 보내면 서버가 거절하고, 사용자는 자기가 무엇을
   * 잘못 적었는지 모르는 채 조회 실패만 본다.
   */
  it('읽을 수 없는 공장 조건은 조건이 없는 것으로 다룬다', async () => {
    const { sent } = renderScreen({ route: '/?plant=abc' });

    await screen.findByRole('button', { name: 'GRP-A' });

    expect(lastQuery(sent).has('plantId')).toBe(false);
  });

  /*
   * 식별자는 양의 정수다. 0·음수는 어느 공장도 가리키지 않으므로 「읽을 수 없는 값」과
   * 같은 갈래로 다룬다 — 실어 보내면 서버가 거절하거나 빈 결과를 돌려주고, 사용자는
   * 조건이 걸린 줄 모르는 채 「없다」를 본다.
   */
  it.each(['0', '-5'])('공장 조건이 %s 이면 조건이 없는 것으로 다룬다', async (value) => {
    const { sent } = renderScreen({ route: `/?plant=${value}` });

    await screen.findByRole('button', { name: 'GRP-A' });

    expect(lastQuery(sent).has('plantId')).toBe(false);
  });

  it('하위만 보는 조건(parentGroupId)은 보내지 않는다', async () => {
    const { sent } = renderScreen({ route: '/?q=GRP' });

    await screen.findByRole('button', { name: 'GRP-A' });

    expect(lastQuery(sent).has('parentGroupId')).toBe(false);
  });

  it('조회를 누르면 조건이 주소에 실리고 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { sent } = renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });
    await user.type(screen.getByLabelText(t.filters.searchLabel), 'GRP-A');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(lastQuery(sent).get('q')).toBe('GRP-A');
    });
  });

  it('그룹을 고르면 주소에 그 그룹이 실린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'GRP-A-01' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'GRP-A-01' })).toHaveAttribute(
        'aria-current',
        'true',
      );
    });
  });

  /* 아직 상세 페인이 없다 — 무엇을 해야 하는지 빈 자리 문구로 밝힌다. */
  it('그룹을 고르기 전에는 우측이 무엇을 기다리는지 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(t.empty.groupNotSelected)).toBeInTheDocument();
  });

  it('조회에 실패하면 배너를 내고 빈 상태를 내지 않는다', async () => {
    renderScreen({
      respondGroups: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.groupNoneTitle)).toBeNull();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /*
   * 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 하고
   * 정작 해야 할 일(담당자 문의)을 가린다.
   */
  it('권한 없음에는 「다시 시도」를 내지 않는다', async () => {
    renderScreen({
      respondGroups: () => jsonResponse({ message: '권한 없음' }, { status: 403 }),
    });

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).toBeNull();
  });

  /* 잘렸다는 사실을 감추면 사용자는 없는 그룹을 찾아 헤맨다. */
  it('목록이 잘리면 전체 건수와 함께 알린다', async () => {
    renderScreen({
      respondGroups: () => jsonResponse({ items: groupItems, page: pageOf(groupItems, 120) }),
    });

    expect(await screen.findByText(t.listTruncated(groupItems.length, 120))).toBeInTheDocument();
  });

  it('잘리지 않았으면 안내를 내지 않는다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });
    expect(screen.queryByText(t.listTruncated(groupItems.length, 120))).toBeNull();
  });

  /* 선택 목록 실패를 삼키면 공장 칸이 이유 없이 비어 보인다. */
  it('선택 목록 조회가 실패하면 그 사실을 알린다', async () => {
    renderScreen({
      respondPlants: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    expect(await screen.findByText(t.optionsLoadFailed)).toBeInTheDocument();
  });

  it('선택 목록이 잘리면 그 사실을 알린다', async () => {
    renderScreen({
      respondPlants: () => jsonResponse({ items: [], page: pageOf([], 40) }),
    });

    expect(await screen.findByText(t.optionsTruncated)).toBeInTheDocument();
  });

  /*
   * ⚠ 데이터베이스는 직계 자기참조만 막는다 — A→B→A 는 실제로 내려올 수 있다(스펙 §8-4).
   * 화면이 멈추거나 항목을 잃으면 안 된다.
   */
  it('순환이 든 응답에도 모든 그룹을 한 번씩 그린다', async () => {
    const cycled = [
      makeGroup(201, 'CYC-1', { parentGroupId: 202 }),
      makeGroup(202, 'CYC-2', { parentGroupId: 201 }),
    ];

    renderScreen({ respondGroups: () => jsonResponse({ items: cycled, page: pageOf(cycled) }) });

    expect(await screen.findByRole('button', { name: 'CYC-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CYC-2' })).toBeInTheDocument();
  });
});

/**
 * 폼 안만 본다. 좌측 필터 바에도 같은 이름의 공장 선택칸이 있어,
 * 화면 전체에서 찾으면 두 칸이 함께 잡혀 무엇을 잰 것인지 알 수 없다.
 */
const form = (mode: 'create' | 'edit' = 'edit') =>
  within(
    screen.getByRole('region', { name: mode === 'create' ? t.form.createTitle : t.form.editTitle }),
  );

const openGroup = async (user: ReturnType<typeof userEvent.setup>, code = 'GRP-A') => {
  await user.click(await screen.findByRole('button', { name: code }));
  await screen.findByRole('region', { name: t.form.editTitle });
  return form().getByRole('textbox', { name: new RegExp(t.fields.groupName) });
};

describe('EquipmentMasterScreen — 그룹 등록·수정', () => {
  it('그룹을 고르면 상세를 조회해 폼에 값을 싣는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);

    expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupCode) })).toHaveValue(
      'GRP-A',
    );
    expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupName) })).toHaveValue(
      'GRP-A 그룹',
    );
  });

  /* 상세를 받지 못한 채 빈 폼을 보이면 사용자가 그것을 자료로 읽는다. */
  it('상세 조회에 실패하면 폼 대신 배너를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDetail: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.form.editTitle })).toBeNull();
  });

  it('「그룹 추가」를 누르면 빈 폼이 선다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });
    await user.click(screen.getAllByRole('button', { name: t.actions.addGroup })[0] as HTMLElement);

    await screen.findByRole('region', { name: t.form.createTitle });
    expect(
      form('create').getByRole('textbox', { name: new RegExp(t.fields.groupCode) }),
    ).toHaveValue('');
    expect(
      form('create').getByRole('textbox', { name: new RegExp(t.fields.groupName) }),
    ).toHaveValue('');
  });

  /* 등록 후에는 바꿀 수 없는 값이라 사용자가 고른 적 없는 값이 조용히 굳으면 안 된다. */
  it('등록 폼의 공장은 좌측에서 고른 그룹의 공장을 물려받지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);
    await user.click(screen.getAllByRole('button', { name: t.actions.addGroup })[0] as HTMLElement);

    await screen.findByRole('region', { name: t.form.createTitle });
    expect(form('create').getByRole('combobox', { name: t.fields.plant })).not.toHaveTextContent(
      '제1공장',
    );
  });

  it('고친 것이 없으면 저장·취소를 누를 수 없다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);

    expect(form().getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(form().getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  it('취소는 기준값으로 되돌린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');
    expect(nameInput).toHaveValue('고친 이름');

    await user.click(form().getByRole('button', { name: messages.common.cancel }));

    expect(nameInput).toHaveValue('GRP-A 그룹');
  });

  it('수정 저장이 PUT 으로 나가고 상세의 잠금 토큰을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(request.method).toBe('PUT');
    expect(new URL(request.url).pathname).toBe('/mdm/equipment-groups/101');
    // 잠금 토큰은 상세 경로에 보관된다 — 요청 경로로 꺼내면 언제나 비어 있다.
    expect(request.headers.get('If-Match')).toBe('7');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    await expect(lastWriteBody(writes)).resolves.toMatchObject({ groupName: '프레스 구역' });
  });

  /*
   * ⭐ 계약이 「groupCode 는 참조가 0일 때만 보낼 수 있다」로 정했다.
   * 잠긴 코드를 되돌려 보내면 값이 같아도 서버가 거절할 수 있다.
   */
  it('코드가 잠기면 입력을 잠그고 사유를 보이며 본문에 코드를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen({
      respondDetail: (request) => {
        const found = groupById(idOf(request)) as EquipmentGroup;
        return jsonResponse(groupDetail(found, { editability: lockedCode }), {
          headers: { ETag: '7' },
        });
      },
    });

    const nameInput = await openGroup(user);

    expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupCode) })).toBeDisabled();
    expect(form().getByText(messages.editability.referenced(3))).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    const body = await lastWriteBody(writes);
    expect('groupCode' in body).toBe(false);
  });

  it('공장은 수정에서 잠기고 사유가 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);

    expect(form().getByRole('combobox', { name: t.fields.plant })).toBeDisabled();
    expect(form().getByText(t.actionReasons.plantFixedAfterCreate)).toBeInTheDocument();
  });

  it('화면에서 잡히는 오류는 서버로 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.click(form().getByRole('button', { name: messages.common.save }));

    expect(
      await form().findByText(messages.equipmentMaster.validation.required),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('등록 저장은 POST 로 나가고 성공하면 등록한 그룹의 상세로 옮긴다', async () => {
    const user = userEvent.setup();
    const created = makeGroup(901, 'GRP-NEW');
    const { writes } = renderScreen({
      // 등록한 그룹의 상세도 답해야 「옮겨 갔다」를 잴 수 있다. 없는 번호는 그대로 404다.
      respondDetail: (request) => {
        const id = idOf(request);
        const found = id === 901 ? created : groupById(id);
        return found === undefined
          ? jsonResponse({ message: '없는 그룹' }, { status: 404 })
          : jsonResponse(groupDetail(found), { headers: { ETag: '7' } });
      },
    });

    await screen.findByRole('button', { name: 'GRP-A' });
    await user.click(screen.getAllByRole('button', { name: t.actions.addGroup })[0] as HTMLElement);

    await screen.findByRole('region', { name: t.form.createTitle });
    await user.type(
      form('create').getByRole('textbox', { name: new RegExp(t.fields.groupCode) }),
      'GRP-NEW',
    );
    await user.type(
      form('create').getByRole('textbox', { name: new RegExp(t.fields.groupName) }),
      '새 구역',
    );
    await user.click(form('create').getByRole('combobox', { name: t.fields.plant }));
    await user.click(await screen.findByRole('option', { name: /제1공장/ }));
    await user.click(form('create').getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(request.method).toBe('POST');
    // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
    expect(request.headers.get('If-Match')).toBeNull();
    await expect(lastWriteBody(writes)).resolves.toMatchObject({
      groupCode: 'GRP-NEW',
      groupName: '새 구역',
      plantId: 11,
    });

    // 등록 응답(201)에는 ETag가 없다 — 상세로 옮겨야 이어서 수정할 수 있다.
    expect(await screen.findByRole('region', { name: t.form.editTitle })).toBeInTheDocument();
  });

  /*
   * 서버가 칸에 붙여 보낸 오류는 그 칸을 고치는 즉시 사라져야 한다.
   *
   * ⭐ **이 성질이 「로컬 오류와 서버 오류가 같은 칸에서 겹치지 않는다」를 만든다.**
   * 겹치지 않으므로 둘을 합치는 차례는 결과를 바꾸지 못한다 — 뒤집는 뮤턴트가 살아남는
   * 이유가 그것이며, 그때 재야 할 것은 합치는 차례가 아니라 이 성질이다.
   */
  it('서버가 칸에 붙여 보낸 오류는 그 칸을 고치면 사라진다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'groupCode',
                code: 'DUPLICATED',
                message: '이미 있는 코드입니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    expect(await form().findByText('이미 있는 코드입니다')).toBeInTheDocument();

    await user.type(form().getByRole('textbox', { name: new RegExp(t.fields.groupCode) }), '-2');

    await waitFor(() => {
      expect(form().queryByText('이미 있는 코드입니다')).toBeNull();
    });
  });

  /* 저장 충돌은 최신 값을 받아 다시 입력하는 수밖에 없다 — 그 길을 배너가 낸다. */
  it('저장 충돌에는 다시 불러오기를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      /* 계약이 충돌 원인을 함께 내린다 — 원인마다 안내가 다르다. */
      respondWrite: () =>
        jsonResponse(
          { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다' },
          { status: 409 },
        ),
    });

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    expect(await form().findByText(messages.conflict.user)).toBeInTheDocument();
    expect(
      form().getByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });
});

describe('EquipmentMasterScreen — 상위 그룹 선택지와 순환', () => {
  const openParentOptions = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));
    await screen.findByRole('region', { name: t.form.editTitle });
    await user.click(form().getByRole('combobox', { name: t.fields.parentGroup }));
    return screen.findAllByRole('option');
  };

  /*
   * ⭐ 데이터베이스는 직계 자기참조만 막는다. 자기 자신과 후손을 선택지에 남기면
   * 사용자가 순환을 만들 수 있고, 그렇게 저장된 계층은 아무도 되돌리지 못한다.
   */
  it('상위 그룹 선택지에서 자기 자신과 후손을 뺀다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const labels = (await openParentOptions(user)).map((node) => node.textContent);

    expect(labels.some((label) => label?.includes('GRP-A ·'))).toBe(false);
    expect(labels.some((label) => label?.includes('GRP-A-01'))).toBe(false);
    expect(labels.some((label) => label?.includes('GRP-A-02'))).toBe(false);
  });

  it('고를 수 없는 값이 있다는 사실을 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));

    await screen.findByRole('region', { name: t.form.editTitle });
    expect(form().getByText(t.actionReasons.parentExcludesSelfAndDescendants)).toBeInTheDocument();
  });

  it('최상위로 두는 선택지가 첫 줄에 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const labels = (await openParentOptions(user)).map((node) => node.textContent);

    // 선택지 줄에는 체크 표식이 함께 그려진다 — 문구가 담겨 있는지로 잰다.
    expect(labels[0]).toContain(t.form.parentNone);
  });

  /*
   * ⭐ 좌측 목록은 검색으로 좁혀져 있다. 그것을 상위 선택지로 재사용하면 조건에
   * 안 걸린 정상 그룹이 사라지고, 후손이 빠져 순환을 못 막는다.
   */
  it('상위 그룹 선택지는 좌측 검색으로 좁혀지지 않는다', async () => {
    const user = userEvent.setup();
    const sibling = makeGroup(150, 'ZZZ-OTHER', { plantId: 11 });

    renderScreen({
      route: '/?q=GRP-A',
      // 검색이 걸린 조회에는 GRP-A 계열만, 조건 없는 조회(선택지용)에는 형제까지 내려준다.
      respondGroups: (request) => {
        const hasKeyword = new URL(request.url).searchParams.has('q');
        const items = hasKeyword
          ? groupItems.filter((item) => item.groupCode.startsWith('GRP-A'))
          : [...groupItems, sibling];
        return jsonResponse({ items, page: pageOf(items) });
      },
    });

    const labels = (await openParentOptions(user)).map((node) => node.textContent);

    expect(labels.some((label) => label?.includes('ZZZ-OTHER'))).toBe(true);
  });

  /*
   * 선택지가 만들어진 뒤 목록이 갱신돼 낡았을 수 있다 — 선택지에서 빼는 것만으로 끝내지 않는다.
   * 서버가 순환을 막지 않으므로 여기가 마지막 방어선이다.
   */
  it('순환이 되는 상위가 폼에 남아 있으면 저장을 막고 사유를 낸다', async () => {
    const user = userEvent.setup();
    // 자기 자신을 상위로 갖는 그룹을 상세로 내려준다 — 서버가 막지 못한 상태다.
    const selfParent = makeGroup(101, 'GRP-A', { parentGroupId: 101 });
    const { writes } = renderScreen({
      respondDetail: () => jsonResponse(groupDetail(selfParent), { headers: { ETag: '7' } }),
    });

    const nameInput = await openGroup(user);

    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    expect(
      await form().findByText(messages.equipmentMaster.validation.parentCycle),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
