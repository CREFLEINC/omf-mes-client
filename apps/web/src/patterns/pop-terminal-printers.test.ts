import { afterEach, describe, expect, it, vi } from 'vitest';

import { shellPrintsRaw, terminalPrinters } from './pop-terminal-printers';

/**
 * **셸이 명령형(RAW) 인쇄를 할 수 있는가**를 묻는 자리. 이 판정이 형식(`tspl`·`png`)을 가른다 —
 * 틀리면 인쇄가 「보낼 프린터를 찾을 수 없다」로 멎고 라벨을 붙이지 못해 다음 걸음이 막힌다
 * (WIP-CHAIN-01 D6 실측 · macOS 셸).
 */
const withShell = (printers: Record<string, unknown>): void => {
  Object.defineProperty(window, 'pop', { configurable: true, value: { printers } });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'pop');
});

describe('셸의 명령형 인쇄 가능 여부', () => {
  it('셸이 할 수 있다고 하면 참이다', async () => {
    withShell({ capabilities: vi.fn().mockResolvedValue({ raw: true }) });

    await expect(shellPrintsRaw()).resolves.toBe(true);
  });

  it('셸이 못 한다고 하면 거짓이다', async () => {
    withShell({ capabilities: vi.fn().mockResolvedValue({ raw: false }) });

    await expect(shellPrintsRaw()).resolves.toBe(false);
  });

  /* 브라우저로 연 관리자 웹이다 — 통로 자체가 없다. */
  it('통로가 없으면 거짓이다', async () => {
    await expect(shellPrintsRaw()).resolves.toBe(false);
  });

  /*
   * ⛔ **모르면 「없다」로 본다.** 이 물음을 모르는 옛 설치본에서 참으로 보면 명령형을 받아
   *    인쇄가 통째로 멎는다 — 그림은 어느 길로도 찍힌다.
   */
  it('이 물음을 모르는 옛 셸이면 거짓이다', async () => {
    withShell({ list: vi.fn() });

    await expect(shellPrintsRaw()).resolves.toBe(false);
  });

  it('묻다가 실패해도 거짓이다 — 인쇄를 멈추지 않는다', async () => {
    withShell({ capabilities: vi.fn().mockRejectedValue(new Error('통로 끊김')) });

    await expect(shellPrintsRaw()).resolves.toBe(false);
  });
});

describe('단말 프린터 목록', () => {
  /* 빈 배열(프린터 없음)과 null(여기서는 알 수 없음)을 가르는 성질은 그대로다. */
  it('통로가 없으면 null 이다', async () => {
    await expect(terminalPrinters()).resolves.toBeNull();
  });

  it('통로가 있으면 목록을 옮긴다', async () => {
    withShell({
      list: vi.fn().mockResolvedValue({
        printers: [{ name: 'LABEL-1', displayName: '라벨 1호' }],
        target: 'LABEL-1',
      }),
    });

    await expect(terminalPrinters()).resolves.toEqual([
      expect.objectContaining({ printerName: 'LABEL-1', displayName: '라벨 1호', isDefault: true }),
    ]);
  });
});
