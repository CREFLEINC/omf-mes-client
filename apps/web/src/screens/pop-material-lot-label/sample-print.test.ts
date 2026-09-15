import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMaterialLotLabel } from './label-tspl';
import { SAMPLE_LOT_LABEL, printSampleLotLabel } from './sample-print';

afterEach(() => {
  delete window.pop;
});

describe('printSampleLotLabel', () => {
  it('⭐ 실제 발행과 같은 서식을 같은 통로(tspl)로 보낸다', async () => {
    const save = vi.fn().mockResolvedValue('C:/out/lot-sample.prn');
    window.pop = { rendition: { save } };

    await expect(printSampleLotLabel()).resolves.toBe('C:/out/lot-sample.prn');

    const [bytes, label, , format] = save.mock.calls[0] as [Uint8Array, string, string, string];

    expect(new TextDecoder().decode(bytes)).toBe(buildMaterialLotLabel(SAMPLE_LOT_LABEL));
    expect(label).toBe('lot-sample');
    expect(format).toBe('tspl');
  });

  it('셸 통로가 없으면 성공으로 넘기지 않는다', async () => {
    await expect(printSampleLotLabel()).rejects.toThrow('셸 인쇄 통로가 없습니다.');
  });
});
