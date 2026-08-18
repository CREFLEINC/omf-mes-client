import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { currentMismatchBody, passwordDraftFixture } from './fixtures';
import { useChangePassword } from './queries';

const CHANGE_PASSWORD_PATH = '/app/users/me:change-password';

/** 계약이 정한 성공 응답 — **본문이 없다.** */
const noContentResponse = (): Response => new Response(null, { status: 204 });

interface RecordedRequest {
  method: string;
  url: URL;
  /** **실제로 나간 본문을 본다.** 조립 함수만 재면 「다른 값을 보냈다」를 못 잡는다 */
  body: unknown;
  headers: Headers;
}

const changeRoute = (respond: (request: Request) => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === CHANGE_PASSWORD_PATH,
  respond,
});

/** 늘 204를 주는 스텁. 「무엇이 나갔는가」만 볼 때 쓴다. */
const okRoute = (): StubRoute => changeRoute(() => noContentResponse());

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. `hold`가 참이면 **기록한 뒤 붙잡아 둔다** —
 * 「나가는 중에 무엇이 되는가」를 재려면 응답이 오기 전 상태가 남아 있어야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold = false,
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const body: unknown = await request.clone().json();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      body,
      headers: request.headers,
    });

    if (hold) await gate;

    return stub(request);
  };

  return { fetch, requests, release };
};

const renderChange = (fetch: StubFetch, onSuccess = vi.fn()) => {
  const result = renderHookWithProviders(() => useChangePassword({ onSuccess }), { fetch });

  return { ...result, onSuccess };
};

const keyOf = (request: RecordedRequest | undefined): string | null =>
  request?.headers.get('Idempotency-Key') ?? null;

describe('useChangePassword — 무엇이 나가는가', () => {
  it('한 번 보내면 변경 요청이 한 번 나간다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(recording.requests[0]?.method).toBe('POST');
    expect(recording.requests[0]?.url.pathname).toBe(CHANGE_PASSWORD_PATH);
  });

  /** 계약이 전 쓰기 API에 멱등 키를 필수로 두었다. 형식까지 재는 이유는 아래 재사용 시험 때문이다. */
  it('요청에 UUID 형식의 멱등 키가 실린다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(keyOf(recording.requests[0])).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  /**
   * ⛔ **본문에 확인 칸이 실리지 않는다.** 계약에 없는 칸이고, 자격을 한 벌 더 보내는 것은
   * 얻는 것 없이 새는 면만 넓힌다. 키 목록을 통째로 견줘 **더 실린 것이 없음**까지 잰다.
   */
  it('본문에 계약이 정한 두 칸만 실린다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);
    const draft = passwordDraftFixture();

    act(() => {
      result.current.submit(draft);
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(recording.requests[0]?.body).toEqual({
      currentPassword: draft.currentPassword,
      newPassword: draft.newPassword,
    });
    expect(Object.keys(recording.requests[0]?.body as object)).toHaveLength(2);
  });

  /**
   * ⛔ **자격은 본문에만 싣는다.** 주소에 실으면 방문 기록·프록시 로그·리퍼러에 남고 한 번 남은
   * 것은 되돌릴 수 없다. 질의 문자열 전체와 경로를 함께 훑는다.
   */
  it('주소에 자격이 실리지 않는다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);
    const draft = passwordDraftFixture();

    act(() => {
      result.current.submit(draft);
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    const url = recording.requests[0]?.url;

    expect(url?.search).toBe('');
    expect(url?.href).not.toContain(draft.currentPassword);
    expect(url?.href).not.toContain(draft.newPassword);
  });
});

describe('useChangePassword — 멱등 키의 수명 (결정 ②)', () => {
  /**
   * ⭐ **통신 실패 뒤의 재시도는 같은 키로 나간다 — 전례(로그인)와 반대다.**
   *
   * 이 쓰기는 되돌릴 수 없고 두 번 실행되면 두 번째가 반드시 실패한다. 응답을 못 받은 사이
   * 서버가 이미 비밀번호를 바꿨다면, 새 키로 다시 보낼 때 「현재 비밀번호」가 더 이상 맞지 않아
   * **본인이 방금 바꾼 값 때문에 「현재 비밀번호가 틀렸다」는 말을 듣는다.** 같은 키면 계약의
   * 멱등 규약이 그 경우를 흡수한다.
   *
   * 로그인이 시도마다 새 키를 쓰는 것은 그 화면에서 옳다 — 거기서는 같은 키가 앞선 실패 응답을
   * 되돌려 남은 시도 횟수를 굳게 만든다. **같은 부품, 반대 판단이다.**
   */
  it('재시도는 첫 요청과 같은 키로 나간다', async () => {
    const recording = createRecordingFetch([
      changeRoute(() => {
        throw new Error('연결 실패(합성)');
      }),
    ]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'network' });
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    expect(keyOf(recording.requests[0])).toBeTruthy();
    expect(keyOf(recording.requests[1])).toBe(keyOf(recording.requests[0]));
  });

  /** 보낼 값이 달라지면 **다른 시도**다 — 같은 키로 보내면 서버가 앞 요청의 결과를 되돌려 준다. */
  it('값을 고쳐 다시 보내면 새 키로 나간다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    act(() => {
      result.current.submit(passwordDraftFixture({ newPassword: 'SYN-NEXT-0002' }));
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    expect(keyOf(recording.requests[1])).not.toBe(keyOf(recording.requests[0]));
  });

  /**
   * 같은 값을 다시 보내는 것은 **같은 시도**다(사용자가 통신 실패를 보고 버튼을 다시 누른 경우).
   * 여기서 새 키를 만들면 결정 ②가 막으려던 이중 실행이 그대로 열린다.
   */
  it('같은 값을 다시 보내면 키가 유지된다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    expect(keyOf(recording.requests[1])).toBe(keyOf(recording.requests[0]));
  });

  /**
   * 확인 칸은 **나가지 않는 값**이라 시도를 가르지 않는다 — 같은 쓰기를 두 번 만들지 않는 것이
   * 키의 목적이고, 본문이 같으면 같은 쓰기다.
   */
  it('확인 칸만 달라진 것은 같은 시도로 본다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    act(() => {
      result.current.submit(passwordDraftFixture({ confirmPassword: 'SYN-NEXT-0003' }));
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    expect(keyOf(recording.requests[1])).toBe(keyOf(recording.requests[0]));
  });

  /** 보낸 적이 없으면 되보낼 것도 없다 — 빈 재시도가 요청을 만들지 않는다(음성 단언). */
  it('보낸 적 없이 재시도하면 아무것도 나가지 않는다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.retry();
    });

    /* 양성 대조 — 같은 훅으로 보내면 실제로 나간다. 그 뒤에 「앞서는 나가지 않았다」가 성립한다. */
    expect(recording.requests).toHaveLength(0);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });
  });
});

