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
      jsonResponse(
        { ...process, processName: '정밀 사출' },
        { headers: { ETag: '"8"' } },
      ),
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
  renderWithProviders(<RoutingScreen />, {
    fetch,
    route: '/master-data/routing?tab=processes&inactive=1',
  });
  return { recorded, user: userEvent.setup() };
};

describe('RoutingScreen — 공정 마스터 탭', () => {
  it('고정 설계의 두 탭을 제공하고 공정 목록은 품목 선택 없이 조회한다', async () => {
    const { recorded } = renderScreen();

    expect(screen.getByRole('tab', { name: 'Routing' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: '공정 마스터' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('button', { name: 'OP-INJ' })).toBeInTheDocument();
    expect(screen.getByText('가공')).toBeInTheDocument();

    const listRequest = recorded.find(
      (request) => request.method === 'GET' && request.url.pathname === '/mdm/processes',
    );
    expect(listRequest?.url.searchParams.get('includeInactive')).toBe('true');
    expect(recorded.some((request) => request.url.pathname === '/mdm/items')).toBe(false);
  });

  it('상세의 editability로 코드만 잠그고 수정에는 상세 ETag를 보낸다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));

    const form = await screen.findByRole('region', { name: '공정 등록·편집' });
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
  });

  it('사용 중지 전에 참조 건수와 기존 Routing 보존 범위를 확인하고 If-Match를 보낸다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-INJ' }));
    const form = await screen.findByRole('region', { name: '공정 등록·편집' });

    await user.click(within(form).getByRole('button', { name: '사용 중지' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/기존 확정 Routing은 그대로 유지/)).toBeInTheDocument();
    expect(within(dialog).getByText(/12건/)).toBeInTheDocument();
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

  it('미사용 공정은 별도 activate 경로로 다시 사용한다', async () => {
    const { recorded, user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OP-PNT' }));
    const form = await screen.findByRole('region', { name: '공정 등록·편집' });

    await user.click(within(form).getByRole('button', { name: '다시 사용' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/새 공정 라인에서도/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '다시 사용' }));

    await waitFor(() => {
      expect(recorded.filter((request) => request.url.pathname.endsWith(':activate'))).toHaveLength(
        1,
      );
    });
    const request = recorded.find((item) => item.url.pathname.endsWith(':activate'));
    expect(request?.headers.get('If-Match')).toBe('"4"');
  });

  it('새 공정은 코드·명칭·동적 유형만 등록하고 저장된 행을 선택한다', async () => {
    const { recorded, user } = renderScreen();
    await screen.findByRole('button', { name: 'OP-INJ' });
    await user.click(screen.getByRole('button', { name: '공정 추가' }));

    const form = screen.getByRole('region', { name: '공정 등록·편집' });
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
    expect(await screen.findByDisplayValue('OP-CUT')).toBeInTheDocument();
  });
});
