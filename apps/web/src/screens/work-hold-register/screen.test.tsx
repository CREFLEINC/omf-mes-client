import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('사유 7값을 스펙의 순서대로 세운다', async () => {
    renderScreen([sessionsRoute([workSession()]), eventsRoute([])]);

    await screen.findByRole('region', { name: t.form.sectionLabel });

    const labels = screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'));

    expect(labels).toEqual([
      'EMERGENCY_ORDER',
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
});
