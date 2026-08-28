import { messages } from '@omf-mes/i18n';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError, toApiError } from '../request';
import { renderHookWithProviders } from '../../test/api-harness';
import {
  requireIfMatch,
  useMasterWrite,
  type MasterWriteOptions,
  type WriteHeaders,
} from './use-master-write';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 낙관적 잠금이 걸린 리소스의 상세 경로. patterns는 리소스 이름을 알지 않으므로 중립적인 경로를 쓴다. */
const DETAIL_PATH = '/probe/1';

interface Variables {
  name: string;
}

interface Recorded {
  variables: Variables;
  headers: WriteHeaders;
}

const okResponse = (): Response => new Response(null, { status: 200 });
const failedResponse = (status: number): Response => new Response(null, { status });

/** 요청을 기록하고 정해진 결과를 돌려주는 스텁. */
const recordingRequest = (
  calls: Recorded[],
  result: () => { data?: { id: number }; error?: unknown; response: Response },
) => {
  return async (variables: Variables, headers: WriteHeaders) => {
    calls.push({ variables, headers });
    return result();
  };
};

const renderWrite = (options: Partial<MasterWriteOptions<Variables, { id: number }>> = {}) => {
  const calls: Recorded[] = [];
  const defaults: MasterWriteOptions<Variables, { id: number }> = {
    request: recordingRequest(calls, () => ({ data: { id: 1 }, response: okResponse() })),
    etagPath: null,
    invalidateKeys: [],
    knownFields: [],
  };

  const rendered = renderHookWithProviders(() => useMasterWrite({ ...defaults, ...options }));

  return { ...rendered, calls };
};

