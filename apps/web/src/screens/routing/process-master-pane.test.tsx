import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { processFixtures } from './fixtures';
import { RoutingScreen } from './screen';

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const process = { ...processFixtures[0]!, processTypeCode: 'MACHINING' };
const inactiveProcess = { ...processFixtures[2]!, processTypeCode: 'INSPECTION' };
const editability = { codeEditable: false, reason: 'REFERENCED', referenceCount: 12 };

const routes = (): StubRoute[] => [
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/processes',
    respond: () =>
      jsonResponse({ items: [process, inactiveProcess], page: { page: 1, size: 20, total: 2 } }),
  },
  {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === '/mdm/processes',
    respond: () =>
      jsonResponse(
        {
          processId: 9010,
          processCode: 'OP-CUT',
          processName: '절단',
          processTypeCode: 'MACHINING',
          isActive: true,
        },
        { status: 201 },
      ),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          {
            codeValueId: 1,
            codeGroupId: 1,
            code: 'MACHINING',
            codeName: '가공',
            displayOrder: 1,
            isActive: true,
          },
          {
            codeValueId: 2,
            codeGroupId: 1,
            code: 'INSPECTION',
            codeName: '검사',
            displayOrder: 2,
            isActive: true,
          },
        ],
        page: { page: 1, size: 20, total: 2 },
      }),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/processes/9001',
    respond: () => jsonResponse({ process, editability }, { headers: { ETag: '"7"' } }),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/processes/9003',
    respond: () =>
      jsonResponse(
        {
          process: inactiveProcess,
          editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
        },
        { headers: { ETag: '"4"' } },
      ),
  },
  {
    match: (request) =>
      request.method === 'PUT' && new URL(request.url).pathname === '/mdm/processes/9001',
    respond: () =>
      jsonResponse({ ...process, processName: '정밀 사출' }, { headers: { ETag: '"8"' } }),
  },
  {
    match: (request) =>
      request.method === 'POST' &&
      new URL(request.url).pathname === '/mdm/processes/9001:deactivate',
    respond: () => jsonResponse({ ...process, isActive: false }),
  },
  {
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === '/mdm/processes/9003:activate',
    respond: () => jsonResponse({ ...inactiveProcess, isActive: true }),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === '/mdm/processes/9010',
    respond: () =>
      jsonResponse(
        {
          process: {
            processId: 9010,
            processCode: 'OP-CUT',
            processName: '절단',
            processTypeCode: 'MACHINING',
            isActive: true,
          },
          editability: { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 },
        },
        { headers: { ETag: '"1"' } },
      ),
  },
];

const renderScreen = () => {
  const recorded: RecordedRequest[] = [];
  const stub = createStubFetch(routes());
  const fetch: StubFetch = async (request) => {
    recorded.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };
  renderWithProviders(<RoutingScreen tab="processes" />, {
    fetch,
    route: '/master-data/processes?inactive=1',
    dataRouter: true,
  });
  return { recorded, user: userEvent.setup() };
};

/** 공정 목록 요청 — 사용 · 미사용 라벨의 건수 요청(size=1 · #231)은 뺀다. */
const processListRequests = <T extends { method: string; url: URL }>(recorded: T[]): T[] =>
  recorded.filter(
    (request) =>
      request.method === 'GET' &&
      request.url.pathname === '/mdm/processes' &&
      request.url.searchParams.get('size') !== '1',
  );

