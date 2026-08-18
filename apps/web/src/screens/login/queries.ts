import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { LoginDraft } from './login-draft';
import { toLoginOutcome, type LoginOutcome } from './login-outcome';
import type { Session } from './types';

/** 응답이 없어 상태 코드를 붙일 수 없는 자리. 상태로 분기하는 갈래에 걸리지 않게 한다. */
const NO_HTTP_STATUS = 0;

/**
 * 로그인 실패를 실은 예외.
 *
 * 던지는 값은 `Error` 하위 클래스여야 하고(팀 TypeScript 규칙), TanStack Query가 기본으로
 * `Error`를 오류 타입으로 두므로 그 계약과도 맞는다. **메시지에 자격을 담지 않는다** —
 * 예외 메시지는 로그·오류 보고로 새어 나가는 첫 경로다.
 */
export class LoginFailedError extends Error {
  readonly outcome: LoginOutcome;

  constructor(outcome: LoginOutcome, options?: ErrorOptions) {
    super(`로그인 실패 (${outcome.kind})`, options);
    this.name = 'LoginFailedError';
    this.outcome = outcome;
  }
}

export interface LoginMutation {
  submit: (draft: LoginDraft) => void;
  isSubmitting: boolean;
  /** 마지막 시도의 갈래. `null`이면 아직 시도하지 않았거나 되돌렸다 */
  outcome: LoginOutcome | null;
  /** 진행 중이 아닐 때만 되돌린다 — 사본 체크리스트의 `resetIfIdle` 규율 */
  resetIfIdle: () => void;
}

export interface LoginOptions {
  onSuccess: (session: Session) => void;
}

/**
 * 한 번의 시도. **멱등 키를 초안과 함께 나른다.**
 *
 * 키를 요청 함수 안에서 만들지 않는 이유는 그 자리가 **재시도마다 다시 도는 자리**이기
 * 때문이다 — 같은 시도의 재시도가 새 키를 얻으면 서버에는 서로 다른 요청이 된다.
 * 전례(`patterns/master/use-master-write.ts`)가 키를 보내기 직전에 만들어 넘기는 것과 같다.
 */
interface LoginAttempt {
  draft: LoginDraft;
  idempotencyKey: string;
}

const readOutcome = (cause: unknown): LoginOutcome =>
  cause instanceof LoginFailedError ? cause.outcome : { kind: 'unknown', status: NO_HTTP_STATUS };

/**
 * 세션을 만든다 — 이 화면의 유일한 요청이다.
 *
 * **공통 쓰기 훅(`useMasterWrite`)을 쓰지 않는다.** 그쪽은 실패를 `ApiError`로 정규화하는데,
 * 그 과정에서 401 본문의 남은 시도 횟수가 버려지고 423이 필드 오류로 분류된다(`login-outcome.ts`).
 * 캐시 무효화도 필요 없다 — 이 요청이 만드는 것은 조회 자원이 아니라 세션이다.
 *
 * ⭐ **멱등 키는 시도마다 새로 만든다.** 같은 키로 다시 보내면 서버가 앞선 실패 응답을 그대로
 * 되돌려 줄 수 있고, 그러면 남은 시도 횟수가 갱신되지 않아 **맞는 자격을 넣고도 앞선 실패를
 * 다시 본다.** 계약이 이 헤더를 필수로 두었고 목 서버는 없는 요청을 400으로 되돌린다(실측).
 */
export const useLogin = (options: LoginOptions): LoginMutation => {
  const { client } = useApiClient();
  const [outcome, setOutcome] = useState<LoginOutcome | null>(null);

  const mutation = useMutation({
    /* 요청 함수를 변수로 받아 이 훅이 옛 렌더의 값을 붙잡지 않게 한다. */
    mutationFn: async (attempt: LoginAttempt): Promise<Session> => {
      let result;

      try {
        result = await client.POST('/app/sessions', {
          params: { header: { 'Idempotency-Key': attempt.idempotencyKey } },
          /*
           * ⛔ 자격은 **본문에만** 싣는다. 주소에 실으면 방문 기록·프록시 로그·리퍼러에
           * 남고, 한 번 남은 것은 되돌릴 수 없다.
           */
          body: { loginId: attempt.draft.loginId, password: attempt.draft.password },
        });
      } catch (cause) {
        /* 응답이 없는 실패다. 상태 코드가 없으므로 http 갈래로 뭉뚱그리지 않는다. */
        throw new LoginFailedError({ kind: 'network' }, { cause });
      }

      if (!result.response.ok || result.data === undefined) {
        throw new LoginFailedError(toLoginOutcome(result.response.status, result.error));
      }

      return result.data;
    },
  });

  const submit = (draft: LoginDraft): void => {
    /* 새 시도가 앞 시도의 진술을 지운다 — 남겨 두면 방금 친 값에 대한 판정처럼 읽힌다. */
    setOutcome(null);

    mutation.mutate(
      { draft, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (session) => {
          options.onSuccess(session);
        },
        onError: (cause) => {
          setOutcome(readOutcome(cause));
        },
      },
    );
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(사본 체크리스트 · `omf-mes#96`).
   *
   * 진행 중 mutation의 `reset()`은 그 호출에 매달린 되먹임을 통째로 끊는다 — 요청은 이미
   * 서버에 갔는데 화면만 없던 일로 친다. 로그인에서 그것은 **세션은 만들어졌는데 로그인되지
   * 않은 화면**이다. 되돌리는 자리는 전부 이 함수를 지난다.
   */
  const resetIfIdle = (): void => {
    if (mutation.isPending) return;

    setOutcome(null);
    mutation.reset();
  };

  return {
    submit,
    isSubmitting: mutation.isPending,
    outcome,
    resetIfIdle,
  };
};