describe('useChangePassword — 응답을 어떻게 읽는가', () => {
  /**
   * ⭐ **204는 상태 코드로만 판정한다.** 계약이 이 응답에 본문을 두지 않았다 — 전례(로그인)가
   * 200 본문에 세션이 있는지 확인하던 자리의 **역방향**이다. 여기서 본문을 요구하면 계약대로
   * 응답한 서버를 실패로 읽는다.
   */
  it('204를 받으면 성공 되먹임이 불린다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result, onSuccess } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(result.current.outcome).toBeNull();
  });

  it('401을 받으면 현재 비밀번호 불일치 갈래가 된다', async () => {
    const recording = createRecordingFetch([
      changeRoute(() => jsonResponse(currentMismatchBody(), { status: 401 })),
    ]);
    const { result, onSuccess } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'currentMismatch' });
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('응답이 없으면 통신 실패 갈래가 된다', async () => {
    const recording = createRecordingFetch([
      changeRoute(() => {
        throw new Error('연결 실패(합성)');
      }),
    ]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'network' });
    });
  });

  it('가를 근거가 없는 응답은 상태 코드를 안고 온다', async () => {
    const recording = createRecordingFetch([changeRoute(() => jsonResponse({}, { status: 500 }))]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'unknown', status: 500 });
    });
  });
});

describe('useChangePassword — 나가는 중과 되돌리기', () => {
  it('나가는 중에는 보내는 중임을 알린다', async () => {
    const recording = createRecordingFetch([okRoute()], true);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(true);
    });

    act(() => {
      recording.release();
    });

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  /**
   * ⭐ **나가는 중인 쓰기는 끊지 않는다**(사본 체크리스트 `resetIfIdle` 규율). 진행 중 mutation의
   * `reset()`은 그 호출에 매달린 되먹임을 통째로 끊는다 — 요청은 이미 서버에 갔는데 화면만 없던
   * 일로 친다. 이 화면에서 그것은 **비밀번호는 바뀌었는데 바뀐 줄 모르는 화면**이다.
   */
  it('나가는 중에 되돌리기를 불러도 성공 되먹임이 살아 있다', async () => {
    const recording = createRecordingFetch([okRoute()], true);
    const { result, onSuccess } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(true);
    });

    act(() => {
      result.current.resetIfIdle();
    });

    act(() => {
      recording.release();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('멈춰 있을 때 되돌리면 앞 시도의 갈래가 걷힌다', async () => {
    const recording = createRecordingFetch([
      changeRoute(() => jsonResponse(currentMismatchBody(), { status: 401 })),
    ]);
    const { result } = renderChange(recording.fetch);

    act(() => {
      result.current.submit(passwordDraftFixture());
    });
    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'currentMismatch' });
    });

    act(() => {
      result.current.resetIfIdle();
    });

    expect(result.current.outcome).toBeNull();
  });
});
