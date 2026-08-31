import { describe, expect, it } from 'vitest';

import { encodeQr, type QrMatrix } from './qr-encode';
import fixtures from './qr-fixtures.json';

/**
 * ⭐ **사람이 보고 판정할 수 없는 그림이라 기계로 판정한다.**
 *
 * QR 은 틀려도 조용하다 — 격자는 멀쩡히 그려지고 스캐너만 못 읽는다. 「틀려도 조용한 것」의
 * 가장 순수한 예다.
 *
 * ⚠ **정답 행렬과 칸 단위로 맞추는 시험은 쓸 수 없다.** 규격에 맞는 부호기 둘이 같은 글에
 * 서로 다른 격자를 낸다 — 채움 바이트와 마스크 선택에 여지가 있어서다(널리 쓰이는 파이썬
 * 구현 두 벌을 대조해 실측했다: 같은 글·같은 정정 수준에 다른 행렬이 나온다). 그래서 이
 * 시험은 **읽어서 되돌아오는가**로 판정한다.
 *
 * 붙인 그물 셋:
 *
 * 1. **되읽기** — 규격을 따로 구현한 판독기가 격자를 읽어 원문을 되찾는다. 자료 배치·마스크
 *    적용·형식 정보·블록 뒤섞기·길이 표시 전환이 여기서 걸린다.
 * 2. **신드롬** — 각 블록의 코드워드를 α^0…α^(정정길이-1) 에 넣어 0이 나오는지 본다. 리드-솔로몬
 *    계산과 정정 블록 구성표가 여기서 걸린다. **정답 없이 성립하는 검사**다.
 * 3. **기능 패턴 대조** — 위치 검출·타이밍·정렬 패턴은 자료와 무관해 부호기가 달라도 같다.
 *    독립 구현이 만든 행렬(`qr-fixtures.json`)과 그 자리만 맞춘다 — 정렬 패턴 좌표표의 오타가
 *    여기서 걸린다.
 */

interface Fixture {
  text: string;
  why: string;
  version: number;
  rows: string[];
}

const SAMPLES = fixtures as Fixture[];

/* ── 갈릭 필드 — 시험이 제 몫으로 따로 갖는다(구현과 같은 표를 빌려 쓰면 검사가 아니다). ── */
const EXP: number[] = [];
const LOG: number[] = new Array<number>(256).fill(0);

{
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
}

const mul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : (EXP[((LOG[a] ?? 0) + (LOG[b] ?? 0)) % 255] ?? 0);

/** 정정 수준 M 의 블록 구성 — 되읽기와 신드롬 검사가 쓴다. */
const EC_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  7: [18, 4, 31, 0, 0],
  13: [22, 8, 37, 1, 38],
  24: [28, 6, 45, 14, 46],
};

const blockSizes = (version: number): number[] => {
  const row = EC_M[version];

  if (row === undefined) throw new Error(`시험이 버전 ${String(version)}의 구성표를 모릅니다.`);

  const [, count1, size1, count2, size2] = row;

  return [...new Array<number>(count1).fill(size1), ...new Array<number>(count2).fill(size2)];
};

const ecPerBlock = (version: number): number => {
  const row = EC_M[version];

  if (row === undefined) throw new Error(`시험이 버전 ${String(version)}의 구성표를 모릅니다.`);

  return row[0];
};

/** 이 자리가 기능 패턴인가 — 판독기가 자료 칸을 고르는 기준. */
const isFunction = (size: number, version: number, row: number, col: number): boolean => {
  if (row <= 8 && col <= 8) return true;
  if (row <= 8 && col >= size - 8) return true;
  if (row >= size - 8 && col <= 8) return true;
  if (row === 6 || col === 6) return true;
  if (version >= 7 && row < 6 && col >= size - 11) return true;
  if (version >= 7 && col < 6 && row >= size - 11) return true;

  for (const center of alignmentCenters(version)) {
    if (Math.abs(row - center[0]) <= 2 && Math.abs(col - center[1]) <= 2) return true;
  }

  return false;
};

