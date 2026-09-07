import { describe, expect, it } from 'vitest';

import {
  LabelTooSmallError,
  SAMPLE_LOT,
  SAMPLE_SHIPPING,
  buildLotLabel,
  buildShippingLabel,
  escapeTspl,
} from './tspl-label';

const lot = buildLotLabel(SAMPLE_LOT);
const shipping = buildShippingLabel(SAMPLE_SHIPPING);

/** 라벨에서 「무엇이 몇 pt 로 찍히는가」만 뽑는다 — 크기 비교를 좌표에 얽매지 않는다. */
const pointOf = (label: string, needle: string): number => {
  const found = [...label.matchAll(/^TEXT [^,]+,[^,]+,"0",0,(\d+),\d+,"([^"]*)"/gm)].find(
    ([, , content]) => content?.includes(needle) === true,
  );

  if (found === undefined) throw new Error(`라벨에 없다: ${needle}`);

  return Number(found[1]);
};

const eachLabel: [string, string][] = [
  ['표준 LOT 라벨', lot],
  ['출하용 라벨', shipping],
];

describe('사양서 공통 인쇄 사양', () => {
  it.each([
    ['표준 LOT 라벨', lot, 'SIZE 80 mm,30 mm'],
    ['출하용 라벨', shipping, 'SIZE 100 mm,60 mm'],
  ])('%s 는 그 규격의 대지를 잡는다', (_name, label, expected) => {
    expect(label).toContain(expected);
  });

  /*
   * ⛔ 사양서 §4.1·§4.2 — 내장 폰트 "0" 하나로 통일한다. 다른 폰트가 섞이면 라벨마다 글자
   *    모양이 갈리고, 크기를 point 로 지정할 수 없어 좁은 대지에서 넘친다.
   */
  it.each(eachLabel)('%s 의 글자는 전부 내장 폰트 "0" 이다', (_name, label) => {
    const fonts = [...label.matchAll(/^TEXT [^,]+,[^,]+,"([^"]+)"/gm)].map(([, font]) => font);

    expect(fonts.length).toBeGreaterThan(0);
    expect([...new Set(fonts)]).toEqual(['0']);
  });

  /* ⛔ 사양서 §10 — 2D 바코드는 DataMatrix 다. 1D 바코드로 대신하지 않는다. */
  it.each(eachLabel)('%s 는 DataMatrix 를 싣는다', (_name, label) => {
    expect(label).toContain('DMATRIX ');
    expect(label).not.toContain('BARCODE ');
  });

  /* ⛔ 사양서 §4.2 — 203 dpi 에서 7pt 아래는 읽히지 않는다. */
  it.each(eachLabel)('%s 는 7pt 아래로 줄이지 않는다', (_name, label) => {
    const points = [...label.matchAll(/^TEXT [^,]+,[^,]+,"0",0,(\d+),/gm)].map(([, pt]) =>
      Number(pt),
    );

    expect(points.length).toBeGreaterThan(0);
    expect(Math.min(...points)).toBeGreaterThanOrEqual(7);
  });

  it('7pt 아래는 조용히 줄이지 않고 던진다', () => {
    expect(new LabelTooSmallError(6).message).toContain('7pt');
  });

  it.each(eachLabel)('%s 는 CRLF 로 끊고 인쇄로 끝난다', (_name, label) => {
    expect(label).not.toMatch(/[^\r]\n/);
    expect(label.endsWith('PRINT 1\r\n')).toBe(true);
  });

  /* ⛔ 사양서 §3 — 표기 언어는 English Only 다. */
  it.each(eachLabel)('%s 는 영문·숫자만 싣는다', (_name, label) => {
    expect(label).toMatch(/^[\x20-\x7e\r\n]+$/);
  });
});

