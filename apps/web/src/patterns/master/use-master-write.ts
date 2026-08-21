import type { ApiError, ErrorItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../api-context';
import { runRequest, toApiError, type ApiCallResult } from '../request';

/**
 * 멱등 키의 수명 — **쓰기의 성격이 정한다. 부품이 정하지 않는다.**
 *
 * `docs/decisions.md` #10 이 「소멸 조건을 좁게 잡는 쪽이 이중 실행을 막는다」고 정했지만,
 * 그 규칙은 **되돌릴 수 없는 쓰기**를 두고 세운 것이다. 두 수명이 각각 옳은 자리가 있다.
 *
 * | 수명 | 언제 | 왜 |
 * | --- | --- | --- |
 * | `per-attempt` | 되돌릴 수 있는 쓰기 · **본문이 빈 액션** | 아래 ⚠ |
 * | `until-applied` | **되돌릴 수 없는 쓰기**(확정·전이·차감) | 통신이 끊긴 뒤 다시 눌렀을 때 서버가 다른 쓰기로 보고 두 번 실행하는 것을 막는다 |
 *
 * ⚠ **본문이 빈 액션(`:approve`·`:confirm` 류)에 `until-applied` 를 쓰면 안 된다.** 보낼 값이
 * 없으면 「값이 바뀌면 새 키」가 성립하지 않는다 — 사용자가 **다른 화면에서 원인을 고치고**
 * 돌아와 다시 눌러도 같은 키가 나가고, 서버가 앞선 거부를 되돌려 주면 **영영 성공할 수 없다.**
 *
 * ⚠ **로그인·비밀번호 변경은 이 훅을 쓰지 않는다** — 각자 사정으로 따로 구현한다
 * (`screens/login/queries.ts` · `screens/password-change/queries.ts`). **같은 부품, 반대 판단이다.**
 */
export type IdempotencyKeyLifetime = 'per-attempt' | 'until-applied';

/** 쓰기 요청이 반드시 갖춰야 하는 헤더. 계약이 전 쓰기 API에 멱등 키를 요구한다. */
export interface WriteHeaders {
  'Idempotency-Key': string;
  'If-Match'?: string;
}

export interface MasterWriteOptions<TVariables, TData> {
  /** 실제 요청. 헤더는 훅이 만들어 넘긴다. */
  request: (variables: TVariables, headers: WriteHeaders) => Promise<ApiCallResult<TData>>;
  /** If-Match를 꺼낼 리소스 상세 경로. 신규 등록처럼 낙관적 잠금이 없으면 null. */
  etagPath: string | null;
  /** 성공 후 무효화할 캐시 키. 키를 `as const`로 두는 것이 관례라 안쪽도 읽기 전용을 받는다. */
  invalidateKeys: readonly (readonly unknown[])[];
  /** 화면이 소유한 입력칸 이름 — 인라인으로 낼 필드 오류를 고르는 기준 */
  knownFields: readonly string[];
  /**
   * 멱등 키의 수명. **기본은 `per-attempt`** — 지금까지의 동작이고 되돌릴 수 있는 쓰기에 맞다.
   * 되돌릴 수 없는 쓰기만 `until-applied` 를 고른다. 판단 기준은 위 타입 주석에 있다.
   */
  keyLifetime?: IdempotencyKeyLifetime;
  onSuccess?: (data: TData) => void;
}

export interface MasterWriteResult<TVariables> {
  write: (variables: TVariables) => void;
  isSaving: boolean;
  /** 입력칸 옆에 낼 오류. 화면이 로컬 검증 결과와 병합해 쓴다. */
  fieldErrors: Record<string, string>;
  /** 배너로 낼 오류. 인라인으로 소화하지 못한 것만 남는다. */
  error: ApiError | null;
  reset: () => void;
  clearFieldError: (field: string) => void;
}

interface WritePayload<TVariables, TData> {
  variables: TVariables;
  headers: WriteHeaders;
  request: (variables: TVariables, headers: WriteHeaders) => Promise<ApiCallResult<TData>>;
}

interface SplitError {
  fieldErrors: Record<string, string>;
  error: ApiError | null;
}

/**
 * 보낼 값의 지문 — **같은 값이면 같은 지문**이어야 한다.
 *
 * 키 순서만 다른 객체가 다른 지문이 되면, 같은 쓰기를 다시 보내는데도 새 키가 나가
 * 이중 실행을 막지 못한다. 그래서 객체의 키를 정렬한 뒤 문자열로 만든다.
 */
const signatureOf = (variables: unknown): string =>
  JSON.stringify(variables, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
            left < right ? -1 : 1,
          ),
        )
      : value,
  );

/** 지금 살아 있는 멱등 키와 그것이 매인 값. */
interface IdempotencyState {
  signature: string;
  key: string;
}

/** ETag를 확보하지 못해 저장을 시작조차 못 한 상태. 화면 전체에 대한 안내다. */
const staleTokenError = (): ApiError => ({
  kind: 'validation',
  errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: messages.save.staleToken }],
});

