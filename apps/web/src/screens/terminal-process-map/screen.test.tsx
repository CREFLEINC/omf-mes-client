import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { TerminalProcessMapScreen } from './screen';

const t = messages.terminalProcessMap;
const path = (request: Request): string => new URL(request.url).pathname;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 50, total: items.length } });

const terminal = (id: number, code: string, overrides: Record<string, unknown> = {}) => ({
  terminalId: id,
  terminalCode: code,
  plantId: 1,
  terminalTypeCode: 'SYN-TYPE',
  statusCode: 'SYN-RUN',
  registrationStatusCode: 'UNREGISTERED',
  isActive: true,
  versionNo: 1,
  ...overrides,
});
const unregistered = terminal(701, 'SYN-TERM-01');
const registered = terminal(702, 'SYN-TERM-02', { registrationStatusCode: 'REGISTERED' });

/* 공통코드 표시명 — 이름이 없는 코드는 화면이 코드를 그대로 보인다. */
const codeNames: Record<string, { code: string; codeName: string }[]> = {
  TERMINAL_TYPE: [{ code: 'SYN-TYPE', codeName: '합성 유형' }],
  TERMINAL_STATUS: [{ code: 'SYN-RUN', codeName: '합성 가동' }],
};

const routes: StubRoute[] = [
  {
    match: (request) => path(request) === '/mdm/terminals',
    respond: () => jsonResponse(page([unregistered, registered])),
  },
  {
    match: (request) => /^\/mdm\/terminals\/\d+$/.test(path(request)),
    respond: (request) =>
      jsonResponse(path(request).endsWith('/702') ? registered : unregistered, {
        headers: { ETag: '"1"' },
      }),
  },
  {
    match: (request) => /^\/mdm\/terminals\/\d+\/processes$/.test(path(request)),
    respond: () => jsonResponse(page([]), { headers: { ETag: '"1"' } }),
  },
  {
    match: (request) => path(request) === '/mdm/code-values',
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
      return jsonResponse(
        page(
          (codeNames[group] ?? []).map((value, index) => ({
            ...value,
            codeValueId: index + 1,
            displayOrder: index + 1,
            isActive: true,
          })),
        ),
      );
    },
  },
  {
    match: (request) =>
      ['/mdm/plants', '/mdm/equipments', '/mdm/processes'].includes(path(request)),
    respond: () => jsonResponse(page([])),
  },
];

const renderScreen = (route = '/system/terminal-process-map') =>
  renderWithProviders(<TerminalProcessMapScreen />, {
    fetch: createStubFetch(routes),
    route,
    session: null,
  });

describe('TerminalProcessMapScreen 표시', () => {
  it('선택 전에는 단말 정보만 크게 안내하고 기능 구성은 한 줄로 줄인다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    expect(screen.getAllByText(t.grid.selectTerminalTitle)).toHaveLength(1);
    expect(screen.getByText(t.grid.unselectedNote)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.grid })).toBeInTheDocument();
    /* 저장 안내는 저장 단추가 있을 때만 그 위에 선다. */
    expect(screen.queryByText(t.grid.replaceNote)).not.toBeInTheDocument();
  });

  it('유형·운영 상태를 공통코드 이름으로 보이고, 미등록 단말의 운영 상태는 되풀이하지 않는다', async () => {
    renderScreen();
    const table = await screen.findByRole('table');
    await within(table).findAllByText('합성 유형');

    const firstRow = within(table).getByRole('button', { name: 'SYN-TERM-01' }).closest('tr');
    const secondRow = within(table).getByRole('button', { name: 'SYN-TERM-02' }).closest('tr');
    if (firstRow === null || secondRow === null) throw new Error('행 없음');

    /* 열 순서: 단말 코드 · 유형 · 운영 상태 · 등록 상태 · 설비 · 사용 여부 */
    const statusCell = (row: Element): string => row.children[2]?.textContent ?? '';
    expect(statusCell(firstRow)).toBe(t.list.notAvailable);
    expect(within(firstRow).getByText(t.list.registrationPending)).toBeInTheDocument();
    await within(secondRow).findByText('합성 가동');
    expect(statusCell(secondRow)).toBe('합성 가동');
    expect(within(table).queryByText('SYN-TYPE')).not.toBeInTheDocument();
  });

  it('고른 단말은 목록에서 aria-current 로 표시되고, 저장 안내는 저장 단추 위에 선다', async () => {
    renderScreen('/system/terminal-process-map?terminal=701');

    const current = await screen.findByRole('button', { name: 'SYN-TERM-01' });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'SYN-TERM-02' })).not.toHaveAttribute('aria-current');

    const note = await screen.findByText(t.grid.replaceNote);
    expect(note.nextElementSibling).toHaveClass('form-actions');
    expect(
      within(note.nextElementSibling as HTMLElement).getByRole('button', { name: t.grid.save }),
    ).toBeInTheDocument();
  });
});
