import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  codeValuesResponse,
  equipmentDetail,
  equipmentItems,
  equipmentsResponse,
  makeEquipment,
  groupById,
  groupDetail,
  groupItems,
  groupsResponse,
  lockedCode,
  makeGroup,
  pageOf,
  plantsResponse,
  processesResponse,
} from './fixtures';
import { EquipmentMasterScreen } from './screen';
import type { Equipment as EquipmentType, EquipmentGroup } from './types';

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
  respondDeactivate?: (request: Request) => Response;
  respondEquipments?: (request: Request) => Response;
  respondProcesses?: () => Response;
  respondEquipmentDetail?: (request: Request) => Response;
  respondEquipmentWrite?: (request: Request) => Response;
  respondEquipmentDeactivate?: (request: Request) => Response;
  respondCodeValues?: () => Response;
  respondDispose?: (request: Request) => Response;
}

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 주소가 조건을 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  /** 설비 목록 조회가 실어 간 조건 */
  const equipmentSent: URL[] = [];
  /** 코드값 조회가 실어 간 조건 — 그룹을 이름으로 부르는지 본다 */
  const codeValueSent: URL[] = [];
  /** 쓰기 요청 원본 — 본문과 헤더를 그대로 본다 */
  const writes: Request[] = [];

  /* 사용 중지가 나간 뒤의 재조회는 «바뀐» 상태를 돌려줘야 한다 — 늘 같은 것을 주면 갱신 경로가 헛통과한다. */
  let deactivated = false;

  const defaultDetail = (request: Request): Response => {
    const found = groupById(idOf(request));
    if (found === undefined) return jsonResponse({ message: '없는 그룹' }, { status: 404 });

    return jsonResponse(groupDetail(deactivated ? { ...found, isActive: false } : found), {
      headers: { ETag: '7' },
    });
  };

  const defaultEquipmentDetail = (request: Request): Response => {
    const found = equipmentItems.find((item) => item.equipmentId === idOf(request));
    return found === undefined
      ? jsonResponse({ message: '없는 설비' }, { status: 404 })
      : jsonResponse(equipmentDetail(found), { headers: { ETag: '9' } });
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
        /*
         * ⚠ 자원을 함께 못박는다. `endsWith(':deactivate')` 만 보면 «설비» 사용 중지까지
         * 이 스텁이 삼켜, 설비 쪽 감지기가 그룹 응답을 받고 헛통과한다.
         */
        match: (request) =>
          request.method === 'POST' &&
          isUnder(request, '/mdm/equipment-groups/') &&
          new URL(request.url).pathname.endsWith(':deactivate'),
        respond: (request) => {
          writes.push(request.clone());
          deactivated = true;
          return (
            options.respondDeactivate ??
            (() => jsonResponse(makeGroup(101, 'GRP-A', { isActive: false })))
          )(request);
        },
      },
      {
        match: (request) => request.method === 'GET' && isPath(request, '/mdm/equipments'),
        respond: (request) => {
          equipmentSent.push(new URL(request.url));
          return (options.respondEquipments ?? (() => jsonResponse(equipmentsResponse())))(request);
        },
      },
      {
        match: (request) => request.method === 'POST' && isPath(request, '/mdm/equipments'),
        respond: (request) => {
          writes.push(request.clone());
          return (
            options.respondEquipmentWrite ??
            (() => jsonResponse(makeEquipment(2009, 'EQ-NEW'), { status: 201 }))
          )(request);
        },
      },
      {
        match: (request) => request.method === 'GET' && isUnder(request, '/mdm/equipments/'),
        respond: (request) => (options.respondEquipmentDetail ?? defaultEquipmentDetail)(request),
      },
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname.endsWith(':dispose'),
        respond: (request) => {
          writes.push(request.clone());
          return (
            options.respondDispose ??
            (() => jsonResponse(makeEquipment(2001, 'EQ-01', { statusCode: 'DISPOSED' })))
          )(request);
        },
      },
      {
        match: (request) =>
          request.method === 'POST' &&
          new URL(request.url).pathname.startsWith('/mdm/equipments/') &&
          new URL(request.url).pathname.endsWith(':deactivate'),
        respond: (request) => {
          writes.push(request.clone());
          return (
            options.respondEquipmentDeactivate ??
            (() => jsonResponse(makeEquipment(2001, 'EQ-01', { isActive: false })))
          )(request);
        },
      },
      {
        match: (request) => request.method === 'PUT' && isUnder(request, '/mdm/equipments/'),
        respond: (request) => {
          writes.push(request.clone());
          return (
            options.respondEquipmentWrite ?? (() => jsonResponse(makeEquipment(2001, 'EQ-01')))
          )(request);
        },
      },
      {
        match: (request) => isPath(request, '/mdm/plants'),
        respond: () => (options.respondPlants ?? (() => jsonResponse(plantsResponse())))(),
      },
      {
        match: (request) => isPath(request, '/mdm/code-values'),
        respond: (request) => {
          codeValueSent.push(new URL(request.url));
          return (options.respondCodeValues ?? (() => jsonResponse(codeValuesResponse())))();
        },
      },
      {
        match: (request) => isPath(request, '/mdm/processes'),
        respond: () => (options.respondProcesses ?? (() => jsonResponse(processesResponse())))(),
      },
    ]),
  });

  return { ...view, sent, equipmentSent, codeValueSent, writes };
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

  /*
   * ⭐ 옮겨 가면 지금 폼이 통째로 버려진다. 사용자가 폼을 생각하지 않는 채 다른 그룹을
   * 누르는 자리라, 확인 없이 사라지면 무엇을 잃었는지도 알 수 없다.
   */
  it('고친 것이 있는 채로 다른 그룹을 고르면 먼저 확인한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');

    await user.click(screen.getByRole('button', { name: 'GRP-B' }));

    expect(await screen.findByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    // 아직 옮겨 가지 않았다 — 고친 값이 그대로 남아 있다.
    expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupName) })).toHaveValue(
      '고친 이름',
    );
  });

  it('「계속 편집」을 고르면 옮겨 가지 않고 고친 값이 남는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');
    await user.click(screen.getByRole('button', { name: 'GRP-B' }));
    await user.click(await screen.findByRole('button', { name: t.actions.keepEditing }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).toBeNull();
    });
    expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupName) })).toHaveValue(
      '고친 이름',
    );
  });

  it('「변경 버리기」를 고르면 고른 그룹으로 옮겨 간다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');
    await user.click(screen.getByRole('button', { name: 'GRP-B' }));
    await user.click(await screen.findByRole('button', { name: t.actions.discardChanges }));

    await waitFor(() => {
      expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupCode) })).toHaveValue(
        'GRP-B',
      );
    });
  });

  it('고친 것이 있는 채로 「그룹 추가」를 눌러도 먼저 확인한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');
    await user.click(screen.getAllByRole('button', { name: t.actions.addGroup })[0] as HTMLElement);

    expect(await screen.findByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.form.createTitle })).toBeNull();
  });

  /* 고친 것이 없으면 확인은 방해다 — 누를 때마다 창이 서면 아무도 읽지 않게 된다. */
  it('고친 것이 없으면 확인 없이 바로 옮겨 간다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);
    await user.click(screen.getByRole('button', { name: 'GRP-B' }));

    expect(screen.queryByRole('dialog', { name: t.dialog.discardTitle })).toBeNull();
    await waitFor(() => {
      expect(form().getByRole('textbox', { name: new RegExp(t.fields.groupCode) })).toHaveValue(
        'GRP-B',
      );
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
   * ⭐ **지금 매여 있는 값은 선택지에 남되 번호만 덩그러니 두지 않는다.**
   *
   * 데이터베이스가 순환을 막지 않아 자기 자신이 상위인 자료가 실제로 내려온다(스펙 §8-4).
   * 그 값은 고를 수 있는 목록에서 빠지는데, 코드만 되살리면 화면에 **내부 번호**가 그대로
   * 나온다 — 사용자는 그것이 무엇인지도, 왜 고칠 수 없는지도 알 수 없다.
   * (브라우저 확인에서 실제로 `1001` 이 그대로 보여 드러난 자리다.)
   */
  it('자기 자신이 상위로 매여 있으면 이름과 순환 표식을 함께 보인다', async () => {
    const user = userEvent.setup();
    const selfParent = makeGroup(101, 'GRP-A', { parentGroupId: 101 });

    renderScreen({
      respondGroups: () => jsonResponse({ items: [selfParent], page: pageOf([selfParent]) }),
      respondDetail: () => jsonResponse(groupDetail(selfParent), { headers: { ETag: '7' } }),
    });

    const labels = (await openParentOptions(user)).map((node) => node.textContent);

    // 내부 번호가 그대로 서면 안 된다.
    expect(labels.some((label) => label?.trim() === '101')).toBe(false);
    expect(
      labels.some(
        (label) => label?.includes('GRP-A') && label.includes(t.values.parentCycleSuffix.trim()),
      ),
    ).toBe(true);
  });

  /* 이름조차 찾지 못하면 그 값이 번호라는 사실을 밝힌다 — 맨 숫자로 두지 않는다. */
  it('이름을 풀지 못한 상위는 번호임을 밝힌다', async () => {
    const user = userEvent.setup();
    // 상위가 다른 공장의 그룹이라 이 공장 목록에 없다.
    const orphanParent = makeGroup(101, 'GRP-A', { parentGroupId: 777 });

    renderScreen({
      respondGroups: () => jsonResponse({ items: [orphanParent], page: pageOf([orphanParent]) }),
      respondDetail: () => jsonResponse(groupDetail(orphanParent), { headers: { ETag: '7' } }),
    });

    const labels = (await openParentOptions(user)).map((node) => node.textContent);

    expect(labels.some((label) => label?.includes(t.values.parentUnresolved('777')))).toBe(true);
    expect(labels.some((label) => label?.trim() === '777')).toBe(false);
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

describe('EquipmentMasterScreen — 그룹 사용 중지', () => {
  const deactivateT = messages.equipmentMaster.deactivate;

  it('사용 중지를 누르면 대상과 소속 설비 건수를 함께 보이고 먼저 확인한다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDetail: (request) => {
        const found = groupById(idOf(request)) as EquipmentGroup;
        return jsonResponse(groupDetail(found, { memberEquipmentCount: 12 }), {
          headers: { ETag: '7' },
        });
      },
    });

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.title }));
    expect(dialog.getByText(deactivateT.target('GRP-A · GRP-A 그룹'))).toBeInTheDocument();
    // 건수를 화면이 세지 않는다 — 상세 응답이 내려 준 값을 그대로 보인다.
    expect(dialog.getByText(deactivateT.members(12))).toBeInTheDocument();
  });

  it('확인하면 사용 중지 경로로 나가고 상세의 잠금 토큰을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/mdm/equipment-groups/101:deactivate');
    // 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로로 꺼내면 언제나 비어 있다.
    expect(request.headers.get('If-Match')).toBe('7');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('성공하면 확인 창이 닫힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: deactivateT.title })).toBeNull();
    });
  });

  /*
   * 업무 규칙 위반(참조 존재·상태 잠김)은 400 이다 — 409 가 아니다.
   * 창을 닫아 버리면 사용자는 왜 막혔는지 보지 못한 채 같은 일을 되풀이한다.
   */
  it('업무 규칙에 막히면 창을 닫지 않고 창 안에 이유를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDeactivate: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'HAS_REFERENCE',
                message: '소속 설비가 있어 중지할 수 없습니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.title }));
    expect(await dialog.findByText('소속 설비가 있어 중지할 수 없습니다')).toBeInTheDocument();
  });

  /*
   * 창을 다시 열었을 때 지난 회차의 실패가 남아 있으면, 사용자는 방금 누른 것이 또 막힌 줄 안다.
   * ⚠ 다만 **나가는 중인 요청은 거두지 않는다**(`resetIfIdle`) — 끊으면 그 요청의 되먹임이 사라진다.
   */
  it('창을 닫았다 다시 열면 지난 회차의 실패 표시가 남지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDeactivate: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'HAS_REFERENCE',
                message: '소속 설비가 있어 중지할 수 없습니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );
    await screen.findByText('소속 설비가 있어 중지할 수 없습니다');

    await user.click(
      within(screen.getByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: messages.common.cancel,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: deactivateT.title })).toBeNull();
    });

    await user.click(form().getByRole('button', { name: messages.common.deactivate }));

    const reopened = within(await screen.findByRole('dialog', { name: deactivateT.title }));
    expect(reopened.queryByText('소속 설비가 있어 중지할 수 없습니다')).toBeNull();
  });

  /*
   * ⭐ **이 창에는 대응하는 입력칸이 없다.** 서버가 필드에 붙여 보낸 오류를 인라인으로 돌리면
   * 그것을 낼 자리가 없어 **어디에도 보이지 않는 오류**가 된다 — 전부 배너로 올려야 한다.
   */
  it('서버가 칸에 붙여 보낸 오류도 창 안 배너에 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDeactivate: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'groupCode',
                code: 'HAS_REFERENCE',
                message: '참조가 있어 중지할 수 없습니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.title }));
    expect(await dialog.findByText('참조가 있어 중지할 수 없습니다')).toBeInTheDocument();
  });

  /*
   * ⭐ **사용 중지는 상세를 다시 불러온다.** 그때 폼이 새로 세워지므로, 저장하지 않은 입력이
   * 있으면 그것이 말없이 사라진다. 막지 않고 사유를 밝힌다 — 사용자가 무엇을 먼저 해야
   * 하는지(저장 또는 취소) 알아야 한다.
   */
  it('저장하지 않은 변경이 있으면 사용 중지를 누를 수 없고 사유가 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');

    expect(form().getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
    expect(form().getByText(t.actionReasons.deactivateNeedsCleanForm)).toBeInTheDocument();
  });

  it('취소로 되돌리면 사용 중지가 다시 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '고친 이름');
    await user.click(form().getByRole('button', { name: messages.common.cancel }));

    expect(form().getByRole('button', { name: messages.common.deactivate })).toBeEnabled();
    expect(form().queryByText(t.actionReasons.deactivateNeedsCleanForm)).toBeNull();
  });

  /*
   * 사용 중지 뒤의 재조회는 «바뀐» 상태를 돌려준다. 같은 것을 돌려주는 스텁으로 재면
   * 「갱신됐다」를 재는 감지기가 부분 견줌으로 헛통과한다.
   */
  it('사용 중지가 끝나면 다시 조회해 미사용으로 바뀐 것을 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openGroup(user);
    await user.click(form().getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deactivateT.title })).getByRole('button', {
        name: deactivateT.confirm,
      }),
    );

    await waitFor(
      () => {
        expect(form().getByText(t.values.inactive)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(form().queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  /* 이미 중지된 것을 다시 중지할 수는 없다 — 누를 것이 없는 컨트롤을 두지 않는다. */
  it('이미 중지된 그룹에는 사용 중지 버튼을 두지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondDetail: (request) => {
        const found = groupById(idOf(request)) as EquipmentGroup;
        return jsonResponse(groupDetail({ ...found, isActive: false }), {
          headers: { ETag: '7' },
        });
      },
    });

    await openGroup(user);

    expect(form().queryByRole('button', { name: messages.common.deactivate })).toBeNull();
    expect(form().getByText(t.values.inactive)).toBeInTheDocument();
  });
});

