import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  calendarDefault,
  calendarDetail,
  calendarItems,
  calendarsResponse,
  makeCalendar,
  pageOf,
  referencedCode,
} from './fixtures';
import { WorkCalendarScreen } from './screen';

const t = messages.workCalendar;

/** 시험이 고정해 쓰는 달. 화면이 오늘을 읽으면 시험이 날짜마다 다른 달을 연다. */
const TEST_MONTH = { year: 2026, month: 8 } as const;

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

interface RenderOptions {
  respondCalendars?: (request: Request) => Response;
  respondDetail?: (request: Request) => Response;
  respondWrite?: (request: Request) => Response;
  respondDays?: (request: Request) => Response;
}

/** 나간 쓰기 하나. 없으면 시험이 거기서 멈추는 편이 낫다 — 다음 단언이 헛통과하지 않는다. */
const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

/** 경로 끝의 식별자. 스텁이 늘 같은 건을 돌려주지 않게 한다. */
const idOf = (request: Request): number => Number(new URL(request.url).pathname.split('/').at(-1));

const renderScreen = (options: RenderOptions = {}) => {
  const sent: URL[] = [];
  const writes: Request[] = [];
  /** 일자 조회가 실어 간 조건 — 기간을 반드시 지정하는지 본다 */
  const dayRequests: URL[] = [];

  const defaultDetail = (request: Request): Response => {
    const found = calendarItems.find((item) => item.workCalendarId === idOf(request));

    return found === undefined
      ? jsonResponse({ message: '없는 캘린더' }, { status: 404 })
      : jsonResponse(calendarDetail(found), { headers: { ETag: '9' } });
  };

  const fetch = createStubFetch([
    {
      match: (request) => isPath(request, '/mdm/work-calendars') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());

        return (options.respondWrite ?? (() => jsonResponse(calendarDefault, { status: 201 })))(
          request,
        );
      },
    },
    {
      match: (request) => isPath(request, '/mdm/work-calendars'),
      respond: (request) => {
        sent.push(new URL(request.url));

        return (options.respondCalendars ?? (() => jsonResponse(calendarsResponse())))(request);
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname.startsWith('/mdm/work-calendars/') &&
        request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());

        return (options.respondWrite ?? (() => jsonResponse(calendarDefault)))(request);
      },
    },
    {
      match: (request) =>
        new URL(request.url).pathname.endsWith('/days') && request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone());

        return (options.respondWrite ?? (() => jsonResponse({ appliedCount: 1 })))(request);
      },
    },
    {
      match: (request) => new URL(request.url).pathname.endsWith('/days'),
      respond: (request) => {
        dayRequests.push(new URL(request.url));

        return (options.respondDays ?? (() => jsonResponse({ items: [] })))(request);
      },
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/mdm/work-calendars/'),
      respond: (request) => (options.respondDetail ?? defaultDetail)(request),
    },
  ]);

  const user = userEvent.setup();
  /* 달을 인자로 고정한다 — 오늘이 언제든 시험이 같은 달을 연다. */
  const view = renderWithProviders(<WorkCalendarScreen initialMonth={TEST_MONTH} />, { fetch });

  return { ...view, user, sent, writes, dayRequests };
};

const listPane = () => screen.getByRole('region', { name: t.title });
const gridPane = () => screen.getByRole('region', { name: t.grid.title });
const formDialog = () => screen.getByRole('dialog');

/** 캘린더를 고른다 — 여는 것이 아니라 고르는 것이다. */
const selectCalendar = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: code }));
};

/** 고른 뒤 그 캘린더의 이름·코드를 고치러 간다. */
const openEditOf = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> => {
  await selectCalendar(user, code);
  await user.click(await screen.findByRole('button', { name: t.actions.editCalendar }));
  await screen.findByRole('dialog', { name: t.form.editTitle });
};

