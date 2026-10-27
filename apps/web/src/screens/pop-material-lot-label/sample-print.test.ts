import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBitmap } from '../../patterns/label/bitmap';

import { buildMaterialLotLabel, buildMaterialLotLabelBytes } from './label-tspl';
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

  /* 견본은 TEXT 판으로 짠다 — 값이 전부 ASCII 라야 실제 발행(그림 판)과 같은 바이트다. */
  it('⭐ 견본은 실제 발행 바이트(그림 판)와 같다 — 그림으로 바뀌는 줄이 없다', () => {
    const drawAnything = (content: string, fontPx: number) =>
      createBitmap(content.length * fontPx, fontPx);

    expect(Array.from(buildMaterialLotLabelBytes(SAMPLE_LOT_LABEL, drawAnything))).toEqual(
      Array.from(new TextEncoder().encode(buildMaterialLotLabel(SAMPLE_LOT_LABEL))),
    );
    /* 새 양식의 칸이 다 찍힌다 — 견본으로 줄 자리를 실기에서 본다. */
    expect(buildMaterialLotLabel(SAMPLE_LOT_LABEL)).toContain('"TEST ITEM"');
    expect(buildMaterialLotLabel(SAMPLE_LOT_LABEL)).toContain('"10,000 EA"');
    expect(buildMaterialLotLabel(SAMPLE_LOT_LABEL)).toContain('"TEST SUPPLIER (000000)"');
    expect(buildMaterialLotLabel(SAMPLE_LOT_LABEL)).toContain('"RCV 2026-01-01"');
  });

  it('셸 통로가 없으면 성공으로 넘기지 않는다', async () => {
    await expect(printSampleLotLabel()).rejects.toThrow('셸 인쇄 통로가 없습니다.');
  });
});