describe('EquipmentMasterScreen — 나가는 중인 쓰기', () => {
  /**
   * ⭐ **끝난 쓰기만 거둔다**(`resetIfIdle` · client#96).
   *
   * 저장이 나가는 중에 다른 그룹으로 옮겨 가면 편집 상태를 거두는데, 그때 나가는 중인 요청까지
   * 함께 끊으면 **그 요청의 되먹임이 사라진다** — 화면은 아무 일도 없었다고 믿고 서버는 이미
   * 처리한 상태가 된다. 여기서는 저장을 붙잡아 둔 채 옮겨 간 뒤 응답을 풀어, 성공 알림이
   * 그대로 도착하는지 본다.
   */
  it('저장이 나가는 중에 옮겨 가도 그 저장의 결과가 사라지지 않는다', async () => {
    const user = userEvent.setup();

    /* 저장을 붙잡아 둘 손잡이. 초기값을 두어 「비어 있을 수 있는 값」이 되지 않게 한다. */
    let releaseWrite: () => void = () => undefined;
    const writeHeld = new Promise<void>((resolve) => {
      releaseWrite = () => {
        resolve();
      };
    });

    const fetchStub = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);

      if (request.method === 'PUT' && url.pathname.startsWith('/mdm/equipment-groups/')) {
        await writeHeld;
        return jsonResponse(makeGroup(101, 'GRP-A'));
      }
      if (request.method === 'GET' && url.pathname === '/mdm/plants') {
        return jsonResponse(plantsResponse());
      }
      if (request.method === 'GET' && url.pathname === '/mdm/equipment-groups') {
        return jsonResponse(groupsResponse());
      }
      if (request.method === 'GET' && url.pathname.startsWith('/mdm/equipment-groups/')) {
        const found = groupById(Number(url.pathname.split('/').at(-1)));
        return found === undefined
          ? jsonResponse({ message: '없는 그룹' }, { status: 404 })
          : jsonResponse(groupDetail(found), { headers: { ETag: '7' } });
      }

      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    };

    renderWithProviders(<EquipmentMasterScreen />, { route: '/', fetch: fetchStub });

    const nameInput = await openGroup(user);
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 구역');
    await user.click(form().getByRole('button', { name: messages.common.save }));

    // 저장이 아직 나가는 중이다 — 이 상태에서 다른 그룹으로 옮겨 간다.
    await waitFor(() => {
      expect(form().getByRole('button', { name: messages.common.save })).toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: 'GRP-B' }));
    await user.click(await screen.findByRole('button', { name: t.actions.discardChanges }));

    releaseWrite();

    // 되먹임이 끊기지 않았다면 성공 알림이 도착한다.
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
  });
});