describe('W-05-09 작업 캘린더 — 목록', () => {
  it('캘린더를 조회해 목록에 보인다', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: 'CAL-A' })).toBeInTheDocument();
    expect(screen.getByText('CAL-A 캘린더')).toBeInTheDocument();
  });

  it('사용 여부를 말로 보인다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(screen.getByText(t.values.active)).toBeInTheDocument();
    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('처음에는 사용 중인 것만 조회한다', async () => {
    const { sent } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('false');
  });

  it('미사용 포함을 켜면 조건이 함께 나간다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(
      within(listPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
    });
  });

  it('검색어를 서버 조건으로 싣는다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '2026{Enter}');

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('2026');
    });
  });

  /*
   * ⛔ **모아서 내는 조건이 즉시 적용된 조건을 되돌리면 안 된다**(client#314 에서 실제로 났던 결함).
   */
  it('미사용 포함을 켠 뒤 검색어로 조회해도 유지된다', async () => {
    const { user, sent } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(
      within(listPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
    });

    await user.type(within(listPane()).getByLabelText(t.filters.searchLabel), '2026');
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(sent.at(-1)?.searchParams.get('q')).toBe('2026');
    });
    expect(sent.at(-1)?.searchParams.get('includeInactive')).toBe('true');
  });

  /* ⛔ **아직 적용하지 않은 입력도 초기화가 거둬야 한다**(client#316 계열). */
  it('적용하지 않은 입력도 초기화가 거둔다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '2026');
    expect(box).toHaveValue('2026');

    await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  it('칩으로 검색어를 거두면 검색칸도 함께 비워진다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    const box = within(listPane()).getByLabelText(t.filters.searchLabel);
    await user.type(box, '2026{Enter}');
    await user.click(await screen.findByRole('button', { name: t.filters.chipRemoveKeyword }));

    await waitFor(() => {
      expect(box).toHaveValue('');
    });
  });

  it('아무것도 없으면 등록을 권한다', async () => {
    renderScreen({ respondCalendars: () => jsonResponse(calendarsResponse([])) });

    expect(await screen.findByText(t.empty.noneTitle)).toBeInTheDocument();
  });

  /* 조건이 걸려 있으면 「없다」가 아니라 「조건에 맞는 것이 없다」다 — 할 일이 다르다. */
  it('조건이 걸려 있으면 조건을 줄이라고 말한다', async () => {
    const { user } = renderScreen({
      respondCalendars: (request) =>
        jsonResponse(
          calendarsResponse(
            new URL(request.url).searchParams.get('includeInactive') === 'true'
              ? []
              : calendarItems,
          ),
        ),
    });

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(
      within(listPane()).getByRole('checkbox', { name: messages.common.includeInactive }),
    );

    expect(await screen.findByText(t.empty.noMatchTitle)).toBeInTheDocument();
  });

  it('조회가 실패하면 다시 시도할 자리를 준다', async () => {
    renderScreen({
      respondCalendars: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /* ⭐ 「다시 시도」를 누르면 실제로 다시 나가야 한다 — 누를 자리만 있으면 안 된다(G-23). */
  it('「다시 시도」가 조회를 다시 낸다', async () => {
    const { user, sent } = renderScreen({
      respondCalendars: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await user.click(await screen.findByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(sent.length).toBeGreaterThan(1);
    });
  });

  it('권한이 없으면 다시 시도를 권하지 않는다', async () => {
    renderScreen({
      respondCalendars: () => jsonResponse({ message: '권한 없음' }, { status: 403 }),
    });

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('서버가 목록을 자르면 그 사실을 밝힌다', async () => {
    renderScreen({
      respondCalendars: () =>
        jsonResponse({ items: calendarItems, page: pageOf(calendarItems, 99) }),
    });

    expect(await screen.findByText(t.listTruncated(calendarItems.length, 99))).toBeInTheDocument();
  });
});

describe('W-05-09 작업 캘린더 — 등록·수정', () => {
  it('코드를 누르면 수정 창이 열린다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'CAL-A');

    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).toHaveValue('CAL-A');
  });

  it('캘린더 등록을 누르면 빈 창이 열린다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addCalendar }));
    await screen.findByRole('dialog', { name: t.form.createTitle });

    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).toHaveValue('');
  });

  /*
   * ⭐ **따르는 대상 수가 코드가 잠긴 이유이자 사용 중지 판단의 근거다.**
   * 잠금 사유 문구만으로는 「몇이 따르는가」를 알 수 없다.
   */
  it('따르는 대상 수를 보인다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(calendarDetail(calendarDefault, { applicationCount: 3 }), {
          headers: { ETag: '9' },
        }),
    });

    await openEditOf(user, 'CAL-A');

    expect(within(formDialog()).getByLabelText(t.fields.applicationCount)).toHaveTextContent(
      t.form.applicationCount(3),
    );
  });

  /* ⛔ 0곳과 「아직 모른다」를 같은 모양으로 그리지 않는다(G-9). */
  it('따르는 대상이 없으면 없다고 말한다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'CAL-A');

    expect(within(formDialog()).getByLabelText(t.fields.applicationCount)).toHaveTextContent(
      t.form.applicationNone,
    );
    expect(t.form.applicationNone).not.toBe(t.form.applicationUnknown);
  });

  it('등록 창에는 따르는 대상 칸을 그리지 않는다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addCalendar }));
    await screen.findByRole('dialog', { name: t.form.createTitle });

    expect(
      within(formDialog()).queryByLabelText(t.fields.applicationCount),
    ).not.toBeInTheDocument();
  });

  /* ⭐ 계약이 「참조가 0일 때만 코드를 보낼 수 있다」고 못박았다. */
  it('따르는 대상이 있으면 코드를 잠그고 사유를 보인다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(calendarDetail(calendarDefault, { editability: referencedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEditOf(user, 'CAL-A');

    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).toBeDisabled();
    expect(screen.getByText(messages.editability.referenced(3))).toBeInTheDocument();
  });

  it('등록은 멱등 키만 싣고 잠금 토큰은 싣지 않는다', async () => {
    const { user, writes } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addCalendar }));
    await screen.findByRole('dialog', { name: t.form.createTitle });
    await user.type(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ }), 'CAL-Z');
    await user.type(
      within(formDialog()).getByRole('textbox', { name: /캘린더 이름/ }),
      '새 캘린더',
    );
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(request.method).toBe('POST');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    expect(request.headers.get('If-Match')).toBeNull();
    expect(await request.json()).toEqual({ calendarCode: 'CAL-Z', calendarName: '새 캘린더' });
  });

  /* ⭐ 잠금 토큰은 상세 응답의 ETag 에서 온다 — 목록만으로는 저장을 시작할 수 없다. */
  it('수정은 상세가 준 잠금 토큰을 그대로 싣는다', async () => {
    const { user, writes } = renderScreen();

    await openEditOf(user, 'CAL-A');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(request.headers.get('If-Match')).toBe('9');
  });

  it('코드가 잠겨 있으면 본문에 코드를 싣지 않는다', async () => {
    const { user, writes } = renderScreen({
      respondDetail: () =>
        jsonResponse(calendarDetail(calendarDefault, { editability: referencedCode }), {
          headers: { ETag: '9' },
        }),
    });

    await openEditOf(user, 'CAL-A');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    expect(await onlyWrite(writes).json()).not.toHaveProperty('calendarCode');
  });

  it('검증에 걸리면 저장이 나가지 않는다', async () => {
    const { user, writes } = renderScreen();

    await openEditOf(user, 'CAL-A');
    await user.clear(within(formDialog()).getByRole('textbox', { name: /캘린더 이름/ }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(t.validation.required)).toBeInTheDocument();
    expect(writes.length).toBe(0);
  });

  it('서버가 준 필드 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'calendarCode',
                code: 'DUP',
                message: '이미 쓰는 코드입니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'CAL-A');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText('이미 쓰는 코드입니다.')).toBeInTheDocument();
    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).toBeInvalid();
  });

  /* ⛔ 화면이 모르는 필드명을 버리면 어디에도 표시되지 않는 오류가 생긴다. */
  it('화면이 모르는 필드의 오류는 배너로 올린다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'mystery', code: 'X', message: '알 수 없는 칸입니다.' },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'CAL-A');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText('알 수 없는 칸입니다.')).toBeInTheDocument();
    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).not.toBeInvalid();
  });

  it('서버가 준 오류도 그 칸을 고치면 사라진다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'calendarCode',
                code: 'DUP',
                message: '이미 쓰는 코드입니다.',
              },
            ],
          },
          { status: 400 },
        ),
    });

    await openEditOf(user, 'CAL-A');
    await user.click(screen.getByRole('button', { name: messages.common.save }));
    await screen.findByText('이미 쓰는 코드입니다.');

    await user.type(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ }), '-2');

    expect(screen.queryByText('이미 쓰는 코드입니다.')).not.toBeInTheDocument();
  });

  it('저장에 성공하면 창이 닫히고 목록을 다시 읽는다', async () => {
    const { user, sent } = renderScreen();

    await openEditOf(user, 'CAL-A');
    const before = sent.length;
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(sent.length).toBeGreaterThan(before);
    });
  });

  it('다른 캘린더를 열면 그 캘린더의 상세를 읽는다', async () => {
    const { user } = renderScreen({
      respondCalendars: () =>
        jsonResponse(calendarsResponse([calendarDefault, makeCalendar(5003, 'CAL-C')])),
    });

    await openEditOf(user, 'CAL-C');

    expect(within(formDialog()).getByRole('textbox', { name: /캘린더 코드/ })).toHaveValue('CAL-C');
  });
});

