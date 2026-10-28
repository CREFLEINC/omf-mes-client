import { describe, expect, it } from 'vitest';

import { deriveWorklistState, REASON_STEP } from './worklist-model';

const order = (
  worklistState: string | null,
  autoPlan: { status: 'DONE' | 'NEEDS_REVIEW'; reasons: string[] } | null,
  worklistReasons: { code: string; workOrderCount: number }[] = [],
) => ({
  statusCode: 'RECEIVED',
  autoPlan: autoPlan as never,
  worklistState: worklistState as never,
  worklistReasons: worklistReasons as never,
});

describe('작업함 처리 상태(C-17)', () => {
  it('행 상태는 서버 칩 판정(worklistState) 그대로다', () => {
    expect(deriveWorklistState(order('BEFORE_PLAN', null)).state).toBe('BEFORE_PLAN');
    expect(deriveWorklistState(order('RELEASE_PENDING', { status: 'DONE', reasons: [] }))).toEqual({
      state: 'RELEASE_PENDING',
      reasons: [],
    });
    expect(deriveWorklistState(order('RELEASED', { status: 'DONE', reasons: [] })).state).toBe(
      'RELEASED',
    );
    expect(deriveWorklistState(order('CANCELLED', null)).state).toBe('CANCELLED');
  });

  it('조치 필요의 사유는 자동 계획 확인 필요면 autoPlan.reasons, 자동 계획이 끝났으면 worklistReasons다', () => {
    expect(
      deriveWorklistState(
        order('ACTION_REQUIRED', { status: 'NEEDS_REVIEW', reasons: ['AUTO_PLAN_RERUN_NEEDED'] }),
      ),
    ).toEqual({ state: 'ACTION_REQUIRED', reasons: [{ code: 'AUTO_PLAN_RERUN_NEEDED' }] });
    expect(
      deriveWorklistState(
        order('ACTION_REQUIRED', { status: 'DONE', reasons: [] }, [
          { code: 'WORK_ORDER_LINE_MISSING', workOrderCount: 2 },
          { code: 'WORK_ORDER_LOCATION_MISSING', workOrderCount: 1 },
        ]),
      ),
    ).toEqual({
      state: 'ACTION_REQUIRED',
      reasons: [
        { code: 'WORK_ORDER_LINE_MISSING', workOrderCount: 2 },
        { code: 'WORK_ORDER_LOCATION_MISSING', workOrderCount: 1 },
      ],
    });
  });

  it('worklistState를 싣지 않는 서버에서는 자동 계획 결과로 가른다', () => {
    expect(deriveWorklistState(order(null, null)).state).toBe('BEFORE_PLAN');
    expect(
      deriveWorklistState(order(null, { status: 'NEEDS_REVIEW', reasons: ['BOM_MISSING'] })),
    ).toEqual({ state: 'ACTION_REQUIRED', reasons: [{ code: 'BOM_MISSING' }] });
    expect(deriveWorklistState(order(null, { status: 'DONE', reasons: [] })).state).toBe(
      'RELEASE_PENDING',
    );
    expect(deriveWorklistState({ ...order(null, null), statusCode: 'CANCELLED' }).state).toBe(
      'CANCELLED',
    );
  });

  it('사유가 가리키는 단계(구성안 대응표)', () => {
    expect(REASON_STEP.BOM_MISSING).toBe('master');
    expect(REASON_STEP.PLAN_NOT_CONFIRMED).toBe('plan');
    expect(REASON_STEP.AUTO_PLAN_RERUN_NEEDED).toBe('plan');
    expect(REASON_STEP.NO_LIVE_WORK_ORDER).toBe('plan');
    expect(REASON_STEP.WORK_ORDER_LINE_MISSING).toBe('assign');
    expect(REASON_STEP.WORK_ORDER_LOCATION_MISSING).toBe('assign');
    expect(REASON_STEP.LINE_PLANT_MISMATCH).toBe('assign');
  });
});
