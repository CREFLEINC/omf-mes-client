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

const isPath = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

interface RenderOptions {
  respondCalendars?: (request: Request) => Response;
  respondDetail?: (request: Request) => Response;
  respondWrite?: (request: Request) => Response;
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
      match: (request) => new URL(request.url).pathname.startsWith('/mdm/work-calendars/'),
      respond: (request) => (options.respondDetail ?? defaultDetail)(request),
    },
  ]);

  const user = userEvent.setup();
  const view = renderWithProviders(<WorkCalendarScreen />, { fetch });

  return { ...view, user, sent, writes };
};

const listPane = () => screen.getByRole('region', { name: t.title });
const formDialog = () => screen.getByRole('dialog');

const openEditOf = async (
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: code }));
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