describe('EquipmentMasterScreen — 설비 목록 탭', () => {
  const openEquipmentTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));
    await user.click(await screen.findByRole('tab', { name: t.tabs.equipment }));
    return screen.findByRole('region', { name: t.tabs.equipment });
  };

  it('그룹을 고른 뒤 설비 탭에서 그 그룹의 설비를 본다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));

    expect(pane.getByText('EQ-01')).toBeInTheDocument();
    expect(pane.getByText('EQ-02')).toBeInTheDocument();
  });

  /*
   * ⭐ 계약의 조건 이름은 `productionLineId` 이고 값은 설비 그룹 식별자와 «같다» —
   * 저장처의 이름이 `production_line` 이라 필드가 그것을 따르고 있을 뿐이다.
   */
  it('고른 그룹의 식별자를 소속 그룹 조건으로 보낸다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen();

    await openEquipmentTab(user);

    const last = equipmentSent.at(-1);
    expect(last?.searchParams.get('productionLineId')).toBe('101');
  });

  /* 그룹을 고르기 전에는 대상이 정해지지 않았다 — 부르면 아무 그룹의 설비인지 알 수 없다. */
  it('그룹을 고르기 전에는 설비를 조회하지 않는다', async () => {
    const { equipmentSent } = renderScreen();

    await screen.findByRole('button', { name: 'GRP-A' });

    expect(equipmentSent).toHaveLength(0);
  });

  /* 조회 조건은 URL이 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. */
  it('주소의 설비 조건을 그대로 서버로 보낸다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen({
      route: '/?eq=EQ&eqtype=PRESS&calib=1&eqinactive=1',
    });

    await openEquipmentTab(user);

    const query = (equipmentSent.at(-1) as URL).searchParams;
    expect(query.get('q')).toBe('EQ');
    expect(query.get('equipmentTypeCode')).toBe('PRESS');
    expect(query.get('calibrationRequired')).toBe('true');
    expect(query.get('includeInactive')).toBe('true');
  });

  it('조건이 없으면 빈 값을 실어 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen();

    await openEquipmentTab(user);

    const query = (equipmentSent.at(-1) as URL).searchParams;
    expect(query.has('q')).toBe(false);
    expect(query.has('equipmentTypeCode')).toBe(false);
    // 켜지 않은 해제 조건은 아예 싣지 않는다 — 서버 기본을 뒤집지 않는다.
    expect(query.has('calibrationRequired')).toBe(false);
    expect(query.get('includeInactive')).toBe('false');
  });

  it('설비 조건을 적용하면 주소에 실리고 다시 조회한다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.type(pane.getByLabelText(t.equipmentFilters.searchLabel), 'EQ-01');
    await user.click(pane.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect((equipmentSent.at(-1) as URL).searchParams.get('q')).toBe('EQ-01');
    });
  });

  it('설비 목록이 잘리면 전체 건수와 함께 알린다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () =>
        jsonResponse({ items: equipmentItems, page: pageOf(equipmentItems, 300) }),
    });

    await openEquipmentTab(user);

    expect(
      await screen.findByText(t.equipmentListTruncated(equipmentItems.length, 300)),
    ).toBeInTheDocument();
  });

  it('설비 조회에 실패하면 배너를 내고 빈 상태를 내지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    const pane = within(await openEquipmentTab(user));

    expect(await pane.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(pane.queryByText(t.empty.equipmentNoneTitle)).toBeNull();
  });

  /* 아직 만들어지지 않은 그룹에는 설비를 붙일 대상이 없다. */
  it('등록 폼으로 가면 설비 탭이 서지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipmentTab(user);
    await user.click(screen.getAllByRole('button', { name: t.actions.addGroup })[0] as HTMLElement);

    await screen.findByRole('region', { name: t.form.createTitle });
    expect(screen.queryByRole('tab', { name: t.tabs.equipment })).toBeNull();
  });

  /* 탭 선택도 주소가 소유한다 — 공유한 주소가 같은 화면을 연다. */
  it('주소가 설비 탭을 가리키면 그 탭이 열린 채로 뜬다', async () => {
    const user = userEvent.setup();
    renderScreen({ route: '/?tab=equipment' });

    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));

    expect(await screen.findByText('EQ-01')).toBeInTheDocument();
  });
});

