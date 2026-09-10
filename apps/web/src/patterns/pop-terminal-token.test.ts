import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createApiClient } from '@omf-mes/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentTerminalToken, forgetTerminalToken, readTerminalToken } from './pop-terminal-token';

/** 셸이 여는 통로를 흉내 낸다. `get` 이 무엇을 하는지만 시험이 정한다. */
const putBridge = (get: () => Promise<string | undefined>): void => {
  (globalThis as { pop?: unknown }).pop = { deviceToken: { get } };
};

afterEach(() => {
  delete (globalThis as { pop?: unknown }).pop;
  forgetTerminalToken();
});

describe('셸이 보관한 단말 토큰을 읽는다 — #999', () => {
  it('읽어 두면 그 값을 요청 자리에서 꺼낼 수 있다', async () => {
    putBridge(async () => 'terminal.token.value');

    await readTerminalToken();

    expect(currentTerminalToken()).toBe('terminal.token.value');
  });

  it('셸 밖(브라우저·관리웹)에서는 통로가 없어 토큰이 없다', async () => {
    expect(await readTerminalToken()).toBeNull();
    expect(currentTerminalToken()).toBeNull();
  });

  it('통로 모양이 아니면 없는 것으로 본다', async () => {
    (globalThis as { pop?: unknown }).pop = { rendition: { save: () => undefined } };

    expect(await readTerminalToken()).toBeNull();
  });

  it('보관된 것이 없으면 빈 문자열이 아니라 null 이다', async () => {
    putBridge(async () => undefined);

    expect(await readTerminalToken()).toBeNull();
  });

  it('빈 문자열도 토큰으로 치지 않는다', async () => {
    putBridge(async () => '');

    expect(await readTerminalToken()).toBeNull();
  });

  /*
   * ⛔ 자격증명 저장소를 쓸 수 없는 단말에서도 **기동은 막지 않는다** — 여기서 던지면
   *    화면이 아예 서지 않아 무엇이 잘못됐는지 볼 창구까지 사라진다.
   */
  it('읽기가 실패해도 던지지 않는다', async () => {
    putBridge(async () => {
      throw new Error('자격증명 저장소를 쓸 수 없다');
    });

    await expect(readTerminalToken()).resolves.toBeNull();
  });

  it('한 번 읽은 값은 다음 읽기가 실패하면 남지 않는다', async () => {
    putBridge(async () => 'first.token');
    await readTerminalToken();

    putBridge(async () => {
      throw new Error('통로가 끊겼다');
    });
    await readTerminalToken();

    expect(currentTerminalToken()).toBeNull();
  });
});

describe('읽어 둔 토큰이 실제로 요청에 실린다 — #999', () => {
  const callWithClient = async (): Promise<Headers> => {
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: 'http://localhost',
      authToken: currentTerminalToken,
      fetch: async (request: Request) => {
        seen.push(request);

        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });

    /* 어느 경로든 상관없다 — 재는 것은 «헤더가 붙는가» 하나다. 계약에 실제로 있는 것을 골라
       타입 우회(`as never`)를 두지 않는다. */
    await client.client.GET('/mdm/code-groups');

    return seen[0]!.headers;
  };

  it('토큰을 읽어 두면 Authorization 헤더가 붙는다', async () => {
    putBridge(async () => 'terminal.token.value');
    await readTerminalToken();

    expect((await callWithClient()).get('Authorization')).toBe('Bearer terminal.token.value');
  });

  it('토큰이 없으면 헤더를 붙이지 않는다 — 관리웹이 그대로 도는 자리다', async () => {
    await readTerminalToken();

    expect((await callWithClient()).has('Authorization')).toBe(false);
  });
});

/* 시험이 서로의 값을 물려받지 않는지 확인한다. */
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * 위 시험은 **직접 만든 클라이언트**로 잰다 — 그래서 「배선이 실제로 되어 있는가」는
 * 재지 못한다. 앱이 쓰는 클라이언트(`app/api.ts`)는 불러들이는 순간 만들어지고 `fetch` 를
 * 나중에 갈아 끼울 수 없어, 헤더를 실제로 붙이는지 시험에서 부를 방법이 없다.
 *
 * ⛔ **그 자리를 비워 두면 배선이 조용히 빠진다.** 토큰 공급자를 넘기는 한 줄이 사라져도
 *    위 시험은 전부 초록이고, 현장 단말만 인증 없이 요청을 보낸다. 그래서 소스를 읽어
 *    잰다 — 같은 사정을 `app/pop-dev-guard.test.ts` 가 먼저 만나 같은 방법으로 풀었다.
 *
 * ⚠ 표기를 나눠 쓰면 이 검사를 지나간다. 막으려는 것은 우회가 아니라 실수다.
 */
describe('앱이 쓰는 클라이언트에 토큰 공급자가 실제로 물려 있다 — #999', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/app/api.ts'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//gu,
    '',
  );

  it('createApiClient 가 단말 토큰 공급자를 받는다', () => {
    expect(source).toContain('authToken: currentTerminalToken');
  });
});