/** 정렬 패턴 중심 — 좌표표는 픽스처 대조가 따로 검증한다. */
const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  7: [6, 22, 38],
  13: [6, 34, 62],
  24: [6, 28, 54, 80, 106],
};

const alignmentCenters = (version: number): [number, number][] => {
  const coords = ALIGNMENT[version] ?? [];
  const first = coords[0];
  const last = coords[coords.length - 1];
  const centers: [number, number][] = [];

  for (const row of coords) {
    for (const col of coords) {
      const isCorner =
        (row === first && col === first) ||
        (row === first && col === last) ||
        (row === last && col === first);

      if (!isCorner) centers.push([row, col]);
    }
  }

  return centers;
};

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 격자에 적힌 형식 정보를 읽어 정정 수준과 마스크를 되찾는다. */
const readFormat = (m: QrMatrix): { ecl: number; mask: number } => {
  const at = (r: number, c: number): number => (m.modules[r]?.[c] === true ? 1 : 0);
  const bits: number[] = [];

  for (let i = 0; i <= 5; i += 1) bits[i] = at(i, 8);
  bits[6] = at(7, 8);
  bits[7] = at(8, 8);
  bits[8] = at(8, 7);
  for (let i = 9; i <= 14; i += 1) bits[i] = at(8, 14 - i);

  let value = 0;

  for (let i = 14; i >= 0; i -= 1) value = (value << 1) | (bits[i] ?? 0);

  const bch = (data: number): number => {
    let rem = data;

    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);

    return ((data << 10) | rem) ^ 0x5412;
  };

  for (let ecl = 0; ecl < 4; ecl += 1) {
    for (let mask = 0; mask < 8; mask += 1) {
      if (bch((ecl << 3) | mask) === value) return { ecl, mask };
    }
  }

  throw new Error('형식 정보를 읽지 못했습니다.');
};

/** 격자에서 코드워드를 뽑는다 — 뒤섞기를 되돌리기 전 순서 그대로. */
const readCodewords = (m: QrMatrix, mask: number): number[] => {
  const size = m.size;
  const rule = MASKS[mask];

  if (rule === undefined) throw new Error('마스크 번호가 범위를 벗어났습니다.');

  const bits: number[] = [];
  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;

      for (const col of [right, right - 1]) {
        if (isFunction(size, m.version, row, col)) continue;

        const shown = m.modules[row]?.[col] === true ? 1 : 0;

        bits.push(rule(row, col) ? shown ^ 1 : shown);
      }
    }
    right -= 2;
    upward = !upward;
  }

  const codewords: number[] = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;

    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ?? 0);
    codewords.push(byte);
  }

  return codewords;
};

/** 뒤섞기를 되돌려 블록별 (자료 + 정정) 을 되찾는다. */
const deinterleave = (
  codewords: number[],
  version: number,
): { data: number[][]; ec: number[][] } => {
  const sizes = blockSizes(version);
  const ecCount = ecPerBlock(version);
  const data: number[][] = sizes.map(() => []);
  const ec: number[][] = sizes.map(() => []);
  const longest = Math.max(...sizes);
  let index = 0;

  for (let i = 0; i < longest; i += 1) {
    for (let b = 0; b < sizes.length; b += 1) {
      if (i < (sizes[b] ?? 0)) {
        data[b]?.push(codewords[index] ?? 0);
        index += 1;
      }
    }
  }
  for (let i = 0; i < ecCount; i += 1) {
    for (let b = 0; b < sizes.length; b += 1) {
      ec[b]?.push(codewords[index] ?? 0);
      index += 1;
    }
  }

  return { data, ec };
};

