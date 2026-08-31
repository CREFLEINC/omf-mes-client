/**
 * QR 부호화 — 바이트 모드 · 정정 수준 M · 버전 1~40.
 *
 * ⭐ **화면이 그린 것을 기계가 읽는다.** 사람이 보고 「그럴듯하다」로 판정할 수 없는 그림이라,
 * 틀려도 조용하다 — 격자는 멀쩡히 그려지고 스캐너만 못 읽는다. 그래서 이 파일의 모든 표는
 * **알려진 정답 행렬과 대조하는 시험**을 함께 둔다(`qr-encode.test.ts`).
 *
 * ⛔ **표현을 만들지 않는다.** 여기서 나오는 것은 참/거짓 격자뿐이고 SVG·색·크기는 `qr-code.tsx`가
 * 맡는다 — 부호화가 표현에 얽히면 둘 다 시험하기 어려워진다.
 *
 * 정정 수준을 M 하나로 둔다. 라벨에 인쇄해 현장에서 스캔하는 쓰임이라 L은 얼룩에 약하고
 * Q·H는 같은 자료에 더 큰 격자를 요구한다 — 고를 일이 없는 선택지를 열어 두지 않는다.
 */

/** 갈릭 필드 GF(256), 원시 다항식 0x11D. 리드-솔로몬이 이 위에서 돈다. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255] ?? 0;
}

const gfMul = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;

  return EXP[((LOG[a] ?? 0) + (LOG[b] ?? 0)) % 255] ?? 0;
};

/**
 * 생성 다항식 — 차수만큼 (x + α^i)를 곱해 얻는다.
 *
 * ⭐ **계수는 «차수가 큰 쪽이 앞»이다.** 나머지 계산이 앞자리를 최고차로 읽으므로 여기서도
 * 같은 순서로 쌓는다 — 순서가 뒤집히면 격자는 멀쩡히 그려지고 정정 코드워드만 조용히
 * 달라진다. 그래서 이 파일은 정답 행렬과 대조하는 시험을 함께 둔다.
 */
const generatorPoly = (degree: number): number[] => {
  let poly = [1];

  for (let i = 0; i < degree; i += 1) {
    const next: number[] = new Array<number>(poly.length + 1).fill(0);

    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ (poly[j] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j] ?? 0, EXP[i] ?? 0);
    }
    poly = next;
  }

  return poly;
};

/** 한 블록의 정정 코드워드. */
const errorCodewords = (data: number[], count: number): number[] => {
  const gen = generatorPoly(count);
  const remainder = new Array<number>(count).fill(0);

  for (const byte of data) {
    const factor = byte ^ (remainder[0] ?? 0);

    remainder.shift();
    remainder.push(0);

    for (let i = 0; i < count; i += 1) {
      remainder[i] = (remainder[i] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
    }
  }

  return remainder;
};

/**
 * 버전별 블록 구성 — 정정 수준 M 한 줄만 둔다.
 * `[블록당 정정 코드워드, 1군 블록 수, 1군 자료 코드워드, 2군 블록 수, 2군 자료 코드워드]`
 */
const EC_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
  [26, 17, 42, 0, 0],
  [28, 17, 46, 0, 0],
  [28, 4, 47, 14, 48],
  [28, 6, 45, 14, 46],
  [28, 8, 47, 13, 48],
  [28, 19, 46, 4, 47],
  [28, 22, 45, 3, 46],
  [28, 3, 45, 23, 46],
  [28, 21, 45, 7, 46],
  [28, 19, 47, 10, 48],
  [28, 2, 46, 29, 47],
  [28, 10, 46, 23, 47],
  [28, 14, 46, 21, 47],
  [28, 14, 46, 23, 47],
  [28, 12, 47, 26, 48],
  [28, 6, 47, 34, 48],
  [28, 29, 46, 14, 47],
  [28, 13, 46, 32, 47],
  [28, 40, 47, 7, 48],
  [28, 18, 47, 31, 48],
];

/** 버전별 정렬 패턴 중심 좌표. 버전 1은 없다. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

const blocksOf = (version: number): { ecPerBlock: number; groups: number[][] } => {
  const row = EC_M[version - 1];

  if (row === undefined) throw new Error('지원하지 않는 QR 버전입니다.');

  const [ecPerBlock, count1, size1, count2, size2] = row;
  const groups: number[][] = [];

  for (let i = 0; i < count1; i += 1) groups.push(new Array<number>(size1).fill(0));
  for (let i = 0; i < count2; i += 1) groups.push(new Array<number>(size2).fill(0));

  return { ecPerBlock, groups };
};

/** 이 버전이 담을 수 있는 자료 코드워드 수. */
const dataCapacity = (version: number): number => {
  const { groups } = blocksOf(version);

  return groups.reduce((sum, block) => sum + block.length, 0);
};

