import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { sessionEvent, WORK_ORDER_ID, WORK_SESSION_ID, WORKER_NO, workSession } from './fixtures';
import { WorkHoldRegisterScreen } from './screen';

const t = messages.workHoldRegister;

const SESSIONS_PATH = '/production/work-sessions';
const EVENTS_PATH = `${SESSIONS_PATH}/${String(WORK_SESSION_ID)}/events`;

const ROUTE = `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}&workerNo=${WORKER_NO}`;

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const sessionsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, SESSIONS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const eventsRoute = (items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, EVENTS_PATH),
  respond: () => jsonResponse(items),
});

const failingRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '조회 실패' }, { status: 500 }),
});

const renderScreen = (routes: StubRoute[], route = ROUTE) =>
  renderWithProviders(
    <PopIdentityProvider value={UNKNOWN_POP_IDENTITY}>
      <WorkHoldRegisterScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes), route },
  );

describe('P-02-10 작업 중단 등록', () => {
  it('열린 세션의 번호·시작 시각을 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    const panel = await screen.findByRole('region', { name: t.session.sectionLabel });

    expect(within(panel).getByText(t.session.sessionNo(2))).toBeInTheDocument();
    expect(within(panel).getByText('09-02 08:00')).toBeInTheDocument();
  });

  /**
   * ⛔ **세션이 없으면 이 화면은 성립하지 않는다**(스펙 §5-2 — 세션 참조가 NOT NULL).
   * 빈 카드로 두면 작업자가 사유만 고르고 눌러 본 뒤에야 막힌 것을 안다.
   */
  it('열린 세션이 없으면 차단 안내를 세우고 사유를 고를 수 없게 한다', async () => {
    renderScreen([sessionsRoute([])]);

    expect(await screen.findByText(t.session.none)).toBeInTheDocument();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  /**
   * 「열린 것만」으로 물었지만 닫힌 세션이 섞여 오면 **없는 세션에 중단을 걸려고 한다** —
   * 끝 시각으로 스스로 확인할 수 있으므로 믿고 넘기지 않는다.
   */
  it('닫힌 세션이 섞여 오면 걸러 낸다', async () => {
    renderScreen([
      sessionsRoute([workSession({ endedAt: '2026-09-02T12:00:00+09:00' })]),
      eventsRoute([]),
    ]);

    expect(await screen.findByText(t.session.none)).toBeInTheDocument();
  });

  it('작업지시 없이 들어오면 조회하지 않고 되돌아갈 곳을 말한다', async () => {
    /* 스텁이 비어 있다 — 조회가 나가면 하네스가 던져서 이 시험이 실패한다. */
    renderScreen([], '/pop/work-hold');

    expect(await screen.findByText(t.entry.missingWorkOrder)).toBeInTheDocument();
  });

  it('이벤트 이력을 시각·구분·사유로 세운다', async () => {
    renderScreen([
      sessionsRoute([workSession()]),
      eventsRoute([
        sessionEvent({ workSessionEventId: 1, eventTypeCode: 'START' }),
        sessionEvent({
          workSessionEventId: 2,
          eventTypeCode: 'STOP',
          occurredAt: '2026-09-02T10:30:00+09:00',
          reasonCode: 'MOLD_CHANGE',
          reasonName: '금형 교체',
        }),
        sessionEvent({
          workSessionEventId: 3,
          eventTypeCode: 'RESUME',
          occurredAt: '2026-09-02T10:52:00+09:00',
        }),
      ]),
    ]);

    const history = await screen.findByRole('region', { name: t.history.sectionLabel });
    const rows = (await within(history).findAllByRole('row')).slice(1);

    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('10:30')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(t.eventTypes.STOP)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('금형 교체')).toBeInTheDocument();
    /* 재개는 사유가 없다 — 「없음」이라 적지 않는다. */
    expect(within(rows[2]!).getByText(t.eventTypes.RESUME)).toBeInTheDocument();
    /* 이력은 기록 전용이다 — 정정할 수 없다는 사실이 이력 옆에 상시 서 있어야 한다. */
    expect(within(history).getByText(t.history.recordOnlyNotice)).toBeInTheDocument();
  });

  it('사유 목록이 임시라는 사실을 상시 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    expect(await screen.findByText(t.form.reasonProvisional)).toBeInTheDocument();
  });

  /* ⛔ 코드 문자열은 코드 사전(`CD-WORK-SESSION-EVENT-REASON`)이 정본이다 — 지어내지 않는다. */
  it('사유 7값을 스펙의 순서대로 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    await screen.findByRole('region', { name: t.form.sectionLabel });

    const labels = screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'));

    expect(labels).toEqual([
      'URGENT_ORDER_INTERRUPT',
      'EQUIPMENT_FAILURE',
      'TOOL_FAILURE',
      'MATERIAL_SHORTAGE',
      'MOLD_CHANGE',
      'QUALITY_ISSUE',
      'OTHER',
    ]);
  });

  /** 실패를 빈 상태로 보이지 않는다 — 「없습니다」로 내면 이미 연 세션을 한 번 더 연다. */
  it('세션 조회가 실패하면 실패로 말한다', async () => {
    renderScreen([failingRoute(SESSIONS_PATH)]);

    expect(await screen.findByText(t.session.loadFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.session.none)).not.toBeInTheDocument();
    /* 세션을 모르면 이력도 모른다 — 「기록된 이벤트가 없습니다」로 단정하지 않는다. */
    expect(screen.queryByText(t.history.empty)).not.toBeInTheDocument();
  });

  /** ⚠ 이력을 못 읽은 것이 중단을 막지 않는다 — 이력은 설명하는 자리다. */
  it('이력 조회가 실패해도 세션 구획과 사유 선택은 선다', async () => {
    renderScreen([sessionsRoute([workSession()]), failingRoute(EVENTS_PATH)]);

    expect(await screen.findByText(t.history.loadFailed)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('radio')[0]).toBeEnabled();
    });
  });

  it('사번을 모르면 헤더가 그 사실을 말한다 — 없는 값을 지어내지 않는다', async () => {
    renderScreen(
      [sessionsRoute([workSession()]), eventsRoute([])],
      `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}`,
    );

    expect(await screen.findByText(t.entry.workerUnknown)).toBeInTheDocument();
  });

  /**
   * 전송 — **큐에 담는 것이 곧 성공이다**(공유계약 C-1 #2). 통신을 기다리지 않는다.
   */
  describe('중단·재개 전송', () => {
    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage.clear();
    });

    const eventPost = (sent: Request[]): StubRoute => ({
      match: (request) =>
        request.method === 'POST' && new URL(request.url).pathname === EVENTS_PATH,
      respond: (request) => {
        sent.push(request);

        return jsonResponse({}, { status: 201 });
      },
    });

    it('사유를 고르고 누르면 STOP 이 그 세션 경로로 나간다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), eventPost(sent)]);

      await user.click(await screen.findByRole('radio', { name: t.reasons.MOLD_CHANGE }));
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(1);
      });
      const body: unknown = await sent[0]!.json();

      expect(body).toMatchObject({ eventTypeCode: 'STOP', reasonCode: 'MOLD_CHANGE' });
      /* 발생 시각은 단말이 보낸다(계약) — 서버 수신 시각과 다른 값이다. */
      expect(body).toHaveProperty('occurredAt', expect.any(String));
    });

    /* ⛔ ⓐ 차단(스펙 §6) — 사유 없이 보내면 정정할 수 없는 기록이 사유 없이 남는다. */
    it('사유를 고르지 않으면 보내지 않고 말한다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([sessionsRoute([workSession()]), eventsRoute([]), eventPost(sent)]);

      await user.click(await screen.findByRole('button', { name: t.form.stopAction }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t.form.reasonRequired);
      expect(sent).toHaveLength(0);
    });

    /* 스펙 §6 — 「이미 중단 상태면 재개만 활성」. 돌고 있는 설비에 중단을 두 번 걸지 않는다. */
    it('중단된 세션에서는 재개만 누를 수 있다', async () => {
      renderScreen([sessionsRoute([workSession({ statusCode: 'STOPPED' })]), eventsRoute([])]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeEnabled();
      });
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
    });

    /* ⛔ 재개는 사유를 비운다(§5-4) — 초안에 남은 사유를 실어 보내지 않는다. */
    it('재개는 사유 없이 나간다', async () => {
      const user = userEvent.setup();
      const sent: Request[] = [];

      renderScreen([
        sessionsRoute([workSession({ statusCode: 'STOPPED' })]),
        eventsRoute([]),
        eventPost(sent),
      ]);

      await user.click(await screen.findByRole('button', { name: t.form.resumeAction }));

      await waitFor(() => {
        expect(sent).toHaveLength(1);
      });
      /* 본문은 한 번만 읽을 수 있다 — 두 번 부르면 두 번째가 던져 검사가 헛돈다. */
      const body: unknown = await sent[0]!.json();

      expect(body).toMatchObject({ eventTypeCode: 'RESUME' });
      expect(body).not.toHaveProperty('reasonCode');
    });

    /*
     * ⛔ **적은 것이 어디로 가는지 숨기지 않는다.** 비고를 담을 칸이 계약에 없어 이번에는
     * 나가지 않는다 — 말하지 않으면 작업자는 남았다고 믿는다.
     */
    /*
     * ⛔ **담긴 중단이 아직 안 나갔으면 한 번 더 누를 수 없다.** 서버에 닿기 전에는 세션이
     * 여전히 「진행」이라, 잠그지 않으면 같은 중단이 두 건 기록된다 — 정정 경로가 없다.
     */
    /*
     * ⛔ **같은 방향을 두 번 담을 수 없다.** 서버에 닿기 전에는 세션이 여전히 「진행」이라,
     * 막지 않으면 같은 중단이 두 건 기록된다 — 정정 경로가 없다.
     *
     * ⭐ **반대 방향은 열어 둔다.** 망이 끊기면 큐가 비지 않는데 둘 다 잠그면, 설비가 다시
     * 돌아도 재개를 등록할 방법이 사라진다(공유계약 C-1 #2).
     */
    it('중단을 담으면 중단은 잠기고 재개가 열린다', async () => {
      const user = userEvent.setup();

      renderScreen([
        sessionsRoute([workSession()]),
        eventsRoute([]),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === EVENTS_PATH,
          /* 서버가 아직 받지 못한 상태 — 큐에 남아 있다. */
          respond: () => jsonResponse({ message: '잠시 뒤 다시' }, { status: 503 }),
        },
      ]);

      await user.click(await screen.findByRole('radio', { name: t.reasons.MOLD_CHANGE }));
      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      });
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeEnabled();
    });

    /* 서버가 받으면 세션·이력을 다시 읽는다 — 옛 상태를 들고 있으면 버튼이 틀리게 열린다. */
    it('전송이 닿으면 세션을 다시 읽는다', async () => {
      const user = userEvent.setup();
      let sessionReads = 0;

      renderScreen([
        {
          match: (request) => isGet(request, SESSIONS_PATH),
          respond: () => {
            sessionReads += 1;

            return jsonResponse({
              items: [workSession()],
              page: { page: 1, size: 50, total: 1 },
            });
          },
        },
        eventsRoute([]),
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === EVENTS_PATH,
          respond: () => jsonResponse({}, { status: 201 }),
        },
      ]);

      await user.click(await screen.findByRole('radio', { name: t.reasons.MOLD_CHANGE }));
      const before = sessionReads;

      await user.click(screen.getByRole('button', { name: t.form.stopAction }));

      await waitFor(() => {
        expect(sessionReads).toBeGreaterThan(before);
      });
    });

    /* ⛔ 사번이 없으면 서버가 거부한다 — 누르고 나서가 아니라 누르기 전에 막는다. */
    it('사번을 모르면 두 버튼이 막히고 이유를 말한다', async () => {
      renderScreen(
        [sessionsRoute([workSession()]), eventsRoute([])],
        `/pop/work-hold?workOrderId=${String(WORK_ORDER_ID)}`,
      );

      expect(await screen.findByText(t.form.workerRequired)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    it('세션이 없으면 두 버튼 다 막힌다', async () => {
      renderScreen([sessionsRoute([]), eventsRoute([])]);

      expect(await screen.findByText(t.session.none)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    it('진행 중인 세션에서는 재개가 막힌다', async () => {
      renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: t.form.stopAction })).toBeEnabled();
      });
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    /*
     * ⛔ **「중단이 아니면 진행 중」이 아니다.** 끝난 세션·모르는 상태에서 중단이 열리면
     * 정정할 수 없는 기록이 엉뚱한 세션에 남는다.
     */
    it('끝났거나 모르는 상태의 세션에는 중단을 걸 수 없다', async () => {
      renderScreen([sessionsRoute([workSession({ statusCode: 'ENDED' })]), eventsRoute([])]);

      /*
       * ⛔ **세션이 «선 뒤에» 본다.** 조회 전에는 어차피 두 버튼이 막혀 있어, 기다리지 않고
       * 보면 「아직 안 왔다」를 「막혔다」로 읽고 검사가 헛돈다.
       */
      expect(await screen.findAllByText(t.session.sessionNo(2))).not.toHaveLength(0);

      expect(screen.getByRole('button', { name: t.form.stopAction })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.form.resumeAction })).toBeDisabled();
    });

    it('비고가 아직 저장되지 않는다는 사실을 상시 세운다', async () => {
      renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

      expect(await screen.findByText(t.form.remarksNotSaved)).toBeInTheDocument();
    });
  });
});
