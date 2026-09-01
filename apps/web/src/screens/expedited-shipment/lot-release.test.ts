import { describe, expect, it } from 'vitest';

import { blocksSubmit, lotReleaseState } from './lot-release';
import type { ProductionLotCandidate } from './types';

const lot = (overrides: Partial<ProductionLotCandidate> = {}): ProductionLotCandidate => ({
  lotId: 9001,
  lotNo: 'SYNTH-LOT-0001',
  itemId: 5001,
  initialQty: 500,
  uomId: 7001,
  statusCode: 'NORMAL',
  held: false,
  ...overrides,
});

describe('lotReleaseState', () => {
  it('고른 LOT이 없으면 판정하지 않는다', () => {
    expect(lotReleaseState(null)).toBeNull();
  });

  it('⛔ 보류 중이면 막는다 — 「긴급」이 품질 게이트를 우회하지 않는다', () => {
    const state = lotReleaseState(lot({ held: true }));

    expect(state).toEqual({ kind: 'held' });
    expect(blocksSubmit(state)).toBe(true);
  });

  it('⛔ 검사 대기면 막는다', () => {
    const state = lotReleaseState(lot({ statusCode: 'INSPECTION_PENDING' }));

    expect(state).toEqual({ kind: 'inspection-pending' });
    expect(blocksSubmit(state)).toBe(true);
  });

  /*
   * ⭐ 값 목록이 확정되지 않은 축이라(G-2) 코드 문자열이 바뀔 수 있다. 밖에서 받는 갈래를
   * 물어 두지 않으면 「고칠 자리가 하나」라는 설계가 시험 없이 남는다.
   */
  it('검사 대기 코드를 밖에서 바꿔 넣을 수 있다', () => {
    expect(lotReleaseState(lot({ statusCode: 'AWAITING_QC' }), 'AWAITING_QC')).toEqual({
      kind: 'inspection-pending',
    });
    /* 기본값으로는 같은 값이 걸리지 않는다 — 주입이 실제로 판정을 바꾼다. */
    expect(lotReleaseState(lot({ statusCode: 'AWAITING_QC' }))).toEqual({
      kind: 'no-known-block',
    });
  });

  it('보류도 검사 대기도 아니면 아는 차단 사유가 없다', () => {
    const state = lotReleaseState(lot());

    expect(state).toEqual({ kind: 'no-known-block' });
    expect(blocksSubmit(state)).toBe(false);
  });

  /*
   * ⛔ **모르는 것을 「아님」으로 접지 않는다.** `held`가 안 오면 보류가 아니라 보류 여부를
   * 모르는 것이다. 접으면 보류 LOT이 출하 가능처럼 보인다.
   */
  it('⛔ 보류 여부를 못 받았으면 「보류 아님」으로 접지 않는다', () => {
    const state = lotReleaseState(lot({ held: undefined }));

    expect(state).toEqual({ kind: 'unknown-hold' });
  });

  /*
   * ⭐ 그러나 «막지도» 않는다 — 서버가 필드를 안 내리는 것만으로 화면 전체가 잠기면 이 화면은
   * 쓸 수 없게 되고, 잘못 통과시켜도 서버가 400으로 막아 되돌릴 수 없는 일은 벌어지지 않는다.
   */
  it('보류 여부를 모른다고 확정을 막지는 않는다 — 최종 판정은 서버가 한다', () => {
    expect(blocksSubmit({ kind: 'unknown-hold' })).toBe(false);
  });

  it('판정이 없으면 막지 않는다', () => {
    expect(blocksSubmit(null)).toBe(false);
  });
});
