import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { groupItems, groupsResponse, makeGroup, pageOf, plantsResponse } from './fixtures';
import { EquipmentMasterScreen } from './screen';

const t = messages.equipmentMaster;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

interface RenderOptions {
  route?: string;
  respondGroups?: (request: Request) => Response;
  respondPlants?: () => Response;
}

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 주소가 조건을 몰았음을 그것으로 증명한다. */
const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];

  const view = renderWithProviders(<EquipmentMasterScreen />, {
    route: options.route ?? '/',
    fetch: createStubFetch([
      {
        match: (request) => isPath(request, '/mdm/equipment-groups'),
        respond: (request) => {
          sent.push(new URL(request.url));
          return (options.respondGroups ?? (() => jsonResponse(groupsResponse())))(request);
        },
      },
      {
        match: (request) => isPath(request, '/mdm/plants'),
        respond: () => (options.respondPlants ?? (() => jsonResponse(plantsResponse())))(),
      },
    ]),
  });

  return { ...view, sent };
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
