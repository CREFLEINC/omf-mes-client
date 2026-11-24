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
  /* 공정별 기능 구성은 POP 단말에만 보인다 — 기본 단말은 POP. */
  terminalTypeCode: 'POP',
  statusCode: 'SYN-RUN',
  registrationStatusCode: 'UNREGISTERED',
  isActive: true,
  versionNo: 1,
  ...overrides,
});
const unregistered = terminal(701, 'SYN-TERM-01');
const registered = terminal(702, 'SYN-TERM-02', {
  registrationStatusCode: 'REGISTERED',
  terminalTypeCode: 'SYN-TYPE',
});

/* 공통코드 표시명 — 이름이 없는 코드는 화면이 코드를 그대로 보인다. */
const codeNames: Record<string, { code: string; codeName: string }[]> = {
  TERMINAL_TYPE: [
    { code: 'POP', codeName: 'POP' },
    { code: 'SYN-TYPE', codeName: '합성 유형' },
  ],
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
    /* 단말 정보 표 — 항목 칸(th) 바로 옆 값 칸(td). */
    const label = await screen.findByRole('rowheader', { name: t.terminal.status });
    await waitFor(() => expect(label.nextElementSibling?.textContent).toBe(t.list.notAvailable));
  });

  it('고른 단말은 목록에서 aria-current 로 표시되고, 제목 옆 안내 문구는 없다', async () => {
    renderScreen('/system/terminal-process-map?terminal=701');

    const current = await screen.findByRole('button', { name: 'SYN-TERM-01' });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'SYN-TERM-02' })).not.toHaveAttribute('aria-current');

    expect(await screen.findByRole('button', { name: t.grid.save })).toBeInTheDocument();
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

  it('등록 · 미등록 라벨에 건수가 붙고, 미등록을 누르면 미등록만 서버에 묻는다', async () => {
    const user = userEvent.setup();
    const listQueries: string[] = [];
    renderWithProviders(<TerminalProcessMapScreen />, {
      fetch: createStubFetch([
        {
          match: (request) => path(request) === '/mdm/terminals',
          respond: (request) => {
            const params = new URL(request.url).searchParams;
            if (params.get('size') !== '1') listQueries.push(params.toString());
            /* 미등록만 물으면 미등록 단말 하나 */
            if (params.get('registrationStatusCode') === 'UNREGISTERED') {
              return jsonResponse(page([terminal(703, 'SYN-TERM-03', {})]));
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

    const pending = await screen.findByRole('button', {
      name: t.chips.filterOn(t.list.registrationPending),
    });
    expect(pending).toHaveTextContent('1');
    await user.click(pending);

    expect(await screen.findByRole('button', { name: 'SYN-TERM-03' })).toBeInTheDocument();
    expect(listQueries.at(-1)).toContain('registrationStatusCode=UNREGISTERED');
  });

  it('단말 추가 팝업은 닫기(X) 없이 [취소]로만 닫히고, 칸을 고치면 그 칸의 오류가 지워진다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole('button', { name: 'SYN-TERM-01' });

    await user.click(screen.getByRole('button', { name: t.terminal.create }));
    const dialog = await screen.findByRole('dialog', { name: t.terminal.create });
    expect(within(dialog).queryByRole('button', { name: /닫기|close/i })).not.toBeInTheDocument();

    /* 단말 코드는 유형을 고르면 채워진다(사용자 결정 2026-11-24) — 지워야 빈 칸 오류를 본다. */
    const code = within(dialog).getByRole('textbox', { name: t.terminal.code });
    expect(code).toBeDisabled();
    /* 자주 쓰지 않는 유형은 [더보기] 뒤에 있다(사용자 지시 2026-11-24). */
    expect(within(dialog).queryByRole('radio', { name: /합성 유형/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.terminal.moreTypes }));
    await user.click(within(dialog).getByRole('radio', { name: /합성 유형/ }));
    await waitFor(() => {
      expect(code).not.toHaveValue('');
    });
    await user.clear(code);
    /* POP 이 아니면 공정 단계를 건너뛰어 첫 단계에서 바로 [등록]. */
    await user.click(within(dialog).getByRole('button', { name: t.wizard.register }));
    expect(within(dialog).getByText(t.terminal.requiredCode)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: t.terminal.code }), 'SYN-NEW');
    expect(within(dialog).queryByText(t.terminal.requiredCode)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: t.terminal.cancel }));
    expect(screen.queryByRole('dialog', { name: t.terminal.create })).not.toBeInTheDocument();
  });
});