/** 자료 길이를 적는 비트 수 — 바이트 모드는 버전 10부터 16비트다. */
const lengthBits = (version: number): number => (version < 10 ? 8 : 16);

/** 이 바이트 수를 담을 수 있는 가장 작은 버전. */
const pickVersion = (byteLength: number): number => {
  for (let version = 1; version <= 40; version += 1) {
    const bits = 4 + lengthBits(version) + byteLength * 8;

    if (bits <= dataCapacity(version) * 8) return version;
  }

  throw new Error('QR 한 장에 담기에 자료가 너무 깁니다.');
};

/** 자료 코드워드 — 모드·길이·본문·종단자·채움. */
const toDataCodewords = (bytes: Uint8Array, version: number): number[] => {
  const capacity = dataCapacity(version);
  const bits: number[] = [];
  const push = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, lengthBits(version));
  for (const byte of bytes) push(byte, 8);

  /* 종단자는 남은 자리만큼만 넣는다 — 자리가 없으면 넣지 않는다. */
  const terminator = Math.min(4, capacity * 8 - bits.length);

  push(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];

  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;

    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ?? 0);
    codewords.push(byte);
  }

  /* 채움 바이트는 236·17을 번갈아 쓴다(규격 고정값). */
  const PAD = [0xec, 0x11];

  while (codewords.length < capacity) {
    codewords.push(PAD[(codewords.length - bits.length / 8) % 2] ?? 0xec);
  }

  return codewords;
};

/** 블록을 나눠 정정 코드워드를 붙이고 규격 순서로 뒤섞는다. */
const toFinalCodewords = (data: number[], version: number): number[] => {
  const { ecPerBlock, groups } = blocksOf(version);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (const block of groups) {
    const slice = data.slice(offset, offset + block.length);

    offset += block.length;
    dataBlocks.push(slice);
    ecBlocks.push(errorCodewords(slice, ecPerBlock));
  }

  const result: number[] = [];
  const longest = Math.max(...dataBlocks.map((block) => block.length));

  for (let i = 0; i < longest; i += 1) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i] ?? 0);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) result.push(block[i] ?? 0);
  }

  return result;
};

type Grid = (boolean | null)[][];

const setModule = (grid: Grid, row: number, col: number, value: boolean): void => {
  const line = grid[row];

  if (line !== undefined) line[col] = value;
};

const moduleAt = (grid: Grid, row: number, col: number): boolean => grid[row]?.[col] === true;

/** 기능 패턴 — 위치 검출·구분자·타이밍·정렬·예약 자리. */
const placeFunctionPatterns = (grid: Grid, version: number): boolean[][] => {
  const size = grid.length;
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const reserve = (row: number, col: number): void => {
    const line = reserved[row];

    if (line !== undefined) line[col] = true;
  };

  const finder = (top: number, left: number): void => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = top + r;
        const col = left + c;

        if (row < 0 || row >= size || col < 0 || col >= size) continue;

        const isRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;

        setModule(grid, row, col, isRing || isCore);
        reserve(row, col);
      }
    }
  };

  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  /* 타이밍 — 여섯 번째 줄과 칸이 한 칸 걸러 검다. */
  for (let i = 8; i < size - 8; i += 1) {
    setModule(grid, 6, i, i % 2 === 0);
    setModule(grid, i, 6, i % 2 === 0);
    reserve(6, i);
    reserve(i, 6);
  }

  const centers = ALIGNMENT[version - 1] ?? [];
  const firstCenter = centers[0];
  const lastCenter = centers[centers.length - 1];

  for (const row of centers) {
    for (const col of centers) {
      /*
       * ⭐ 빼는 것은 **위치 검출 패턴과 겹치는 모서리 세 자리뿐**이다.
       * ⛔ 「이미 예약된 자리」로 판정하지 않는다 — 타이밍 줄 위에 놓이는 정렬 패턴이
       * 버전 7부터 실제로 있어서, 예약으로 거르면 그것들이 통째로 빠진다.
       */
      const isCorner =
        (row === firstCenter && col === firstCenter) ||
        (row === firstCenter && col === lastCenter) ||
        (row === lastCenter && col === firstCenter);

      if (isCorner) continue;

      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const isRing = Math.abs(r) === 2 || Math.abs(c) === 2;

          setModule(grid, row + r, col + c, isRing || (r === 0 && c === 0));
          reserve(row + r, col + c);
        }
      }
    }
  }

  /* 형식 정보 자리와 늘 검은 칸 하나. */
  for (let i = 0; i < 9; i += 1) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(8, size - 1 - i);
    reserve(size - 1 - i, 8);
  }
  setModule(grid, size - 8, 8, true);
  reserve(size - 8, 8);

  /* 버전 정보 자리 — 버전 7부터. */
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        reserve(i, size - 11 + j);
        reserve(size - 11 + j, i);
      }
    }
  }

  return reserved;
};

