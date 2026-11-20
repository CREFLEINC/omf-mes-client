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
  it('선택 전에는 오른쪽 카드가 고르라는 안내 하나만 보이고 기능 구성은 아직 없다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    expect(screen.getAllByText(t.grid.selectTerminalTitle)).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: t.panes.grid })).not.toBeInTheDocument();
    /* 머리글(경로 · 화면 이름)은 두지 않는다 — 단말 추가는 조회 줄 오른쪽 끝이다. */
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.terminal.create })).toBeInTheDocument();
  });

  it('목록은 단말 유형을 공통코드 이름으로, 사용 상태를 운영 상태 자리에 보인다', async () => {
    renderScreen();
    const table = await screen.findByRole('table');
    await within(table).findAllByText('합성 유형');

    /* 열 순서: 단말 코드 · 단말 유형 · 사용 상태 · 등록 상태 · 설치 설비 · 창고(용어 정리 2026-11-20 · #333) */
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => (cell.textContent ?? '').replace('drag_indicator', ''));
    expect(headers.slice(0, 4)).toEqual([
      t.list.code,
      t.list.type,
      t.list.activeHeader,
      t.list.registration,
    ]);
    expect(headers).not.toContain(t.list.status);

    const firstRow = within(table).getByRole('button', { name: 'SYN-TERM-01' }).closest('tr');
    if (firstRow === null) throw new Error('행 없음');
    expect(firstRow.children[2]?.textContent).toBe(t.list.active);
    expect(within(table).queryByText('SYN-TYPE')).not.toBeInTheDocument();
  });

  it('운영 상태는 단말 정보에서 공통코드 이름으로 보이고, 미등록 단말은 되풀이하지 않는다', async () => {
    const { unmount } = renderScreen('/system/terminal-process-map?terminal=702');
    expect(await screen.findByText('합성 가동')).toBeInTheDocument();
    unmount();

    renderScreen('/system/terminal-process-map?terminal=701');
    const label = await screen.findByText(t.terminal.status, { selector: 'dt' });
    await waitFor(() =>
      expect(label.parentElement?.querySelector('dd')?.textContent).toBe(t.list.notAvailable),
    );
  });

  it('고른 단말은 목록에서 aria-current 로 표시되고, 제목 옆 안내 문구는 없다', async () => {
    renderScreen('/system/terminal-process-map?terminal=701');

    const current = await screen.findByRole('button', { name: 'SYN-TERM-01' });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'SYN-TERM-02' })).not.toHaveAttribute('aria-current');

    expect(await screen.findByRole('button', { name: t.grid.save })).toBeInTheDocument();
    expect(screen.queryByText(t.grid.removedWarning)).not.toBeInTheDocument();
  });
});

