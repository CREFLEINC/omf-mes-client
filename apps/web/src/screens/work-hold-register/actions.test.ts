import { describe, expect, it } from 'vitest';

import { resolveActions, type ActionInputs } from './actions';

const inputs = (over: Partial<ActionInputs> = {}): ActionInputs => ({
  running: true,
  stopped: false,
  lastQueuedType: null,
  lastSentType: null,
  isRefetching: false,
  ...over,
});

describe('resolveActions — 같은 방향을 두 번 열지 않는다', () => {
  it('큐가 비어 있으면 서버가 말하는 상태를 따른다', () => {
    expect(resolveActions(inputs())).toEqual({ canStop: true, canResume: false });
    expect(resolveActions(inputs({ running: false, stopped: true }))).toEqual({
      canStop: false,
      canResume: true,
    });
  });

  it('세션이 없거나 끝났으면 둘 다 열지 않는다', () => {
    expect(resolveActions(inputs({ running: false, stopped: false }))).toEqual({
      canStop: false,
      canResume: false,
    });
  });

  /*
   * ⭐ **망이 끊기면 큐가 비지 않는다.** 둘 다 잠그면 설비가 다시 돌아도 재개를 등록할 수
   * 없어, 「담는 것이 곧 성공」이라는 이 큐의 전제가 오프라인에서 무너진다.
   */
  it('담긴 중단이 아직 안 나갔으면 중단만 잠기고 재개는 열린다', () => {
    expect(resolveActions(inputs({ lastQueuedType: 'STOP' }))).toEqual({
      canStop: false,
      canResume: true,
    });
  });

  it('담긴 재개가 아직 안 나갔으면 재개만 잠긴다', () => {
    expect(resolveActions(inputs({ running: false, lastQueuedType: 'RESUME' }))).toEqual({
      canStop: true,
      canResume: false,
    });
  });

  /*
   * ⛔ **여기가 이 파일을 따로 둔 이유다.** 보낸 것이 닿으면 큐는 즉시 비지만 세션 조회는 아직
   * 돌아오지 않았다 — 그 사이 서버가 말하는 상태는 여전히 「진행」이라, 그대로 믿으면 방금 건
   * 중단이 한 번 더 눌린다. 다른 멱등 키라 서버도 흡수하지 못한다.
   */
  it('보낸 직후 다시 읽는 중이면 방금 보낸 방향을 잠근 채 둔다', () => {
    expect(
      resolveActions(inputs({ running: true, lastSentType: 'STOP', isRefetching: true })),
    ).toEqual({ canStop: false, canResume: true });
  });

  it('다시 읽기가 끝나면 서버가 말하는 상태로 돌아간다', () => {
    expect(resolveActions(inputs({ running: false, stopped: true, lastSentType: 'STOP' }))).toEqual(
      { canStop: false, canResume: true },
    );
  });
});
