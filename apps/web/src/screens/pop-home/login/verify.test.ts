import { describe, expect, it } from 'vitest';

import { pickExact, verifyWorker, type WorkerResponse } from './verify';

const workerOf = (over: Partial<WorkerResponse> = {}): WorkerResponse => ({
  workerId: 1001,
  workerNo: '900028',
  workerName: '김작업',
  businessUnitId: 1,
  plantId: 10,
  statusCode: 'ACTIVE',
  isActive: true,
  ...over,
});

describe('verifyWorker', () => {
  it('찾지 못하면 미등록이다', () => {
    expect(verifyWorker(undefined, 10)).toEqual({ kind: 'unknown' });
  });

  /* 미등록과 비재직은 문구도 사용자가 할 일도 다르다 — 뭉치지 않는다. */
  it('재직 중이 아니면 거부한다', () => {
    const worker = workerOf({ isActive: false });

    expect(verifyWorker(worker, 10)).toEqual({ kind: 'inactive', worker });
  });

  /*
   * ⛔ 계약이 「화면은 statusCode 로 재직을 판정하지 않는다」고 못박았다 — 값 목록이 열려
   * 있어 화면이 뜻을 지어내게 된다.
   */
  it('상태 코드가 무엇이든 isActive 로 판정한다', () => {
    expect(verifyWorker(workerOf({ statusCode: 'RETIRED', isActive: true }), 10).kind).toBe('ok');
    expect(verifyWorker(workerOf({ statusCode: 'ACTIVE', isActive: false }), 10).kind).toBe(
      'inactive',
    );
  });

  /* ⚠ 막지 않는다 — 사번이 전역 유일이고 사람이 옮겨 다닌다. 표시만 한다. */
  it('다른 공장이어도 통과시키고 표시만 한다', () => {
    const result = verifyWorker(workerOf({ plantId: 20 }), 10);

    expect(result).toEqual({ kind: 'ok', worker: workerOf({ plantId: 20 }), isOtherPlant: true });
  });

  /* 견줄 기준이 없으면 모르는 것을 아는 것처럼 그리지 않는다. */
  it('기준 공장을 모르면 다른 공장이라고 말하지 않는다', () => {
    const result = verifyWorker(workerOf({ plantId: 20 }), null);

    expect(result).toEqual({ kind: 'ok', worker: workerOf({ plantId: 20 }), isOtherPlant: false });
  });
});

describe('pickExact', () => {
  it('사번이 정확히 같은 것을 고른다', () => {
    const items = [workerOf({ workerNo: '900029' }), workerOf({ workerNo: '900028' })];

    expect(pickExact(items, '900028')?.workerNo).toBe('900028');
  });

  /*
   * ⛔ 첫 줄을 그냥 쓰면 응답이 달라졌을 때 «엉뚱한 사람»으로 귀속된다. 이 화면이 남기는
   * 것은 「누가 했는가」다.
   */
  it('같은 사번이 없으면 고르지 않는다', () => {
    expect(pickExact([workerOf({ workerNo: '900029' })], '900028')).toBeUndefined();
  });

  it('앞뒤 공백은 사번을 가리지 않는다', () => {
    expect(pickExact([workerOf()], '  900028 ')?.workerNo).toBe('900028');
  });
});