describe('TerminalProcessMapScreen 조회 조건', () => {
  it('초기화는 늘 보이고, 누르면 치던 검색어와 걸린 조건을 비운다', async () => {
    const user = userEvent.setup();
    renderScreen('/system/terminal-process-map?includeInactive=1');
    await screen.findByRole('button', { name: 'SYN-TERM-01' });
    expect(screen.getByRole('checkbox', { name: t.filters.includeInactive })).toBeChecked();

    const search = screen.getByPlaceholderText(t.filters.searchPlaceholder);
    await user.type(search, 'SYN');
    await user.click(screen.getByRole('button', { name: t.filters.clear }));

    expect(search).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: t.filters.includeInactive })).not.toBeChecked();
    expect(screen.getByRole('button', { name: t.filters.clear })).toBeInTheDocument();
  });

  it('좌우 · 상하 배치 단추가 조회 줄에 늘 보이고, 상하를 누르면 위아래로 쌓인다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    const stacked = screen.getByRole('button', {
      name: messages.common.inspectionHub.layoutStacked,
    });
    await user.click(stacked);

    expect(stacked).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.po-board-split.is-stacked')).not.toBeNull();
  });

  it('사용 · 미사용 라벨에 건수가 붙고, 미사용을 누르면 미사용만 서버에 묻는다', async () => {
    const user = userEvent.setup();
    const listQueries: string[] = [];
    renderWithProviders(<TerminalProcessMapScreen />, {
      fetch: createStubFetch([
        {
          match: (request) => path(request) === '/mdm/terminals',
          respond: (request) => {
            const params = new URL(request.url).searchParams;
            if (params.get('size') !== '1') listQueries.push(params.toString());
            /* 사용 2건 · 미사용 1건인 단말 목록 */
            if (params.get('isActive') === 'false') {
              return jsonResponse(page([terminal(703, 'SYN-TERM-03', { isActive: false })]));
            }
            return jsonResponse(page([unregistered, registered]));
          },
        },
        ...routes,
      ]),
      route: '/system/terminal-process-map',
      session: null,
    });
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    const inactive = await screen.findByRole('button', {
      name: t.chips.filterOn(t.list.inactive),
    });
    expect(inactive).toHaveTextContent('1');
    await user.click(inactive);

    expect(await screen.findByRole('button', { name: 'SYN-TERM-03' })).toBeInTheDocument();
    expect(listQueries.at(-1)).toContain('isActive=false');
  });

  it('단말 추가 팝업은 닫기(X) 없이 [취소]로만 닫히고, 칸을 고치면 그 칸의 오류가 지워진다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    await user.click(screen.getByRole('button', { name: t.terminal.create }));
    const dialog = await screen.findByRole('dialog', { name: t.terminal.create });
    expect(within(dialog).queryByRole('button', { name: /닫기|close/i })).not.toBeInTheDocument();

    /* 단말 코드는 열자마자 미리 채워진다(사용자 지시 2026-11-20 · #333) — 지워야 빈 칸 오류를 본다. */
    const code = within(dialog).getByRole('textbox', { name: t.terminal.code });
    await waitFor(() => {
      expect(code).not.toHaveValue('');
    });
    await user.clear(code);
    await user.click(within(dialog).getByRole('button', { name: t.terminal.register }));
    expect(within(dialog).getByText(t.terminal.requiredCode)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: t.terminal.code }), 'SYN-NEW');
    expect(within(dialog).queryByText(t.terminal.requiredCode)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: t.terminal.cancel }));
    expect(screen.queryByRole('dialog', { name: t.terminal.create })).not.toBeInTheDocument();
  });
});