/** 확인 창. 폼 창이 뒤에 남아 있어 **가장 나중에 열린 창**을 고른다. */
const confirmDialog = () => screen.getAllByRole('dialog').at(-1) as HTMLElement;

const openRetire = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> => {
  await openEditOf(user, code);
  await user.click(within(formDialog()).getByRole('button', { name: t.retire.confirm }));
  await screen.findByRole('dialog', { name: t.retire.title });
};

describe('W-05-09 작업 캘린더 — 사용 중지', () => {
  /* 되돌릴 수 없는 조작은 폼 «본문»에 둔다 — 바닥에 두면 저장·취소가 밀려난다. */
  it('수정 창에 사용 중지가 선다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'CAL-A');

    expect(within(formDialog()).getByRole('button', { name: t.retire.confirm })).toBeEnabled();
  });

  it('등록 창에는 사용 중지가 서지 않는다', async () => {
    const { user } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });
    await user.click(within(listPane()).getByRole('button', { name: t.actions.addCalendar }));
    await screen.findByRole('dialog', { name: t.form.createTitle });

    expect(
      within(formDialog()).queryByRole('button', { name: t.retire.confirm }),
    ).not.toBeInTheDocument();
  });

  /* 감추지 않고 잠그고 사유를 붙인다(G-2). */
  it('이미 중지된 캘린더는 잠그고 사유를 보인다', async () => {
    const { user } = renderScreen();

    await openEditOf(user, 'CAL-B');

    expect(within(formDialog()).getByRole('button', { name: t.retire.confirm })).toBeDisabled();
    expect(screen.getByText(t.retire.alreadyInactive)).toBeInTheDocument();
  });

  /*
   * ⭐ **계약이 시킨 것이다** — 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」(B-4).
   * 중지가 곧 그 대상들을 상위 층으로 떨어뜨리는 일이라 건수가 판단의 근거다.
   */
  it('확인 창이 따르는 대상 수와 그 파급을 함께 말한다', async () => {
    const { user } = renderScreen({
      respondDetail: () =>
        jsonResponse(calendarDetail(calendarDefault, { applicationCount: 3 }), {
          headers: { ETag: '9' },
        }),
    });

    await openRetire(user, 'CAL-A');

    expect(within(confirmDialog()).getByText(t.retire.applicationCount(3))).toBeInTheDocument();
  });

  it('따르는 대상이 없으면 없다고 말한다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'CAL-A');

    expect(within(confirmDialog()).getByText(t.retire.applicationNone)).toBeInTheDocument();
  });

  /* ⚠ 계약에 다시 켜는 경로가 없다 — 그 사실을 반드시 말한다. */
  it('되돌릴 수 있는지를 말한다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'CAL-A');

    expect(within(confirmDialog()).getByText(t.retire.notReversibleHere)).toBeInTheDocument();
    expect(within(confirmDialog()).getByText(t.retire.impact)).toBeInTheDocument();
  });

  it('잠금 토큰과 멱등 키를 싣고 나간다', async () => {
    const { user, writes } = renderScreen();

    await openRetire(user, 'CAL-A');
    await user.click(within(confirmDialog()).getByRole('button', { name: t.retire.confirm }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(new URL(request.url).pathname).toBe('/mdm/work-calendars/5001:deactivate');
    expect(request.headers.get('If-Match')).toBe('9');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /*
   * ⛔ **중지 뒤에는 수정 창도 닫는다.** 중지된 캘린더는 기본 조회에서 빠지므로, 열린 폼을
   * 남기면 사용자가 목록에 없는 것을 계속 고치게 된다.
   */
  it('중지 뒤에는 수정 창도 닫는다', async () => {
    const { user } = renderScreen();

    await openRetire(user, 'CAL-A');
    await user.click(within(confirmDialog()).getByRole('button', { name: t.retire.confirm }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('중지 뒤에 목록을 다시 읽는다', async () => {
    const { user, sent } = renderScreen();

    await openRetire(user, 'CAL-A');
    const before = sent.length;
    await user.click(within(confirmDialog()).getByRole('button', { name: t.retire.confirm }));

    await waitFor(() => {
      expect(sent.length).toBeGreaterThan(before);
    });
  });

  /* 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  it('실패하면 확인 창을 닫지 않고 이유를 보인다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'LOCKED', message: '지금은 처리할 수 없습니다.' }] },
          { status: 400 },
        ),
    });

    await openRetire(user, 'CAL-A');
    await user.click(within(confirmDialog()).getByRole('button', { name: t.retire.confirm }));

    expect(await screen.findByText('지금은 처리할 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.retire.title })).toBeInTheDocument();
  });
});

/** 일자 설정 응답 하나. **설정이 있는 날만 온다** — 나머지는 「미설정」이다. */
const dayItem = (calendarDate: string, overrides: Record<string, unknown> = {}) => ({
  calendarDate,
  dayTypeCode: 'WORKING',
  ...overrides,
});

const cellOf = (date: string) => screen.getByText(String(Number(date.slice(8, 10)))).closest('td');

describe('W-05-09 작업 캘린더 — 달력 그리드', () => {
  /* ⛔ 캘린더를 고르기 전에는 그릴 것이 없다 — 빈 달력을 세우지 않는다. */
  it('캘린더를 고르기 전에는 고르라고 말한다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(within(gridPane()).getByText(t.grid.pickCalendar)).toBeInTheDocument();
    expect(within(gridPane()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('고르기 전에는 일자를 조회하지 않는다', async () => {
    const { dayRequests } = renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(dayRequests).toHaveLength(0);
  });

  /* ⛔ 계약이 기간을 반드시 요구한다 — 한 해가 365행이라 전량을 내리지 않는다. */
  it('고르면 보이는 달의 기간을 지정해 조회한다', async () => {
    const { user, dayRequests } = renderScreen();

    await selectCalendar(user, 'CAL-A');

    await waitFor(() => {
      expect(dayRequests).toHaveLength(1);
    });

    const url = dayRequests[0];

    expect(url?.pathname).toBe('/mdm/work-calendars/5001/days');
    expect(url?.searchParams.get('from')).toBe('2026-08-01');
    expect(url?.searchParams.get('to')).toBe('2026-08-31');
  });

  it('고른 캘린더의 이름을 밝힌다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');

    expect(within(gridPane()).getByText('CAL-A 캘린더')).toBeInTheDocument();
  });

  /* ⭐ 색만으로 표시하면 색을 보지 못하는 사용자가 어느 캘린더를 보고 있는지 알 수 없다. */
  it('고른 줄을 `aria-current` 로 밝힌다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');

    expect(screen.getByRole('button', { name: 'CAL-A' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'CAL-B' })).not.toHaveAttribute('aria-current');
  });

  it('한 달의 모든 날이 칸으로 선다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(within(gridPane()).getByRole('table')).toBeInTheDocument();
    });

    expect(within(gridPane()).getByText('1')).toBeInTheDocument();
    expect(within(gridPane()).getByText('31')).toBeInTheDocument();
  });

  it('요일 머리글 일곱이 선다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(within(gridPane()).getByRole('table')).toBeInTheDocument();
    });

    expect(within(gridPane()).getAllByRole('columnheader')).toHaveLength(7);
  });

  /*
   * ⭐ **이 슬라이스의 본론** — 설정이 없는 날을 「가동」으로 그리면 실제로 쉬는 날이
   * 일하는 날로 보인다(G-9).
   */
  it('설정이 없는 날은 「미설정」으로 그린다', async () => {
    const { user } = renderScreen({
      respondDays: () =>
        jsonResponse({ items: [dayItem('2026-08-03', { dayTypeCode: 'HOLIDAY' })] }),
    });

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(within(gridPane()).getByRole('table')).toBeInTheDocument();
    });

    expect(
      within(cellOf('2026-08-03') as HTMLElement).getByText(t.grid.status.holiday),
    ).toBeInTheDocument();
    expect(
      within(cellOf('2026-08-04') as HTMLElement).getByText(t.grid.status.unset),
    ).toBeInTheDocument();
  });

  it('세 상태를 각각 그린다', async () => {
    const { user } = renderScreen({
      respondDays: () =>
        jsonResponse({
          items: [
            dayItem('2026-08-03'),
            dayItem('2026-08-04', { dayTypeCode: 'HOLIDAY' }),
            dayItem('2026-08-05', {
              dayTypeCode: 'PARTIAL',
              startTime: '08:00',
              endTime: '12:00',
            }),
          ],
        }),
    });

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(within(gridPane()).getByRole('table')).toBeInTheDocument();
    });

    expect(
      within(cellOf('2026-08-03') as HTMLElement).getByText(t.grid.status.working),
    ).toBeInTheDocument();
    expect(
      within(cellOf('2026-08-04') as HTMLElement).getByText(t.grid.status.holiday),
    ).toBeInTheDocument();
    expect(
      within(cellOf('2026-08-05') as HTMLElement).getByText(t.grid.status.partial),
    ).toBeInTheDocument();
  });

  /* 부분 가동의 시각은 상태만으로 알 수 없는 사실이라 함께 낸다. */
  it('부분 가동은 시각을 함께 보인다', async () => {
    const { user } = renderScreen({
      respondDays: () =>
        jsonResponse({
          items: [
            dayItem('2026-08-05', {
              dayTypeCode: 'PARTIAL',
              startTime: '08:00',
              endTime: '12:00',
            }),
          ],
        }),
    });

    await selectCalendar(user, 'CAL-A');

    expect(await within(gridPane()).findByText('08:00~12:00')).toBeInTheDocument();
  });

  it('다음 달로 옮기면 그 달의 기간으로 다시 조회한다', async () => {
    const { user, dayRequests } = renderScreen();

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(dayRequests).toHaveLength(1);
    });

    await user.click(within(gridPane()).getByRole('button', { name: t.grid.nextMonth }));

    await waitFor(() => {
      expect(dayRequests.at(-1)?.searchParams.get('from')).toBe('2026-09-01');
    });
    expect(dayRequests.at(-1)?.searchParams.get('to')).toBe('2026-09-30');
  });

  it('이전 달로도 옮긴다', async () => {
    const { user, dayRequests } = renderScreen();

    await selectCalendar(user, 'CAL-A');
    await waitFor(() => {
      expect(dayRequests).toHaveLength(1);
    });

    await user.click(within(gridPane()).getByRole('button', { name: t.grid.previousMonth }));

    await waitFor(() => {
      expect(dayRequests.at(-1)?.searchParams.get('from')).toBe('2026-07-01');
    });
  });

  it('지금 보고 있는 달을 밝힌다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');

    expect(within(gridPane()).getByText(t.grid.monthLabel(2026, 8))).toBeInTheDocument();

    await user.click(within(gridPane()).getByRole('button', { name: t.grid.nextMonth }));

    expect(within(gridPane()).getByText(t.grid.monthLabel(2026, 9))).toBeInTheDocument();
  });

  it('일자 조회가 실패하면 다시 시도할 자리를 준다', async () => {
    const { user } = renderScreen({
      respondDays: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
    });

    await selectCalendar(user, 'CAL-A');

    expect(
      await within(gridPane()).findByRole('button', { name: messages.common.retry }),
    ).toBeInTheDocument();
  });

  /* 고른 캘린더의 이름·코드를 고치러 가는 자리는 목록이 아니라 여기다. */
  it('고른 캘린더를 그 자리에서 고치러 간다', async () => {
    const { user } = renderScreen();

    await selectCalendar(user, 'CAL-A');
    await user.click(within(gridPane()).getByRole('button', { name: t.actions.editCalendar }));

    expect(await screen.findByRole('dialog', { name: t.form.editTitle })).toBeInTheDocument();
  });

  it('고르기 전에는 고칠 자리도 없다', async () => {
    renderScreen();

    await screen.findByRole('button', { name: 'CAL-A' });

    expect(
      within(gridPane()).queryByRole('button', { name: t.actions.editCalendar }),
    ).not.toBeInTheDocument();
  });
});