/** 자료 비트를 오른쪽 아래에서 지그재그로 채운다. */
const placeData = (grid: Grid, reserved: boolean[][], codewords: number[]): void => {
  const size = grid.length;
  let bit = 0;
  let upward = true;

  let right = size - 1;

  while (right > 0) {
    /*
     * ⭐ 여섯 번째 칸은 타이밍이라 건너뛰는데, **건너뛰면 그 뒤 열 짝의 홀짝이 통째로
     * 뒤집힌다.** 오른쪽 값을 그대로 두고 짝만 옮기면 어떤 열은 두 번 채워지고 0번 열은
     * 한 번도 채워지지 않는다 — 격자는 멀쩡히 그려지고 스캐너만 못 읽는다.
     */
    if (right === 6) right = 5;

    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;

      for (const col of [right, right - 1]) {
        if (reserved[row]?.[col] === true) continue;

        const byte = codewords[bit >> 3] ?? 0;
        const value = ((byte >> (7 - (bit % 8))) & 1) === 1;

        setModule(grid, row, col, value);
        bit += 1;
      }
    }
    right -= 2;
    upward = !upward;
  }
};

const MASKS: readonly ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 규격의 네 가지 벌점 — 낮을수록 스캐너가 헤매지 않는다. */
const penalty = (grid: Grid): number => {
  const size = grid.length;
  let score = 0;

  for (let i = 0; i < size; i += 1) {
    let rowRun = 1;
    let colRun = 1;

    for (let j = 1; j < size; j += 1) {
      rowRun = moduleAt(grid, i, j) === moduleAt(grid, i, j - 1) ? rowRun + 1 : 1;
      if (rowRun === 5) score += 3;
      else if (rowRun > 5) score += 1;

      colRun = moduleAt(grid, j, i) === moduleAt(grid, j - 1, i) ? colRun + 1 : 1;
      if (colRun === 5) score += 3;
      else if (colRun > 5) score += 1;
    }
  }

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const first = moduleAt(grid, r, c);

      if (
        first === moduleAt(grid, r, c + 1) &&
        first === moduleAt(grid, r + 1, c) &&
        first === moduleAt(grid, r + 1, c + 1)
      ) {
        score += 3;
      }
    }
  }

  /*
   * 위치 검출 패턴을 흉내 내는 1:1:3:1:1 줄에 벌점을 준다. 앞뒤 두 방향을 다 본다 —
   * 한 방향만 보면 뒤집힌 모양이 그대로 남아 스캐너가 그것을 모서리로 착각한다.
   */
  const FORWARD = [true, false, true, true, true, false, true, false, false, false, false];
  const BACKWARD = [...FORWARD].reverse();
  const scanLine = (line: boolean[]): number => {
    let found = 0;

    for (let start = 0; start + FORWARD.length <= line.length; start += 1) {
      const window = line.slice(start, start + FORWARD.length);

      if (window.every((cell, index) => cell === FORWARD[index])) found += 1;
      if (window.every((cell, index) => cell === BACKWARD[index])) found += 1;
    }

    return found * 40;
  };

  for (let i = 0; i < size; i += 1) {
    const row: boolean[] = [];
    const col: boolean[] = [];

    for (let j = 0; j < size; j += 1) {
      row.push(moduleAt(grid, i, j));
      col.push(moduleAt(grid, j, i));
    }
    score += scanLine(row) + scanLine(col);
  }

  let dark = 0;

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (moduleAt(grid, r, c)) dark += 1;
    }
  }

  const ratio = (dark * 100) / (size * size);

  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
};

