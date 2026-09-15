import { describe, expect, it } from 'vitest';

import { buildMaterialLotLabel, escapeTspl } from './label-tspl';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const FIELDS = {
  itemCode: 'SYN-ITEM-01',
  lotNo: 'SYN-ITEM-01|10000|260914|100330|0001',
  qty: 10000,
  uomCode: 'EA',
  issueSeq: 2,
  inboundReceiptNo: 'SYN-IB-0001',
};

const WIDTH = 639;
const HEIGHT = 240;

/** 명령 한 줄의 x·y 좌표. */
const origin = (line: string): [number, number] => {
  const matched = /^(?:TEXT|QRCODE) (\d+),(\d+),/u.exec(line);

  if (matched === null) throw new Error(`좌표가 없는 줄: ${line}`);

  return [Number(matched[1]), Number(matched[2])];
};

describe('buildMaterialLotLabel', () => {
  it('80 × 30 mm 대지를 선언하고 한 장을 찍는다', () => {
    const lines = buildMaterialLotLabel(FIELDS).split('\r\n');

    expect(lines[0]).toBe('SIZE 80 mm,30 mm');
    expect(lines).toContain('CLS');
    expect(lines).toContain('PRINT 1,1');
  });

  /** ⛔ 100 × 60 좌표로 짠 서버 라벨이 80 × 30 라벨지 밖으로 나간 결함(실기 2026-09-14). */
  it('⛔ 모든 글줄과 QR 이 80 × 30 mm 안에서 시작한다', () => {
    const drawn = buildMaterialLotLabel(FIELDS)
      .split('\r\n')
      .filter((line) => line.startsWith('TEXT ') || line.startsWith('QRCODE '));

    expect(drawn.length).toBeGreaterThan(0);

    for (const line of drawn) {
      const [x, y] = origin(line);

      expect(x).toBeLessThan(WIDTH);
      expect(y).toBeLessThan(HEIGHT);
    }
  });

  /**
   * ⛔ 3 mm 여백으로 짜면 QR 윗변·오른쪽 끝이 라벨지 가장자리에 붙어, 프린터가 조금만 밀려도
   *    잘렸다(실기 HT800 2026-09-15). 시작점만 보던 검사가 이것을 못 잡았다 — «끝점»을 본다.
   */
  it('⛔ 글줄과 QR 이 사방 4 mm 안전 여백 안에서 끝나고 서로 겹치지 않는다', () => {
    const SAFE = 32;
    const lines = buildMaterialLotLabel(FIELDS).split('\r\n');
    const qr = lines.find((line) => line.startsWith('QRCODE ')) ?? '';
    const [qrX, qrY] = origin(qr);
    const cell = Number(/^QRCODE \d+,\d+,M,(\d+),/u.exec(qr)?.[1]);
    /* LOT 37자 → 버전 3(29칸). */
    const side = 29 * cell;

    expect(qrX + side).toBeLessThanOrEqual(WIDTH - SAFE);
    expect(qrY).toBeGreaterThanOrEqual(SAFE);
    expect(qrY + side).toBeLessThanOrEqual(HEIGHT - SAFE);

    for (const line of lines.filter((entry) => entry.startsWith('TEXT '))) {
      const [x, y] = origin(line);
      const matched = /,"0",0,(\d+),\d+,"(.*)"$/u.exec(line);
      const point = Number(matched?.[1]);
      const content = matched?.[2] ?? '';
      /* 내장 글꼴 어림 — 자폭 point×0.5, 높이 point, 203 dpi. */
      const right = x + content.length * point * 0.5 * (203 / 72);
      const bottom = y + point * (203 / 72);

      expect(x).toBeGreaterThanOrEqual(SAFE);
      expect(y).toBeGreaterThanOrEqual(SAFE);
      expect(bottom).toBeLessThanOrEqual(HEIGHT - SAFE);
      expect(right).toBeLessThanOrEqual(qrX);
    }
  });

  it('⛔ QR 에는 LOT 번호만 싣는다 — 모바일이 스캔값을 그대로 LOT 번호로 읽는다', () => {
    const qr = buildMaterialLotLabel(FIELDS)
      .split('\r\n')
      .find((line) => line.startsWith('QRCODE '));

    expect(qr?.endsWith(`,"${FIELDS.lotNo}"`)).toBe(true);
  });

  it('단위를 모르면 수량만 적는다', () => {
    expect(buildMaterialLotLabel({ ...FIELDS, uomCode: null })).toContain('"QTY 10000"');
  });

  it('너무 긴 품번은 잘라 끝에 ~ 를 남긴다 — QR 위로 넘치게 두지 않는다', () => {
    const label = buildMaterialLotLabel({ ...FIELDS, itemCode: 'X'.repeat(120) });
    const item = label.split('\r\n').find((line) => line.includes('"ITEM ')) ?? '';

    expect(item).toMatch(/~"$/u);
  });
});

describe('escapeTspl', () => {
  it('⛔ 따옴표·역슬래시가 명령을 가르지 못하게 하고 찍을 수 없는 글자는 ? 로 바꾼다', () => {
    expect(escapeTspl('A"B\\C한')).toBe('A\\"B\\\\C?');
  });
});
