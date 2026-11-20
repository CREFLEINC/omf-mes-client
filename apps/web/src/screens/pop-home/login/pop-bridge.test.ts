import { afterEach, describe, expect, it } from 'vitest';

import { readOutboxSize, readWorkerDirectory, writeWorkerDirectory } from './pop-bridge';

/**
 * 셸 통로는 **던지지 않는다**(`pop-bridge.ts` 규약). 화면에서 부르는 자리가 그리기 도중이라
 * 거부가 그대로 새면 아무도 받지 않는 오류가 되고, 다음 오프라인 확인이 근거 없이 막히는데
 * 그 이유가 어디에도 남지 않는다.
 *
 * ⭐ **화면 시험으로는 이것을 잴 수 없다** — 거부가 새도 화면은 그저 아무 일도 하지 않아
 * 보여 시험이 통과한다. 그래서 함수를 직접 부른다.
 */
describe('셸 통로', () => {
  afterEach(() => {
    delete (globalThis as { pop?: unknown }).pop;
  });

  const failingBridge = () => {
    (globalThis as { pop?: unknown }).pop = {
      cache: {
        get: () => Promise.reject(new Error('통로 실패')),
        put: () => Promise.reject(new Error('통로 실패')),
      },
      outbox: { size: () => Promise.reject(new Error('통로 실패')) },
    };
  };

  it('큐를 세지 못하면 던지지 않고 0을 낸다', async () => {
    failingBridge();

    await expect(readOutboxSize()).resolves.toBe(0);
  });

  it('목록을 넣지 못하면 던지지 않고 실패를 알린다', async () => {
    failingBridge();

    await expect(writeWorkerDirectory(10, [], '2026-09-01T00:00:00Z')).resolves.toBe(false);
  });

  it('목록을 읽지 못하면 던지지 않고 «받은 적 없음»으로 본다', async () => {
    failingBridge();

    await expect(readWorkerDirectory(10)).resolves.toBeNull();
  });

  /** 통로가 없는 브라우저에서도 같은 약속이다 — 없다고 화면이 깨지지 않는다. */
  it('통로가 아예 없어도 던지지 않는다', async () => {
    await expect(readOutboxSize()).resolves.toBe(0);
    await expect(writeWorkerDirectory(null, [], '2026-09-01T00:00:00Z')).resolves.toBe(false);
    await expect(readWorkerDirectory(null)).resolves.toBeNull();
  });
});
