import { describe, expect, it } from 'vitest';

import type { DataScopeDraft } from './data-scope-draft';
import { dataScopeBlockReason } from './data-scope-validation';

const draftOf = (overrides: Partial<DataScopeDraft> = {}): DataScopeDraft => ({
  draftId: 'new:1',
  businessUnitId: '',
  plantId: '',
  ...overrides,
});

describe('dataScopeBlockReason — 최소 1축', () => {
  /**
   * 계약의 `ck_user_data_scope_target`이 두 축 중 하나 이상을 요구한다.
   * **목 서버가 이것을 강제하지 않는다**(둘 다 널인 본문에도 200을 준다) —
   * 화면이 막지 않으면 실서버에 붙기 전까지 아무도 이 결함을 보지 못한다.
   */
  it('두 축이 모두 비면 막는다', () => {
    expect(dataScopeBlockReason(draftOf(), [])).toBe('targetRequired');
  });

  it('사업부만 골라도 만들 수 있다', () => {
    expect(dataScopeBlockReason(draftOf({ businessUnitId: '2001' }), [])).toBeNull();
  });

  it('공장만 골라도 만들 수 있다', () => {
    expect(dataScopeBlockReason(draftOf({ plantId: '4001' }), [])).toBeNull();
  });

  it('두 축을 다 골라도 만들 수 있다', () => {
    expect(dataScopeBlockReason(draftOf({ businessUnitId: '2001', plantId: '4001' }), [])).toBeNull();
  });
});

describe('dataScopeBlockReason — 중복', () => {
  it('같은 짝이 이미 있으면 막는다', () => {
    const existing = draftOf({ draftId: 'saved:9001', businessUnitId: '2001', plantId: '4001' });

    expect(
      dataScopeBlockReason(draftOf({ businessUnitId: '2001', plantId: '4001' }), [existing]),
    ).toBe('duplicatePair');
  });

  /** 유일 제약이 빈 축을 접어 판정한다 — 사업부만 고른 두 줄은 서버에게 같은 짝이다. */
  it('빈 축을 접어 판정한다 — 사업부만 고른 줄을 두 번 만들 수 없다', () => {
    const existing = draftOf({ draftId: 'saved:9001', businessUnitId: '2001' });

    expect(dataScopeBlockReason(draftOf({ businessUnitId: '2001' }), [existing])).toBe(
      'duplicatePair',
    );
  });

  it('사업부만 고른 줄과 두 축을 다 고른 줄은 겹치지 않는다', () => {
    const existing = draftOf({ draftId: 'saved:9001', businessUnitId: '2001' });

    expect(
      dataScopeBlockReason(draftOf({ businessUnitId: '2001', plantId: '4001' }), [existing]),
    ).toBeNull();
  });

  /** 수정할 때 축을 그대로 두는 것이 정상 조작이다. */
  it('자기 자신은 중복으로 세지 않는다', () => {
    const self = draftOf({ draftId: 'saved:9001', businessUnitId: '2001' });

    expect(dataScopeBlockReason(self, [self])).toBeNull();
  });

  it('축이 다르면 겹치지 않는다', () => {
    const existing = draftOf({ draftId: 'saved:9001', businessUnitId: '2001' });

    expect(dataScopeBlockReason(draftOf({ businessUnitId: '2002' }), [existing])).toBeNull();
  });
});

describe('dataScopeBlockReason — 사유의 순서', () => {
  /**
   * 두 축이 비면 그것이 먼저다. 「이미 있는 범위와 겹친다」를 먼저 내면
   * 사용자는 무엇을 고쳐야 하는지 알 수 없다 — 아직 아무 축도 고르지 않았다.
   */
  it('두 축이 비었고 그런 줄이 이미 있어도 최소 1축을 먼저 낸다', () => {
    const existing = draftOf({ draftId: 'saved:9001' });

    expect(dataScopeBlockReason(draftOf(), [existing])).toBe('targetRequired');
  });
});