describe('TerminalProcessMapScreen 기능 구성 저장', () => {
  const processRow = (processId: number, processName: string, flags: Record<string, boolean>) => ({
    terminalProcessId: processId + 1000,
    terminalId: 701,
    processId,
    processName,
    ...flags,
  });
  const renderWith = (rows: unknown[], put?: StubRoute['respond']) => {
    const puts: unknown[] = [];
    const extra: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'PUT' && path(request) === '/mdm/terminals/701/processes',
        respond: async (request) => {
          puts.push(await request.clone().json());
          return put === undefined ? jsonResponse(page(rows)) : put(request);
        },
      },
      {
        match: (request) => path(request) === '/mdm/terminals/701/processes',
        respond: () => jsonResponse(page(rows), { headers: { ETag: '"1"' } }),
      },
    ];
    renderWithProviders(<TerminalProcessMapScreen />, {
      fetch: createStubFetch([...extra, ...routes]),
      route: '/system/terminal-process-map?terminal=701',
      session: null,
    });
    return { puts, user: userEvent.setup() };
  };
  const flag = (processName: string, key: keyof typeof t.flags) =>
    screen.getByRole('checkbox', { name: `${processName} ${t.flags[key]}` });

  it('저장된 공정을 목록에서 빼면 저장 옆에 경고가 뜬다(사용자 지시 2026-11-20 · #333)', async () => {
    const { user } = renderWith([processRow(11, '합성 사출', { canStartWork: true })]);

    await screen.findByRole('button', { name: t.grid.save });
    expect(screen.queryByText(t.grid.removedWarning)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `합성 사출 ${t.grid.remove}` }));
    expect(screen.getByText(t.grid.removedWarning)).toBeInTheDocument();
    expect(screen.getByText(t.grid.emptyTitle)).toBeInTheDocument();
  });

  it('기능을 하나도 켜지 않은 줄을 짚고 저장을 막으며, 하나라도 켜면 풀린다', async () => {
    const { user } = renderWith([
      processRow(11, '합성 사출', { canStartWork: true }),
      processRow(12, '합성 조립', {}),
    ]);

    const save = await screen.findByRole('button', { name: t.grid.save });
    const row = screen.getByText('합성 조립').closest('tr');
    if (row === null) throw new Error('행 없음');
    expect(within(row).getByText(t.grid.noFlag)).toBeInTheDocument();
    expect(screen.getAllByText(t.grid.noFlag)).toHaveLength(1);
    await user.click(flag('합성 사출', 'canCompleteWork'));
    expect(save).toBeDisabled();

    await user.click(flag('합성 조립', 'canInputResult'));

    expect(screen.queryByText(t.grid.noFlag)).not.toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  const rejectSecondRow = () =>
    renderWith(
      [
        processRow(11, '합성 사출', { canStartWork: true }),
        processRow(12, '합성 조립', { canPrintLabel: true }),
      ],
      () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'items[1]',
                code: 'INVALID',
                message: '합성 서버 문구 — 기능 없음',
              },
            ],
          },
          { status: 400 },
        ),
    );
  const SERVER_MESSAGE = '합성 서버 문구 — 기능 없음';
  const saveAndReject = async () => {
    const rendered = rejectSecondRow();
    await screen.findByRole('button', { name: t.grid.save });
    await rendered.user.click(flag('합성 조립', 'canInputResult'));
    await rendered.user.click(screen.getByRole('button', { name: t.grid.save }));
    await waitFor(() => expect(rendered.puts).toHaveLength(1));
    await screen.findByText(SERVER_MESSAGE);
    return rendered;
  };

  it('서버가 줄을 짚어 거절하면 그 줄에 서버 문구를 붙인다', async () => {
    const { user, puts } = rejectSecondRow();

    await screen.findByRole('button', { name: t.grid.save });
    await user.click(flag('합성 조립', 'canInputResult'));
    await user.click(screen.getByRole('button', { name: t.grid.save }));

    await waitFor(() => expect(puts).toHaveLength(1));
    const row = (await screen.findByText('합성 서버 문구 — 기능 없음')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('합성 조립')).toBeInTheDocument();
    /* 줄에 붙인 문구는 띠에 다시 내지 않는다. */
    expect(screen.getAllByText('합성 서버 문구 — 기능 없음')).toHaveLength(1);
  });

  it('서버가 짚은 줄을 고치면 그 줄의 문구만 지운다', async () => {
    const { user } = await saveAndReject();

    await user.click(flag('합성 사출', 'canPrintLabel'));
    expect(screen.getByText(SERVER_MESSAGE)).toBeInTheDocument();

    await user.click(flag('합성 조립', 'canInputInspection'));
    expect(screen.queryByText(SERVER_MESSAGE)).not.toBeInTheDocument();
  });

  it('저장하지 않은 구성이 있으면 다른 단말을 고르기 전에 묻고, 계속 편집하면 그대로 남는다', async () => {
    const { user } = renderWith([processRow(11, '합성 사출', { canStartWork: true })]);

    await screen.findByRole('button', { name: t.grid.save });
    await user.click(flag('합성 사출', 'canCompleteWork'));
    await user.click(screen.getByRole('button', { name: 'SYN-TERM-02' }));

    const dialog = await screen.findByRole('dialog', { name: t.discard.title });
    await user.click(within(dialog).getByRole('button', { name: t.discard.keep }));

    expect(screen.queryByRole('dialog', { name: t.discard.title })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYN-TERM-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(flag('합성 사출', 'canCompleteWork')).toBeChecked();
  });

  it('저장하지 않고 나가면 고른 단말이 바뀐다', async () => {
    const { user } = renderWith([processRow(11, '합성 사출', { canStartWork: true })]);

    await screen.findByRole('button', { name: t.grid.save });
    await user.click(flag('합성 사출', 'canCompleteWork'));
    await user.click(screen.getByRole('button', { name: 'SYN-TERM-02' }));
    const dialog = await screen.findByRole('dialog', { name: t.discard.title });
    await user.click(within(dialog).getByRole('button', { name: t.discard.leave }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'SYN-TERM-02' })).toHaveAttribute(
        'aria-current',
        'true',
      ),
    );
  });

  it('「취소」하면 서버가 짚은 문구도 지운다', async () => {
    const { user } = await saveAndReject();

    await user.click(screen.getByRole('button', { name: t.grid.reset }));

    expect(screen.queryByText(SERVER_MESSAGE)).not.toBeInTheDocument();
  });
});
