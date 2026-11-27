import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

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

/** `extra` 는 기본 규칙보다 먼저 잡힌다 — 실패 응답 등을 덮어쓸 때 쓴다. */
const renderScreen = (extra: StubRoute[] = []) => {
  const recorded: RecordedRequest[] = [];
  const stub = createStubFetch([...extra, ...routes()]);
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

/** 그 공정 줄 끝 단추(#360) — 줄 고르기 · 상세 상자는 걷었다. */
const findRowButton = async (code: string, name: string): Promise<HTMLElement> => {
  const row = (await screen.findByText(code, { selector: '.routing-process-open' })).closest('tr');
  if (row === null) throw new Error(`${code} 줄이 없습니다.`);
  return within(row).getByRole('button', { name });
};

describe('RoutingScreen — 공정 관리 탭', () => {
  afterEach(() => {
    window.localStorage.removeItem('omf-mes:routing:process-split:collapsed');
  });

  it('탭은 셸 탭 막대(주소)가 고르고, 공정 목록은 품목 선택 없이 조회한다', async () => {
    const { recorded } = renderScreen();

    /* 화면 안 탭 줄은 두지 않는다(#231) — 탭 막대는 셸이 세운다. */
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(await screen.findByText('OP-INJ')).toBeInTheDocument();
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

  /* C-6 — 초기화는 처음 조건과 다를 때만 보인다. 사용 여부 라벨도 초기화가 되돌리므로 함께 견준다. */
  it('초기화는 조건을 바꾼 뒤에만 보이고 누르면 다시 사라진다', async () => {
    const { user } = renderScreen();
    await screen.findByText('OP-INJ');

    expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^미사용/ }));
    await user.click(await screen.findByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();
    });
  });

  it('줄 끝 [수정]은 상세를 받아 수정 팝업을 열고, 코드만 잠그며 수정에는 상세 ETag를 보낸다(#360)', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await findRowButton('OP-INJ', '수정'));

    const form = await screen.findByRole('dialog', { name: '공정 수정' });
    expect(within(form).getByLabelText('공정코드')).toHaveValue('OP-INJ');
    expect(within(form).getByLabelText('공정코드')).toBeDisabled();
    expect(within(form).getByText(/12건/)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: '저장' })).toBeDisabled();

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
    /* 저장하면 팝업이 닫힌다. */
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '공정 수정' })).toBeNull());
  });

  it('수정 팝업의 취소는 고친 값을 버리고 닫는다 — 다시 열면 저장된 값이다(#360)', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await findRowButton('OP-INJ', '수정'));
    const form = await screen.findByRole('dialog', { name: '공정 수정' });
    await user.type(within(form).getByLabelText('공정명'), '-X');

    await user.click(within(form).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '공정 수정' })).toBeNull());

    await user.click(await findRowButton('OP-INJ', '수정'));
    const reopened = await screen.findByRole('dialog', { name: '공정 수정' });
    expect(within(reopened).getByLabelText('공정명')).toHaveValue('사출');
    expect(recorded.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('줄 끝 [사용 중지]는 참조 건수와 기존 Routing 보존 범위를 확인하고 If-Match를 보낸다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await findRowButton('OP-INJ', '사용 중지'));

    const dialog = await screen.findByRole('dialog');
    /* 대상 상자 · 질문 · 영향 한 줄 — 기존 확정 경로는 영향 없음, 현재 참조 건수(#231 · #360). */
    expect(within(dialog).getByText('사출')).toBeInTheDocument();
    expect(within(dialog).getByText('이 공정의 사용을 중지하시겠습니까?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('기존 확정 경로에는 영향이 없습니다. 현재 참조 12건.'),
    ).toBeInTheDocument();
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

  it('미사용 공정은 줄 끝 [재사용]으로 별도 activate 경로를 부른다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await findRowButton('OP-PNT', '재사용'));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/새로운 라우팅에 이 공정을 추가할 수 있습니다/),
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

  it('사용 중지 · 재사용 · 수정 단추에 같은 크기 아이콘이 붙는다(#360)', async () => {
    renderScreen();

    for (const [code, name, icon] of [
      ['OP-INJ', '사용 중지', 'block'],
      ['OP-PNT', '재사용', 'restart_alt'],
      ['OP-INJ', '수정', 'edit'],
    ] as const) {
      const glyph = (await findRowButton(code, name)).querySelector<HTMLElement>(
        '[aria-hidden="true"]',
      );
      expect(glyph).toHaveTextContent(icon);
      expect(glyph).toHaveStyle({ fontSize: '16px' });
    }
  });

  it('줄을 눌러도 아무 일이 없다 — 상세 상자 · 주소 선택값 · 목록 접기가 없다(#360)', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByText('OP-INJ'));
    await user.click(screen.getByText('사출'));

    expect(screen.queryByRole('button', { name: 'OP-INJ' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('region', { name: '공정 상세' })).toBeNull();
    expect(document.querySelector('[aria-current="true"]')).toBeNull();
    expect(recorded.some((request) => request.url.pathname === '/mdm/processes/9001')).toBe(false);
    expect(
      screen.queryByRole('button', { name: messages.common.inspectionHub.listCollapse }),
    ).toBeNull();
    const split = document.querySelector('.routing-process-split');
    expect(split?.children).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '공정 목록' })).toBeInTheDocument();
  });

  /* 상세 상자를 걷어도 실패는 알린다(#360) — 줄 끝 단추로 받던 상세가 실패하면 목록 위에 배너를 낸다. */
  it('줄 끝 [수정]의 상세 조회에 실패하면 팝업 대신 오류 배너와 다시 시도가 뜬다(#360)', async () => {
    const { user } = renderScreen([
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === '/mdm/processes/9001',
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    await user.click(await findRowButton('OP-INJ', '수정'));

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /* 공정 추가는 팝업(사용자 지시 · #231) — 저장하면 닫힌다(줄 고르기는 걷었다 · #360). */
  it('새 공정은 팝업에서 코드·명칭·동적 유형만 등록하고, 저장하면 팝업이 닫힌다', async () => {
    const { recorded, user } = renderScreen();
    await screen.findByText('OP-INJ');
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
    expect(screen.queryByRole('region', { name: '공정 상세' })).toBeNull();
  });
});
