import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MaterialIssueRequestInput } from './material-issue-request-body';
import { usePublishSubmission } from './publish-submission';
import type { MaterialIssueLineDraft } from './types';

/**
 * 집중 갈래 — **제출 순간과 본문 조립을 잇는 이음매**(D-5 의 배선 쪽).
 *
 * ⭐ 앞 회차에는 이 두 줄이 `screen.tsx` 의 `publish()` 안에 있었고, 그 자리에서 `stamp.at` 을
 * `new Date()` 로 바꿔도 **16,856개 시험이 전부 통과했다**(검증 발견 1). 감지기 둘이 각각 순수
 * 함수와 공통 훅만 보고 있어 정작 결함이 사는 이음매가 비어 있었다.
 *
 * 이 파일은 **시각이 실제로 흐르는 동안** 같은 초안이 같은 본문을 내는지 본다 — 시간을 앞으로
 * 밀어 놓고도 두 본문이 같아야 한다.
 */

const line = (patch: Partial<MaterialIssueLineDraft> = {}): MaterialIssueLineDraft => ({
  key: 'shortage:1',
  origin: 'shortage',
  bomComponentId: 7601,
  itemId: '7401',
  uomId: '7501',
  requiredQty: 200,
  issuedQty: 120,
  shortageQty: 80,
  requestedQty: '80',
  ...patch,
});

const draft = (patch: Partial<MaterialIssueRequestInput> = {}): MaterialIssueRequestInput => ({
  workOrderId: '7101',
  destinationLocationId: '7301',
  requiredDate: '',
  requiredTime: '',
  reasonCode: '',
  remarks: '합성 비고',
  lines: [line()],
  shortage: [],
  ...patch,
});

const START = new Date(2026, 8, 1, 0, 12, 30);

/**
 * 시각을 앞으로 민다. 이음매가 끊겨 `stamp.at` 대신 `new Date()` 가 쓰이면 `occurredAt` 의 초가
 * 갈려 두 본문이 달라진다 — **같은 초 안에서만 보면 끊긴 배선도 통과한다.**
 */
const advanceClock = (seconds: number): void => {
  vi.setSystemTime(new Date(START.getTime() + seconds * 1000));
};

describe('usePublishSubmission — 제출 순간과 본문 조립의 이음매 (D-5 배선)', () => {
  beforeEach(() => {
    /* Date 만 고정한다 — 타이머까지 가짜로 만들 이유가 없다. */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('시간이 흘러도 **같은 초안은 같은 본문**을 낸다 — 재시도가 같은 멱등 키를 받는다', () => {
    const { result } = renderHook(() => usePublishSubmission());

    let first: unknown = null;
    let second: unknown = null;

    act(() => {
      first = result.current.build(draft());
    });

    /* 90초 뒤 재시도 — 여기서 이음매가 끊겨 있으면 `occurredAt` 의 초가 갈린다. */
    advanceClock(90);
    act(() => {
      second = result.current.build(draft());
    });

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
  });

  it('보낼 값이 달라지면 **다른 본문**을 낸다 — 다른 쓰기다', () => {
    const { result } = renderHook(() => usePublishSubmission());

    let first: unknown = null;
    let second: unknown = null;

    act(() => {
      first = result.current.build(draft());
    });

    advanceClock(90);
    act(() => {
      second = result.current.build(draft({ lines: [line({ requestedQty: '50' })] }));
    });

    expect(second).not.toEqual(first);
  });

  /**
   * ⚠ **한 칸짜리 도장의 경계를 적어 둔다.**
   *
   * 이 훅은 도장을 하나만 들어 「**직전 제출**과 값이 같은가」를 판정한다. 사이에 다른 값으로
   * 한 번 보냈으면 도장이 그쪽으로 옮겨 가 있어, 원래 값으로 돌아와도 새 순간을 찍는다.
   *
   * **사용자가 값을 고쳤다 되돌리는 흔한 경로는 여기 걸리지 않는다** — 편집은 `build` 를 부르지
   * 않고 발행을 누를 때만 부르므로, 두 제출 사이의 편집이 아무리 많아도 값이 같으면 같은 도장이
   * 나간다(`publish-wiring.test.tsx` 가 그 갈래를 화면에서 확인한다).
   *
   * 이 경계를 없애려면 지문→시각 표를 들어야 하는데 **그 표를 언제 비울지가 또 하나의 판단**이라
   * 두지 않았다. 경계를 감추지 않고 시험으로 못 박아 둔다.
   */
  it('사이에 **다른 값으로 한 번 보냈으면** 도장이 그쪽으로 옮겨 가 있다 — 한 칸짜리 도장의 경계', () => {
    const { result } = renderHook(() => usePublishSubmission());

    let first: unknown = null;
    let restored: unknown = null;

    act(() => {
      first = result.current.build(draft());
    });

    advanceClock(30);
    act(() => {
      result.current.build(draft({ remarks: '고친 비고' }));
    });

    advanceClock(90);
    act(() => {
      restored = result.current.build(draft());
    });

    expect(restored).not.toEqual(first);
  });

  it('채워지지 않은 초안에는 본문을 만들지 않는다', () => {
    const { result } = renderHook(() => usePublishSubmission());

    let body: unknown = 'not-null';

    act(() => {
      body = result.current.build(draft({ destinationLocationId: '' }));
    });

    expect(body).toBeNull();
  });
});
