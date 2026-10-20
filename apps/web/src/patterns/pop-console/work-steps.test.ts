import { describe, expect, it } from 'vitest';

import { nextStepOf, POP_WORK_STEPS, stepDestination, stepIndexOf } from './work-steps';

describe('작업 단계', () => {
  it('시작 → 투입 → 생산 작업 순서이고 이름은 화면 목록과 같다', () => {
    expect(POP_WORK_STEPS.map((step) => step.screen.name)).toEqual([
      '작업 시작',
      '자재 투입',
      '생산 작업',
    ]);
  });

  it('지금 주소의 단계를 찾고, 단계가 아닌 화면은 -1 이다', () => {
    expect(stepIndexOf('/pop/material-input')).toBe(1);
    expect(stepIndexOf('/pop/downtime')).toBe(-1);
  });

  it('작업지시가 필요한 단계는 작업지시를 실어 보내고, 모르면 잠긴다', () => {
    const [start, input] = POP_WORK_STEPS;

    if (start === undefined || input === undefined) throw new Error('단계가 비었습니다');

    expect(stepDestination(start, null)).toBe('/pop/work-start');
    expect(stepDestination(input, 42)).toBe('/pop/material-input?workOrderId=42');
    expect(stepDestination(input, null)).toBeNull();
  });

  it('다음 단계는 하나뿐이고 마지막 단계·단계 밖 화면에는 없다', () => {
    expect(nextStepOf('/pop/work-start')?.key).toBe('input');
    expect(nextStepOf('/pop/production-result')).toBeNull();
    expect(nextStepOf('/pop/downtime')).toBeNull();
  });
});