describe('useMasterWrite', () => {
  it('성공하면 지정한 캐시 키를 무효화하고 onSuccess를 부른다', async () => {
    const onSuccess = vi.fn();
    const { result, queryClient, calls } = renderWrite({
      invalidateKeys: [['probe'], ['probe', 'detail', 1]],
      onSuccess,
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    });
    expect(calls).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['probe'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['probe', 'detail', 1] });
    expect(result.current.error).toBeNull();
  });

  it('보낼 값이 바뀌면 새 키를 만든다 — 다른 쓰기다 (결정 #10 ⓐ · 형식은 UUID)', async () => {
    const { result, calls } = renderWrite();

    act(() => {
      result.current.write({ name: '첫 시도' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.write({ name: '두 번째 시도' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[0]?.headers['Idempotency-Key']).toMatch(UUID_PATTERN);
    expect(calls[1]?.headers['Idempotency-Key']).toMatch(UUID_PATTERN);
    expect(calls[0]?.headers['Idempotency-Key']).not.toBe(calls[1]?.headers['Idempotency-Key']);
  });

  /*
   * ⭐ **기본은 시도마다 새 키다.** 되돌릴 수 있는 쓰기와 본문이 빈 액션이 그것을 필요로
   * 한다 — 보낼 값이 없으면 「값이 바뀌면 새 키」가 성립하지 않아, 사용자가 다른 화면에서
   * 원인을 고치고 돌아와도 같은 키가 나가 앞선 거부를 되돌려 받는다.
   */
  it('기본은 실패한 뒤 다시 보내도 새 키다 — 되돌릴 수 있는 쓰기와 본문이 빈 액션의 수명이다', async () => {
    const calls: Recorded[] = [];

    const { result } = renderWrite({
      request: async (variables, headers) => {
        calls.push({ variables, headers });
        return { error: {}, response: failedResponse(400) };
      },
    });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[1]?.headers['Idempotency-Key']).not.toBe(calls[0]?.headers['Idempotency-Key']);
  });

  /*
   * ⭐ 아래 넷이 `docs/decisions.md` #10 의 수명 규칙이다. 요지는 **「소멸 조건을 좁게 잡는
   * 쪽이 이중 실행을 막는다」** — 시도마다 새 키를 주면 통신이 끊긴 뒤 다시 눌렀을 때 서버가
   * 그것을 다른 쓰기로 보고 두 번 실행할 수 있다.
   */
  it('until-applied · 통신이 실패한 뒤 같은 값으로 다시 보내면 같은 키를 쓴다 — 적용됐는지 모른다 (ⓑ)', async () => {
    const calls: Recorded[] = [];
    let shouldFail = true;

    const { result } = renderWrite({
      keyLifetime: 'until-applied',
      request: async (variables, headers) => {
        calls.push({ variables, headers });

        if (shouldFail) throw new Error('연결 끊김');

        return { data: { id: 1 }, response: okResponse() };
      },
    });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    shouldFail = false;
    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[1]?.headers['Idempotency-Key']).toBe(calls[0]?.headers['Idempotency-Key']);
  });

  it.each([500, 400, 401])(
    'until-applied · %i 뒤 같은 값으로 다시 보내면 같은 키를 쓴다 (ⓑ)',
    async (status) => {
      const calls: Recorded[] = [];
      let current = status;

      const { result } = renderWrite({
        keyLifetime: 'until-applied',
        request: async (variables, headers) => {
          calls.push({ variables, headers });

          return current === 200
            ? { data: { id: 1 }, response: okResponse() }
            : { error: {}, response: failedResponse(current) };
        },
      });

      act(() => {
        result.current.write({ name: '같은 값' });
      });
      await waitFor(() => {
        expect(calls).toHaveLength(1);
      });

      current = 200;
      act(() => {
        result.current.write({ name: '같은 값' });
      });
      await waitFor(() => {
        expect(calls).toHaveLength(2);
      });

      expect(calls[1]?.headers['Idempotency-Key']).toBe(calls[0]?.headers['Idempotency-Key']);
    },
  );

  it('until-applied · 성공하면 키를 버린다 — 끝난 키로 다시 보내면 서버가 실행 없이 앞 응답을 되돌려 준다 (ⓒ)', async () => {
    const { result, calls } = renderWrite({ keyLifetime: 'until-applied' });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[1]?.headers['Idempotency-Key']).not.toBe(calls[0]?.headers['Idempotency-Key']);
  });

  it('until-applied · reset 은 키를 버리지 않는다 — 오류 표시를 지우는 것과 적용 여부를 모르는 것은 다른 사실이다', async () => {
    const calls: Recorded[] = [];

    const { result } = renderWrite({
      keyLifetime: 'until-applied',
      request: async (variables, headers) => {
        calls.push({ variables, headers });
        return { error: {}, response: failedResponse(500) };
      },
    });

    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.reset();
    });
    act(() => {
      result.current.write({ name: '같은 값' });
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[1]?.headers['Idempotency-Key']).toBe(calls[0]?.headers['Idempotency-Key']);
  });

  it('until-applied · 키 순서만 다른 같은 값은 같은 쓰기로 본다 — 지문이 순서에 흔들리면 이중 실행을 막지 못한다', async () => {
    const calls: { headers: WriteHeaders }[] = [];

    const { result } = renderWrite({
      keyLifetime: 'until-applied',
      request: async (_variables, headers) => {
        calls.push({ headers });
        return { error: {}, response: failedResponse(500) };
      },
    });

    act(() => {
      result.current.write({ a: 1, b: 2 } as unknown as Variables);
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.write({ b: 2, a: 1 } as unknown as Variables);
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[1]?.headers['Idempotency-Key']).toBe(calls[0]?.headers['Idempotency-Key']);
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 지문을 수명과 무관하게 계산하면, 이 기능을 «고르지 않은» 소비처
   * 84곳까지 직렬화할 수 없는 값에서 깨진다 — 옛 경로는 variables 를 읽지도 않았다.
   */
  it('수명을 고르지 않았으면 보낼 값을 «읽지» 않는다 — 옛 경로는 variables 를 건드리지 않았다', async () => {
    const calls: { headers: WriteHeaders }[] = [];
    let readCount = 0;

    const { result } = renderWrite({
      request: async (_variables, headers) => {
        calls.push({ headers });
        return { data: { id: 1 }, response: okResponse() };
      },
    });

    /* 값을 읽으면 세는 초안. 직렬화하면 게터가 불린다. */
    const watched = {
      get name(): string {
        readCount += 1;
        return '읽힘';
      },
    };

    act(() => {
      result.current.write(watched as Variables);
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    expect(readCount).toBe(0);
    expect(calls[0]?.headers['Idempotency-Key']).toMatch(UUID_PATTERN);
  });

  it('수명을 고르지 않았으면 직렬화할 수 없는 값에도 요청이 나간다', async () => {
    const calls: { headers: WriteHeaders }[] = [];

    const { result } = renderWrite({
      request: async (_variables, headers) => {
        calls.push({ headers });
        return { data: { id: 1 }, response: okResponse() };
      },
    });

    const cyclic: Record<string, unknown> = { name: '순환' };
    cyclic.self = cyclic;

    act(() => {
      result.current.write(cyclic as unknown as Variables);
    });

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.headers['Idempotency-Key']).toMatch(UUID_PATTERN);
  });

  it('until-applied 인데 지문을 못 만들면 새 키로 간다 — 모를 때 같은 키로 묶는 것보다 안전하다', async () => {
    const calls: { headers: WriteHeaders }[] = [];

    const { result } = renderWrite({
      keyLifetime: 'until-applied',
      request: async (_variables, headers) => {
        calls.push({ headers });
        return { error: {}, response: failedResponse(500) };
      },
    });

    const cyclic = (): Record<string, unknown> => {
      const value: Record<string, unknown> = { name: '순환' };
      value.self = value;
      return value;
    };

    act(() => {
      result.current.write(cyclic() as unknown as Variables);
    });
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });

    act(() => {
      result.current.write(cyclic() as unknown as Variables);
    });
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });

    expect(calls[0]?.headers['Idempotency-Key']).toMatch(UUID_PATTERN);
    expect(calls[1]?.headers['Idempotency-Key']).not.toBe(calls[0]?.headers['Idempotency-Key']);
  });

  it('etagPath에 보관된 토큰을 If-Match로 싣는다', async () => {
    const { result, apiClient, calls } = renderWrite({ etagPath: DETAIL_PATH });
    apiClient.etags.capture(DETAIL_PATH, '"7"');

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.headers['If-Match']).toBe('"7"');
  });

  it('etagPath가 null이면 If-Match를 싣지 않는다 — 등록 요청에는 낙관적 잠금이 없다', async () => {
    const { result, calls } = renderWrite({ etagPath: null });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.headers['If-Match']).toBeUndefined();
  });

  it('토큰이 없으면 요청을 보내지 않고 다시 저장하라는 안내를 세운다 — 빈 If-Match는 계약 위반이다', async () => {
    const { result, calls } = renderWrite({ etagPath: DETAIL_PATH });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(calls).toHaveLength(0);
    expect(result.current.error).toEqual({
      kind: 'validation',
      errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: messages.save.staleToken }],
    });
  });

  it('화면이 아는 필드의 오류는 인라인으로, 모르는 필드의 오류는 배너로 나눈다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, () => ({
        error: {
          errors: [
            { scope: 'field', field: 'name', code: 'REQUIRED', message: '이름을 입력하세요' },
            { scope: 'field', field: '모르는칸', code: 'RANGE', message: '값이 범위를 벗어납니다' },
          ],
        },
        response: failedResponse(400),
      })),
    });

    act(() => {
      result.current.write({ name: '' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '이름을 입력하세요' });
    });
    expect(result.current.error).toEqual({
      kind: 'validation',
      errors: [
        { scope: 'field', field: '모르는칸', code: 'RANGE', message: '값이 범위를 벗어납니다' },
      ],
    });
  });

  it('한 필드에 오류가 둘이면 두 번째를 삼키지 않고 배너로 올린다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, () => ({
        error: {
          errors: [
            { scope: 'field', field: 'name', code: 'REQUIRED', message: '첫 번째 오류' },
            { scope: 'field', field: 'name', code: 'RANGE', message: '두 번째 오류' },
          ],
        },
        response: failedResponse(400),
      })),
    });

    act(() => {
      result.current.write({ name: '' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '첫 번째 오류' });
    });
    expect(result.current.error).toMatchObject({
      kind: 'validation',
      errors: [{ message: '두 번째 오류' }],
    });
  });

  it('필드 오류만 있으면 배너를 세우지 않는다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, () => ({
        error: {
          errors: [{ scope: 'field', field: 'name', code: 'REQUIRED', message: '필수입니다' }],
        },
        response: failedResponse(400),
      })),
    });

    act(() => {
      result.current.write({ name: '' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '필수입니다' });
    });
    expect(result.current.error).toBeNull();
  });

  it('409는 충돌로 정규화해 배너 쪽으로 보낸다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      request: recordingRequest(calls, () => ({
        error: { conflictCause: 'workerLease', message: '처리 중' },
        response: failedResponse(409),
      })),
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.error).toMatchObject({ kind: 'conflict', cause: 'workerLease' });
    });
    expect(result.current.fieldErrors).toEqual({});
  });

  it('fetch 자체가 실패하면 network로 낸다', async () => {
    const { result } = renderWrite({
      request: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.error).toEqual({ kind: 'network' });
    });
  });

  it('clearFieldError는 그 필드의 서버 오류만 지운다 — 고치는 중에 옛 오류가 남지 않는다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name', 'code'],
      request: recordingRequest(calls, () => ({
        error: {
          errors: [
            { scope: 'field', field: 'name', code: 'REQUIRED', message: '이름 오류' },
            { scope: 'field', field: 'code', code: 'REQUIRED', message: '코드 오류' },
          ],
        },
        response: failedResponse(400),
      })),
    });

    act(() => {
      result.current.write({ name: '' });
    });
    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '이름 오류', code: '코드 오류' });
    });

    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.fieldErrors).toEqual({ code: '코드 오류' });
  });

  it('reset은 세워 둔 오류를 모두 지운다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, () => ({
        error: {
          errors: [{ scope: 'field', field: 'name', code: 'REQUIRED', message: '이름 오류' }],
        },
        response: failedResponse(400),
      })),
    });

    act(() => {
      result.current.write({ name: '' });
    });
    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '이름 오류' });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('다시 저장하면 이전 오류를 지우고 시작한다', async () => {
    const calls: Recorded[] = [];
    let shouldFail = true;
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, () =>
        shouldFail
          ? {
              error: {
                errors: [{ scope: 'field', field: 'name', code: 'REQUIRED', message: '이름 오류' }],
              },
              response: failedResponse(400),
            }
          : { data: { id: 1 }, response: okResponse() },
      ),
    });

    act(() => {
      result.current.write({ name: '' });
    });
    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '이름 오류' });
    });

    shouldFail = false;
    act(() => {
      result.current.write({ name: '고친 값' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({});
    });
    expect(result.current.error).toBeNull();
  });
});

