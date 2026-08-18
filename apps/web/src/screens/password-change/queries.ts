import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { ApiCallResult } from '../../patterns/request';
import { NO_HTTP_STATUS, toChangeOutcome, type ChangeOutcome } from './change-outcome';
import type { PasswordDraft } from './password-draft';

const CHANGE_PASSWORD_PATH = '/app/users/me:change-password';

/**
 * 변경 실패를 실은 예외.
 *
 * 던지는 값은 `Error` 하위 클래스여야 하고(팀 TypeScript 규칙), TanStack Query가 기본으로
 * `Error`를 오류 타입으로 두므로 그 계약과도 맞는다. **메시지에 자격을 담지 않는다** —
 * 예외 메시지는 로그·오류 보고로 새어 나가는 첫 경로다.
 */
export class PasswordChangeFailedError extends Error {
  readonly outcome: ChangeOutcome;

  constructor(outcome: ChangeOutcome, options?: ErrorOptions) {
    super(`비밀번호 변경 실패 (${outcome.kind})`, options);
    this.name = 'PasswordChangeFailedError';
    this.outcome = outcome;
  }
}

/**
 * 한 번의 시도. **멱등 키를 초안과 함께 나른다.**
 *
 * 키를 요청 함수 안에서 만들지 않는 이유는 그 자리가 **재시도마다 다시 도는 자리**이기
 * 때문이다 — 같은 시도의 재시도가 새 키를 얻으면 서버에는 서로 다른 요청이 된다.
 */
interface PasswordChangeAttempt {
  draft: PasswordDraft;
  idempotencyKey: string;
}

/**
 * 같은 쓰기인가. **나가는 두 칸만 견준다.**
 *
 * 확인 칸은 요청에 실리지 않으므로 그것만 달라진 초안은 서버에서 **완전히 같은 쓰기**다 —
 * 그것을 다른 시도로 세면 새 키가 나가고, 결정 ②가 막으려던 이중 실행이 열린다.
 */
const isSameWrite = (a: PasswordDraft, b: PasswordDraft): boolean =>
  a.currentPassword === b.currentPassword && a.newPassword === b.newPassword;

export interface PasswordChangeMutation {
  submit: (draft: PasswordDraft) => void;
  /** 통신 실패 뒤 같은 시도를 다시 보낸다 — 멱등 키를 유지한다(결정 ②) */
  retry: () => void;
  isSubmitting: boolean;
  /** 마지막 시도의 갈래. `null`이면 아직 시도하지 않았거나 되돌렸다 */
  outcome: ChangeOutcome | null;
  /** 진행 중이 아닐 때만 되돌린다 — 사본 체크리스트의 `resetIfIdle` 규율 */
  resetIfIdle: () => void;
}

export interface PasswordChangeOptions {
  /**
   * 바뀌었다. **넘겨줄 값이 없다** — 204에는 본문이 없고, 이 화면은 세션도 캐시도 건드리지
   * 않는다(누구의 비밀번호인지는 주소가 정한다).
   */
  onSuccess: () => void;
}

/**
 * 내 비밀번호를 바꾼다 — 이 화면의 유일한 요청이다.
 *
 * **공통 쓰기 훅(`useMasterWrite`)을 쓰지 않는다.** 그쪽은 실패를 `ApiError`로 정규화하는데
 * 이 화면은 401을 **특정 칸의 인라인**으로 옮겨야 하고, 무효화할 조회 캐시도 없다.
 *
 * ⭐ **멱등 키는 시도당 하나이고, 통신 실패 뒤의 재시도는 그 키를 그대로 쓴다(결정 ②) —
 * 전례(로그인)와 반대다.** 이 쓰기는 되돌릴 수 없고 두 번 실행되면 두 번째가 반드시 실패한다.
 * 응답을 못 받은 사이 서버가 이미 바꿨다면, 새 키로 다시 보낼 때 「현재 비밀번호」가 더 이상
 * 맞지 않아 **본인이 방금 바꾼 값 때문에 「현재 비밀번호가 틀렸다」는 말을 듣는다.** 같은 키면
 * 계약의 멱등 규약이 그 경우를 흡수한다. 로그인이 시도마다 새 키를 쓰는 것은 그 화면에서
 * 옳다(같은 키는 앞선 실패 응답을 되돌려 남은 시도 횟수를 굳게 만든다) — **같은 부품, 반대
 * 판단이다.**
 */