describe('RoutingScreen — 공정 관리 탭', () => {
  it('탭은 셸 탭 막대(주소)가 고르고, 공정 목록은 품목 선택 없이 조회한다', async () => {
    const { recorded } = renderScreen();

    /* 화면 안 탭 줄은 두지 않는다(#231) — 탭 막대는 셸이 세운다. */
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'OP-INJ' })).toBeInTheDocument();
    expect(screen.getByText('가공')).toBeInTheDocument();

    const listRequest = processListRequests(recorded)[0];
    expect(listRequest?.url.searchParams.get('includeInactive')).toBe('true');
    expect(recorded.some((request) => request.url.pathname === '/mdm/items')).toBe(false);
  });

  /* 사용 여부 라벨(#231) — 탭 줄에 「사용 N · 미사용 N」, 누르면 서버 조건 isActive 로 거르고 다시 누르면 푼다. */
  it('사용 · 미사용 라벨은 서버가 센 건수를 보이고, 누르면 isActive 로 거르고 다시 누르면 푼다', async () => {
    const { recorded, user } = renderScreen();

    const inactive = await screen.findByRole('button', { name: /^미사용/ });
    expect(screen.queryByRole('button', { name: /^전체/ })).toBeNull();
    await user.click(inactive);
    await waitFor(() => {
      expect(processListRequests(recorded).at(-1)?.url.searchParams.get('isActive')).toBe('false');
    });
    expect(screen.getByRole('button', { name: /^미사용/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /^미사용/ }));
    await waitFor(() => {
      expect(processListRequests(recorded).at(-1)?.url.searchParams.has('isActive')).toBe(false);
    });
  });

  it('상세의 editability로 코드만 잠그고 수정에는 상세 ETag를 보낸다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));

    const form = await screen.findByRole('region', { name: '공정 상세' });
    /* 고르면 먼저 보기 — 입력칸 없이 값만, [수정]을 눌러야 고칠 수 있다(사용자 지시 · #231). */
    expect(await within(form).findByText('OP-INJ')).toBeInTheDocument();
    expect(within(form).queryByRole('textbox')).toBeNull();
    await user.click(within(form).getByRole('button', { name: '수정' }));

    expect(within(form).getByLabelText('공정코드')).toBeDisabled();
    expect(within(form).getByText(/12건/)).toBeInTheDocument();

    const name = within(form).getByLabelText('공정명');
    await user.clear(name);
    await user.type(name, '정밀 사출');
    await user.click(within(form).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        recorded.filter(
          (request) => request.method === 'PUT' && request.url.pathname === '/mdm/processes/9001',
        ),
      ).toHaveLength(1);
    });
    const update = recorded.find((request) => request.method === 'PUT');
    expect(update?.headers.get('If-Match')).toBe('"7"');
    expect(JSON.parse(update?.body ?? '{}')).toEqual({
      processCode: 'OP-INJ',
      processName: '정밀 사출',
      processTypeCode: 'MACHINING',
    });
    /* 저장하면 다시 보기로 돌아간다. */
    await waitFor(() => expect(within(form).queryByRole('button', { name: '저장' })).toBeNull());
    expect(within(form).getByRole('button', { name: '수정' })).toBeInTheDocument();
  });

  it('사용 중지 전에 참조 건수와 기존 Routing 보존 범위를 확인하고 If-Match를 보낸다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));
    const form = await screen.findByRole('region', { name: '공정 상세' });

    await user.click(within(form).getByRole('button', { name: '사용 중지' }));
    const dialog = screen.getByRole('dialog');
    /* 영향 상자 — 기존 확정 경로는 영향 없음, 현재 참조 건수(사용자 시안 · #231). */
    expect(within(dialog).getByText('기존 확정 경로').nextElementSibling).toHaveTextContent(
      '영향 없음',
    );
    expect(within(dialog).getByText('현재 참조').nextElementSibling).toHaveTextContent('12건');
    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(
        recorded.filter((request) => request.url.pathname.endsWith(':deactivate')),
      ).toHaveLength(1);
    });
    const request = recorded.find((item) => item.url.pathname.endsWith(':deactivate'));
    expect(request?.headers.get('If-Match')).toBe('"7"');
    expect(request?.body).toBe('');
  });

  it('미사용 공정은 별도 activate 경로로 재사용한다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-PNT' }));
    const form = await screen.findByRole('region', { name: '공정 상세' });

    await user.click(within(form).getByRole('button', { name: '재사용' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/새로운 공정 경로에 이 공정을 추가할 수 있습니다/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '재사용' }));

    await waitFor(() => {
      expect(recorded.filter((request) => request.url.pathname.endsWith(':activate'))).toHaveLength(
        1,
      );
    });
    const request = recorded.find((item) => item.url.pathname.endsWith(':activate'));
    expect(request?.headers.get('If-Match')).toBe('"4"');
  });

  it('고른 공정을 한 번 더 누르면 선택이 풀리고 상세는 고르기 전 안내로 돌아간다', async () => {
    const { user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));
    expect(screen.getByRole('button', { name: 'OP-INJ' })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: 'OP-INJ' }));

    expect(screen.getByRole('button', { name: 'OP-INJ' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('공정을 고르거나 새 공정을 추가하세요')).toBeInTheDocument();
  });

  /* 수정 중 저장하지 않고 다른 공정으로 옮기면 묻는다(사용자 지시 · #231). */
  it('수정 중 저장하지 않고 다른 공정을 누르면 묻고, 계속 편집하면 그대로 둔다', async () => {
    const { user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));
    const form = await screen.findByRole('region', { name: '공정 상세' });
    await user.click(await within(form).findByRole('button', { name: '수정' }));
    await user.type(within(form).getByLabelText('공정명'), '-X');

    await user.click(screen.getByRole('button', { name: 'OP-PNT' }));
    const dialog = await screen.findByRole('dialog', { name: '저장하지 않은 변경이 있습니다' });
    await user.click(within(dialog).getByRole('button', { name: '계속 편집' }));

    expect(within(form).getByLabelText('공정명')).toHaveValue('사출-X');
  });

  /* 공정 추가는 팝업(사용자 지시 · #231) — 저장하면 닫히고 새 공정이 오른쪽 상자에 보인다. */
  it('새 공정은 팝업에서 코드·명칭·동적 유형만 등록하고, 닫힌 뒤 저장된 공정을 고른다', async () => {
    const { recorded, user } = renderScreen();
    await screen.findByRole('button', { name: 'OP-INJ' });
    await user.click(screen.getByRole('button', { name: '공정 추가' }));

    const form = await screen.findByRole('dialog', { name: '공정 추가' });
    await user.type(within(form).getByLabelText('공정코드'), ' OP-CUT ');
    await user.type(within(form).getByLabelText('공정명'), ' 절단 ');
    await user.click(within(form).getByLabelText('공정 유형'));
    await user.click(screen.getByRole('option', { name: '가공' }));
    await user.click(within(form).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        recorded.filter(
          (request) => request.method === 'POST' && request.url.pathname === '/mdm/processes',
        ),
      ).toHaveLength(1);
    });
    const create = recorded.find(
      (request) => request.method === 'POST' && request.url.pathname === '/mdm/processes',
    );
    expect(JSON.parse(create?.body ?? '{}')).toEqual({
      processCode: 'OP-CUT',
      processName: '절단',
      processTypeCode: 'MACHINING',
    });
    expect(create?.headers.get('If-Match')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '공정 추가' })).toBeNull());
    const detail = screen.getByRole('region', { name: '공정 상세' });
    expect(await within(detail).findByText('OP-CUT')).toBeInTheDocument();
  });
});