/** BCH(15,5) — 형식 정보. */
const formatBits = (mask: number): number => {
  /* 정정 수준 M 의 표시자는 0b00 이다. */
  const data = (0b00 << 3) | mask;
  let value = data << 10;

  for (let i = 4; i >= 0; i -= 1) {
    if ((value >> (10 + i)) & 1) value ^= 0b10100110111 << i;
  }

  return ((data << 10) | value) ^ 0b101010000010010;
};

/** BCH(18,6) — 버전 정보. */
const versionBits = (version: number): number => {
  let value = version << 12;

  for (let i = 5; i >= 0; i -= 1) {
    if ((value >> (12 + i)) & 1) value ^= 0b1111100100101 << i;
  }

  return (version << 12) | value;
};

const applyFormat = (grid: Grid, mask: number): void => {
  const size = grid.length;
  const bits = formatBits(mask);
  const at = (index: number): boolean => ((bits >> index) & 1) === 1;

  /*
   * 왼쪽 위 한 벌 — **세로로 먼저** 여섯 칸(8번 칸의 0~5행), 모퉁이 세 칸, 그다음 가로 여섯 칸.
   * ⚠ 행과 칸을 바꿔 적기 쉬운 자리다. 바꿔 적어도 격자는 그려지고 스캐너만 못 읽는다.
   */
  for (let i = 0; i <= 5; i += 1) setModule(grid, i, 8, at(i));
  setModule(grid, 7, 8, at(6));
  setModule(grid, 8, 8, at(7));
  setModule(grid, 8, 7, at(8));
  for (let i = 9; i <= 14; i += 1) setModule(grid, 8, 14 - i, at(i));

  /* 두 번째 벌 — 8번 행의 오른쪽 여덟 칸과 8번 칸의 아래 일곱 행. 늘 검은 칸이 그 끝을 덮는다. */
  for (let i = 0; i <= 7; i += 1) setModule(grid, 8, size - 1 - i, at(i));
  for (let i = 8; i <= 14; i += 1) setModule(grid, size - 15 + i, 8, at(i));
  setModule(grid, size - 8, 8, true);
};

const applyVersion = (grid: Grid, version: number): void => {
  if (version < 7) return;

  const size = grid.length;
  const bits = versionBits(version);

  for (let i = 0; i < 18; i += 1) {
    const value = ((bits >> i) & 1) === 1;
    const row = Math.floor(i / 3);
    const col = i % 3;

    setModule(grid, row, size - 11 + col, value);
    setModule(grid, size - 11 + col, row, value);
  }
};

export interface QrMatrix {
  /** 한 변의 칸 수. 여백은 포함하지 않는다 — 여백은 그리는 쪽이 정한다. */
  size: number;
  /** `[행][칸]`. 참이 검은 칸이다. */
  modules: boolean[][];
  version: number;
  mask: number;
}

/**
 * 글을 QR 격자로 만든다. 정정 수준은 M 고정이다.
 *
 * ⛔ **여백(quiet zone)을 넣지 않는다** — 그리는 쪽이 배경과 함께 정한다. 여백 없이 인쇄하면
 * 스캐너가 못 읽으므로 `qr-code.tsx`가 반드시 넣는다.
 */
export const encodeQr = (text: string): QrMatrix => {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const codewords = toFinalCodewords(toDataCodewords(bytes, version), version);
  const size = version * 4 + 17;

  const base: Grid = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(false),
  );
  const reserved = placeFunctionPatterns(base, version);

  placeData(base, reserved, codewords);
  applyVersion(base, version);

  let best: { grid: Grid; mask: number; score: number } | null = null;

  for (let mask = 0; mask < MASKS.length; mask += 1) {
    const candidate: Grid = base.map((row) => [...row]);
    const rule = MASKS[mask];

    if (rule === undefined) continue;

    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (reserved[r]?.[c] === true) continue;
        if (rule(r, c)) setModule(candidate, r, c, !moduleAt(candidate, r, c));
      }
    }
    applyFormat(candidate, mask);

    const score = penalty(candidate);

    if (best === null || score < best.score) best = { grid: candidate, mask, score };
  }

  if (best === null) throw new Error('QR 마스크를 고르지 못했습니다.');

  return {
    size,
    version,
    mask: best.mask,
    modules: best.grid.map((row) => row.map((cell) => cell === true)),
  };
};
