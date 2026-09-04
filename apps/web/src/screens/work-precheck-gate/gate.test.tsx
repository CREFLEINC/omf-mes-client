import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setWorkerSession } from '../../patterns/worker-session';
import {
  DAILY_ASSIGNMENT,
  PASSED_INSPECTION,
  WORKER,
  WORK_ORDER,
  renderScreen,
  type StubOptions,
} from '../work-start/screen-harness';

/**
 * `P-02-02` 작업 전 점검 이력 확인·통제.
 *
 * ⚠ **게이트는 `P-02-01` 을 통해서만 열린다** — 그래서 감지기도 그 화면을 세우고 시작을
 * 눌러 들어간다. 게이트만 따로 렌더하면 「어떻게 진입하는가」가 시험에서 빠진다.
 */
const w = messages.workStart;
const t = messages.workPrecheckGate;

const selectName = (workOrderNo: string): string => `${w.list.select} ${workOrderNo}`;

beforeEach(() => {
  setWorkerSession(null);
});

afterEach(() => {
  setWorkerSession(null);
});

/** 사번 확인 → 작업지시 선택 → 시작. 게이트가 뜨는 자리까지 데려간다. */
const pressStart = async (options: StubOptions = {}) => {
  const rendered = renderScreen(options);
  const { user } = rendered;

  await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) });

  for (const digit of WORKER.workerNo) {
    await user.click(screen.getByRole('button', { name: digit }));
  }

  await user.click(screen.getByRole('button', { name: w.worker.confirm }));
  await user.click(
    await screen.findByRole('button', { name: selectName(WORK_ORDER.workOrderNo) }),
  );

  const start = () => screen.getByRole('button', { name: w.actions.start });

  await waitFor(() => {
    expect(start()).toBeEnabled();
  });
  await user.click(start());

  return rendered;
};

const decisions = (bodies: { url: string; body: unknown }[]) =>
  bodies
    .filter((sent) => sent.url === '/production/precheck-decisions')
    .map((sent) => sent.body as Record<string, unknown>);

const sessions = (bodies: { url: string; body: unknown }[]) =>
  bodies.filter((sent) => sent.url === '/production/work-sessions');

/** 긴급 작업지시 한 건 — 우회가 열리는 유일한 조건이다(§5-8). */
const EMERGENCY_ORDER = { ...WORK_ORDER, workOrderTypeCode: 'EMERGENCY' };

/** 주기 내 이력이 없는 상태 — 조회가 빈 목록을 준다. */
const NO_HISTORY: StubOptions = { inspections: [] };

describe('P-02-02 작업 전 점검 통제 — 통과', () => {
  /** ⭐ 게이트는 막을 때만 보인다(§9-3). */
  it('주기 내 합격 이력이 있으면 게이트가 뜨지 않고 그대로 시작한다', async () => {
    const { recorded } = await pressStart();

    await waitFor(() => {
      expect(sessions(recorded.bodies)).toHaveLength(1);
    });

    expect(screen.queryByText(t.verdict.blockedMissing)).not.toBeInTheDocument();
  });

  /** ⭐ 통과도 기록한다 — 안 보이는 것과 안 남기는 것은 다르다(§9-3). */
  it('통과도 판정으로 남기고 근거 점검을 함께 싣는다', async () => {
    const { recorded } = await pressStart();

    await waitFor(() => {
      expect(decisions(recorded.bodies)).toHaveLength(1);
    });

    const [decision] = decisions(recorded.bodies);
    expect(decision?.decisionCode).toBe('PASSED');
    expect(decision?.basisInspectionId).toBe(PASSED_INSPECTION.inspectionId);
  });

  /** ⛔ 기록이 남기 전에는 세션을 열지 않는다 — 판정 없는 세션을 만들지 않는다. */
  it('판정 기록이 실패하면 세션을 열지 않는다', async () => {
    const { recorded } = await pressStart({ decisionStatus: 500 });

    expect(await screen.findByText(t.blocked.recordFailed)).toBeInTheDocument();
    expect(sessions(recorded.bodies)).toHaveLength(0);
  });

  /**
   * ⛔ **통과인데 기록만 실패한 상태를 「경고」로 그리지 않는다.**
   *
   * 그렇게 그리면 [ 진행 ] 이 붙고, 누르면 **있지도 않았던 경고 판정**이 기록에 남는다 —
   * 통제를 뚫는 것은 아니지만 판정 근거가 사실과 달라진다.
   */
  it('통과 판정의 기록만 실패하면 경고로 바꿔 그리지 않는다', async () => {
    await pressStart({ decisionStatus: 500 });

    expect(await screen.findByText(t.verdict.recordRetry)).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.warned)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.proceed })).not.toBeInTheDocument();
  });

  /** ⭐ 다시 시도는 **같은 판정**을 다시 보낸다 — 판정을 바꾸지 않는다. */
  it('기록 다시 시도는 같은 판정으로 나간다', async () => {
    const { user, recorded } = await pressStart({ decisionStatus: 500 });

    await user.click(await screen.findByRole('button', { name: t.actions.retryRecord }));

    await waitFor(() => {
      expect(decisions(recorded.bodies).length).toBeGreaterThan(1);
    });

    for (const decision of decisions(recorded.bodies)) {
      expect(decision.decisionCode).toBe('PASSED');
    }
  });

  /** ⛔ 부여가 없으면 점검 대상이 아니다 — 「이력 없음」으로 막지 않는다. */
  it('부여된 점검 항목이 없으면 통과한다', async () => {
    const { recorded } = await pressStart({ assignments: [], resolvedFromLevelCode: 'NONE' });

    await waitFor(() => {
      expect(sessions(recorded.bodies)).toHaveLength(1);
    });
  });
});

