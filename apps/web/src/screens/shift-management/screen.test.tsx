import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { nextShiftCode } from './edit-dialog';
import { ShiftManagementScreen } from './screen';

const t = messages.shiftManagement;
const td = t.dialog;

/** 공장 · 교대는 합성 값이다(시험 전용). */
const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

const shift = (id: number, code: string, name: string, start: string, end: string) => ({
  shiftId: id,
  plantId: 8401,
  shiftCode: code,
  shiftName: name,
  startTime: start,
  endTime: end,
  crossesMidnight: end <= start,
  isActive: true,
});

/* 일부러 야간을 앞에 둔다 — 화면이 시작 시각 차례로 세우는지 본다. */
const SHIFTS = [
  shift(2, 'N', '합성 야간', '20:00:00', '08:00:00'),
  shift(1, 'D', '합성 주간', '08:00:00', '20:00:00'),
];

interface Write {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
}

const setup = (
  options: {
    referenceCount?: number;
    shifts?: ReturnType<typeof shift>[];
    /** 계정 범위 — 기본은 공장이 지정된 계정. */
    scopes?: { businessUnitId: number; plantId?: number }[];
    respondWrite?: (path: string) => Response | undefined;
  } = {},
) => {
  const writes: Write[] = [];
  const listQueries: URL[] = [];
  const detailGets: string[] = [];
  const pathOf = (request: Request) => new URL(request.url).pathname;
  const isGet = (request: Request, path: string) =>
    request.method === 'GET' && pathOf(request) === path;
  const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });
  const referenceCount = options.referenceCount ?? 0;

  const routes: StubRoute[] = [
    { match: (r) => isGet(r, '/mdm/plants'), respond: () => jsonResponse(page([PLANT])) },
    {
      match: (r) => isGet(r, '/mdm/shifts'),
      respond: (r) => {
        listQueries.push(new URL(r.url));
        return jsonResponse(page(options.shifts ?? SHIFTS));
      },
    },
    {
      match: (r) => r.method === 'GET' && /^\/mdm\/shifts\/\d+$/.test(pathOf(r)),
      respond: (r) => {
        detailGets.push(pathOf(r));
        return jsonResponse(
          {
            shift: (options.shifts ?? SHIFTS).find(
              (each) => String(each.shiftId) === pathOf(r).split('/').at(-1),
            ),
            editability: {
              codeEditable: referenceCount === 0,
              reason: referenceCount === 0 ? 'EDITABLE' : 'REFERENCED',
              referenceCount,
            },
          },
          { headers: { ETag: '5' } },
        );
      },
    },
    {
      match: (r) => r.method !== 'GET' && pathOf(r).startsWith('/mdm/shifts'),
      respond: async (r) => {
        const text = await r.clone().text();
        const body: unknown = text === '' ? null : JSON.parse(text);
        writes.push({ method: r.method, path: pathOf(r), body, headers: r.headers });
        const override = options.respondWrite?.(pathOf(r));
        if (override !== undefined) return override;
        const saved = { ...SHIFTS[1], ...(body as object) };
        return jsonResponse(saved, {
          status: r.method === 'POST' && pathOf(r) === '/mdm/shifts' ? 201 : 200,
          headers: { ETag: '6' },
        });
      },
    },
  ];

  renderWithProviders(
    <SessionProvider>
      <ShiftManagementScreen />
    </SessionProvider>,
    {
      fetch: createStubFetch(routes),
      route: '/master-data/shifts',
      dataRouter: true,
      session: {
        ...SYNTHETIC_SESSION,
        scopes: options.scopes ?? [{ businessUnitId: 8301, plantId: 8401 }],
        permissions: ['W-06-26'],
      },
    },
  );

  return { user: userEvent.setup(), writes, listQueries, detailGets };
};

const table = async () => within(await screen.findByRole('table', { name: t.tableLabel }));

type User = ReturnType<typeof userEvent.setup>;

const tf = messages.screenPatterns.timeField;

/** 공용 시각 칸 — 시계 아이콘으로 고르기 창을 열고 시 · 분 묶음에서 차례로 고른다. */
const pickTime = async (user: User, which: 'start' | 'end', value: string) => {
  const [hour, minute] = value.split(':');
  await user.click(
    screen.getByRole('button', { name: tf.open(which === 'start' ? td.start : td.end) }),
  );
  const hours = screen.getByRole('listbox', {
    name: which === 'start' ? td.startHour : td.endHour,
  });
  await user.click(within(hours).getByRole('option', { name: hour }));
  const minutes = screen.getByRole('listbox', {
    name: which === 'start' ? td.startMinute : td.endMinute,
  });
  await user.click(within(minutes).getByRole('option', { name: minute }));
};

