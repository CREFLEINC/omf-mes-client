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
  /*
   * ⭐ **대지는 «걸린 용지»다**(사용자 확인 2026-09-08). 사양서의 서식 크기(80×30)를 `SIZE`
   *    에 적으면 100×60 라벨지를 건 프린터가 어긋난 대지를 잡아 오류를 낸다 — 서식은 그
   *    대지 «안»에 그린다.
   */
  it.each([
    ['표준 LOT 라벨', lot],
    ['출하용 라벨', shipping],
  ])('%s 는 걸린 라벨지 크기로 대지를 잡는다', (_name, label) => {
    expect(label).toContain('SIZE 100 mm,60 mm');
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
    ['유형과 상태 한 줄', 'WIP  OK'],
    ['품번', 'PART NO.: PRT-000001'],
    ['품명', 'SAMPLE PART BLK'],
    ['LOT 번호', 'LOT NO.: 000000-A01'],
    ['수량과 단위', 'QTY: 1000 EA'],
    ['기준 일시', 'MFG DT: 26-08-05 14:25'],
  ])('%s 가 실린다', (_name, expected) => {
    expect(lot).toContain(`"${expected}"`);
  });

  /*
   * ⭐ 화면이 내보내는 LOT 라벨과 «같은 배치»여야 한다(사용자 지시). 두 서식이 갈리지
   *    않게 대지·테두리·2D 바코드 크기와 자리를 여기에 못 박는다 —
   *    짝은 `tools/mock/label-layout.mjs` 의 `renderLotLabel` 이다.
   */
  it.each([
    ['대지', 'SIZE 100 mm,60 mm'],
    ['테두리', 'BOX 0,0,638,239,2'],
    ['2D 바코드 12mm 각', 'DMATRIX 527,24,96,96,'],
  ])('화면 쪽 서식과 같은 %s 를 쓴다', (_name, expected) => {
    expect(lot).toContain(expected);
  });

  /*
   * ⭐ 사양서 §5.4 예시가 다섯째 줄에 유형별 추가 항목(§5.3)을 둔다 — 사출 공정품이면
   *    `WO NO.` 다. **주면 찍고, 없으면 그 줄을 비운다.**
   */
  it.each([
    ['유형별 추가 항목', 'WO NO.: WO000000001'],
  ])('%s 가 실린다', (_name, expected) => {
    expect(lot).toContain(`"${expected}"`);
  });

  it('추가 항목이 없으면 그 줄을 비운다', () => {
    const { extra: _drop, ...without } = SAMPLE_LOT;

    expect(buildLotLabel(without)).not.toContain('WO NO.');
  });

  /*
   * ⭐ **줄마다 하나씩 내려 쓴다 — 좌·우로 나누지 않는다.**
   *
   * 사양서 §5.4 예시는 유형·상태와 품번을 한 줄에 두지만, 그러면 왼쪽 칸이 19mm 로 묶여
   * 상태가 `INSPECTION_PENDING` 처럼 길게 올 때 **품번 위로 겹쳐 찍힌다**(실측 2026-09-08 ·
   * 실기). TSPL 은 넘쳐도 잘라 주지 않는다 — 칸을 나누지 않는 쪽을 택했다.
   */
  it('겹칠 수 있는 줄을 같은 높이에 두지 않는다', () => {
    const rowOf = (needle: string): string => {
      const found = [...lot.matchAll(/^TEXT [^,]+,([^,]+),"0",0,\d+,\d+,"([^"]*)"/gm)].find(
        ([, , content]) => content?.includes(needle) === true,
      );

      if (found === undefined) throw new Error(`라벨에 없다: ${needle}`);

      return found[1] ?? '';
    };

    expect(rowOf('WIP')).not.toBe(rowOf('PART NO.'));
    expect(rowOf('PART NO.')).not.toBe(rowOf('QTY:'));
    expect(rowOf('LOT NO.')).not.toBe(rowOf('QTY:'));
  });

  /*
   * ⛔ **긴 상태 코드가 옆 칸을 덮지 않는다.** 계약이 상태 값 목록을 확정하지 않아
   *    `INSPECTION_PENDING` 같은 값이 그대로 온다 — 실기에서 이것이 품번 위로 찍혔다.
   */
  it('긴 상태가 와도 품번 줄을 침범하지 않는다', () => {
    const built = buildLotLabel({ ...SAMPLE_LOT, type: 'RAW', status: 'INSPECTION_PENDING' });

    const rows = [...built.matchAll(/^TEXT (\d+),(\d+),"0",0,(\d+),\d+,"([^"]*)"/gm)];
    const head = rows.find(([, , , , content]) => content?.startsWith('RAW') === true);
    const partNo = rows.find(([, , , , content]) => content?.startsWith('PART NO.') === true);

    expect(head).toBeDefined();
    expect(partNo).toBeDefined();

    /* 서로 다른 줄에 있고, 머리줄이 라벨 폭(80mm · 639dot) 안에서 끝난다. */
    expect(head?.[2]).not.toBe(partNo?.[2]);

    const point = Number(head?.[3] ?? 0);
    const width = (head?.[4]?.length ?? 0) * point * 0.5 * (203 / 72);

    expect(Number(head?.[1] ?? 0) + width).toBeLessThan(639);
  });

  /*
   * ⛔ 사양서 §5.1 의 권장 «상한»을 넘지 않는다.
   *
   * ⚠ **하한은 재지 않는다.** 80×30 에 2D 바코드를 두고 34자리 자재LOT 번호까지 실으면
   *   권장 크기로는 칸에 들어가지 않는다 — TSPL 은 넘쳐도 잘라 주지 않아 옆 칸과 바코드
   *   위로 찍히므로(실측 2026-09-08), **넘치게 두기보다 줄이는 쪽**을 택했다. 대신 7pt
   *   아래로는 내리지 않는다(§4.2) — 그 검사는 위 「7pt 아래로 줄이지 않는다」가 한다.
   */
  it.each([
    ['PART NO.', 'PART NO.', 12],
    ['수량', 'QTY:', 12],
    ['LOT 번호', 'LOT NO.', 10],
    ['품명', 'SAMPLE PART BLK', 9],
    ['기준 일시', 'MFG DT', 8],
    ['추가 항목', 'WO NO.', 8],
  ])('%s 는 권장 상한을 넘지 않는다', (_name, needle, max) => {
    expect(pointOf(lot, needle)).toBeLessThanOrEqual(max);
  });

  /*
   * ⭐ 길어서 줄어들더라도 **순서는 지킨다**(§5.4) — 품번이 가장 크고, 일시가 품명보다 크지
   *    않다. 각 줄을 따로 줄이면 짧은 품명이 가장 커진다(실측).
   */
  it('긴 LOT 번호가 와도 크기 순서가 뒤집히지 않는다', () => {
    const long = buildLotLabel({
      ...SAMPLE_LOT,
      lotNo: '0001234500000012002607310001230007',
    });

    expect(pointOf(long, 'PART NO.')).toBeGreaterThanOrEqual(pointOf(long, 'LOT NO.'));
    expect(pointOf(long, 'LOT NO.')).toBeGreaterThanOrEqual(pointOf(long, 'SAMPLE PART BLK'));
    expect(pointOf(long, 'SAMPLE PART BLK')).toBeGreaterThanOrEqual(pointOf(long, 'MFG DT'));
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
