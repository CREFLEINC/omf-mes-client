import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { errorResponseBody, loginDraftFixture, loginFailureBody, sessionBody } from './fixtures';
import { useLogin } from './queries';

const SESSIONS_PATH = '/app/sessions';

interface RecordedRequest {
  method: string;
  url: URL;
  /** **실제로 나간 본문을 본다.** 조립 함수를 단위로 재는 것만으로는 「다른 값을 보냈다」를 못 잡는다 */
  body: unknown;
  headers: Headers;
}

const sessionsRoute = (respond: (request: Request) => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === SESSIONS_PATH,
  respond,
});

/** 늘 200을 주는 스텁. 「무엇이 나갔는가」만 볼 때 쓴다. */
const okRoute = (): StubRoute => sessionsRoute(() => jsonResponse(sessionBody()));

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다.
 *
 * `hold`가 참이면 **기록한 뒤에** 붙잡아 둔다 — 「나가는 중에 무엇이 되는가」를 재려면
 * 응답이 오기 전 상태가 남아 있어야 한다.
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
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

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

const renderLogin = (fetch: StubFetch, onSuccess = vi.fn()) => {
  const result = renderHookWithProviders(() => useLogin({ onSuccess }), { fetch });

  return { ...result, onSuccess };
};

describe('useLogin — 무엇이 나가는가', () => {
  it('한 번 누르면 세션 만들기 요청이 한 번 나간다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(recording.requests[0]?.method).toBe('POST');
    expect(recording.requests[0]?.url.pathname).toBe(SESSIONS_PATH);
  });

  /** 계약이 전 쓰기 API에 멱등 키를 요구한다. 목 서버는 키가 없는 요청을 400으로 되돌린다(실측). */
  it('요청에 멱등 키가 실린다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(recording.requests[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  /**
   * ⭐ **시도마다 새 키다.** 같은 키로 다시 보내면 서버가 앞선 실패 응답을 그대로 되돌려 줄 수
   * 있고, 그러면 **남은 시도 횟수가 갱신되지 않는다** — 사용자는 맞는 자격을 넣고도 앞선 실패를
   * 다시 본다.
   */
  it('두 번 시도하면 두 요청의 멱등 키가 서로 다르다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    const first = recording.requests[0]?.headers.get('Idempotency-Key');
    const second = recording.requests[1]?.headers.get('Idempotency-Key');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  /**
   * ⛔ **비밀번호가 주소에 실리지 않는다.** 주소는 방문 기록·프록시 로그·리퍼러에 남는다 —
   * 공개된 자리에 한 번 실리면 되돌릴 수 없다. 본문에만 실려야 한다.
   */
  it('요청 본문이 아이디와 비밀번호 둘뿐이고 주소에는 아무것도 실리지 않는다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const draft = loginDraftFixture();
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(draft);
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    const sent = recording.requests[0];

    expect(sent?.body).toEqual({ loginId: draft.loginId, password: draft.password });
    expect(sent?.url.search).toBe('');
    expect(sent?.url.href).not.toContain(draft.password);
  });

  /** 친 값을 그대로 보낸다 — 앞뒤 공백은 비밀번호에서 값의 일부일 수 있다. */
  it('앞뒤 공백을 걷어내지 않고 보낸다', async () => {
    const recording = createRecordingFetch([okRoute()]);
    const draft = loginDraftFixture({ loginId: ' SYN-LOGIN-01 ', password: ' SYN-PW-VALUE-01 ' });
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(draft);
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    expect(recording.requests[0]?.body).toEqual({
      loginId: ' SYN-LOGIN-01 ',
      password: ' SYN-PW-VALUE-01 ',
    });
  });
});