describe('P-02-02 작업 전 점검 통제 — 차단', () => {
  it('이력이 없고 통제 수준이 차단이면 막고 그 사실을 기록한다', async () => {
    const { recorded } = await pressStart(NO_HISTORY);

    expect(await screen.findByText(t.verdict.blockedMissing)).toBeInTheDocument();

    await waitFor(() => {
      expect(decisions(recorded.bodies)).toHaveLength(1);
    });

    expect(decisions(recorded.bodies)[0]?.decisionCode).toBe('BLOCKED');
    expect(sessions(recorded.bodies)).toHaveLength(0);
  });

  /** ⛔ 코드 문자열을 화면에 내지 않는다(스펙 §4 · 공유계약 G-32). */
  it('점검 유형을 코드가 아니라 코드 사전의 이름으로 보인다', async () => {
    await pressStart(NO_HISTORY);

    expect(await screen.findByText('일상(Daily)')).toBeInTheDocument();
    expect(screen.queryByText('DAILY')).not.toBeInTheDocument();
  });

  /** ⭐ 무엇이 걸렸는지 말한다 — 「점검 기록이 없다」로만 적으면 할 일을 알 수 없다. */
  it('어느 점검이 없어서 막혔는지 문구에 적는다', async () => {
    await pressStart(NO_HISTORY);

    expect(
      await screen.findByText(t.verdict.blockedMissingDetail('일상(Daily)')),
    ).toBeInTheDocument();
  });

  /** ⭐ 그 수준이 어느 범위로 정해졌는지 함께 보인다(스펙 §4). */
  it('통제 수준 옆에 적용 범위를 함께 보인다', async () => {
    await pressStart(NO_HISTORY);

    expect(
      await screen.findByText(`${t.verdict.levelBlock}${t.verdict.scopeSuffix('공정')}`),
    ).toBeInTheDocument();
  });

  /** ⚠ 「이력 없음」을 「점검 안 함」으로 단정하지 않는다(§5-4). */
  it('이력이 없을 때 미전송 가능성을 함께 말한다', async () => {
    await pressStart(NO_HISTORY);

    expect(await screen.findByText(t.history.unsentWarning)).toBeInTheDocument();
  });

  /** ⛔ 「미적용」은 「NG 인데 돌려도 된다」가 아니다(§5-7). */
  it('점검이 불합격이면 통제 수준이 미적용이어도 막는다', async () => {
    const { recorded } = await pressStart({
      controlLevel: 'OFF',
      inspections: [{ ...PASSED_INSPECTION, overallResultCode: 'FAIL' }],
    });

    expect(await screen.findByText(t.verdict.blockedFailed)).toBeInTheDocument();
    expect(sessions(recorded.bodies)).toHaveLength(0);
  });

  /** ⛔ 불합격은 긴급 작업지시여도 우회로 풀리지 않는다. */
  it('불합격이면 긴급 작업지시여도 우회 버튼이 없다', async () => {
    await pressStart({
      workOrders: [EMERGENCY_ORDER],
      inspections: [{ ...PASSED_INSPECTION, overallResultCode: 'FAIL' }],
    });

    expect(await screen.findByText(t.verdict.blockedFailed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.override })).not.toBeInTheDocument();
    expect(screen.getByText(t.guide.failedNoOverride)).toBeInTheDocument();
  });

  /** ⚠ 긴급이 아니면 우회가 열리지 않고 그 사유를 말한다. */
  it('긴급 작업지시가 아니면 우회 버튼이 없다', async () => {
    await pressStart(NO_HISTORY);

    expect(await screen.findByText(t.verdict.blockedMissing)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.override })).not.toBeInTheDocument();
    expect(screen.getByText(t.guide.emergencyOnly)).toBeInTheDocument();
  });
});