describe('EquipmentMasterScreen — 설비 등록·수정', () => {
  const equipmentForm = (mode: 'create' | 'edit' = 'edit') =>
    within(
      screen.getByRole('dialog', {
        name: mode === 'create' ? t.equipmentForm.createTitle : t.equipmentForm.editTitle,
      }),
    );

  const openEquipmentTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));
    await user.click(await screen.findByRole('tab', { name: t.tabs.equipment }));
    return screen.findByRole('region', { name: t.tabs.equipment });
  };

  const openEquipment = async (user: ReturnType<typeof userEvent.setup>, code = 'EQ-01') => {
    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: code }));
    await screen.findByRole('dialog', { name: t.equipmentForm.editTitle });
  };

  it('설비 코드를 누르면 그 설비의 폼이 뜬다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);

    expect(
      equipmentForm().getByRole('textbox', { name: new RegExp(t.fields.equipmentCode) }),
    ).toHaveValue('EQ-01');
    expect(
      equipmentForm().getByRole('textbox', { name: new RegExp(t.fields.equipmentName) }),
    ).toHaveValue('EQ-01 설비');
  });

  /*
   * ⭐ 계층 텍스트를 화면이 잇지 않는다 — 상세 응답이 준 재료를 그대로 그린다(이슈 §6).
   */
  it('설비 위치를 상세 응답의 재료로 그린다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);

    expect(equipmentForm().getByText('제1공장 > GRP-A 그룹 > EQ-01 설비')).toBeInTheDocument();
  });

  /*
   * ⚠ 빈칸으로 두지 않는다(G-9 · 이슈 §6). 알람 화면에서 위치가 공장으로만 나오면 찾아갈 수
   * 없으므로 여기서 비어 있음이 보여야 채운다.
   */
  it('소속 그룹이 없으면 빈칸이 아니라 그 사실을 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipmentDetail: () =>
        jsonResponse(
          equipmentDetail(makeEquipment(2001, 'EQ-01', { productionLineId: null }), {
            hierarchy: {
              plantName: '제1공장',
              groupNames: [],
              equipmentName: 'EQ-01 설비',
              groupAssigned: false,
            },
          }),
          { headers: { ETag: '9' } },
        ),
    });

    await openEquipment(user);

    expect(equipmentForm().getByText(t.values.noGroupAssigned)).toBeInTheDocument();
    expect(equipmentForm().getByText('제1공장 > EQ-01 설비')).toBeInTheDocument();
  });

  /*
   * ⚠ 계약이 「대상이 참이면 주기 두 칸이 함께 필요하다」로 짝을 묶었는데 주기 단위의
   * 값 목록이 아직 없다(omf-mes#185). 열어 두면 켜는 순간 반드시 저장이 실패한다 —
   * 감추지 않고 사유를 밝힌다(G-2).
   */
  it('검교정 대상을 잠그고 사유를 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);

    expect(
      equipmentForm().getByRole('switch', { name: t.fields.calibrationRequired }),
    ).toBeDisabled();
    expect(
      equipmentForm().getByText(t.actionReasons.calibrationCycleUnavailable),
    ).toBeInTheDocument();
  });

  /* 이 화면이 영영 정하지 않는 값은 잠긴 입력칸이 아니라 값 표기로 낸다. */
  it('운용 상태와 검교정 일자를 값으로만 보이고 사유를 함께 낸다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);

    expect(equipmentForm().getByText(t.actionReasons.statusNotEditableHere)).toBeInTheDocument();
    expect(equipmentForm().getByText(t.actionReasons.calibrationDatesReadOnly)).toBeInTheDocument();
    // 잠긴 입력칸을 두지 않는다 — 「언젠가 여기서 고칠 수 있다」를 뜻하게 된다.
    expect(
      equipmentForm().queryByRole('textbox', { name: new RegExp(t.fields.lastCalibrationDate) }),
    ).toBeNull();
  });

  /*
   * 값이 없는 읽기 전용 칸을 빈칸으로 두면 모르는 값과 없는 값이 같은 모양이 된다(G-9).
   *
   * ⚠ 문구를 선택칸의 「지정 없음」과 **다른 말로** 둔 이유가 여기 있다 — 같은 글자였을 때
   * 이 감지기가 선택칸의 트리거를 잡아 헛통과했다.
   */
  it('검교정 일자가 없으면 그 칸에 「기록 없음」을 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);

    const value = equipmentForm().getByLabelText(t.fields.lastCalibrationDate);
    expect(value).toHaveTextContent(t.fields.notRecorded);
  });

  it('수정 저장이 PUT 으로 나가고 상세의 잠금 토큰을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    await openEquipment(user);
    const nameInput = equipmentForm().getByRole('textbox', {
      name: new RegExp(t.fields.equipmentName),
    });
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 1호기');
    await user.click(equipmentForm().getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(request.method).toBe('PUT');
    expect(new URL(request.url).pathname).toBe('/mdm/equipments/2001');
    expect(request.headers.get('If-Match')).toBe('9');
    await expect(lastWriteBody(writes)).resolves.toMatchObject({ equipmentName: '프레스 1호기' });
  });

  /*
   * ⭐ 이 화면이 소유하지 않는 값(주기·정밀도)을 그대로 되돌려 보낸다. PUT 이 전체 교체라
   * 빼면 계측기 마스터가 정한 것이 지워진다 — 보이지도 고치지도 않지만 지우지도 않는다.
   */
  it('계측기 마스터가 정한 값을 지우지 않고 그대로 되돌려 보낸다', async () => {
    const user = userEvent.setup();
    const carried = makeEquipment(2001, 'EQ-01', {
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: 12,
      precisionValue: 0.01,
      precisionUomId: 31,
    });
    const { writes } = renderScreen({
      respondEquipments: () => jsonResponse({ items: [carried], page: pageOf([carried]) }),
      respondEquipmentDetail: () =>
        jsonResponse(equipmentDetail(carried), { headers: { ETag: '9' } }),
    });

    await openEquipment(user);
    const nameInput = equipmentForm().getByRole('textbox', {
      name: new RegExp(t.fields.equipmentName),
    });
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 1호기');
    await user.click(equipmentForm().getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    await expect(lastWriteBody(writes)).resolves.toMatchObject({
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: 12,
      precisionValue: 0.01,
      precisionUomId: 31,
    });
  });

  it('등록은 POST 로 나가고 고른 그룹의 공장을 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(
      pane.getAllByRole('button', { name: t.actions.addEquipment })[0] as HTMLElement,
    );
    await screen.findByRole('dialog', { name: t.equipmentForm.createTitle });

    await user.type(
      equipmentForm('create').getByRole('textbox', { name: new RegExp(t.fields.equipmentCode) }),
      'EQ-NEW',
    );
    await user.type(
      equipmentForm('create').getByRole('textbox', { name: new RegExp(t.fields.equipmentName) }),
      '새 설비',
    );
    await user.click(equipmentForm('create').getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(request.method).toBe('POST');
    // 등록에는 낙관적 잠금이 없다.
    expect(request.headers.get('If-Match')).toBeNull();
    await expect(lastWriteBody(writes)).resolves.toMatchObject({
      equipmentCode: 'EQ-NEW',
      plantId: 11,
      // 좌측에서 고른 그룹 아래에 등록하는 것이 정상 경로다 — 다시 고르게 하지 않는다.
      productionLineId: 101,
    });
  });

  /* 등록 중에는 아직 위치가 없다 — 지어내지 않는다. */
  it('등록 폼에는 계층 텍스트를 그리지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(
      pane.getAllByRole('button', { name: t.actions.addEquipment })[0] as HTMLElement,
    );
    await screen.findByRole('dialog', { name: t.equipmentForm.createTitle });

    expect(equipmentForm('create').queryByText(t.fields.hierarchy)).toBeNull();
  });

  it('화면에서 잡히는 오류는 서버로 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    await openEquipment(user);
    const nameInput = equipmentForm().getByRole('textbox', {
      name: new RegExp(t.fields.equipmentName),
    });
    await user.clear(nameInput);
    await user.click(equipmentForm().getByRole('button', { name: messages.common.save }));

    expect(
      await equipmentForm().findByText(messages.equipmentMaster.validation.required),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('코드가 잠기면 입력을 잠그고 사유를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipmentDetail: () =>
        jsonResponse(equipmentDetail(makeEquipment(2001, 'EQ-01'), { editability: lockedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEquipment(user);

    expect(
      equipmentForm().getByRole('textbox', { name: new RegExp(t.fields.equipmentCode) }),
    ).toBeDisabled();
    expect(equipmentForm().getByText(messages.editability.referenced(3))).toBeInTheDocument();
  });

  /*
   * ⭐ **모르면 잠근다.** 상세를 받지 못했으면 코드 편집 가부를 알 수 없다 —
   * 열어 두면 사용자가 고친 값이 저장 시점에야 거부되고 그 사유를 화면이 말할 수 없다.
   */
  it('상세를 받지 못하면 코드를 잠그고 그 사실을 배너로 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipmentDetail: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    await screen.findByRole('dialog', { name: t.equipmentForm.editTitle });

    expect(
      equipmentForm().getByRole('textbox', { name: new RegExp(t.fields.equipmentCode) }),
    ).toBeDisabled();
    expect(equipmentForm().getByText(t.actionReasons.codeLockUnknown)).toBeInTheDocument();
    expect(await equipmentForm().findByText(messages.httpError.loadTitle)).toBeInTheDocument();
  });

  /* 신규에는 참조가 있을 수 없어 코드가 언제나 열려 있다 — 없는 제약을 말하면 안 된다. */
  it('등록 폼의 코드는 잠기지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(
      pane.getAllByRole('button', { name: t.actions.addEquipment })[0] as HTMLElement,
    );
    await screen.findByRole('dialog', { name: t.equipmentForm.createTitle });

    expect(
      equipmentForm('create').getByRole('textbox', { name: new RegExp(t.fields.equipmentCode) }),
    ).toBeEnabled();
    expect(equipmentForm('create').queryByText(t.actionReasons.codeLockUnknown)).toBeNull();
  });

  it('저장이 끝나면 창이 닫힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await openEquipment(user);
    const nameInput = equipmentForm().getByRole('textbox', {
      name: new RegExp(t.fields.equipmentName),
    });
    await user.clear(nameInput);
    await user.type(nameInput, '프레스 1호기');
    await user.click(equipmentForm().getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.equipmentForm.editTitle })).toBeNull();
    });
  });
});

