import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PopRegistrationProvider,
  usePopRegistration,
  type PopRegistration,
} from './pop-registration';
import { forgetTerminalToken } from './pop-terminal-token';
import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';

/**
 * 등록 상태 기계가 **갈래마다 다르게 움직이는지** 잰다.
 *
 * ⭐ **왜 이 자리에 감지기가 필요한가.** 이 흐름은 타입 검사와 화면 시험이 전부 초록인 채
 * 깨질 수 있다 — 실제로 그랬다. 큐 보존 판정이 언제나 「신원이 안 바뀐다」로 떨어져 **한 번도
 * 작동하지 않았고**(리뷰 지적), 그 사이 전체 시험 19,287건이 초록이었다. 판정이 한 시점의
 * 값이 아니라 **상태 전이**에 걸려 있어, 전이를 실제로 밟지 않는 시험으로는 잡히지 않는다.
 */

/** `sub` 만 담은 토큰. 서명은 검증되지 않으므로 자리만 채운다. */
const tokenFor = (sub: number): string =>
  `header.${btoa(JSON.stringify({ sub, kind: 'terminal' })).replace(/=+$/, '')}.signature`;

const TOKEN_A = tokenFor(1001);
const TOKEN_B = tokenFor(2002);

interface TerminalRow {
  terminalId: number;
  plantId: number;
}

/** 단말 단건과 자기 공정 목록 — 등록이 부르는 요청은 이 둘뿐이다. */
const stubFor = (rows: TerminalRow[]) =>
  createStubFetch([
    {
      match: (request) => /\/mdm\/terminals\/\d+\/processes(\?|$)/.test(request.url),
      respond: () => jsonResponse({ items: [{ processId: 1001, processName: '사출' }] }),
    },
    {
      match: (request) => /\/mdm\/terminals\/\d+(\?|$)/.test(request.url),
      respond: (request) => {
        const id = Number(/\/mdm\/terminals\/(\d+)/.exec(request.url)?.[1]);
        const row = rows.find((candidate) => candidate.terminalId === id);

        /* 없는 단말·위조·만료는 계약이 401 로 묶는다(F-4). */
        return row === undefined
          ? jsonResponse({ message: '없다' }, { status: 401 })
          : jsonResponse({
              terminalId: row.terminalId,
              terminalCode: `POP-${String(row.terminalId)}`,
              terminalTypeCode: 'POP',
              plantId: row.plantId,
              isActive: true,
            });
      },
    },
  ]);

/** 셸 통로를 흉내 낸다 — 미전송 건수와 토큰 보관이 판정에 든다. */
const putShell = (pendingCount: number): void => {
  (globalThis as { pop?: unknown }).pop = {
    deviceToken: { get: async () => undefined, set: async () => undefined },
    outbox: { size: async () => pendingCount },
  };
};

/**
 * 등록 객체를 시험이 들고 있게 한다.
 *
 * 훅 전용 하네스는 프로바이더를 갈아 끼우지 못해, 화면 하네스 안에 탐침을 세우고 그 탐침이
 * 매 렌더의 값을 바깥 상자에 넣는다.
 */
const openRegistration = (rows: TerminalRow[]): { current: PopRegistration } => {
  const box = { current: null as PopRegistration | null };

  const Probe = () => {
    box.current = usePopRegistration();

    return null;
  };

  renderWithProviders(
    <PopRegistrationProvider>
      <Probe />
    </PopRegistrationProvider>,
    { fetch: stubFor(rows), session: null },
  );

  return box as { current: PopRegistration };
};

/** 등록을 끝까지 밟는다 — 여러 시험이 「이미 등록된 상태」에서 시작한다. */
const register = async (registration: { current: PopRegistration }, token: string) => {
  await act(async () => {
    await registration.current.verify(token);
  });
  await act(async () => {
    await registration.current.apply();
  });
  await waitFor(() => expect(registration.current.phase).toBe('ready'));
};

afterEach(() => {
  delete (globalThis as { pop?: unknown }).pop;
  forgetTerminalToken();
});