export const useChangePassword = (options: PasswordChangeOptions): PasswordChangeMutation => {
  const { client } = useApiClient();
  const [outcome, setOutcome] = useState<ChangeOutcome | null>(null);

  /**
   * 마지막 시도. **렌더 사이에 살아 있어야 재시도가 같은 키를 쓸 수 있다.**
   * 상태가 아니라 참조로 두는 이유는 이 값이 화면에 그려지지 않기 때문이다 — 바뀔 때마다
   * 다시 그릴 이유가 없다.
   */
  const attemptRef = useRef<PasswordChangeAttempt | null>(null);

  const mutation = useMutation({
    mutationFn: async (attempt: PasswordChangeAttempt): Promise<void> => {
      let result: ApiCallResult<void>;

      try {
        result = await client.POST(CHANGE_PASSWORD_PATH, {
          params: { header: { 'Idempotency-Key': attempt.idempotencyKey } },
          /*
           * ⛔ 자격은 **본문에만** 싣는다. 주소에 실으면 방문 기록·프록시 로그·리퍼러에 남고,
           * 한 번 남은 것은 되돌릴 수 없다.
           *
           * ⛔ **확인 칸을 싣지 않는다** — 계약에 없는 칸이고, 자격을 한 벌 더 보내는 것은
           * 얻는 것 없이 새는 면만 넓힌다.
           */
          body: {
            currentPassword: attempt.draft.currentPassword,
            newPassword: attempt.draft.newPassword,
          },
        });
      } catch (cause) {
        /* 응답이 없는 실패다. 상태 코드가 없으므로 http 갈래로 뭉뚱그리지 않는다. */
        throw new PasswordChangeFailedError(toChangeOutcome(NO_HTTP_STATUS, null), { cause });
      }

      /*
       * ⭐ **성공은 응답 코드로만 판정한다.** 계약의 성공 응답은 204이고 **본문이 없다** —
       * 전례(로그인)가 200 본문에 세션이 실렸는지 확인하던 자리의 **역방향**이다. 여기서 본문을
       * 요구하면 계약대로 응답한 서버를 실패로 읽는다.
       */
      if (!result.response.ok) {
        throw new PasswordChangeFailedError(toChangeOutcome(result.response.status, result.error));
      }
    },
  });

  /**
   * 잡은 값에서 갈래를 꺼낸다.
   *
   * 우리가 던진 것이 아니면 **연결 문제로 오인시키지 않는다** — 「가를 근거가 없다」로 떨어뜨린다.
   * 원인을 통신 실패로 적으면 사용자가 할 수 없는 조치(연결 확인)를 하게 된다.
   */
  const readOutcome = (cause: unknown): ChangeOutcome =>
    cause instanceof PasswordChangeFailedError
      ? cause.outcome
      : { kind: 'unknown', status: NO_HTTP_STATUS };

  const send = (attempt: PasswordChangeAttempt): void => {
    attemptRef.current = attempt;

    /* 새 시도가 앞 시도의 진술을 지운다 — 남겨 두면 방금 보낸 것에 대한 판정처럼 읽힌다. */
    setOutcome(null);

    mutation.mutate(attempt, {
      onSuccess: () => {
        /*
         * ⚠ **전례처럼 되먹임을 try/catch로 감싸지 않는다 — 던질 자리가 없다(실측).**
         *
         * 로그인은 이 자리에 **세션 적재**가 붙어 그것이 던지면 「로그인은 됐는데 누구인지 모르는
         * 화면」이 남았다. 이 화면의 되먹임은 성공 알림과 칸 비우기뿐이고, 알림은 상태 갱신 뒤
         * id를 돌려주는 함수라 던지는 경로가 타입·구현에 없다. 프로바이더가 없을 때 던지는 자리는
         * `useToast()` 호출부이며 그것은 **렌더 시점**이라 이 경로 밖이다.
         *
         * 던지는 자리가 생기면(예: 되먹임에서 저장소를 건드리게 되면) 전례처럼 갈래로 옮기고
         * 감지기를 함께 둔다. 지금 감싸 두면 **일어날 수 없는 경우를 있는 것처럼** 남긴다.
         */
        options.onSuccess();
      },
      onError: (cause) => {
        setOutcome(readOutcome(cause));
      },
    });
  };

  /**
   * 보낸다. **값이 바뀌었을 때만 새 키를 만든다**(결정 ②).
   *
   * 같은 값을 다시 보내는 것은 사용자가 통신 실패를 보고 버튼을 다시 누른 경우이고, 그것은
   * **같은 시도**다 — 여기서 새 키를 만들면 막으려던 이중 실행이 그대로 열린다.
   */
  const submit = (draft: PasswordDraft): void => {
    const previous = attemptRef.current;
    const idempotencyKey =
      previous !== null && isSameWrite(previous.draft, draft)
        ? previous.idempotencyKey
        : crypto.randomUUID();

    send({ draft, idempotencyKey });
  };

  /** 같은 시도를 그대로 다시 보낸다. **보낸 적이 없으면 되보낼 것도 없다.** */
  const retry = (): void => {
    const previous = attemptRef.current;

    if (previous === null || mutation.isPending) return;

    send(previous);
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(사본 체크리스트 · `omf-mes#96`).
   *
   * 진행 중 mutation의 `reset()`은 그 호출에 매달린 되먹임을 통째로 끊는다 — 요청은 이미
   * 서버에 갔는데 화면만 없던 일로 친다. 이 화면에서 그것은 **비밀번호는 바뀌었는데 바뀐 줄
   * 모르는 화면**이고, 사용자는 옛 비밀번호로 다음 로그인을 시도한다.
   */
  const resetIfIdle = (): void => {
    if (mutation.isPending) return;

    setOutcome(null);
    mutation.reset();
  };

  return {
    submit,
    retry,
    isSubmitting: mutation.isPending,
    outcome,
    resetIfIdle,
  };
};
