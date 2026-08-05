import type { ApiError, ErrorItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApiClient } from '../api-context';
import { runRequest, toApiError, type ApiCallResult } from '../request';

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

    const headers: WriteHeaders = { 'Idempotency-Key': crypto.randomUUID() };

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
          for (const queryKey of options.invalidateKeys) {
            void queryClient.invalidateQueries({ queryKey });
          }
          options.onSuccess?.(data);
        },
        onError: (cause) => {
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
