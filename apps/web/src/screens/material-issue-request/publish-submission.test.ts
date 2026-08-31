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
   * ⚠ **A → B → A 로 보내면 첫 키가 돌아오지 않는다. 이 화면이 고칠 수 있는 결함이 아니다.**
   *
   * 이 훅은 도장을 하나만 들어 「**직전 제출**과 값이 같은가」를 판정한다. 사이에 다른 값으로
   * 실제로 한 번 **보냈으면** 도장이 그쪽으로 옮겨 가, 원래 값으로 돌아와도 새 순간을 찍는다.
   *
   * ⛔ **드문 경로가 아니다.** 반복 실패 앞에서 값을 바꿔 재시도했다가 되돌리는 것은 흔한
   * 반응이고, 그 경로가 그대로 걸린다. 두 제출 사이의 «편집만»으로는 걸리지 않는다는 것이
   * 이 경계의 전부가 아니다(`screen-wiring.test.tsx` 가 그 편집 갈래를 화면에서 확인한다).
   *
   * ⛔ **손해는 「키 하나 더 소모」가 아니라 「전표 중복」이다.** 첫 A 가 서버에 실제로 적용됐다면
   * 둘째 A 가 새 키로 나가 같은 자재 요청 전표가 둘 쌓인다. 이 화면에 취소 경로가 없다.
   *
   * ⭐ **여기서 고칠 수 없다.** 화면이 지문→시각 표를 완벽히 들어도 소용없다 —
   * `patterns/master/use-master-write.ts` 의 `idempotency` **ref 가 한 칸**이라, 이 훅을 건너뛰고
   * `businessDate`·`occurredAt` 을 고정값으로 박은 본문 A→B→A 를 보내도 `key[0] !== key[2]` 다
   * (재검증 실측). **뿌리는 공용 부품에 있고 `omf-mes-client#528` 과 같은 뿌리다.**
   *
   * 그래서 이 시험은 「이 훅이 무엇까지 책임지는가」의 경계를 못 박아 둘 뿐이다 — 경계를 감추지
   * 않되, 화면에서 우회를 시도하지도 않는다.
   */
  it('사이에 **다른 값으로 한 번 보냈으면** 도장이 그쪽으로 옮겨 가 있다 — 아래층 한 칸 저장소의 경계(#528)', () => {
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
