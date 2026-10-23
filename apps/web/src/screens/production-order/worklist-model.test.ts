import { describe, expect, it } from 'vitest';

import { deriveWorklistState, REASON_STEP, toReleaseBacklog } from './worklist-model';

const order = (autoPlan: { status: 'DONE' | 'NEEDS_REVIEW'; reasons: string[] } | null) => ({
  statusCode: 'RECEIVED',
  autoPlan: autoPlan as never,
});

describe('작업함 처리 상태(C-17 잠정 규칙)', () => {
  it('행 상태는 조건, 머리 건수와 같은 기준인 서버 자동 계획 결과다', () => {
    expect(deriveWorklistState(order(null), undefined)).toEqual({
      state: 'NOT_PLANNED',
      reasons: [],
    });
    expect(
      deriveWorklistState(
        order({ status: 'NEEDS_REVIEW', reasons: ['LINE_UNKNOWN', 'BOM_MISSING'] }),
        undefined,
      ),
    ).toEqual({ state: 'NEEDS_REVIEW', reasons: ['LINE_UNKNOWN', 'BOM_MISSING'] });
  });

  it('자동 계획 완료여도 상태는 그대로 두고 배포 막힘은 사유 칩으로만 보인다', () => {
    expect(
      deriveWorklistState(order({ status: 'DONE', reasons: [] }), { pending: 3, blocked: 2 }),
    ).toEqual({
      state: 'DONE',
      reasons: ['ASSIGNMENT_INCOMPLETE'],
    });
    expect(
      deriveWorklistState(order({ status: 'DONE', reasons: [] }), { pending: 3, blocked: 0 }),
    ).toEqual({
      state: 'DONE',
      reasons: [],
    });
  });

  it('취소된 ERP W/O는 취소로 보인다', () => {
    expect(deriveWorklistState({ ...order(null), statusCode: 'CANCELLED' }, undefined).state).toBe(
      'CANCELLED',
    );
  });

  it('사유가 가리키는 단계(구성안 대응표)', () => {
    expect(REASON_STEP.BOM_MISSING).toBe('master');
    expect(REASON_STEP.PLAN_NOT_CONFIRMED).toBe('plan');
    expect(REASON_STEP.ASSIGNMENT_INCOMPLETE).toBe('assign');
  });

  it('W/O 목록을 ERP W/O별로 센다', () => {
    const map = toReleaseBacklog(
      [{ productionOrderId: 1 }, { productionOrderId: 1 }, { productionOrderId: 2 }],
      [{ productionOrderId: 1 }],
    );
    expect(map.get(1)).toEqual({ pending: 2, blocked: 1 });
    expect(map.get(2)).toEqual({ pending: 1, blocked: 0 });
  });
});