describe('ShiftManagementScreen — 교대 관리 W-06-26 (#318)', () => {
  it('공장의 교대를 시작 시간 차례로 보이고, 자정을 넘는 교대의 종료 시간은 「다음 날 HH:MM」로 적는다', async () => {
    const { listQueries } = setup();
    const rows = (await table()).getAllByRole('row').slice(1);
    const [day, night] = rows;
    if (day === undefined || night === undefined) throw new Error('교대 두 줄이 없다');

    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['D', 'N']);
    expect(within(day).getByText('08:00')).toBeInTheDocument();
    expect(within(day).getByText('20:00')).toBeInTheDocument();
    expect(within(night).getByText(t.values.nextDayEnd('08:00'))).toBeInTheDocument();
    expect(screen.getByText(messages.common.paneList.count(2))).toBeInTheDocument();
    /* 기존 조회 API 를 공장으로 거르고, 사용 유무 라벨을 위해 사용 중지한 교대까지 받는다. */
    expect(listQueries[0]?.searchParams.get('plantId')).toBe('8401');
    expect(listQueries[0]?.searchParams.get('includeInactive')).toBe('true');
  });

  it('사용 유무 라벨 — 누르면 그 상태만 보이고, 0건인 라벨은 보이지 않는다', async () => {
    const { user } = setup({
      shifts: [
        ...SHIFTS,
        { ...shift(3, 'X', '합성 폐지', '06:00:00', '14:00:00'), isActive: false },
      ],
    });
    await table();
    const chips = within(screen.getByRole('group', { name: t.chips.label }));
    await user.click(chips.getByRole('button', { name: t.chips.filterOn(t.chips.inactive) }));
    const rows = (await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    /* 사용 중지한 교대는 관리 단추가 없다. */
    /* 미사용 줄은 [재사용] 단추 하나만 있다. */
    expect(
      within(rows[0] as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([t.activateRow('합성 폐지')]);
  });

  it('미사용이 0건이면 미사용 라벨은 보이지 않는다', async () => {
    setup();
    await table();
    const chips = within(screen.getByRole('group', { name: t.chips.label }));
    expect(
      chips.getByRole('button', { name: t.chips.filterOn(t.chips.active) }),
    ).toBeInTheDocument();
    expect(chips.queryByRole('button', { name: t.chips.filterOn(t.chips.inactive) })).toBeNull();
  });

  it('추가 — 코드를 미리 채우고, 필수 칸이 다 차야 [저장]이 켜지며, 공장과 HH:MM:SS 시간을 보낸다', async () => {
    const { user, writes } = setup();
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));

    /* 닫기(X) 단추는 없다. */
    expect(dialog.queryByRole('button', { name: /닫기/ })).toBeNull();
    const code = dialog.getByLabelText(td.code, { exact: false });
    expect(code).toHaveValue('S01');
    expect(dialog.getByRole('button', { name: td.save })).toBeDisabled();
    /* 빈 필수 칸은 오류로 표시하지 않는다 — 연한 빨간 바탕(팝업 공통)으로만, [저장]은 꺼져 있다(omf-all-around#360). */
    expect(dialog.getByRole('textbox', { name: td.start })).not.toHaveAttribute('aria-invalid');
    expect(
      dialog.getByRole('textbox', { name: td.start }).closest('.time-picker-trigger'),
    ).toHaveAttribute('data-empty');

    /* 자동 코드는 바꿀 수 있다. */
    await user.clear(code);
    expect(dialog.getByRole('button', { name: td.save })).toBeDisabled();
    await user.type(code, 'N2');
    await user.type(dialog.getByLabelText(td.name, { exact: false }), '야간 2');
    await pickTime(user, 'start', '22:00');
    await pickTime(user, 'end', '06:00');
    /* 다음 날 종료 안내는 띄우지 않는다(사용자 결정 2026-11-26). */
    expect(dialog.queryByText(/다음 날/)).toBeNull();
    expect(dialog.getByRole('button', { name: td.save })).toBeEnabled();
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'POST',
      path: '/mdm/shifts',
      body: {
        plantId: 8401,
        shiftCode: 'N2',
        shiftName: '야간 2',
        startTime: '22:00:00',
        endTime: '06:00:00',
      },
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: td.addTitle })).toBeNull());
  });

  it('수정 — 상세의 ETag 로 잠그고 고친 시각을 보낸다', async () => {
    const { user, writes } = setup();
    await user.click((await table()).getByRole('button', { name: t.editRow('합성 주간') }));
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));
    await waitFor(() =>
      expect(dialog.getByLabelText(td.name, { exact: false })).toHaveValue('합성 주간'),
    );

    await pickTime(user, 'end', '19:30');
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'PUT',
      path: '/mdm/shifts/1',
      body: { shiftCode: 'D', shiftName: '합성 주간', startTime: '08:00:00', endTime: '19:30:00' },
    });
    expect(writes[0]?.headers.get('If-Match')).toBe('5');
  });

  it('작업·실적에 쓰인 교대는 코드 칸을 잠그고 코드를 보내지 않는다', async () => {
    const { user, writes } = setup({ referenceCount: 3 });
    await user.click((await table()).getByRole('button', { name: t.editRow('합성 야간') }));
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));

    await waitFor(() => expect(dialog.getByLabelText(td.code, { exact: false })).toBeDisabled());
    // 까닭은 칸 아래 글로 펼치지 않고 자물쇠 툴팁 · 화면 읽기 설명으로만 남는다(#360).
    expect(dialog.getByLabelText(td.code, { exact: false })).toHaveAccessibleDescription(
      td.codeLocked(3),
    );
    expect(dialog.getByText(td.codeLocked(3))).toHaveClass('visually-hidden');
    expect(
      dialog
        .getAllByTitle(td.codeLocked(3))
        .some((el) => el.classList.contains('locked-field-icon')),
    ).toBe(true);
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body).not.toHaveProperty('shiftCode');
  });

  it('사용 중지 — 목록 관리 칸에서 확인 뒤 :deactivate 를 ETag 와 함께 보낸다', async () => {
    const { user, writes } = setup();
    await user.click((await table()).getByRole('button', { name: t.deactivateRow('합성 야간') }));

    const confirm = within(await screen.findByRole('dialog', { name: t.deactivateDialog.title }));
    expect(confirm.getByText(t.deactivateDialog.body('합성 야간'))).toBeInTheDocument();
    await waitFor(() =>
      expect(confirm.getByRole('button', { name: t.deactivateDialog.confirm })).toBeEnabled(),
    );
    await user.click(confirm.getByRole('button', { name: t.deactivateDialog.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/mdm/shifts/2:deactivate' });
    expect(writes[0]?.headers.get('If-Match')).toBe('5');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: t.deactivateDialog.title })).toBeNull(),
    );
  });

  it('서버가 코드 중복으로 거절하면 창을 닫지 않고 교대 코드 칸에 알린다', async () => {
    const { user } = setup({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'UNIQUE_VIOLATION',
                message: '이미 있는 값입니다.',
                uniqueScope: ['plantId', 'shiftCode'],
              },
            ],
          },
          { status: 400 },
        ),
    });
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));
    await user.clear(dialog.getByLabelText(td.code, { exact: false }));
    await user.type(dialog.getByLabelText(td.code, { exact: false }), 'X');
    await user.type(dialog.getByLabelText(td.name, { exact: false }), '주간');
    await pickTime(user, 'start', '08:00');
    await pickTime(user, 'end', '20:00');
    await user.click(dialog.getByRole('button', { name: td.save }));

    expect(await dialog.findByText(td.codeTaken)).toBeInTheDocument();
    expect(dialog.queryByText('이미 있는 값입니다.')).toBeNull();
    expect(screen.getByRole('dialog', { name: td.addTitle })).toBeInTheDocument();
    /* 코드를 고치면 안내가 사라진다. */
    await user.type(dialog.getByLabelText(td.code, { exact: false }), '2');
    expect(dialog.queryByText(td.codeTaken)).toBeNull();
  });

  it('같은 공장에 이미 있는 코드(사용 중지 포함)는 저장 전에 칸에서 알리고 [저장]을 끈다', async () => {
    const { user, writes } = setup({
      shifts: [
        ...SHIFTS,
        { ...shift(3, 'X', '합성 예전', '06:00:00', '14:00:00'), isActive: false },
      ],
    });
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));
    await user.clear(dialog.getByLabelText(td.code, { exact: false }));
    await user.type(dialog.getByLabelText(td.code, { exact: false }), 'X');
    await user.type(dialog.getByLabelText(td.name, { exact: false }), '오후');
    await pickTime(user, 'start', '14:00');
    await pickTime(user, 'end', '22:00');
    expect(dialog.getByText(td.codeTaken)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: td.save })).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('저장 충돌이면 [최신 불러오기]로 상세를 다시 받는다', async () => {
    const { user, detailGets } = setup({
      respondWrite: () =>
        jsonResponse(
          { conflictCause: 'user', message: '다른 사용자가 먼저 저장했습니다.' },
          { status: 409 },
        ),
    });
    await user.click((await table()).getByRole('button', { name: t.editRow('합성 주간') }));
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));
    await waitFor(() => expect(dialog.getByRole('button', { name: td.save })).toBeEnabled());
    await user.click(dialog.getByRole('button', { name: td.save }));
    const reload = await dialog.findByRole('button', { name: messages.conflict.reloadAction });
    const before = detailGets.length;
    await user.click(reload);
    await waitFor(() => expect(detailGets.length).toBeGreaterThan(before));
  });

  it('미사용 교대는 [재사용]만 있고 확인 뒤 :activate 를 ETag 와 함께 보낸다', async () => {
    const { user, writes } = setup({
      shifts: [
        shift(1, 'D', '합성 주간', '08:00:00', '20:00:00'),
        { ...shift(2, 'N', '합성 야간', '20:00:00', '08:00:00'), isActive: false },
      ],
    });
    const rows = await table();
    expect(rows.queryByRole('button', { name: t.editRow('합성 야간') })).toBeNull();
    await user.click(rows.getByRole('button', { name: t.activateRow('합성 야간') }));
    const confirm = within(await screen.findByRole('dialog', { name: t.activateDialog.title }));
    expect(confirm.getByText(t.activateDialog.body('합성 야간'))).toBeInTheDocument();
    await waitFor(() =>
      expect(confirm.getByRole('button', { name: t.activateDialog.confirm })).toBeEnabled(),
    );
    await user.click(confirm.getByRole('button', { name: t.activateDialog.confirm }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/mdm/shifts/2:activate' });
    expect(writes[0]?.headers.get('If-Match')).toBe('5');
  });
});

