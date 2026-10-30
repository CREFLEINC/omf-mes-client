import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  canEnter,
  firstOpenStep,
  judgeAssign,
  judgeMaster,
  judgePlan,
  judgeRelease,
  nextIncompleteId,
  type StepJudgment,
} from './process-model';

const r = messages.erpWorkOrderFlow.process.remaining;
const master = {
  loading: false,
  failed: false,
  bomCount: 1,
  routingCount: 1,
  bomSelected: true,
  routingSelected: true,
};
const plan = {
  loading: false,
  rowCount: 1,
  unconfirmed: 0,
  invalid: null,
  missingLine: null,
  totalQty: 500,
  confirmedQty: 500,
  orderQty: 500,
};
const assign = { loading: false, pending: 2, blocked: 0, unsaved: null, firstBlocked: null };

describe('처리 화면 단계 판정(C-5)', () => {
  it('BOM이나 Routing이 없으면 화면에서 고칠 수 없는 사유와 담당을 할 일로 말한다', () => {
    expect(judgeMaster({ ...master, bomCount: 0 }, '생산계획')).toEqual({
      complete: false,
      guidance: { text: r.bomMissing },
      blockedOutside: 'bom',
    });
    expect(judgeMaster({ ...master, routingCount: 0 }, '생산계획').blockedOutside).toBe('routing');
    expect(judgeMaster({ ...master, bomSelected: false }, '생산계획').guidance).toEqual({
      text: 'BOM을 고르세요',
    });
  });

  it('확정된 계획이 있으면 그 계획의 개정으로 통과한다(개정 목록에 없거나 쓸 수 없어도)', () => {
    expect(
      judgeMaster(
        { ...master, routingCount: 0, routingSelected: false, fixedByPlan: true },
        '생산계획',
      ),
    ).toEqual({
      complete: true,
      guidance: { text: '생산계획으로 진행할 수 있습니다' },
    });
  });

  it('막힘이 없으면 「남은 일」 없이 다음 단계 문장을 쓰고 조사를 받침에 맞춘다', () => {
    expect(judgeMaster(master, '생산계획').guidance).toEqual({
      text: '생산계획으로 진행할 수 있습니다',
    });
    expect(judgeMaster(master, '4M 배정').guidance?.text).toBe('4M 배정으로 진행할 수 있습니다');
  });

  it('생산계획은 지금 할 일(칸, 라인, 수량) 순서로 말하고, 확정할 줄이 있으면 [전개 확정]을 연다', () => {
    expect(judgePlan({ ...plan, rowCount: 0 }, '4M 배정').guidance?.text).toBe(r.addPlan);
    expect(
      judgePlan(
        { ...plan, unconfirmed: 1, invalid: { plan: '신규 계획 1', field: '계획 수량' } },
        '4M 배정',
      ).guidance?.text,
    ).toBe('신규 계획 1의 계획 수량을 입력하세요');
    const noLine = judgePlan({ ...plan, unconfirmed: 1, missingLine: 'PP-1' }, '4M 배정');
    expect(noLine.guidance).toEqual({ text: 'PP-1의 라인을 고르세요' });
    expect(noLine.canConfirm).toBe(false);
    expect(judgePlan({ ...plan, unconfirmed: 1, totalQty: 300 }, '4M 배정').guidance?.text).toBe(
      r.qtyShort('200'),
    );
    const ready = judgePlan({ ...plan, unconfirmed: 1, confirmedQty: 0 }, '4M 배정');
    expect(ready.canConfirm).toBe(true);
    expect(ready.complete).toBe(false);
    expect(judgePlan(plan, '4M 배정').complete).toBe(true);
  });

  it('4M은 저장 안 한 변경, 미배정 칸, 점검 결과 순으로 말한다', () => {
    expect(judgeAssign({ ...assign, unsaved: 'WO-1' }, '배포 확인').guidance?.text).toBe(
      'WO-1의 변경을 저장하세요',
    );
    expect(
      judgeAssign(
        {
          ...assign,
          blocked: 2,
          firstBlocked: { operation: '조립', field: '기본 WIP 위치', finding: null },
        },
        '배포 확인',
      ).guidance?.text,
    ).toBe('W/O 2건 미배정. 조립 공정의 기본 WIP 위치를 고르세요');
    expect(
      judgeAssign(
        {
          ...assign,
          blocked: 1,
          firstBlocked: { operation: '조립', field: null, finding: '설비가 겹칩니다.' },
        },
        '배포 확인',
      ).guidance?.text,
    ).toBe('W/O 1건 미배정. 「설비가 겹칩니다」를 해결하세요');
    expect(judgeAssign({ ...assign, pending: 0 }, '배포 확인').guidance?.text).toBe(r.noWorkOrders);
    expect(judgeAssign(assign, '배포 확인')).toEqual({
      complete: true,
      guidance: { text: '배포 확인으로 진행할 수 있습니다' },
    });
  });

  it('배포 확인은 LOT 크기가 비면 처음부터 할 일로, 아니면 머리말 없이 「확정 후 수정 불가」다', () => {
    expect(judgeRelease('WO-1')).toEqual({ text: 'WO-1의 LOT 크기를 입력하세요' });
    expect(judgeRelease(null)).toEqual({ text: r.releaseFinal });
  });

  it('처음 여는 단계는 첫 미완료 단계이고, 앞 단계가 끝나야 뒤 단계로 갈 수 있다', () => {
    const done: StepJudgment = { complete: true, guidance: null };
    const open: StepJudgment = { complete: false, guidance: null };
    expect(firstOpenStep({ master: done, plan: open, assign: open })).toBe('plan');
    expect(firstOpenStep({ master: done, plan: done, assign: done })).toBe('release');
    expect(canEnter('assign', { master: done, plan: open, assign: open })).toBe(false);
    expect(canEnter('plan', { master: done, plan: open, assign: open })).toBe(true);
  });
});

describe('4M 저장 뒤 다음 W/O(T-W-C 항목 하나씩 끝내는 흐름)', () => {
  it('저장한 W/O가 끝났으면 공정 순서로 그 뒤의 첫 미완료 W/O를 연다', () => {
    expect(nextIncompleteId([1, 2, 3], new Set([2, 3]), 2, true)).toBe(3);
    expect(nextIncompleteId([1, 2, 3], new Set([1, 3]), 3, true)).toBe(1);
  });
  it('저장한 W/O가 아직 막혀 있거나 남은 W/O가 없으면 옮기지 않는다', () => {
    expect(nextIncompleteId([1, 2, 3], new Set([2, 3]), 2, false)).toBeNull();
    expect(nextIncompleteId([1, 2, 3], new Set([3]), 3, true)).toBeNull();
  });
});