describe('POP 단말 등록 — 상태 전이', () => {
  it('붙여넣기 → 검증 → 적용 → 준비까지 가면 업무로 넘어간다', async () => {
    putShell(0);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify(TOKEN_A);
    });

    /* 검증만으로 업무를 열지 않는다 — 설치 담당자가 단말 코드를 확인해야 한다(F-4). */
    expect(registration.current.phase).toBe('verified');
    expect(registration.current.terminal?.terminalCode).toBe('POP-1001');

    await act(async () => {
      await registration.current.apply();
    });

    await waitFor(() => expect(registration.current.phase).toBe('ready'));
    expect(registration.current.processes).toHaveLength(1);
  });

  /**
   * ⛔ **이 시험이 리뷰가 잡은 Blocker 를 고정한다.** 판정 기준점을 `state` 로 두면 `verify()` 가
   * 상태를 갈아엎는 탓에 **언제나 통과**해, 미전송 기록이 다른 단말 앞으로 전송된다(F-4).
   */
  it('⛔ 다른 단말로 바꾸는데 미전송이 남아 있으면 적용을 막는다', async () => {
    putShell(3);
    const registration = openRegistration([
      { terminalId: 1001, plantId: 10 },
      { terminalId: 2002, plantId: 10 },
    ]);

    await register(registration, TOKEN_A);

    await act(() => {
      registration.current.restart();
    });
    await act(async () => {
      await registration.current.verify(TOKEN_B);
    });
    await act(async () => {
      await registration.current.apply();
    });

    expect(registration.current.failure).toBe('queue-blocked');
    expect(registration.current.pendingCount).toBe(3);
    expect(registration.current.phase).not.toBe('ready');
  });

  it('같은 단말 재등록은 미전송이 남아 있어도 막지 않는다 — 큐는 새 토큰으로 그대로 간다', async () => {
    putShell(3);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await register(registration, TOKEN_A);

    await act(() => {
      registration.current.restart();
    });
    await register(registration, TOKEN_A);

    expect(registration.current.failure).toBeNull();
  });

  it('없는 단말·폐기된 세대는 재발급 안내로 떨어진다', async () => {
    putShell(0);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify(TOKEN_B);
    });

    expect(registration.current.failure).toBe('rejected');
    expect(registration.current.phase).toBe('unregistered');
  });

  /**
   * ⛔⛔ **넣지도 않은 토큰의 부고를 전하지 않는다**(#1137).
   *
   * 켤 때 보관된 토큰을 스스로 확인하는데(`app/pop-main` 의 `PopRegistrationGate`), 그 실패가
   * 입력란이 «빈» 등록 화면에 그대로 떴다 — 설치 담당자는 한 글자도 넣지 않고 「이 토큰은 더
   * 이상 쓸 수 없습니다」를 받았다(실측 2026-09-12 · 사용자 지적 · 실서버 설치본).
   *
   * ⚠ 여기서 재는 것은 **판정이 누구 이야기인가**다. 문구 자체는 화면이 고르고, 이 자리는 그
   *   화면이 고를 수 있게 하는 값을 잰다.
   */
  it('보관된 토큰이 걸러지면 그 판정이 사람이 넣은 값의 것이 아님을 밝힌다', async () => {
    putShell(0);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify(TOKEN_B, 'stored');
    });

    expect(registration.current.failure).toBe('rejected');
    expect(registration.current.failureSource).toBe('stored');
  });

  it('사람이 붙여넣은 값의 판정은 보관 토큰 이야기로 새지 않는다', async () => {
    putShell(0);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify(TOKEN_B);
    });

    expect(registration.current.failureSource).toBe('entered');
  });

  /**
   * ⛔⛔ **거절당한 보관 토큰을 남겨 두지 않는다**(#1137 ②). 남기면 껐다 켤 때마다 같은
   *    실패가 되풀이되고, 화면은 매번 아무도 넣지 않은 토큰의 부고를 전한다.
   */
  it('서버가 보관 토큰을 거절하면 그 자리에서 버린다', async () => {
    putShell(0);
    const written: string[] = [];
    (globalThis as { pop?: unknown }).pop = {
      deviceToken: {
        get: async () => TOKEN_B,
        set: async (value: string) => {
          written.push(value);
        },
      },
      outbox: { size: async () => 0 },
    };

    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify(TOKEN_B, 'stored');
    });

    expect(written).toEqual(['']);
  });

  /**
   * ⛔⛔ **닿지 못한 것은 버리지 않는다.** 잠깐 망이 끊긴 사이에 멀쩡한 토큰을 지우면 설치
   *    담당자를 현장으로 다시 불러야 한다 — 판정과 못 물어본 것은 다르다.
   */
  it('서버에 닿지 못했으면 보관 토큰을 버리지 않는다', async () => {
    const written: string[] = [];
    (globalThis as { pop?: unknown }).pop = {
      deviceToken: {
        get: async () => TOKEN_A,
        set: async (value: string) => {
          written.push(value);
        },
      },
      outbox: { size: async () => 0 },
    };

    const box = { current: null as PopRegistration | null };
    const Probe = () => {
      box.current = usePopRegistration();

      return null;
    };

    renderWithProviders(
      <PopRegistrationProvider>
        <Probe />
      </PopRegistrationProvider>,
      {
        fetch: () => Promise.reject(new TypeError('Failed to fetch')),
        session: null,
      },
    );

    const registration = box as { current: PopRegistration };

    await act(async () => {
      await registration.current.verify(TOKEN_A, 'stored');
    });

    expect(registration.current.failure).toBe('unreachable');
    expect(written).toEqual([]);
  });

  it('토큰 모양이 아니면 서버에 묻지 않는다 — 붙여넣기 실수를 등록 시도로 만들지 않는다', async () => {
    putShell(0);
    const registration = openRegistration([{ terminalId: 1001, plantId: 10 }]);

    await act(async () => {
      await registration.current.verify('붙여넣기-실수');
    });

    expect(registration.current.failure).toBe('malformed');
  });

  /**
   * ⭐ **서버에 닿지 못한 것과 거절당한 것을 가른다.** 사람이 할 일이 다르다 — 하나는 연결
   * 확인이고 하나는 재발급이다. 실 서버 설치본이 CORS 로 막혔을 때 화면이 「이 토큰은 더
   * 이상 쓸 수 없습니다」를 말해, 담당자가 멀쩡한 토큰을 몇 번씩 다시 발급받았다(실측
   * 2026-09-12 · 사용자 지적).
   */
  it('응답이 아예 없으면 토큰을 의심하지 않는다 — 연결 실패는 거절이 아니다', async () => {
    putShell(0);
    const box = { current: null as PopRegistration | null };

    const Probe = () => {
      box.current = usePopRegistration();

      return null;
    };

    renderWithProviders(
      <PopRegistrationProvider>
        <Probe />
      </PopRegistrationProvider>,
      /* 브라우저가 요청을 막았을 때와 같다 — 응답이 없고 fetch 자체가 던진다. */
      { fetch: () => Promise.reject(new TypeError('Failed to fetch')), session: null },
    );

    const registration = box as { current: PopRegistration };

    await act(async () => {
      await registration.current.verify(TOKEN_A);
    });

    expect(registration.current.failure).toBe('unreachable');
  });

  /**
   * ⭐ **403 갈래가 실제로 선다.** 오류에서 `status` 를 바로 읽던 동안 이 갈래는 한 번도
   * 서지 못했다 — 요청 경로가 정규화된 봉투를 던져 그 자리에 `status` 가 없기 때문이다.
   *
   * ⛔ **몸통을 계약 모양(`errors[]`)으로 낸다.** 계약에 없는 `{ message }` 로 재면 정규화가
   *    상태 코드를 그대로 들고 와 갈래가 서는 것처럼 보인다 — 실제 서버 응답은 봉투라
   *    거기서 상태가 접혀 사라지고, 감지기만 초록인 채 갈래는 죽어 있다(리뷰 2회차 실측).
   */
  it('다른 단말을 가리키면 거절이 아니라 「남의 토큰」이다', async () => {
    putShell(0);
    const box = { current: null as PopRegistration | null };

    const Probe = () => {
      box.current = usePopRegistration();

      return null;
    };

    renderWithProviders(
      <PopRegistrationProvider>
        <Probe />
      </PopRegistrationProvider>,
      {
        fetch: createStubFetch([
          {
            match: (request) => /\/mdm\/terminals\/\d+(\?|$)/.test(request.url),
            respond: () =>
              jsonResponse(
                { errors: [{ scope: 'screen', code: 'FORBIDDEN', message: '남의 단말' }] },
                { status: 403 },
              ),
          },
        ]),
        session: null,
      },
    );

    const registration = box as { current: PopRegistration };

    await act(async () => {
      await registration.current.verify(TOKEN_A);
    });

    expect(registration.current.failure).toBe('foreign');
  });
});