describe('ShiftManagementScreen — 검색 · 쪽 넘김', () => {
  it('교대 코드 · 교대명으로 거르고, 조건이 바뀌면 [초기화]가 나와 되돌린다', async () => {
    const { user } = setup();
    await table();
    expect(screen.queryByRole('button', { name: t.filters.clear })).toBeNull();
    await user.type(screen.getByLabelText(t.filters.search), '야간');
    await user.click(screen.getByRole('button', { name: t.filters.apply }));
    let rows = (await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText('합성 야간')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.clear }));
    rows = (await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
  });

  it('쪽당 건수만큼 보이고 다음 쪽으로 넘긴다', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      shift(
        100 + index,
        `C${String(index).padStart(2, '0')}`,
        `합성 ${String(index)}`,
        '08:00:00',
        '20:00:00',
      ),
    );
    const { user } = setup({ shifts: many });
    expect((await table()).getAllByRole('row').slice(1)).toHaveLength(12);
    await user.click(screen.getByRole('combobox', { name: /쪽|페이지|건/ }));
    await user.click(screen.getByRole('option', { name: '10건' }));
    expect((await table()).getAllByRole('row').slice(1)).toHaveLength(10);
    await user.click(
      within(screen.getByRole('navigation')).getByRole('button', {
        name: messages.screenPatterns.pageNav.next,
      }),
    );
    expect((await table()).getAllByRole('row').slice(1)).toHaveLength(2);
  });
});

