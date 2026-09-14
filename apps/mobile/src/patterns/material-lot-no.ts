/**
 * 자재 LOT 번호 — `|` 로 가른 다섯 칸이다(설계 통보 277).
 *
 * ```
 * RM-1001|12.5|260731|SUP-001|0001
 * 제품코드 |수량|날짜  |공급사 |번호
 * ```
 *
 * 형식은 자재 LOT 번호 체계에만 속한다. 생산 LOT 같은 다른 번호에 그대로 쓰지 않는다.
 */
const SEPARATOR = '|';
const SEGMENT_COUNT = 5;

/** 칸 값은 출력 가능한 ASCII 한 글자 이상이다. `|` 는 가를 때 이미 빠진다. */
const PRINTABLE = /^[\x20-\x7E]+$/;

/** 모양만 본다. 공급사가 `12.50` 으로 찍은 라벨은 다시 찍을 수 없다. */
const QTY = /^\d+(\.\d+)?$/;

const SERIAL = /^\d{4}$/;

/** 자재 LOT 번호가 싣고 온 다섯 칸. */
export interface MaterialLotSegments {
  /** 품목 마스터의 품목코드 원본. */
  itemCode: string;
  /** 최초 납품 수량 스냅샷. 라인의 실제 수량과 다를 수 있고 단위는 싣지 않는다. */
  qty: string;
  /** YYMMDD. 업무 판단에 쓰지 않는다. */
  date: string;
  /** 거래처 마스터의 거래처코드 원본. */
  supplier: string;
  serial: string;
}

/** 형식이 아니다(`format`), 날짜 칸만 없는 날짜다(`badDate`). */
export type MaterialLotNoProblem = 'format' | 'badDate';

/**
 * 라벨의 YYMMDD 가 실제 날짜인가.
 *
 * 자릿수만 보면 `260231` 같은 값이 통과한다. Date 는 그것을 3월 3일로 굴려 받아, 없는
 * 날짜가 있는 날짜로 조용히 바뀐다.
 */
export const isYymmdd = (value: string): boolean => {
  if (!/^\d{6}$/.test(value)) {
    return false;
  }

  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const at = new Date(Date.UTC(year, month - 1, day));

  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
};

/** 날짜가 실재하는지만 빼고 모양을 본다. 날짜만 틀린 라벨을 따로 알리려고 나눈다. */
const shapeOf = (value: string): MaterialLotSegments | null => {
  const parts = value.split(SEPARATOR);

  if (parts.length !== SEGMENT_COUNT) {
    return null;
  }

  const [itemCode = '', qty = '', date = '', supplier = '', serial = ''] = parts;

  if (
    !PRINTABLE.test(itemCode) ||
    !PRINTABLE.test(supplier) ||
    !QTY.test(qty) ||
    !/^\d{6}$/.test(date) ||
    !SERIAL.test(serial) ||
    serial === '0000'
  ) {
    return null;
  }

  return { itemCode, qty, date, supplier, serial };
};

/**
 * 이 값이 자재 LOT 번호로 읽히지 않는 이유. 읽히면 `null`.
 *
 * ⛔ 대소문자를 바꾸지 않는다. 서버가 코드를 글자 그대로 견주므로, 화면이 바꿔 읽으면 화면은
 *    통과시키고 서버는 거부한다.
 *
 * 길이는 보지 않는다. 앞뒤 공백은 부르는 쪽이 뗀다.
 */
export const materialLotNoProblemOf = (value: string): MaterialLotNoProblem | null => {
  const shape = shapeOf(value);

  if (shape === null) {
    return 'format';
  }

  return isYymmdd(shape.date) ? null : 'badDate';
};

/** 번호를 칸으로 읽는다. 형식이 아니면 끊지 않는다 — 어긋나게 끊은 값이 기록으로 남는다. */
export const parseMaterialLotNo = (value: string): MaterialLotSegments | null => {
  const shape = shapeOf(value);

  return shape !== null && isYymmdd(shape.date) ? shape : null;
};

export const isMaterialLotNo = (value: string): boolean => parseMaterialLotNo(value) !== null;

/** 라벨과 견줄 코드 — 품목코드와 공급사의 거래처코드. */
export interface MaterialLotCodes {
  itemCode: string;
  supplierCode: string;
}

export type MaterialLotCodeMismatch = 'otherItem' | 'otherSupplier';

/**
 * 라벨의 제품코드·공급사 칸이 견줄 코드와 다른가.
 *
 * 두 칸은 마스터 코드 원본이라 글자 그대로 견준다 — 서버의 입하 등록 대조와 같은 규칙이다.
 * 품목이 다르면 그것만 알린다. 그 라벨은 이미 틀렸고, 겹쳐 알리면 무엇을 고칠지 흐려진다.
 */
export const codeMismatchOf = (
  segments: MaterialLotSegments,
  codes: MaterialLotCodes,
): MaterialLotCodeMismatch | null => {
  if (segments.itemCode !== codes.itemCode) {
    return 'otherItem';
  }

  return segments.supplier === codes.supplierCode ? null : 'otherSupplier';
};

/**
 * 자재 LOT 번호 첫 칸의 제품코드.
 *
 * 품목 마스터 코드 원본이 그대로 실려 있어, 이것으로 품목을 찾아 자재 P/O 후보를 좁힌다.
 */
export const itemCodeOf = (lotNo: string): string | null =>
  parseMaterialLotNo(lotNo)?.itemCode ?? null;