describe('TerminalProcessMapScreen 단말 정보 정리 (사용자 지시 2026-11-24)', () => {
  it('POP 이 아닌 단말(창고에서 쓰는 단말)은 공정별 기능 구성을 보이지 않는다', async () => {
    renderScreen('/system/terminal-process-map?terminal=702');
    await screen.findByRole('heading', { name: t.panes.terminal });
    expect(screen.queryByRole('heading', { name: t.panes.grid })).not.toBeInTheDocument();
  });

  it('사용 중지는 단말 정보가 아니라 [단말 수정] 창 본문에 있고, 수정 창에서 유형은 바꿀 수 없다', async () => {
    const user = userEvent.setup();
    renderScreen('/system/terminal-process-map?terminal=701');
    await screen.findByRole('heading', { name: t.panes.grid });
    expect(
      screen.queryByRole('button', { name: t.terminal.deactivateAction }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.terminal.edit }));
    const dialog = await screen.findByRole('dialog', { name: t.terminal.edit });
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(t.terminal.type)).toHaveTextContent('POP');

    await user.click(within(dialog).getByRole('button', { name: t.terminal.deactivateAction }));
    expect(
      await screen.findByRole('dialog', { name: t.terminal.deactivateTitle }),
    ).toBeInTheDocument();
  });
});