describe('ShiftManagementScreen — 공장이 지정되지 않은 계정', () => {
  it('「전체」로 공장 조건 없이 모든 교대를 보이고 공장 열을 둔다', async () => {
    const { listQueries } = setup({ scopes: [{ businessUnitId: 8301 }] });
    const grid = await table();
    expect(grid.getByRole('columnheader', { name: t.columns.plant })).toBeInTheDocument();
    expect(grid.getAllByText(PLANT.plantName)).toHaveLength(2);
    expect(listQueries[0]?.searchParams.has('plantId')).toBe(false);
  });
});

describe('nextShiftCode', () => {
  it('이 공장에서 아직 쓰지 않은 S01 · S02 … 중 첫 번째를 고른다', () => {
    expect(nextShiftCode([])).toBe('S01');
    expect(nextShiftCode(['D', 's01', 'S03'])).toBe('S02');
  });
});

describe('ShiftManagementScreen — 시작 · 종료 같은 시각', () => {
  it('종료 시간에서 시작 시간과 같은 시각은 고를 수 없다', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));
    await pickTime(user, 'start', '08:00');
    await user.click(dialog.getByRole('button', { name: tf.open(td.end) }));
    await user.click(
      within(screen.getByRole('listbox', { name: td.endHour })).getByRole('option', { name: '08' }),
    );
    const minutes = within(screen.getByRole('listbox', { name: td.endMinute }));
    expect(minutes.getByRole('option', { name: '00' })).toHaveAttribute('aria-disabled', 'true');
    expect(minutes.getByRole('option', { name: '30' })).not.toHaveAttribute('aria-disabled');
  });
});
