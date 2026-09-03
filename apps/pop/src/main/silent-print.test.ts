import { describe, expect, it, vi } from 'vitest';

import type { Rendition } from './print';
import {
  type AvailablePrinter,
  type PrintPage,
  type SilentPrintDeps,
  createSilentPrinter,
  selectPrinter,
} from './silent-print';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const label: Rendition = { bytes: PNG, format: 'png', label: 'LOT-0001' };

const printer = (name: string, extra: Partial<AvailablePrinter> = {}): AvailablePrinter => ({
  name,
  ...extra,
});

describe('프린터 선택 — 못 고르면 보내지 않는다', () => {
  it('지정한 이름이 있으면 그것을 쓴다', () => {
    expect(selectPrinter([printer('A'), printer('B')], 'B')).toBe('B');
  });

  it('보이는 이름으로 지정해도 찾아내되 드라이버 이름을 돌려준다', () => {
    expect(selectPrinter([printer('ZD421_1', { displayName: '라벨기 1호' })], '라벨기 1호')).toBe(
      'ZD421_1',
    );
  });

  // ⛔ 이 항목이 「엉뚱한 프린터에서 라벨이 나오는 것」을 막는다. 종이는 나오는 즉시 자재에
  //    붙어 되돌릴 수 없다 — 지정한 장치가 없으면 인쇄하지 않는 편이 낫다.
  it('지정한 이름이 목록에 없으면 다른 프린터로 대신 보내지 않는다', () => {
    expect(selectPrinter([printer('A', { isDefault: true }), printer('B')], '없는프린터')).toBe(
      null,
    );
  });

  it('지정이 없으면 OS 기본 프린터를 쓴다', () => {
    expect(selectPrinter([printer('A'), printer('B', { isDefault: true })])).toBe('B');
  });

  it('빈 지정은 지정하지 않은 것으로 본다 — 환경변수가 비어 있을 때다', () => {
    expect(selectPrinter([printer('A', { isDefault: true })], '   ')).toBe('A');
  });

  it('기본이 없어도 한 대뿐이면 그것을 쓴다', () => {
    expect(selectPrinter([printer('A')])).toBe('A');
  });

  it('여러 대인데 기본도 지정도 없으면 고르지 않는다', () => {
    expect(selectPrinter([printer('A'), printer('B')])).toBe(null);
  });

  it('프린터가 없으면 null', () => {
    expect(selectPrinter([])).toBe(null);
  });
});

function fakeDeps(page: Partial<PrintPage> = {}): {
  deps: SilentPrintDeps;
  page: PrintPage;
  discarded: string[];
} {
  const discarded: string[] = [];
  const built: PrintPage = {
    load: vi.fn(async () => undefined),
    print: vi.fn(async () => undefined),
    close: vi.fn(),
    ...page,
  };

  return {
    page: built,
    discarded,
    deps: {
      openPage: () => built,
      stage: async (_bytes, format) => ({
        path: `/tmp/job.${format}`,
        url: `file:///tmp/job.${format}`,
      }),
      discard: async (path) => void discarded.push(path),
    },
  };
}

describe('무음 인쇄', () => {
  it('띄운 뒤에 인쇄한다 — 그리기 전에 보내면 빈 종이가 나온다', async () => {
    const order: string[] = [];
    const { deps } = fakeDeps({
      load: async () => void order.push('load'),
      print: async () => void order.push('print'),
    });

    await createSilentPrinter(deps).print('ZD421', label);
    expect(order).toEqual(['load', 'print']);
  });

  it('형식에 맞는 확장자로 떨어뜨린 파일을 띄운다', async () => {
    const { deps, page } = fakeDeps();
    await createSilentPrinter(deps).print('ZD421', label);
    expect(page.load).toHaveBeenCalledWith('file:///tmp/job.png');
    expect(page.print).toHaveBeenCalledWith('ZD421', 'LOT-0001');
  });

  // ⚠ 키오스크는 재시작 없이 며칠씩 돈다. 실패마다 창·파일이 남으면 그 단말이 느려진다.
  it('인쇄가 실패해도 창을 닫고 임시 파일을 지운다', async () => {
    const { deps, page, discarded } = fakeDeps({
      print: async () => {
        throw new Error('프린터 오프라인');
      },
    });

    await expect(createSilentPrinter(deps).print('ZD421', label)).rejects.toThrow('프린터 오프라인');
    expect(page.close).toHaveBeenCalled();
    expect(discarded).toEqual(['/tmp/job.png']);
  });

  it('임시 파일 정리가 실패해도 인쇄 성공을 뒤집지 않는다 — 종이는 이미 나왔다', async () => {
    const { deps } = fakeDeps();
    const failing: SilentPrintDeps = {
      ...deps,
      discard: async () => {
        throw new Error('파일이 잠겨 있다');
      },
    };

    await expect(createSilentPrinter(failing).print('ZD421', label)).resolves.toBeUndefined();
  });
});