const openDay = async (
  user: ReturnType<typeof userEvent.setup>,
  date: string,
  status: string,
): Promise<void> => {
  await selectCalendar(user, 'CAL-A');
  await waitFor(() => {
    expect(within(gridPane()).getByRole('table')).toBeInTheDocument();
  });
  await user.click(screen.getByRole('button', { name: t.grid.pickDay(date, status) }));
  await screen.findByRole('dialog', { name: t.dayForm.title(date) });
};

describe('W-05-09 작업 캘린더 — 하루 편집', () => {
  /* ⭐ 칸 전체가 손잡이다 — 날짜 숫자만 누를 수 있게 두면 표적이 작고 고칠 수 있다는 것도 안 보인다. */
  it('칸을 누르면 그 날의 창이 열린다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);

    expect(screen.getByRole('dialog', { name: t.dayForm.title('2026-08-04') })).toBeInTheDocument();
  });

  /* 눌러 보지 않고도 무엇을 여는지 알아야 한다 — 접근 이름에 날짜와 지금 상태를 담는다. */
  it('칸의 접근 이름에 날짜와 지금 상태가 있다', async () => {
    const { user } = renderScreen({
      respondDays: () =>
        jsonResponse({ items: [dayItem('2026-08-04', { dayTypeCode: 'HOLIDAY' })] }),
    });

    await selectCalendar(user, 'CAL-A');

    expect(
      await screen.findByRole('button', {
        name: t.grid.pickDay('2026-08-04', t.grid.status.holiday),
      }),
    ).toBeInTheDocument();
  });

  it('설정이 있는 날은 그 값으로 창이 찬다', async () => {
    const { user } = renderScreen({
      respondDays: () =>
        jsonResponse({
          items: [
            dayItem('2026-08-05', {
              dayTypeCode: 'PARTIAL',
              startTime: '08:00',
              endTime: '12:00',
              remarks: '반일',
            }),
          ],
        }),
    });

    await openDay(user, '2026-08-05', t.grid.status.partial);

    expect(screen.getByRole('radio', { name: t.grid.status.partial })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /시작 시각/ })).toHaveValue('08:00');
    expect(screen.getByRole('textbox', { name: /비고/ })).toHaveValue('반일');
  });

  /* 설정이 없는 날은 「미설정」이라 구분도 고르지 않은 상태다 — 「가동」으로 채우지 않는다. */
  it('설정이 없는 날은 구분이 고르지 않은 채로 열린다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);

    for (const label of [t.grid.status.working, t.grid.status.holiday, t.grid.status.partial]) {
      expect(screen.getByRole('radio', { name: label })).not.toBeChecked();
    }
  });

  /* 감추지 않고 잠그고 사유를 붙인다(G-2). */
  it('부분 가동이 아니면 시각 두 칸을 잠그고 사유를 밝힌다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.holiday }));

    expect(screen.getByRole('textbox', { name: /시작 시각/ })).toBeDisabled();
    expect(screen.getAllByText(t.dayForm.timeNeedsPartial).length).toBeGreaterThan(0);
  });

  it('부분 가동을 고르면 시각 두 칸이 열린다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));

    expect(screen.getByRole('textbox', { name: /시작 시각/ })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: /종료 시각/ })).toBeEnabled();
  });

  /* ⭐ 적힌 값을 지우지 않는다 — 다시 부분 가동으로 바꾸면 방금 적은 것이 그대로 있어야 한다. */
  it('구분을 바꿔도 적어 둔 시각을 지우지 않는다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));
    await user.type(screen.getByRole('textbox', { name: /시작 시각/ }), '08:00');
    await user.click(screen.getByRole('radio', { name: t.grid.status.holiday }));
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));

    expect(screen.getByRole('textbox', { name: /시작 시각/ })).toHaveValue('08:00');
  });

  /* ⭐ 「보낸 날짜만 덮어쓴다」 — 하루를 고칠 때는 그 하루만 담는다. */
  it('그 하루만 담아 보낸다', async () => {
    const { user, writes } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.holiday }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(writes.length).toBe(1);
    });

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(new URL(request.url).pathname).toBe('/mdm/work-calendars/5001/days');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    /* ⛔ 계약이 낙관적 잠금을 요구하지 않는다 — 보낸 날짜만 덮어쓰기 때문이다. */
    expect(request.headers.get('If-Match')).toBeNull();
    expect(await request.json()).toEqual({
      days: [
        {
          calendarDate: '2026-08-04',
          dayTypeCode: 'HOLIDAY',
          startTime: null,
          endTime: null,
          reasonCode: null,
          remarks: null,
        },
      ],
    });
  });

  it('검증에 걸리면 저장이 나가지 않는다', async () => {
    const { user, writes } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findAllByText(t.dayValidation.timesRequired)).not.toHaveLength(0);
    expect(writes.length).toBe(0);
  });

  it('종료가 시작보다 빠르면 막는다', async () => {
    const { user, writes } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));
    await user.type(screen.getByRole('textbox', { name: /시작 시각/ }), '12:00');
    await user.type(screen.getByRole('textbox', { name: /종료 시각/ }), '08:00');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(t.dayValidation.endAfterStart)).toBeInTheDocument();
    expect(writes.length).toBe(0);
  });

  it('저장하면 창이 닫히고 그 달을 다시 읽는다', async () => {
    const { user, dayRequests } = renderScreen({
      respondWrite: () => jsonResponse({ appliedCount: 1 }),
    });

    await openDay(user, '2026-08-04', t.grid.status.unset);
    const before = dayRequests.length;
    await user.click(screen.getByRole('radio', { name: t.grid.status.working }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(dayRequests.length).toBeGreaterThan(before);
    });
  });

  it('서버가 준 필드 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'startTime', code: 'BAD', message: '시각이 잘못됐습니다.' },
            ],
          },
          { status: 400 },
        ),
    });

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.partial }));
    await user.type(screen.getByRole('textbox', { name: /시작 시각/ }), '08:00');
    await user.type(screen.getByRole('textbox', { name: /종료 시각/ }), '12:00');
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText('시각이 잘못됐습니다.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /시작 시각/ })).toBeInvalid();
  });

  /*
   * ⭐ **서버가 준 오류도 고치는 순간 낡은 말이 된다.** 로컬 검증만 거두면 서버 오류가 칸에
   * 눌어붙어, 사용자가 이미 고친 값을 두고 옛 사유가 계속 서 있게 된다.
   */
  it('서버가 준 오류도 그 칸을 고치면 사라진다', async () => {
    const { user } = renderScreen({
      respondWrite: () =>
        jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'remarks', code: 'BAD', message: '비고가 너무 깁니다.' },
            ],
          },
          { status: 400 },
        ),
    });

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.holiday }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));
    await screen.findByText('비고가 너무 깁니다.');

    await user.type(screen.getByRole('textbox', { name: /비고/ }), '짧게');

    expect(screen.queryByText('비고가 너무 깁니다.')).not.toBeInTheDocument();
  });

  it('실패하면 창을 닫지 않는다', async () => {
    const { user } = renderScreen({
      respondWrite: () => jsonResponse({ message: '권한 없음' }, { status: 403 }),
    });

    await openDay(user, '2026-08-04', t.grid.status.unset);
    await user.click(screen.getByRole('radio', { name: t.grid.status.holiday }));
    await user.click(screen.getByRole('button', { name: messages.common.save }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.dayForm.title('2026-08-04') })).toBeInTheDocument();
  });

  /* ⚠ 사유는 계약이 선택으로 두었다 — 비어도 저장된다는 사실을 화면이 말한다. */
  it('사유가 비어도 저장된다는 것을 밝힌다', async () => {
    const { user } = renderScreen();

    await openDay(user, '2026-08-04', t.grid.status.unset);

    expect(screen.getByText(t.dayForm.reasonOptional)).toBeInTheDocument();
  });
});
