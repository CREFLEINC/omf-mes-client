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
 * 반대쪽도 같은 무게다. 다른 것을 적기 시작했는데 앞 키를 그대로 들고 가면 서버가 그것을 앞
 * 시도로 보고 흡수한다 - 화면은 기록했다고 말하는데 아무것도 기록되지 않는다. 그래서 무엇을
 * 적는 중인지를 함께 받아, 그 대상이 바뀌면 스스로 비운다. 비우는 자리를 화면이 일일이 적으면
 * 언젠가 하나를 빠뜨린다.
 *
 * 이 보증은 화면이 서 있는 동안만이다. 화면이 다시 서면 키가 사라져 다음 재시도는 새 키로
 * 간다. 그것까지 막으려면 큐처럼 보관소에 남겨야 한다.
 *
 * 큐를 타는 쓰기는 담을 때 만든 키를 회차마다 재사용해 이미 이 성질을 갖는다. 온라인 전용
 * 경로에는 그 자리가 없어 여기서 준다.
 */
export const useIdempotencyKey = (target?: unknown): IdempotencyKey => {
  const key = useRef<string | null>(null);
  const written = useRef(target);

  if (!Object.is(written.current, target)) {
    written.current = target;
    key.current = null;
  }

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