/**
 * 서버 오류를 인라인용과 배너용으로 나눈다.
 *
 * 화면이 아는 필드가 아니면 배너로 올린다 — 목 서버도 실서버도 화면이 모르는 필드명을 내려주며,
 * 그것을 버리면 어디에도 표시되지 않는 오류가 생긴다.
 * 같은 필드에 오류가 둘 이상이면 첫 번째만 인라인으로 내고 나머지는 배너로 올린다.
 */
const splitError = (apiError: ApiError, knownFields: readonly string[]): SplitError => {
  if (apiError.kind !== 'validation') {
    return { fieldErrors: {}, error: apiError };
  }

  const fieldErrors: Record<string, string> = {};
  const remaining: ErrorItem[] = [];

  for (const item of apiError.errors) {
    const field = item.field;
    const isInline =
      item.scope === 'field' &&
      field !== undefined &&
      knownFields.includes(field) &&
      !(field in fieldErrors);

    if (isInline && field !== undefined) {
      fieldErrors[field] = item.message;
    } else {
      remaining.push(item);
    }
  }

  return {
    fieldErrors,
    error: remaining.length > 0 ? { kind: 'validation', errors: remaining } : null,
  };
};

/**
 * 마스터 형 리소스의 쓰기 요청 하나를 다룬다 — 등록·수정·사용 중지가 모두 이 훅을 쓴다.
 * 헤더 규약과 실패 분해가 한 곳에 있어야 규약이 바뀔 때 고칠 곳이 하나로 남는다.
 *
 * write는 매 렌더 새로 만들어진다. 의존성 배열에 넣지 말고 이벤트 핸들러에서 부른다.
 */
export const useMasterWrite = <TVariables, TData>(
  options: MasterWriteOptions<TVariables, TData>,
): MasterWriteResult<TVariables> => {
  const { etags } = useApiClient();
  const queryClient = useQueryClient();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * `until-applied` 일 때만 살아 있는 키. `docs/decisions.md` #10 의 수명을 구현한다.
   *
   * | 사태 | 키 |
   * | --- | --- |
   * | 보낼 값이 바뀜 | **새 키** — 다른 쓰기다 |
   * | 통신 실패 · 5xx | **유지** — 적용됐는지 모른다 |
   * | 검증 실패(400) · 자격 불일치(401) | **유지** — 실행 전 거부다 |
   * | 성공 | **버린다** — 끝난 키로 다시 보내면 서버가 실행 없이 앞 응답을 되돌려 준다 |
   *
   * ⛔ **`reset` 에서도 버리지 않는다.** 화면이 오류 표시를 지우는 것과 「서버에 적용됐는지
   * 모르는 쓰기가 남아 있다」는 것은 다른 사실이다. 값이 달라지면 지문이 새 키를 준다.
   */
  const idempotency = useRef<IdempotencyState | null>(null);

  const mutation = useMutation({
    // 요청 함수를 변수로 받아 이 훅이 옛 렌더의 요청을 붙잡지 않게 한다.
    mutationFn: (payload: WritePayload<TVariables, TData>): Promise<TData> =>
      runRequest(() => payload.request(payload.variables, payload.headers)),
  });

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setError(null);
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearErrors();
    mutation.reset();
  }, [clearErrors, mutation]);

  const write = (variables: TVariables): void => {
    clearErrors();

    const signature = signatureOf(variables);
    const keepsKey = options.keyLifetime === 'until-applied';

    if (!keepsKey || idempotency.current === null || idempotency.current.signature !== signature) {
      idempotency.current = { signature, key: crypto.randomUUID() };
    }

    const headers: WriteHeaders = { 'Idempotency-Key': idempotency.current.key };

    if (options.etagPath !== null) {
      const ifMatch = etags.ifMatch(options.etagPath);

      if (ifMatch === undefined) {
        // 빈 If-Match는 계약 위반이라 서버가 400으로 되돌린다. 보내지 않고 멈춘다.
        setError(staleTokenError());
        return;
      }

      headers['If-Match'] = ifMatch;
    }

    mutation.mutate(
      { variables, headers, request: options.request },
      {
        onSuccess: (data) => {
          /*
           * ⭐ 성공에만 키를 버린다. 버리지 않으면 같은 값 재제출이 «끝난 키»로 나가고,
           * 서버는 계약대로 실행 없이 앞 응답을 되돌려 준다 — 화면은 그것을 성공으로 읽어
           * 아무 일도 없었는데 바뀌었다고 단언한다(결정 #10 ⓒ).
           */
          idempotency.current = null;

          for (const queryKey of options.invalidateKeys) {
            void queryClient.invalidateQueries({ queryKey });
          }
          options.onSuccess?.(data);
        },
        onError: (cause) => {
          /* 키를 유지한다 — 적용 여부를 모르거나(통신 실패·5xx) 실행 전 거부(400·401)다. */
          const split = splitError(toApiError(cause), options.knownFields);
          setFieldErrors(split.fieldErrors);
          setError(split.error);
        },
      },
    );
  };

  return {
    write,
    isSaving: mutation.isPending,
    fieldErrors,
    error,
    reset,
    clearFieldError,
  };
};
