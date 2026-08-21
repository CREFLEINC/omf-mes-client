import { messages } from '@omf-mes/i18n';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderHookWithProviders } from '../../test/api-harness';
import { useMasterWrite, type MasterWriteOptions, type WriteHeaders } from './use-master-write';

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
