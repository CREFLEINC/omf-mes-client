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
import { endsNextDay } from './edit-dialog';
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
  options: { referenceCount?: number; respondWrite?: (path: string) => Response | undefined } = {},
) => {
  const writes: Write[] = [];
  const listQueries: URL[] = [];
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
        return jsonResponse(page(SHIFTS));
      },
    },
    {
      match: (r) => r.method === 'GET' && /^\/mdm\/shifts\/\d+$/.test(pathOf(r)),
      respond: (r) =>
        jsonResponse(
          {
            shift: SHIFTS.find((each) => String(each.shiftId) === pathOf(r).split('/').at(-1)),
            editability: {
              codeEditable: referenceCount === 0,
              reason: referenceCount === 0 ? 'EDITABLE' : 'REFERENCED',
              referenceCount,
            },
          },
          { headers: { ETag: '5' } },
        ),
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
        scopes: [{ businessUnitId: 8301 }],
        permissions: ['W-06-26'],
      },
    },
  );

  return { user: userEvent.setup(), writes, listQueries };
};

const table = async () => within(await screen.findByRole('table', { name: t.tableLabel }));

type User = ReturnType<typeof userEvent.setup>;

/** 공용 시각 선택칸 — 칸을 눌러 열고 시 · 분 열에서 차례로 고른다. */
const pickTime = async (user: User, which: 'start' | 'end', value: string) => {
  const [hour, minute] = value.split(':');
  await user.click(screen.getByRole('button', { name: which === 'start' ? td.start : td.end }));
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
  it('공장의 교대를 시작 시각 차례로 보이고, 자정을 넘는 교대는 「다음 날」로 적는다', async () => {
    const { listQueries } = setup();
    const rows = (await table()).getAllByRole('row').slice(1);
    const [day, night] = rows;
    if (day === undefined || night === undefined) throw new Error('교대 두 줄이 없다');

    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['D', 'N']);
    expect(within(day).getByText('08:00')).toBeInTheDocument();
    expect(within(day).getByText(t.values.sameDay)).toBeInTheDocument();
    expect(within(night).getByText(t.values.nextDay)).toBeInTheDocument();
    expect(screen.getByText(t.count(2))).toBeInTheDocument();
    /* 기존 조회 API 를 공장으로 거른다 — 사용 중지 포함 조건은 싣지 않는다. */
    expect(listQueries[0]?.searchParams.get('plantId')).toBe('8401');
    expect(listQueries[0]?.searchParams.has('includeInactive')).toBe(false);
  });

  it('추가 — 빈 필수 칸은 막고, 채우면 공장과 HH:MM:SS 시각을 보낸다', async () => {
    const { user, writes } = setup();
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));

    await user.click(dialog.getByRole('button', { name: td.save }));
    expect(dialog.getAllByText(td.required)).toHaveLength(4);
    expect(writes).toHaveLength(0);

    await user.type(dialog.getByLabelText(td.code, { exact: false }), 'N2');
    await user.type(dialog.getByLabelText(td.name, { exact: false }), '야간 2');
    await pickTime(user, 'start', '22:00');
    await pickTime(user, 'end', '06:00');
    expect(dialog.getByText(td.nextDayNote)).toBeInTheDocument();
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
    expect(dialog.getByText(td.codeLocked(3))).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: td.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body).not.toHaveProperty('shiftCode');
  });

  it('사용 중지 — 확인 뒤 :deactivate 를 ETag 와 함께 보내고 창을 닫는다', async () => {
    const { user, writes } = setup();
    await user.click((await table()).getByRole('button', { name: t.editRow('합성 야간') }));
    const dialog = within(await screen.findByRole('dialog', { name: td.editTitle }));
    await waitFor(() => expect(dialog.getByRole('button', { name: td.deactivate })).toBeEnabled());
    await user.click(dialog.getByRole('button', { name: td.deactivate }));

    const confirm = within(await screen.findByRole('dialog', { name: t.deactivateDialog.title }));
    expect(confirm.getByText(t.deactivateDialog.body('합성 야간'))).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: t.deactivateDialog.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'POST', path: '/mdm/shifts/2:deactivate' });
    expect(writes[0]?.headers.get('If-Match')).toBe('5');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: td.editTitle })).toBeNull());
  });

  it('서버가 거절하면 창을 닫지 않고 칸 옆에 이유를 보인다', async () => {
    const { user } = setup({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'shiftCode',
                code: 'DUPLICATE',
                message: '이미 있는 교대 코드입니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });
    await user.click(await screen.findByRole('button', { name: t.add }));
    const dialog = within(await screen.findByRole('dialog', { name: td.addTitle }));
    await user.type(dialog.getByLabelText(td.code, { exact: false }), 'D');
    await user.type(dialog.getByLabelText(td.name, { exact: false }), '주간');
    await pickTime(user, 'start', '08:00');
    await pickTime(user, 'end', '20:00');
    await user.click(dialog.getByRole('button', { name: td.save }));

    expect(await dialog.findByText('이미 있는 교대 코드입니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: td.addTitle })).toBeInTheDocument();
  });
});

describe('endsNextDay', () => {
  it('끝이 시작보다 이르거나 같으면 다음 날이다 — 비어 있으면 판단하지 않는다', () => {
    expect(endsNextDay('20:00', '08:00')).toBe(true);
    expect(endsNextDay('08:00', '08:00')).toBe(true);
    expect(endsNextDay('08:00', '20:00')).toBe(false);
    expect(endsNextDay('', '08:00')).toBe(false);
  });
});