describe('TerminalProcessMapScreen 단말 추가 단계 (사용자 결정 2026-11-24)', () => {
  const created = terminal(801, 'POP-001', { terminalTypeCode: 'POP' });
  const issuedToken = {
    token: 'header.payload.signature',
    issuedAt: '2026-11-24T04:00:00Z',
    expiresAt: null,
  };

  const renderWizard = () => {
    const calls: string[] = [];
    const puts: { body: unknown; ifMatch: string | null }[] = [];
    renderWithProviders(<TerminalProcessMapScreen />, {
      fetch: createStubFetch([
        {
          match: (request) => request.method === 'POST' && path(request) === '/mdm/terminals',
          respond: () => {
            calls.push('create');
            return jsonResponse(created, { status: 201, headers: { ETag: '"1"' } });
          },
        },
        {
          match: (request) => request.method === 'PUT' && path(request).endsWith('/processes'),
          respond: async (request) => {
            calls.push('processes');
            puts.push({ body: await request.json(), ifMatch: request.headers.get('If-Match') });
            return jsonResponse(page([]), { headers: { ETag: '"2"' } });
          },
        },
        {
          match: (request) => path(request).endsWith(':issue-token'),
          respond: () => {
            calls.push('token');
            return jsonResponse(issuedToken, { status: 201 });
          },
        },
        {
          match: (request) => path(request) === '/mdm/code-values',
          respond: (request) => {
            const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
            const values =
              group === 'TERMINAL_TYPE'
                ? [
                    { code: 'POP', codeName: 'POP' },
                    { code: 'MOBILE', codeName: 'PDA' },
                  ]
                : [];
            return jsonResponse(
              page(
                values.map((value, index) => ({
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
          match: (request) => path(request) === '/mdm/plants',
          respond: () =>
            jsonResponse(
              page([{ plantId: 1, plantCode: 'G1', plantName: '합성 1공장', isActive: true }]),
            ),
        },
        {
          match: (request) => path(request) === '/mdm/processes',
          respond: () =>
            jsonResponse(
              page([
                { processId: 31, processCode: 'SYN-P', processName: '합성 사출', isActive: true },
              ]),
            ),
        },
        ...routes,
      ]),
      route: '/system/terminal-process-map',
      session: null,
    });
    return { calls, puts };
  };

  const fillInfo = async (user: ReturnType<typeof userEvent.setup>, type: RegExp) => {
    await screen.findByRole('button', { name: 'SYN-TERM-01' });
    await user.click(screen.getByRole('button', { name: t.terminal.create }));
    const dialog = await screen.findByRole('dialog', { name: t.terminal.create });
    await user.click(within(dialog).getByRole('radio', { name: type }));
    await user.click(within(dialog).getByRole('combobox', { name: t.terminal.plant }));
    await user.click(await screen.findByRole('option', { name: 'G1 · 합성 1공장' }));
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: t.terminal.code })).not.toHaveValue('');
    });
    return dialog;
  };

  it('POP — 단말 정보 → 공정 기능 → [등록]이 만들기 · 구성 저장 · 토큰 발급을 잇고 기기 연결에 QR 을 보인다', async () => {
    const user = userEvent.setup();
    const { calls, puts } = renderWizard();
    const dialog = await fillInfo(user, /^POP/);

    await user.click(within(dialog).getByRole('button', { name: t.wizard.next }));
    expect(within(dialog).getByText(t.wizard.stepProcesses).closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    await user.click(within(dialog).getByRole('combobox', { name: t.grid.add }));
    await user.click(await screen.findByRole('option', { name: 'SYN-P · 합성 사출' }));
    await user.click(within(dialog).getByRole('button', { name: t.wizard.register }));

    expect(await within(dialog).findByText(t.wizard.registered('POP-001'))).toBeInTheDocument();
    expect(calls).toEqual(['create', 'processes', 'token']);
    /* 구성 저장은 새 단말의 구성 조회가 준 잠금 토큰을 싣는다. */
    expect(puts[0]?.ifMatch).toBe('"1"');
    expect(puts[0]?.body).toMatchObject({ items: [{ processId: 31, canStartWork: true }] });

    await user.click(within(dialog).getByRole('button', { name: t.wizard.done }));
    expect(screen.queryByRole('dialog', { name: t.terminal.create })).not.toBeInTheDocument();
  });

  it('창고에서 쓰는 단말(PDA)은 공정 단계를 건너뛴다 — 첫 단계 [등록]이 만들기 · 토큰 발급만 한다', async () => {
    const user = userEvent.setup();
    const { calls } = renderWizard();
    const dialog = await fillInfo(user, /^PDA/);

    expect(within(dialog).getByText(t.wizard.popOnly)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: t.wizard.next })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.wizard.register }));

    expect(await within(dialog).findByText(t.wizard.registered('POP-001'))).toBeInTheDocument();
    expect(calls).toEqual(['create', 'token']);
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
    await user.click(within(dialog).getByRole('button', { name: messages.routing.discard.stay }));

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
    await user.click(
      within(dialog).getByRole('button', { name: messages.routing.discard.confirm }),
    );

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

  /* 목록 접기(#350) — 접힌 탭에 건수, 펼치면 고른 단말 · 고친 구성이 그대로. */
  it('목록을 접으면 「목록 N건」 탭이 서고, 펼쳐도 고른 단말과 고친 구성이 그대로다(#350)', async () => {
    const keys = [
      'omf-mes:terminal-process-map:split:collapsed',
      'omf-mes:terminal-process-map:split-orientation',
    ];
    keys.forEach((key) => window.localStorage.removeItem(key));
    const { user } = renderWith([processRow(11, '합성 사출', { canStartWork: true })]);
    await screen.findByRole('button', { name: t.grid.save });
    await user.click(flag('합성 사출', 'canCompleteWork'));
    const split = document.querySelector('.users-roles-split');

    await user.click(
      screen.getAllByRole('button', { name: messages.common.inspectionHub.listCollapse })[0]!,
    );
    expect(split).toHaveAttribute('data-left-collapsed', 'true');
    const tab = split!.querySelector<HTMLElement>('.po-board-list-tab');
    expect(tab).toHaveTextContent('목록2건');

    await user.click(tab!);
    expect(split).not.toHaveAttribute('data-left-collapsed');
    expect(screen.getByRole('button', { name: 'SYN-TERM-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(flag('합성 사출', 'canCompleteWork')).toBeChecked();
    keys.forEach((key) => window.localStorage.removeItem(key));
  });
});