/**
 * ⭐ **서버가 주는 `code` 는 계약이고 `message` 는 말씨다.** 화면이 그 상황을 더 정확히 말할
 * 수 있으면 — 유일 범위가 무엇인지 화면만 아는 경우처럼 — 코드로 알아보고 제 문구를 낸다.
 */
describe('useMasterWrite — 화면의 말로 되말하기', () => {
  const duplicateError = () => ({
    error: {
      errors: [{ scope: 'field', field: 'name', code: 'DUPLICATE', message: '서버 문구' }],
    },
    response: failedResponse(400),
  });

  it('되말하면 그 문구가 칸에 붙는다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      restateFieldError: (item) => (item.code === 'DUPLICATE' ? '화면 문구' : undefined),
      request: recordingRequest(calls, duplicateError),
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '화면 문구' });
    });
  });

  /** ⛔ 모르는 코드는 건드리지 않는다 — 되말하지 못하는 것까지 삼키면 서버 말이 지워진다. */
  it('되말하지 않은 오류는 서버 문구 그대로 남는다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      restateFieldError: (item) => (item.code === '다른코드' ? '화면 문구' : undefined),
      request: recordingRequest(calls, duplicateError),
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '서버 문구' });
    });
  });

  /** 되말할 자리를 주지 않은 화면은 지금까지와 똑같이 동작한다. */
  it('되말하는 자리를 주지 않으면 서버 문구를 쓴다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: ['name'],
      request: recordingRequest(calls, duplicateError),
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.fieldErrors).toEqual({ name: '서버 문구' });
    });
  });

  /** ⛔ 배너로 갈 오류는 되말하는 자리가 아니다 — 칸에 붙는 것만 화면의 말로 바꾼다. */
  it('화면이 모르는 칸의 오류는 되말하지 않는다', async () => {
    const calls: Recorded[] = [];
    const { result } = renderWrite({
      knownFields: [],
      restateFieldError: () => '화면 문구',
      request: recordingRequest(calls, duplicateError),
    });

    act(() => {
      result.current.write({ name: '값' });
    });

    await waitFor(() => {
      expect(result.current.error).toEqual({
        kind: 'validation',
        errors: [{ scope: 'field', field: 'name', code: 'DUPLICATE', message: '서버 문구' }],
      });
    });
    expect(result.current.fieldErrors).toEqual({});
  });
});

