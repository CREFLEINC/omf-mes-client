import { describe, expect, it } from 'vitest';

import { buildProductionLotLabel } from './label-tspl';

/** 합성값이다 — 실 운영 값을 쓰지 않는다(공개 저장소 경계). */
const FIELDS = {
  itemCode: 'SYN-ITEM-01',
  lotNo: 'SYN-LOT-260916-0001',
  qty: 1000,
  uomCode: 'EA',
  issueSeq: 1,
  workOrderNo: 'SYN-WO-0007',
  wip: null,
};

const WIDTH = 639;
const HEIGHT = 240;
/* 실기에서 맞춘 안전 여백 — 가로는 좌우 같다(`patterns/label/lot-label-tspl`). */
const TOP = 16;
const BOTTOM = 48;
const LEFT = 32;
const RIGHT = 32;

/** 명령 한 줄의 x·y 좌표. */
const origin = (line: string): [number, number] => {
  const matched = /^(?:TEXT|QRCODE) (\d+),(\d+),/u.exec(line);

  if (matched === null) throw new Error(`좌표가 없는 줄: ${line}`);

  return [Number(matched[1]), Number(matched[2])];
};

const textLines = (label: string): string[] =>
  label.split('\r\n').filter((line) => line.startsWith('TEXT '));

describe('buildProductionLotLabel', () => {
  it('80 × 30 mm 대지를 선언하고 한 장을 찍는다', () => {
    const lines = buildProductionLotLabel(FIELDS).split('\r\n');

    expect(lines[0]).toBe('SIZE 80 mm,30 mm');
    expect(lines).toContain('CLS');
    expect(lines).toContain('PRINT 1,1');
  });

  it('단말 진단 인쇄와 같은 다섯 줄을 같은 차례로 적는다', () => {
    const drawn = textLines(buildProductionLotLabel(FIELDS)).map(
      (line) => /,"0",0,\d+,\d+,"(.*)"$/u.exec(line)?.[1] ?? '',
    );

    expect(drawn).toEqual([
      'PROD LOT  #1',
      'ITEM SYN-ITEM-01',
      'QTY 1000 EA',
      'LOT SYN-LOT-260916-0001',
      'W/O SYN-WO-0007',
    ]);
  });

  /**
   * ⛔ 서버가 100 × 60 mm 좌표로 그려 준 라벨이 80 × 30 mm 라벨지 밖으로 나가 잘린 결함
   *    (실기 2026-09-16 · 사용자 확인). 시작점만 보면 못 잡는다 — «끝점»까지 본다.
   */
  it.each([
    ['수량을 적을 때(5줄)', FIELDS],
    /* 반제품 첫 줄이 가장 길다(피처 016) — 그 판도 QR 앞에서 끝나야 한다. */
    ['반제품 LOT 일 때', { ...FIELDS, issueSeq: 12, wip: { operationSeq: 990 } }],
    /* ⛔ 수량을 빼면 4줄이 되어 줄 간격이 다시 계산된다 — 그 판도 여백 안에서 끝나야 한다. */
    ['수량을 모를 때(4줄)', { ...FIELDS, qty: null }],
  ])('⛔ %s 글줄과 QR 이 안전 여백 안에서 끝나고 서로 겹치지 않는다', (_name, fields) => {
    const lines = buildProductionLotLabel(fields).split('\r\n');
    const qr = lines.find((line) => line.startsWith('QRCODE ')) ?? '';
    const [qrX, qrY] = origin(qr);
    const cell = Number(/^QRCODE \d+,\d+,M,(\d+),/u.exec(qr)?.[1]);
    /* LOT 19자 → 버전 2(25칸). */
    const side = 25 * cell;

    expect(qrX).toBeGreaterThanOrEqual(LEFT);
    expect(qrX + side).toBeLessThanOrEqual(WIDTH - RIGHT);
    expect(qrY).toBeGreaterThanOrEqual(TOP);
    expect(qrY + side).toBeLessThanOrEqual(HEIGHT - BOTTOM);

    for (const line of textLines(buildProductionLotLabel(fields))) {
      const [x, y] = origin(line);
      const matched = /,"0",0,(\d+),\d+,"(.*)"$/u.exec(line);
      const point = Number(matched?.[1]);
      const content = matched?.[2] ?? '';
      /* 내장 글꼴 어림 — 자폭 point×0.5, 높이 point, 203 dpi. */
      const right = x + content.length * point * 0.5 * (203 / 72);
      const bottom = y + point * (203 / 72);

      expect(x).toBe(LEFT);
      expect(y).toBeGreaterThanOrEqual(TOP);
      expect(bottom).toBeLessThanOrEqual(HEIGHT - BOTTOM);
      expect(right).toBeLessThanOrEqual(qrX);
    }
  });

  it('⛔ QR 에는 생산 LOT 번호만 싣는다 — 마감 스캔이 그 값을 그대로 대조한다', () => {
    const qr = buildProductionLotLabel(FIELDS)
      .split('\r\n')
      .find((line) => line.startsWith('QRCODE '));

    expect(qr?.endsWith(`,"${FIELDS.lotNo}"`)).toBe(true);
  });

  it('단위를 모르면 수량만 적는다', () => {
    expect(buildProductionLotLabel({ ...FIELDS, uomCode: null })).toContain('"QTY 1000"');
  });

  it('⛔ 수량을 모르면 0 을 적지 않고 줄을 뺀다', () => {
    const drawn = textLines(buildProductionLotLabel({ ...FIELDS, qty: null }));

    expect(drawn).toHaveLength(4);
    expect(drawn.some((line) => line.includes('"QTY'))).toBe(false);
  });

  describe('피처 016 공정 반제품 LOT', () => {
    const headline = (label: string): string =>
      /,"0",0,\d+,\d+,"(.*)"$/u.exec(textLines(label)[0] ?? '')?.[1] ?? '';

    it('US1-5·Q5 반제품 LOT 라벨 첫 줄은 WIP LOT OP{공정 순번} — 나머지 줄·QR 은 제품 LOT 과 같다', () => {
      const wip = buildProductionLotLabel({ ...FIELDS, wip: { operationSeq: 10 } });
      const prod = buildProductionLotLabel(FIELDS);

      expect(headline(wip)).toBe('WIP LOT OP10  #1');
      expect(textLines(wip).slice(1)).toEqual(textLines(prod).slice(1));
      expect(wip.split('\r\n').find((line) => line.startsWith('QRCODE '))).toBe(
        prod.split('\r\n').find((line) => line.startsWith('QRCODE ')),
      );
    });

    it('US1-5·Q5 제품 LOT(마지막 공정) 라벨은 지금처럼 PROD LOT #n', () => {
      expect(headline(buildProductionLotLabel({ ...FIELDS, issueSeq: 3 }))).toBe('PROD LOT  #3');
    });

    it('US1-5 공정 순번을 모르는 반제품은 WIP LOT 만 적는다', () => {
      expect(headline(buildProductionLotLabel({ ...FIELDS, wip: { operationSeq: null } }))).toBe(
        'WIP LOT  #1',
      );
    });

    it('US1-5·Q5 ⛔ 라벨 글줄은 모두 ASCII — 내장 글꼴이 한글을 찍지 못한다(결정 17)', () => {
      const label = buildProductionLotLabel({ ...FIELDS, wip: { operationSeq: 20 } });

      expect(/^[\x20-\x7e\r\n]*$/u.test(label)).toBe(true);
    });
  });
});
