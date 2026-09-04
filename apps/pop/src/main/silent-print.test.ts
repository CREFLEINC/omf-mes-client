import { describe, expect, it, vi } from 'vitest';

import type { Rendition } from './print';
import {
  type AvailablePrinter,
  type PrintPage,
  PrintTimeoutError,
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

describe('어디로 보낼지 정한다', () => {
  it('지정한 이름이 있으면 그것을 쓴다', () => {
    expect(selectPrinter([printer('A'), printer('B')], 'B')).toEqual({
      kind: 'named',
      deviceName: 'B',
    });
  });

  it('보이는 이름으로 지정해도 찾아내되 드라이버 이름을 돌려준다', () => {
    expect(
      selectPrinter([printer('ZD421_1', { displayName: '라벨기 1호' })], '라벨기 1호'),
    ).toEqual({ kind: 'named', deviceName: 'ZD421_1' });
  });

  // ⛔ 이 항목이 「엉뚱한 프린터에서 라벨이 나오는 것」을 막는다. 종이는 나오는 즉시 자재에
  //    붙어 되돌릴 수 없다 — 지정한 장치가 없으면 인쇄하지 않는 편이 낫다.
  it('지정한 이름이 목록에 없으면 다른 프린터로 대신 보내지 않는다', () => {
    expect(selectPrinter([printer('A'), printer('B')], '없는프린터')).toEqual({ kind: 'none' });
  });

  /*
   * ⭐ 이 묶음이 실기에서 인쇄를 막았던 결함을 문다. 종전 판은 목록에서 「기본」 표시를
   *    찾았는데 Electron 의 프린터 정보에는 그런 항목이 없어 **언제나 못 찾았고**, 기본
   *    프린터를 제대로 지정한 단말에서도 전부 막혔다.
   */
  it('지정이 없으면 OS 기본 프린터에 맡긴다', () => {
    expect(selectPrinter([printer('A'), printer('B'), printer('C')])).toEqual({
      kind: 'systemDefault',
    });
  });

  it('빈 지정은 지정하지 않은 것으로 본다 — 환경변수가 비어 있을 때다', () => {
    expect(selectPrinter([printer('A')], '   ')).toEqual({ kind: 'systemDefault' });
  });

  it('프린터가 하나도 없으면 보내지 않는다', () => {
    expect(selectPrinter([])).toEqual({ kind: 'none' });
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
        filePath: `/tmp/job.${format}`,
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

    await expect(createSilentPrinter(deps).print('ZD421', label)).rejects.toThrow(
      '프린터 오프라인',
    );
    expect(page.close).toHaveBeenCalled();
    expect(discarded).toEqual(['/tmp/job.png']);
  });

  // ⚠ 창 열기가 던지는 경로. 종전 판은 이 자리에서만 임시 파일이 남았다.
  it('창을 열지 못해도 임시 파일을 지운다', async () => {
    const { deps, discarded } = fakeDeps();
    const failing: SilentPrintDeps = {
      ...deps,
      openPage: () => {
        throw new Error('창 생성 실패');
      },
    };

    await expect(createSilentPrinter(failing).print('ZD421', label)).rejects.toThrow(
      '창 생성 실패',
    );
    expect(discarded).toEqual(['/tmp/job.png']);
  });

  // ⛔ 이 묶음이 「인쇄 중에 갇히는 화면」을 막는다. 프린터를 껐다 켜는 중이면 콜백이 영영
  //    오지 않고, 상한이 없으면 사용자는 성공도 실패도 보지 못한 채 아무것도 할 수 없다.
  it('프린터가 응답하지 않으면 상한에서 끊고 실패로 만든다', async () => {
    const { deps, page, discarded } = fakeDeps({ print: () => new Promise(() => undefined) });

    await expect(
      createSilentPrinter({ ...deps, timeoutMs: 20 }).print('ZD421', label),
    ).rejects.toThrow(PrintTimeoutError);
    expect(page.close).toHaveBeenCalled();
    expect(discarded).toEqual(['/tmp/job.png']);
  });

  it('출력물이 떠오르지 않아도 상한에서 끊는다', async () => {
    const { deps } = fakeDeps({ load: () => new Promise(() => undefined) });

    await expect(
      createSilentPrinter({ ...deps, timeoutMs: 20 }).print('ZD421', label),
    ).rejects.toThrow(PrintTimeoutError);
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

describe('OS 인쇄 경로', () => {
  /*
   * ⭐ 이 묶음이 「급지는 되는데 백지」의 대응을 문다. 브라우저 엔진의 무음 인쇄가 이 라벨
   *    프린터에서 빈 종이를 냈고, 같은 프린터의 사진 앱 인쇄는 정상이었다.
   */
  it('OS 경로가 있으면 창을 열지 않는다 — 열지 않은 창은 비지도 않는다', async () => {
    const { deps, page } = fakeDeps();
    const printFile = { print: vi.fn(async () => undefined) };

    await createSilentPrinter({ ...deps, printFile }).print('ZD421', label);

    expect(page.load).not.toHaveBeenCalled();
    expect(page.print).not.toHaveBeenCalled();
    expect(printFile.print).toHaveBeenCalledWith({
      imagePath: '/tmp/job.png',
      deviceName: 'ZD421',
      jobName: 'LOT-0001',
    });
  });

  it('OS 경로가 실패해도 임시 파일을 지운다', async () => {
    const { deps, discarded } = fakeDeps();
    const printFile = {
      print: vi.fn(async () => {
        throw new Error('프린터 오프라인');
      }),
    };

    await expect(createSilentPrinter({ ...deps, printFile }).print('ZD421', label)).rejects.toThrow(
      '프린터 오프라인',
    );
    expect(discarded).toEqual(['/tmp/job.png']);
  });
});