describe('EquipmentMasterScreen — 설비 사용 중지·폐기', () => {
  const deactivateT = messages.equipmentMaster.deactivate;

  const openEquipmentTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));
    await user.click(await screen.findByRole('tab', { name: t.tabs.equipment }));
    return screen.findByRole('region', { name: t.tabs.equipment });
  };

  /** 수명주기 액션은 수정 창 안에 있다 — 그 창의 버튼은 상세가 도착해야 선다. */
  const openDeactivate = async (user: ReturnType<typeof userEvent.setup>) => {
    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const form = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));
    await user.click(await form.findByRole('button', { name: messages.common.deactivate }));
  };

  const confirmDeactivate = async (user: ReturnType<typeof userEvent.setup>) => {
    const dialog = await screen.findByRole('dialog', { name: deactivateT.equipmentTitle });
    await user.click(within(dialog).getByRole('button', { name: deactivateT.confirm }));
  };

  it('수정 창에서 중지할 수 있고 무엇이 달라지는지 먼저 밝힌다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([equipmentItems[0]!])),
    });

    await openDeactivate(user);

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.equipmentTitle }));
    expect(dialog.getByText(deactivateT.target('EQ-01 · EQ-01 설비'))).toBeInTheDocument();
    expect(dialog.getByText(deactivateT.equipmentImpact)).toBeInTheDocument();
    // 되돌릴 수 없다는 사실은 그룹과 같은 문장을 쓴다.
    expect(dialog.getByText(deactivateT.notReversibleHere)).toBeInTheDocument();
  });

  /*
   * ⭐ 목록 행에는 잠금 토큰이 없다 — 상세 조회가 그것을 가져온다.
   * 수명주기 액션이 수정 창 안에만 있어, 눌릴 때에는 토큰이 이미 와 있다.
   */
  it('확인이 설비 상세의 잠금 토큰을 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([equipmentItems[0]!])),
    });

    await openDeactivate(user);
    await confirmDeactivate(user);

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(new URL(request.url).pathname).toBe('/mdm/equipments/2001:deactivate');
    expect(request.headers.get('If-Match')).toBe('9');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('성공하면 확인 창이 닫힌다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([equipmentItems[0]!])),
    });

    await openDeactivate(user);
    await confirmDeactivate(user);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: deactivateT.equipmentTitle })).toBeNull();
    });
  });

  /* 업무 규칙 위반은 400 이다 — 창을 닫으면 왜 막혔는지 보지 못한다. */
  it('업무 규칙에 막히면 창을 닫지 않고 이유를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([equipmentItems[0]!])),
      respondEquipmentDeactivate: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'IN_USE', message: '진행 중인 작업이 있습니다' }] },
          { status: 400 },
        ),
    });

    await openDeactivate(user);
    await confirmDeactivate(user);

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.equipmentTitle }));
    expect(await dialog.findByText('진행 중인 작업이 있습니다')).toBeInTheDocument();
  });

  /*
   * ⭐ 목록 행에는 잠금 토큰이 없다. 토큰이 도착하기 전에 확인을 열면 사용자는 눌러 놓고
   * 「토큰이 없다」는 화면 오류만 받는다 — 무엇을 해야 하는지 알 수 없는 자리다.
   */
  /*
   * ⭐ **토큰이 있다는 것이 자리로 보장된다.** 이 액션은 수정 창 안에만 있고 그 창의 버튼은
   * 상세가 도착해야 선다 — 목록 줄에 두었을 때 필요했던 「토큰이 오기 전」 방어가
   * 여기서는 필요 없다. 그 사실을 재 둔다.
   */
  it('상세가 도착하기 전에는 수명주기 액션이 서지 않는다', async () => {
    const user = userEvent.setup();

    let releaseDetail: () => void = () => undefined;
    const detailHeld = new Promise<void>((resolve) => {
      releaseDetail = () => {
        resolve();
      };
    });

    const fetchStub = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const only = [equipmentItems[0] as EquipmentType];

      if (url.pathname === '/mdm/plants') return jsonResponse(plantsResponse());
      if (url.pathname === '/mdm/processes') return jsonResponse(processesResponse());
      if (url.pathname === '/mdm/equipment-groups') return jsonResponse(groupsResponse());
      if (url.pathname.startsWith('/mdm/equipment-groups/')) {
        return jsonResponse(groupDetail(groupById(idOf(request)) as EquipmentGroup), {
          headers: { ETag: '7' },
        });
      }
      if (url.pathname === '/mdm/equipments') return jsonResponse(equipmentsResponse(only));
      if (url.pathname.startsWith('/mdm/equipments/')) {
        await detailHeld;
        return jsonResponse(equipmentDetail(only[0] as EquipmentType), { headers: { ETag: '9' } });
      }

      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    };

    renderWithProviders(<EquipmentMasterScreen />, { route: '/', fetch: fetchStub });

    await user.click(await screen.findByRole('button', { name: 'GRP-A' }));
    await user.click(await screen.findByRole('tab', { name: t.tabs.equipment }));
    const pane = within(await screen.findByRole('region', { name: t.tabs.equipment }));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));

    const form = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));
    expect(form.queryByRole('button', { name: messages.common.deactivate })).toBeNull();

    releaseDetail();

    expect(
      await form.findByRole('button', { name: messages.common.deactivate }),
    ).toBeInTheDocument();
  });

  /*
   * ⭐ 이 창에는 대응하는 입력칸이 없다 — 서버가 칸에 붙여 보낸 오류를 인라인으로 돌리면
   * 그것을 낼 자리가 없어 어디에도 보이지 않는 오류가 된다.
   */
  it('서버가 칸에 붙여 보낸 오류도 창 안 배너에 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([equipmentItems[0]!])),
      respondEquipmentDeactivate: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'equipmentCode',
                code: 'IN_USE',
                message: '진행 중인 작업이 있습니다',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openDeactivate(user);
    await confirmDeactivate(user);

    const dialog = within(await screen.findByRole('dialog', { name: deactivateT.equipmentTitle }));
    expect(await dialog.findByText('진행 중인 작업이 있습니다')).toBeInTheDocument();
  });

  /*
   * ⭐ **그룹을 이름으로 부른다.** `codeGroupId` 정수는 환경마다 달라 코드에 박을 수 없다
   * (설계 omf-mes#179). 계약이 둘 중 «정확히 하나»만 받는다.
   */
  it('자산 상태 값 목록을 그룹 이름으로 부른다', async () => {
    const user = userEvent.setup();
    const { codeValueSent } = renderScreen();

    await openEquipmentTab(user);

    const query = (codeValueSent.at(-1) as URL).searchParams;
    expect(query.get('codeGroupCode')).toBe('EQUIPMENT_STATUS');
    expect(query.has('codeGroupId')).toBe(false);
  });

  it('상태를 코드가 아니라 이름으로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));

    expect(await pane.findByText('운용')).toBeInTheDocument();
    expect(pane.queryByText('IN_SERVICE')).toBeNull();
  });

  /*
   * ⚠ 시드가 아직 들어가지 않아 목록이 빌 수 있다(설계 omf-mes#182).
   * 그때 「알 수 없음」으로 그리면 모르는 값과 없는 값이 같은 모양이 된다(G-9).
   */
  it('값 목록을 못 받으면 상태를 코드 그대로 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ respondCodeValues: () => jsonResponse(codeValuesResponse([])) });

    const pane = within(await openEquipmentTab(user));

    expect(await pane.findByText('IN_SERVICE')).toBeInTheDocument();
    expect(pane.queryByText('알 수 없음')).toBeNull();
  });

  it('값 목록을 받으면 폐기를 쓸 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const dialog = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));

    expect(await dialog.findByRole('button', { name: t.actions.disposeEquipment })).toBeEnabled();
  });

  /*
   * ⚠ 목록을 못 받으면 **이미 폐기된 자산인지 판정할 수 없다** — 열어 두면 이미 끝난
   * 자산에도 눌리는 컨트롤이 된다. 감추지 않고 사유를 밝힌다(G-2).
   */
  it('값 목록을 못 받으면 폐기를 잠그고 사유를 낸다', async () => {
    const user = userEvent.setup();
    renderScreen({ respondCodeValues: () => jsonResponse(codeValuesResponse([])) });

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const dialog = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));

    const dispose = dialog.getByRole('button', { name: t.actions.disposeEquipment });
    expect(dispose).toBeDisabled();

    const describedBy = dispose.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      t.actionReasons.disposeUnavailable,
    );
  });

  /* 이미 끝난 자산에는 폐기할 대상이 없다 — 누를 것이 없는 컨트롤을 두지 않는다. */
  it('이미 폐기된 설비에는 폐기 버튼을 두지 않는다', async () => {
    const user = userEvent.setup();
    const disposed = makeEquipment(2001, 'EQ-01', { statusCode: 'DISPOSED' });
    renderScreen({
      respondEquipments: () => jsonResponse(equipmentsResponse([disposed])),
      respondEquipmentDetail: () =>
        jsonResponse(equipmentDetail(disposed), { headers: { ETag: '9' } }),
    });

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const dialog = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));

    await waitFor(() => {
      expect(dialog.queryByRole('button', { name: t.actions.disposeEquipment })).toBeNull();
    });
  });

  const disposeT = messages.equipmentMaster.dispose;

  it('폐기 확인이 사용 중지와 다른 문장을 낸다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const form = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));
    await user.click(await form.findByRole('button', { name: t.actions.disposeEquipment }));

    const dialog = within(await screen.findByRole('dialog', { name: disposeT.title }));
    expect(dialog.getByText(disposeT.impact)).toBeInTheDocument();
    // 되돌릴 수 없음의 무게가 다르다 — 사용 중지의 문장을 그대로 쓰지 않는다.
    expect(dialog.getByText(disposeT.notReversible)).toBeInTheDocument();
    expect(dialog.queryByText(deactivateT.notReversibleHere)).toBeNull();
  });

  it('확인하면 폐기 경로로 나가고 상세의 잠금 토큰을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const form = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));
    await user.click(await form.findByRole('button', { name: t.actions.disposeEquipment }));
    await user.click(
      within(await screen.findByRole('dialog', { name: disposeT.title })).getByRole('button', {
        name: disposeT.confirm,
      }),
    );

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0] as Request;
    expect(new URL(request.url).pathname).toBe('/mdm/equipments/2001:dispose');
    expect(request.headers.get('If-Match')).toBe('9');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /*
   * ⛔ 폐기된 자산은 편집이 풀리지 않는다 — 열린 폼을 남기면 사용자가 고칠 수 있다고 믿고
   * 치다가 저장에서 거절당한다. 확인 창과 폼 창을 **둘 다** 닫는다.
   */
  it('폐기가 끝나면 확인 창과 폼 창이 함께 닫힌다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(pane.getByRole('button', { name: 'EQ-01' }));
    const form = within(await screen.findByRole('dialog', { name: t.equipmentForm.editTitle }));
    await user.click(await form.findByRole('button', { name: t.actions.disposeEquipment }));
    await user.click(
      within(await screen.findByRole('dialog', { name: disposeT.title })).getByRole('button', {
        name: disposeT.confirm,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: disposeT.title })).toBeNull();
    });
    expect(screen.queryByRole('dialog', { name: t.equipmentForm.editTitle })).toBeNull();
  });

  /* ⭐ 기본은 운용 중인 것만 부른다(설계 omf-mes#185). */
  it('목록이 기본으로 운용 중인 설비만 부른다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen();

    await openEquipmentTab(user);

    expect((equipmentSent.at(-1) as URL).searchParams.get('statusCode')).toBe('IN_SERVICE');
  });

  /*
   * ⭐ **마스터는 폐기된 자산도 볼 수 있어야 한다** — 감추기만 하면 폐기 처리의 결과를
   * 아무 데서도 확인할 수 없다. 켜면 조건을 아예 뺀다(「폐기만 보기」 조건은 계약에 없다).
   */
  it('「폐기 포함」을 켜면 상태 조건을 아예 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { equipmentSent } = renderScreen({ route: '/?disposed=1' });

    await openEquipmentTab(user);

    expect((equipmentSent.at(-1) as URL).searchParams.has('statusCode')).toBe(false);
  });

  /* 아직 등록되지 않은 설비에는 폐기할 대상이 없다. */
  it('등록 폼에는 폐기 버튼을 두지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    const pane = within(await openEquipmentTab(user));
    await user.click(
      pane.getAllByRole('button', { name: t.actions.addEquipment })[0] as HTMLElement,
    );
    const dialog = within(await screen.findByRole('dialog', { name: t.equipmentForm.createTitle }));

    expect(dialog.queryByRole('button', { name: t.actions.disposeEquipment })).toBeNull();
  });
});