describe('표준 LOT 라벨 항목', () => {
  it.each([
    ['라벨 유형', 'WIP'],
    ['품질 상태', 'OK'],
    ['품번', 'PART NO.: PRT-000001'],
    ['품명', 'SAMPLE PART BLK'],
    ['LOT 번호', 'LOT NO.: 000000-A01'],
    ['수량과 단위', 'QTY: 1000 EA'],
    ['기준 일시', 'MFG DT: 26-08-05 14:25'],
    ['유형별 추가 항목', 'WO NO.: WO000000001'],
  ])('%s 가 실린다', (_name, expected) => {
    expect(lot).toContain(`"${expected}"`);
  });

  /*
   * ⭐ 사양서 §5.4 — 품번·수량·상태가 가장 크고 LOT·품명이 그다음이다. 크기가 뒤집히면
   *    작업자가 먼저 봐야 할 것을 나중에 본다.
   */
  it('시각적 우선순위대로 크기를 준다', () => {
    expect(pointOf(lot, 'PART NO.')).toBeGreaterThan(pointOf(lot, 'SAMPLE PART BLK'));
    expect(pointOf(lot, 'QTY:')).toBeGreaterThan(pointOf(lot, 'MFG DT'));
    expect(pointOf(lot, 'LOT NO.')).toBeGreaterThanOrEqual(pointOf(lot, 'SAMPLE PART BLK'));
  });

  /* ⛔ 사양서 §10 — 조회에 필요한 최소 식별정보만. 상세 이력을 싣지 않는다. */
  it('바코드에 최소 식별정보만 싣는다', () => {
    expect(lot).toContain('"L1|WIP|PRT-000001|000000-A01|1000|EA"');
  });
});

describe('출하용 라벨 항목', () => {
  it.each([
    ['납품처', 'SHIP TO: SAMPLE BUYER CO., LTD.'],
    ['고객 품번', 'CUSTOMER P/N: CPN-000001'],
    ['내부 품번', 'PART NO.: FGD-000001'],
    ['품명', 'SAMPLE ASSY'],
    ['LOT 번호', 'LOT NO.: 000000-B01'],
    ['출하 수량', 'QTY: 100 EA'],
    ['박스 번호', 'BOX NO.: 07/40'],
    ['출하번호', 'SHIPMENT NO.: SHP-000001'],
    ['출하 일시', 'SHIP DT: 26-08-05 17:40'],
  ])('%s 가 실린다', (_name, expected) => {
    expect(shipping).toContain(`"${expected}"`);
  });

  /* ⭐ 사양서 §7 — 고객 품번과 수량을 가장 크게 해 오품·오수량 출하를 육안으로 잡는다. */
  it('고객 품번과 수량이 가장 크다', () => {
    const biggest = Math.min(pointOf(shipping, 'CUSTOMER P/N'), pointOf(shipping, 'QTY:'));

    expect(pointOf(shipping, 'PART NO.')).toBeLessThan(biggest);
    expect(pointOf(shipping, 'SHIPMENT NO.')).toBeLessThan(biggest);
    expect(pointOf(shipping, 'SHIP DT')).toBeLessThan(biggest);
  });

  it('바코드에 박스 순번까지 싣는다', () => {
    expect(shipping).toContain('"S1|SHP-000001|CPN-000001|000000-B01|100|EA|07"');
  });
});

describe('값에 섞인 특수문자', () => {
  /* ⛔ 따옴표가 살아 있으면 그 뒤가 명령으로 읽혀 엉뚱한 것이 찍히거나 프린터가 멈춘다. */
  it('큰따옴표와 역슬래시를 벗어난다', () => {
    expect(escapeTspl('HSG "A" \\ B')).toBe('HSG \\"A\\" \\\\ B');
  });

  /* ⚠ 구분자가 값에 섞이면 읽는 쪽이 칸을 잘못 센다. */
  it('바코드 구분자가 값에 섞이면 뺀다', () => {
    expect(buildLotLabel({ ...SAMPLE_LOT, partNo: 'A|B' })).toContain('"L1|WIP|A B|');
  });
});
