import { useRef } from 'react';

import { createIdempotencyKey } from './outbox';

export interface IdempotencyKey {
  /** 이번 시도의 키. 같은 시도를 다시 보내면 같은 값이 나온다. */
  current: () => string;
  /** 다음 시도는 새 키로 간다. 성공했거나 다른 것을 적기 시작했을 때 부른다. */
  reset: () => void;
}

/**
 * 한 번의 확정에 키 하나를 붙인다.
 *
 * 보낼 때마다 새로 만들면 멱등키가 아무것도 막지 못한다 - 서버가 기록한 뒤 응답이 유실되면
 * 화면은 실패로 보이고, 사람이 다시 보내면 새 키라 서버가 같은 일을 한 번 더 한다. 되돌릴 수
 * 없는 쓰기에서 그 중복은 원복할 길이 없다.
 *
 * 큐를 타는 쓰기는 담을 때 만든 키를 회차마다 재사용해 이미 이 성질을 갖는다. 온라인 전용
 * 경로에는 그 자리가 없어 여기서 준다.
 */
export const useIdempotencyKey = (): IdempotencyKey => {
  const key = useRef<string | null>(null);

  return {
    current: () => {
      key.current ??= createIdempotencyKey();
      return key.current;
    },
    reset: () => {
      key.current = null;
    },
  };
};