/**
 * ⭐ **계약이 `If-Match` 를 필수로 받는 쓰기가 생겨 필요해진 자리다.**
 *
 * 훅은 `etagPath` 가 있으면 토큰 없이 보내지 않지만 **타입에는 그 보장이 없다.** 그 틈을
 * 빈 문자열로 메우면 빈 토큰이 나가고, 서버의 거부가 화면에서 「저장이 반려됐다」로 읽힌다 —
 * 실제로는 **물어보지도 못한 것**이다.
 */
describe('requireIfMatch', () => {
  it('토큰이 있으면 그대로 준다', () => {
    expect(requireIfMatch({ 'Idempotency-Key': 'key-1', 'If-Match': '7' })).toBe('7');
  });

  /* ⛔ 「0」·빈 문자열 같은 값을 지어내 채우지 않는다 — 그 값으로 보내면 거부가 오해를 낳는다. */
  it('⛔ 토큰이 없으면 값을 지어내지 않고 멈춘다', () => {
    expect(() => requireIfMatch({ 'Idempotency-Key': 'key-1' })).toThrow(ApiRequestError);
  });

  /*
   * ⛔ **멈춘 이유가 사용자에게 닿아야 한다.** 연결 문제로 읽히면 사용자는 할 수 없는 조치를
   * 하고, 아무 문구도 없으면 버튼이 그냥 안 먹는 것으로 보인다.
   */
  it('⛔ 멈춘 이유를 화면이 말할 수 있는 형태로 던진다', () => {
    const thrown = (() => {
      try {
        requireIfMatch({ 'Idempotency-Key': 'key-1' });
        return null;
      } catch (error: unknown) {
        return error;
      }
    })();

    expect(toApiError(thrown)).toEqual({
      kind: 'validation',
      errors: [{ scope: 'screen', code: 'STALE_TOKEN', message: messages.save.staleToken }],
    });
  });
});
