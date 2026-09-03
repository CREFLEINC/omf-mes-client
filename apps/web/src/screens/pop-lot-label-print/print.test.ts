import { describe, expect, it, vi } from 'vitest';

import { printAll, renditionShell, type PrintDeps, type PrintTarget } from './print';

/** LOT 라벨은 LOT 당 한 장이지만, 재출력이 같은 걸음을 쓰므로 목록 형태를 검증한다. */
const targets: PrintTarget[] = [
  { documentIssueLogId: 44001, label: 'LOT-2026-0804-0031' },
  { documentIssueLogId: 44002, label: 'LOT-2026-0804-0032' },
];

const okDeps = (): PrintDeps => ({
  fetchRendition: vi.fn(async () => new Uint8Array([1])),
  send: vi.fn(async () => undefined),
  report: vi.fn(async () => undefined),
});

describe('printAll — 인쇄 세 걸음', () => {
  it('장마다 그린 것을 받아 보내고 성공을 보고한다', async () => {
    const deps = okDeps();

    const outcome = await printAll(targets, deps);

    expect(outcome).toEqual({ ok: true, printed: 2 });
    expect(deps.fetchRendition).toHaveBeenCalledTimes(2);
    expect(deps.report).toHaveBeenNthCalledWith(1, 44001, null);
    expect(deps.report).toHaveBeenNthCalledWith(2, 44002, null);
  });

  it('보내기가 실패하면 그 자리에서 멈추고 실패를 보고한다', async () => {
    const deps: PrintDeps = {
      ...okDeps(),
      send: vi.fn(async () => {
        throw new Error('프린터 오프라인');
      }),
    };

    const outcome = await printAll(targets, deps);

    expect(outcome).toEqual({
      ok: false,
      printed: 0,
      failedAt: targets[0],
      reason: '프린터 오프라인',
    });
    expect(deps.report).toHaveBeenCalledTimes(1);
    expect(deps.report).toHaveBeenCalledWith(44001, '프린터 오프라인');
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it('앞 장이 나간 뒤 실패하면 나간 장수를 그대로 센다 — 멈춘 자리를 감추지 않는다', async () => {
    const send = vi
      .fn<PrintDeps['send']>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('용지 걸림'));
    const deps: PrintDeps = { ...okDeps(), send };

    const outcome = await printAll(targets, deps);

    expect(outcome).toMatchObject({ ok: false, printed: 1, reason: '용지 걸림' });
  });

  it('그린 것을 받지 못해도 실패로 보고한다 — 조용히 건너뛰지 않는다', async () => {
    const deps: PrintDeps = {
      ...okDeps(),
      fetchRendition: vi.fn(async () => {
        throw new Error('불러오지 못함');
      }),
    };

    const outcome = await printAll(targets, deps);

    expect(outcome).toMatchObject({ ok: false, printed: 0 });
    expect(deps.report).toHaveBeenCalledWith(44001, '불러오지 못함');
  });

  it('실패 보고까지 실패해도 결과는 실패다 — 원인은 앞의 실패다', async () => {
    const deps: PrintDeps = {
      ...okDeps(),
      send: vi.fn(async () => {
        throw new Error('프린터 오프라인');
      }),
      report: vi.fn(async () => {
        throw new Error('보고 실패');
      }),
    };

    const outcome = await printAll(targets, deps);

    expect(outcome).toMatchObject({ ok: false, reason: '프린터 오프라인' });
  });

  it('성공 보고가 실패하면 종이는 세되 실패로 남긴다 — 서버에 PENDING 으로 남는다', async () => {
    const deps: PrintDeps = {
      ...okDeps(),
      report: vi.fn(async () => {
        throw new Error('보고 실패');
      }),
    };

    const outcome = await printAll([targets[0] as PrintTarget], deps);

    expect(outcome).toMatchObject({ ok: false, printed: 1, reason: '보고 실패' });
  });

  it('보낼 것이 없으면 아무것도 하지 않는다', async () => {
    const deps = okDeps();

    expect(await printAll([], deps)).toEqual({ ok: true, printed: 0 });
    expect(deps.fetchRendition).not.toHaveBeenCalled();
  });
});

describe('renditionShell — 셸 통로', () => {
  it('셸이 없으면 null 이다 — 지어내지 않는다', () => {
    expect(renditionShell()).toBeNull();
  });

  it('셸이 있으면 그 통로를 돌려준다', () => {
    const save = vi.fn(async () => '/tmp/label.png');
    Object.defineProperty(window, 'pop', {
      value: { rendition: { save } },
      configurable: true,
    });

    expect(renditionShell()?.save).toBe(save);

    Reflect.deleteProperty(window, 'pop');
  });
});
