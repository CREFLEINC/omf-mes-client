import { describe, expect, it } from 'vitest';

import { layoutLotLabel } from '../pop-material-lot-label/label-tspl';
import { buildLocationLabel } from './label-tspl';

const fields = {
  warehouseCode: 'S230',
  locationCode: 'S230-A-01-02',
  locationName: 'RACK A LEVEL 1',
  issueSeq: 3,
};

/** 80 × 30 mm 를 203 dpi 로 옮긴 점 수. */
const WIDTH = 640;
const HEIGHT = 240;

describe('창고 적재 위치 라벨 80 × 30 mm', () => {
  it('대지는 80 × 30 mm 이고, 글줄과 QR 이 라벨지 안에 선다', () => {
    const command = buildLocationLabel(fields);

    expect(command).toContain('SIZE 80 mm,30 mm');

    const texts = [...command.matchAll(/^TEXT (\d+),(\d+),"0",0,(\d+),/gmu)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      point: Number(match[3]),
    }));

    expect(texts).toHaveLength(4);
    for (const text of texts) {
      expect(text.x).toBeGreaterThan(0);
      /* 글줄 아래 끝까지 본다 — 시작점만 보면 잘림을 못 잡는다. */
      expect(text.y + Math.ceil(text.point * (203 / 72))).toBeLessThan(HEIGHT);
    }

    const qr = /^QRCODE (\d+),(\d+),M,(\d+),/mu.exec(command);

    expect(qr).not.toBeNull();
    expect(Number(qr?.[2])).toBeGreaterThanOrEqual(0);

    /* QR 은 끝점까지 본다 — 잘림은 오른쪽·아래 끝에서 났다. */
    const { qr: box } = layoutLotLabel([], fields.locationCode);

    expect(box.x).toBe(Number(qr?.[1]));
    expect(box.x + box.side).toBeLessThanOrEqual(WIDTH);
    expect(box.y + box.side).toBeLessThanOrEqual(HEIGHT);
  });

  it('QR 에는 위치 코드만 싣는다', () => {
    expect(buildLocationLabel(fields)).toMatch(/^QRCODE [^\r\n]*,"S230-A-01-02"\r$/mu);
  });

  it('위치명이 한글이어도 줄을 지키고, 못 그리는 글자만 ? 로 찍는다(결정 17)', () => {
    const command = buildLocationLabel({ ...fields, locationName: '자재 랙 1단' });

    expect(command.match(/^TEXT /gmu)).toHaveLength(4);
    expect(command).toContain('"?? ? 1?"');
  });
});
