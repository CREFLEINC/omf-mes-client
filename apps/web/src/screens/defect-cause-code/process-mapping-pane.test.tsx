import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { defectCodeFixtures } from './fixtures';
import { DefectCauseCodeScreen } from './screen';

const ROUTE = '/master-data/defect-cause-code?tab=mapping';
const DEFECT_LIST_PATH = '/quality/defect-codes';
const PROCESS_LIST_PATH = '/mdm/processes';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const processFixtures = [
  {
    processId: 3001,
    processCode: 'OP-INJ',
    processName: '사출',
    processTypeCode: 'MACHINING',
    isActive: true,
  },
  {
    processId: 3002,
    processCode: 'OP-ASM',
    processName: '조립',
    processTypeCode: 'ASSEMBLY',
    isActive: true,
  },
];

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const listBody = (items: unknown[], total = items.length): unknown => ({
  items,
  page: { page: 1, size: 20, total },
});

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });
    return stub(request);
  };

  return { fetch, requests };
};

const mappingPath = (defectCodeId: number): string =>
  `${DEFECT_LIST_PATH}/${String(defectCodeId)}/processes`;

const baseRoutes = (defectTotal = defectCodeFixtures.length): StubRoute[] => [
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === DEFECT_LIST_PATH,
    respond: () => jsonResponse(listBody(defectCodeFixtures, defectTotal)),
  },
  {
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === PROCESS_LIST_PATH,
    respond: () => jsonResponse(listBody(processFixtures)),
  },
  ...[1002, 1003, 1005, 1007].map<StubRoute>((defectCodeId) => ({
    match: (request) =>
      request.method === 'GET' && new URL(request.url).pathname === mappingPath(defectCodeId),
    respond: () =>
      jsonResponse(
        listBody(
          defectCodeId === 1002
            ? [{ defectCodeId: 1002, processId: 3001, processName: '사출' }]
            : [],
        ),
      ),
  })),
];

const renderMapping = (extraRoutes: StubRoute[] = [], defectTotal?: number) => {
  const { fetch, requests } = createRecordingFetch([...extraRoutes, ...baseRoutes(defectTotal)]);
  renderWithProviders(<DefectCauseCodeScreen />, { fetch, route: ROUTE });
  return { requests, user: userEvent.setup() };
};

describe('DefectCauseCodeScreen — 공정 매핑', () => {
  it('상세 불량코드와 사용 중인 공정을 매트릭스로 표시한다', async () => {
    const { requests } = renderMapping();

    expect(await screen.findByRole('tab', { name: '공정 매핑' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '공정별 상세 불량코드 매핑' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'OP-INJ · 사출' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: '공정별 상세 불량코드 매핑' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /DF-11 · 스크래치/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /DF-10 · 외관/ })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'DF-11 · 사출 · 매핑됨' })).toHaveAttribute(
      'data-status',
      'success',
    );
    expect(screen.getByRole('cell', { name: 'DF-12 · 조립 · 매핑 안 됨' })).not.toHaveAttribute(
      'data-status',
    );
    expect(requests.some((request) => request.url.pathname === '/quality/cause-codes')).toBe(false);
  });

  it('빈 셀을 누르면 멱등 키와 공정 번호로 즉시 매핑한다', async () => {
    const { requests, user } = renderMapping([
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === mappingPath(1003),
        respond: () =>
          jsonResponse(
            { defectCodeId: 1003, processId: 3002, processName: '조립' },
            { status: 201 },
          ),
      },
    ]);

    await user.click(await screen.findByRole('cell', { name: 'DF-12 · 조립 · 매핑 안 됨' }));

    await waitFor(() => {
      expect(
        requests.some(
          (request) => request.method === 'POST' && request.url.pathname === mappingPath(1003),
        ),
      ).toBe(true);
    });
    const post = requests.find(
      (request) => request.method === 'POST' && request.url.pathname === mappingPath(1003),
    );
    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(post?.headers.has('If-Match')).toBe(false);
    expect(JSON.parse(post?.body ?? '{}')).toEqual({ processId: 3002 });
  });

  it('매핑된 셀을 누르면 해당 공정 매핑만 즉시 해제한다', async () => {
    const deletePath = `${mappingPath(1002)}/3001`;
    const { requests, user } = renderMapping([
      {
        match: (request) =>
          request.method === 'DELETE' && new URL(request.url).pathname === deletePath,
        respond: () => new Response(null, { status: 204 }),
      },
    ]);

    await user.click(await screen.findByRole('cell', { name: 'DF-11 · 사출 · 매핑됨' }));

    await waitFor(() => {
      expect(
        requests.some(
          (request) => request.method === 'DELETE' && request.url.pathname === deletePath,
        ),
      ).toBe(true);
    });
    const deletion = requests.find(
      (request) => request.method === 'DELETE' && request.url.pathname === deletePath,
    );
    expect(deletion?.headers.get('Idempotency-Key')).toMatch(UUID_PATTERN);
    expect(deletion?.headers.has('If-Match')).toBe(false);
    expect(deletion?.body).toBe('');
  });

  it('목록이 잘렸으면 일부만 매핑 중임을 경고한다', async () => {
    renderMapping([], 120);

    expect(
      await screen.findByText(
        '불량코드 또는 공정 목록이 일부만 표시되어 전체 매핑을 편집할 수 없습니다.',
      ),
    ).toBeInTheDocument();
  });
});