describe('useLogin — 응답을 어떻게 가르는가', () => {
  it('200이면 세션을 넘기고 갈래를 세우지 않는다', async () => {
    const session = sessionBody();
    const stub = createStubFetch([sessionsRoute(() => jsonResponse(session))]);
    const { result, onSuccess } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(onSuccess).toHaveBeenCalledWith(session);
    expect(result.current.outcome).toBeNull();
  });

  it('401이면 불일치 갈래를 세우고 성공 되먹임을 부르지 않는다', async () => {
    const stub = createStubFetch([
      sessionsRoute(() => jsonResponse(loginFailureBody(), { status: 401 })),
    ]);
    const { result, onSuccess } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'mismatch' });
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('423이면 잠긴 갈래가 된다', async () => {
    const stub = createStubFetch([
      sessionsRoute(() => jsonResponse(errorResponseBody(), { status: 423 })),
    ]);
    const { result } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'locked' });
    });
  });

  /**
   * ⭐ **200인데 넘길 세션이 없으면 성공이 아니다.**
   *
   * 전례(`patterns/request.ts`)는 본문 없는 200을 **정상**으로 두는데 이 화면은 반대로 가른다 —
   * 여기서 통과시키면 세션을 보관하는 회차가 **빈 세션을 담고**, 앱은 「로그인했는데 누구인지
   * 모르는」 상태가 된다.
   *
   * **없는 본문의 모양이 둘**이라 둘 다 잰다 — 본문이 비었으면 `undefined`, JSON `null`이면
   * `null`이 온다(실측). 한쪽만 막으면 나머지가 그대로 성공으로 통과한다.
   */
  it.each([
    ['본문이 비었을 때', new Response('', { status: 200 })],
    ['본문이 JSON 널일 때', jsonResponse(null)],
  ])('200이어도 %s는 성공으로 다루지 않는다', async (_label, response) => {
    const stub = createStubFetch([sessionsRoute(() => response.clone())]);
    const { result, onSuccess } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'unknown', status: 200 });
    });

    /* ⭐ 본론은 이쪽이다 — 세션을 보관하는 회차가 이 자리를 밟는다. */
    expect(onSuccess).not.toHaveBeenCalled();
  });

  /**
   * 응답이 아예 없는 실패다. **상태 코드로 뭉뚱그리지 않는다** — 「서버가 거절했다」와
   * 「닿지 못했다」는 사용자가 할 수 있는 조치가 다르다.
   */
  it('응답이 오지 않으면 통신 실패 갈래가 된다', async () => {
    const failing: StubFetch = () => Promise.reject(new Error('연결할 수 없습니다'));
    const { result, onSuccess } = renderLogin(failing);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'network' });
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useLogin — 다시 시도', () => {
  /**
   * ⭐ **두 스텁 형태 — 호출 횟수에 따라 내용이 달라진다**(사본 체크리스트).
   *
   * 같은 응답을 되돌리는 스텁으로는 「다시 시도가 실제로 나갔다」를 잴 수 없다. 1회차 401 →
   * 2회차 200이라야 두 번째 요청이 **정말 새로 나갔고 그 답이 화면에 닿았음**이 증명된다.
   */
  it('1회차 401 뒤 2회차 200이면 갈래가 걷히고 세션이 온다', async () => {
    let calls = 0;
    const stub = createStubFetch([
      sessionsRoute(() => {
        calls += 1;

        return calls === 1
          ? jsonResponse(loginFailureBody(), { status: 401 })
          : jsonResponse(sessionBody());
      }),
    ]);
    const { result, onSuccess } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'mismatch' });
    });

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    expect(calls).toBe(2);
    expect(result.current.outcome).toBeNull();
  });

  it('나가는 동안 진행 표시가 서고 응답이 오면 걷힌다', async () => {
    const recording = createRecordingFetch([okRoute()], true);
    const { result } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(loginDraftFixture());
    });

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(true);
    });

    await act(async () => {
      recording.release();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });
});

describe('useLogin — resetIfIdle', () => {
  it('멈춰 있으면 갈래를 되돌린다', async () => {
    const stub = createStubFetch([
      sessionsRoute(() => jsonResponse(loginFailureBody(), { status: 401 })),
    ]);
    const { result } = renderLogin(stub);

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(result.current.outcome).toEqual({ kind: 'mismatch' });
    });

    act(() => {
      result.current.resetIfIdle();
    });

    expect(result.current.outcome).toBeNull();
  });

  /**
   * ⭐ **나가는 중인 요청은 건드리지 않는다**(사본 체크리스트 · `omf-mes#96`).
   *
   * 진행 중 mutation을 `reset()`하면 그 호출에 매달린 되먹임이 통째로 오지 않는다 —
   * 요청은 이미 서버에 갔는데 화면만 없던 일로 친다. 로그인에서 그것은 **세션이 만들어졌는데
   * 로그인되지 않은 화면**이다. 이 감지기가 그 길을 막는다.
   */
  it('나가는 중에 부르면 되먹임을 끊지 않는다', async () => {
    const recording = createRecordingFetch([okRoute()], true);
    const { result, onSuccess } = renderLogin(recording.fetch);

    act(() => {
      result.current.submit(loginDraftFixture());
    });
    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(true);
    });

    act(() => {
      result.current.resetIfIdle();
    });

    /* 되돌리지 않았으므로 여전히 나가는 중이다. */
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      recording.release();
      await Promise.resolve();
    });

    /* 응답이 도착하면 성공 되먹임이 그대로 온다 — 끊겼다면 여기서 멈춘다. */
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