const decodeText = (data: number[][], version: number): string => {
  const stream = data.flat();
  const bits: number[] = [];

  for (const byte of stream) {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  }

  const take = (count: number, from: number): number => {
    let value = 0;

    for (let i = 0; i < count; i += 1) value = (value << 1) | (bits[from + i] ?? 0);

    return value;
  };

  expect(take(4, 0)).toBe(0b0100);

  const countBits = version < 10 ? 8 : 16;
  const length = take(countBits, 4);
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) bytes[i] = take(8, 4 + countBits + i * 8);

  return new TextDecoder().decode(bytes);
};

describe('encodeQr — 되읽기', () => {
  for (const sample of SAMPLES) {
    it(`${sample.why} — 읽으면 원문이 돌아온다`, () => {
      const m = encodeQr(sample.text);
      const { ecl, mask } = readFormat(m);

      /* 정정 수준 M 의 표시자는 0b00 이다. 다른 값이면 스캐너가 다른 블록 구성으로 읽는다. */
      expect(ecl).toBe(0);
      expect(mask).toBe(m.mask);

      const { data } = deinterleave(readCodewords(m, mask), m.version);

      expect(decodeText(data, m.version)).toBe(sample.text);
    });
  }
});

describe('encodeQr — 신드롬', () => {
  for (const sample of SAMPLES) {
    it(`${sample.why} — 각 블록의 신드롬이 0이다`, () => {
      const m = encodeQr(sample.text);
      const { mask } = readFormat(m);
      const { data, ec } = deinterleave(readCodewords(m, mask), m.version);
      const count = ecPerBlock(m.version);

      for (let b = 0; b < data.length; b += 1) {
        const block = [...(data[b] ?? []), ...(ec[b] ?? [])];

        for (let s = 0; s < count; s += 1) {
          let value = 0;

          for (const byte of block) value = mul(value, EXP[s] ?? 0) ^ byte;
          expect(value).toBe(0);
        }
      }
    });
  }
});

describe('encodeQr — 기능 패턴은 부호기가 달라도 같다', () => {
  for (const sample of SAMPLES) {
    it(`${sample.why} — 위치 검출·타이밍·정렬이 독립 구현과 일치한다`, () => {
      const m = encodeQr(sample.text);
      const expected = (r: number, c: number): boolean => sample.rows[r]?.[c] === '1';
      const mine = (r: number, c: number): boolean => m.modules[r]?.[c] === true;

      expect(m.version).toBe(sample.version);
      expect(m.size).toBe(sample.rows.length);

      /* 위치 검출 패턴과 구분자 — 세 모서리 8×8. */
      for (const [top, left] of [
        [0, 0],
        [0, m.size - 8],
        [m.size - 8, 0],
      ] as [number, number][]) {
        for (let r = 0; r < 8; r += 1) {
          for (let c = 0; c < 8; c += 1) {
            expect(mine(top + r, left + c)).toBe(expected(top + r, left + c));
          }
        }
      }

      /* 타이밍 — 여섯 번째 줄과 칸. */
      for (let i = 8; i < m.size - 8; i += 1) {
        expect(mine(6, i)).toBe(expected(6, i));
        expect(mine(i, 6)).toBe(expected(i, 6));
      }

      /* 정렬 패턴 — 좌표표가 틀리면 여기서 어긋난다. */
      const centers = alignmentCenters(m.version);

      for (const [row, col] of centers) {
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            expect(mine(row + r, col + c)).toBe(expected(row + r, col + c));
          }
        }
      }
    });
  }
});

describe('encodeQr — 경계', () => {
  it('빈 글도 격자를 만든다 — 부르는 쪽이 빈 값을 거르게 두지 않는다', () => {
    expect(encodeQr('').size).toBe(21);
  });

  it('한 장에 담기지 않는 길이는 거부한다 — 조용히 잘라 내지 않는다', () => {
    expect(() => encodeQr('x'.repeat(5000))).toThrow();
  });

  it('길이가 늘면 버전도 늘어난다', () => {
    expect(encodeQr('x'.repeat(200)).version).toBeGreaterThan(encodeQr('x').version);
  });
});
