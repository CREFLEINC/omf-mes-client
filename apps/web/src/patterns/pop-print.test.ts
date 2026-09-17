import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasPrintBridge, renditionShell, sendToPrinter } from './pop-print';

/**
 * 셸 통로의 감지기.
 *
 * ⭐ **가장 중요한 갈래는 「없다」와 「실패했다」의 구분이다.** 관리웹 브라우저에는 통로가 없고
 *    그것은 오류가 아니다. 그때 인쇄를 성공으로 접으면 **나오지 않은 라벨이 나온 것으로
 *    남는다**(공유계약 F-6) — 계약이 인쇄 보고 경로를 따로 둔 까닭이다.
 *
 * ⚠ 이 구획은 `packing-label-reprint/print.test.ts` 에 있던 것을 옮겨 왔다. 통로 선언이
 *   화면마다 흩어져 있던 때의 자리이고, 지금은 이 파일이 그 통로를 소유한다.
 */

const installShell = (save: (...args: never[]) => Promise<string>): void => {
  Object.defineProperty(window, 'pop', {
    value: { rendition: { save } },
    configurable: true,
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'pop');
});

describe('셸 통로 집기', () => {
  it('셸이 없으면 null 이다 — 지어내지 않는다', () => {
    expect(renditionShell()).toBeNull();
    expect(hasPrintBridge()).toBe(false);
  });

  it('셸이 있으면 그 통로를 돌려준다', () => {
    const save = vi.fn(async () => '/tmp/label.png');
    installShell(save);

    expect(renditionShell()?.save).toBe(save);
    expect(hasPrintBridge()).toBe(true);
  });

  /*
   * ⛔ **반쯤 열린 통로를 「있다」로 받지 않는다.** preload 가 심는 도중이거나 다른 셸 판이면
   *    `pop` 은 있는데 `rendition.save` 가 없을 수 있다 — 그것을 통로로 받으면 부르는 자리에서
   *    터지고, 화면은 「인쇄 실패」가 아니라 깨진 오류를 보인다.
   */
  it('`save` 가 함수가 아니면 통로가 아니다', () => {
    Object.defineProperty(window, 'pop', { value: {}, configurable: true });
    expect(renditionShell()).toBeNull();

    Object.defineProperty(window, 'pop', { value: { rendition: {} }, configurable: true });
    expect(renditionShell()).toBeNull();

    Object.defineProperty(window, 'pop', {
      value: { rendition: { save: '함수가 아니다' } },
      configurable: true,
    });
    expect(renditionShell()).toBeNull();
  });
});

describe('프린터로 보내기', () => {
  it('보낸 것을 그대로 넘기고 성공을 돌려준다', async () => {
    const save = vi.fn(async () => '/tmp/label.png');
    installShell(save);

    const bytes = new Uint8Array([1, 2, 3]);
    const attempt = await sendToPrinter(bytes, 'lot-1', 'png');

    expect(attempt).toEqual({ kind: 'printed' });
    expect(save).toHaveBeenCalledTimes(1);

    const [sentBytes, label, now, format] = save.mock.calls[0] as unknown as [
      Uint8Array,
      string,
      string,
      string,
    ];
    expect(sentBytes).toBe(bytes);
    expect(label).toBe('lot-1');
    expect(format).toBe('png');
    /* 시각은 셸이 파일 이름에 쓴다 — 읽을 수 있는 시각이어야 한다. */
    expect(Number.isNaN(Date.parse(now))).toBe(false);
  });

  /*
   * ⛔⛔ **통로가 없는 것을 성공으로 접지 않는다.** 이 한 줄이 「나오지 않은 라벨이 나온 것으로
   *    남는」 일을 막는다. 부르는 쪽은 이 값을 보고 서버에 인쇄 실패를 보고한다.
   */
  it('통로가 없으면 «시도하지 않았다»를 돌려준다 — 성공도 실패도 아니다', async () => {
    expect(await sendToPrinter(new Uint8Array([1]), 'lot-1', 'png')).toEqual({ kind: 'noBridge' });
  });

  it('셸이 던지면 실패로 돌려준다 — 던지지 않는다', async () => {
    installShell(vi.fn(async () => Promise.reject(new Error('프린터를 찾을 수 없습니다'))));

    await expect(sendToPrinter(new Uint8Array([1]), 'lot-1', 'tspl')).resolves.toEqual({
      kind: 'failed',
      reason: '프린터를 찾을 수 없습니다',
    });
  });

  /* 셸이 무엇을 던질지 우리가 정하지 않는다 — IPC 너머에서 온 값은 Error 가 아닐 수 있다. */
  it('Error 가 아닌 것을 던져도 사유를 남긴다', async () => {
    installShell(
      vi.fn(async () => {
        throw '문자열을 던졌다';
      }),
    );

    await expect(sendToPrinter(new Uint8Array([1]), 'lot-1', 'png')).resolves.toEqual({
      kind: 'failed',
      reason: '문자열을 던졌다',
    });
  });

  /*
   * ⚠ **사유 길이에 상한이 있다** — 계약의 인쇄 보고 본문이 500자를 받는다. 넘겨 보내면
   *   보고 자체가 400 으로 되돌아와, 인쇄 실패에 더해 **기록조차 남지 않는다.**
   */
  it('사유가 길면 계약이 받는 길이로 자른다', async () => {
    installShell(vi.fn(async () => Promise.reject(new Error('가'.repeat(900)))));

    const attempt = await sendToPrinter(new Uint8Array([1]), 'lot-1', 'png');

    expect(attempt.kind).toBe('failed');
    expect(attempt.kind === 'failed' && attempt.reason.length).toBe(500);
  });
});