describe('P-02-02 작업 전 점검 통제 — 경고·우회', () => {
  /** ⭐ 적용 정책이 없으면 경고로 다룬다 — ⛔ 무통제로 열지 않는다(§6). */
  it('적용 정책이 없으면 경고로 다루고 그 사실을 밝힌다', async () => {
    await pressStart({ ...NO_HISTORY, policyUnresolved: true });

    expect(await screen.findByText(t.verdict.warned)).toBeInTheDocument();
    expect(screen.getByText(t.verdict.levelUnresolved)).toBeInTheDocument();
  });

  it('경고 수준에서 진행하면 그 사실을 기록하고 세션을 연다', async () => {
    const { user, recorded } = await pressStart({ ...NO_HISTORY, controlLevel: 'WARN' });

    await user.click(await screen.findByRole('button', { name: t.actions.proceed }));
    await user.click(await screen.findByRole('button', { name: t.confirm.confirm }));

    await waitFor(() => {
      expect(sessions(recorded.bodies)).toHaveLength(1);
    });

    expect(decisions(recorded.bodies)[0]?.decisionCode).toBe('WARNED');
  });

  it('긴급 작업지시는 우회로 시작하고 세션 본문에 그 사실이 실린다', async () => {
    const { user, recorded } = await pressStart({
      ...NO_HISTORY,
      workOrders: [EMERGENCY_ORDER],
    });

    await user.click(await screen.findByRole('button', { name: t.actions.override }));
    await user.click(await screen.findByRole('button', { name: t.confirm.confirm }));

    await waitFor(() => {
      expect(sessions(recorded.bodies)).toHaveLength(1);
    });

    const decision = decisions(recorded.bodies).at(-1);
    expect(decision?.decisionCode).toBe('OVERRIDDEN');
    /* ⛔ 자유 텍스트가 아니라 코드다(§5-8). */
    expect(decision?.overrideReasonCode).toBe('EMERGENCY_WORK_ORDER');

    const session = sessions(recorded.bodies)[0]?.body as Record<string, unknown>;
    expect(session.controlOverride).toEqual({ reasonCode: 'EMERGENCY_WORK_ORDER' });
  });
});

describe('P-02-02 작업 전 점검 통제 — 판정할 수 없을 때', () => {
  /** ⛔ 확인하지 못한 것을 통과로 다루지 않는다(F-6 · §9-1). */
  it('점검 이력 조회가 실패하면 시작하지 않고 사유를 말한다', async () => {
    const { recorded } = await pressStart({ inspectionsStatus: 500 });

    expect(await screen.findByText(t.blocked.lookupFailed)).toBeInTheDocument();
    expect(sessions(recorded.bodies)).toHaveLength(0);
    expect(decisions(recorded.bodies)).toHaveLength(0);
  });

  it('통제 수준 조회가 실패해도 시작하지 않는다', async () => {
    const { recorded } = await pressStart({ policyStatus: 500 });

    expect(await screen.findByText(t.blocked.lookupFailed)).toBeInTheDocument();
    expect(sessions(recorded.bodies)).toHaveLength(0);
  });

  /** ⚠ 고장은 보이되 막지 않는다(§5-6) — 축이 다르다. */
  it('열린 고장은 건수를 보이되 막지 않는다', async () => {
    const { user, recorded } = await pressStart({
      ...NO_HISTORY,
      controlLevel: 'WARN',
      openBreakdownCount: 1,
    });

    expect(await screen.findByText(t.history.openBreakdowns(1))).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: t.actions.proceed }));
    await user.click(await screen.findByRole('button', { name: t.confirm.confirm }));

    await waitFor(() => {
      expect(sessions(recorded.bodies)).toHaveLength(1);
    });
  });

  /** 부여의 주기가 조회 기간이 된다 — 창을 넓히면 지난 점검이 오늘 것으로 인정된다. */
  it('주기 창의 시작일을 조회 기간으로 싣는다', async () => {
    const { recorded } = await pressStart({
      assignments: [{ ...DAILY_ASSIGNMENT, cycleTypeCode: 'MONTH', cycleBaseDate: '2026-01-15' }],
    });

    await waitFor(() => {
      expect(
        recorded.urls.some((url) => url.includes('/maintenance/inspections')),
      ).toBe(true);
    });

    const asked = recorded.urls.find((url) => url.startsWith('/maintenance/inspections'));
    expect(asked).toContain('inspectedFrom=');
    expect(asked).not.toContain('inspectedFrom=2026-01-15');
  });

  it('돌아가기를 누르면 작업지시 선택으로 돌아간다', async () => {
    const { user, recorded } = await pressStart(NO_HISTORY);

    await user.click(await screen.findByRole('button', { name: t.actions.back }));

    expect(screen.queryByText(t.verdict.blockedMissing)).not.toBeInTheDocument();
    expect(sessions(recorded.bodies)).toHaveLength(0);
  });
});
