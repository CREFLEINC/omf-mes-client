/**
 * 자재 LOT 번호의 분절 자릿수 — 제품코드9·수량9·날짜6·공급사6·번호4.
 * 자릿수는 자재 LOT 번호 체계에 종속되므로 다른 번호 체계에 그대로 쓰지 않는다.
 */
const SEGMENT_LENGTHS = [9, 9, 6, 6, 4];

const SEPARATOR = ' · ';

export const MATERIAL_LOT_NO_LENGTH = SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0);

/**
 * 이 값이 자재 LOT 번호의 모양인가.
 *
 * 자릿수와 숫자 전용은 저장소 제약이 아니라 화면 책임이다 - 컬럼이 넉넉해 다른 모양도
 * 저장되고, 그러면 분절이 어긋난 채로 남는다.
 */
export const isMaterialLotNo = (value: string): boolean =>
  value.length === MATERIAL_LOT_NO_LENGTH && /^\d+$/.test(value);

/**
 * 저장은 원문, 표시는 분절 그룹핑한다(공유계약 E-2). 34자리를 붙여 쓰면 작업자가 실물
 * 라벨과 화면을 눈으로 대조할 수 없다. 자릿수가 다른 값은 끊지 않고 그대로 돌려준다 —
 * 임의로 끊으면 라벨과 어긋난 자리에서 잘린 글자가 보인다.
 */
export const formatMaterialLotNo = (lotNo: string): string => {
  if (!isMaterialLotNo(lotNo)) {
    return lotNo;
  }

  let cursor = 0;

  return SEGMENT_LENGTHS.map((length) => {
    const segment = lotNo.slice(cursor, cursor + length);
    cursor += length;
    return segment;
  }).join(SEPARATOR);
};

/** 자재 LOT 번호가 싣고 온 다섯 분절. 자릿수만 확정이고 도출 규칙은 이 계층 밖이다. */
export interface MaterialLotSegments {
  itemCode: string;
  /** 최초 납품 수량 스냅샷. 라인의 실제 수량과 다를 수 있다. */
  qty: string;
  /** YYMMDD. */
  date: string;
  supplier: string;
  serial: string;
}

/**
 * 번호를 분절로 끊는다.
 *
 * 자릿수가 맞지 않으면 끊지 않는다 - 어긋난 자리에서 끊으면 옆 분절의 숫자가 수량이나
 * 날짜로 읽혀, 라벨에 없는 값이 조용히 기록으로 남는다.
 */
export const parseMaterialLotNo = (value: string): MaterialLotSegments | null => {
  if (!isMaterialLotNo(value)) {
    return null;
  }

  let cursor = 0;
  const [itemCode, qty, date, supplier, serial] = SEGMENT_LENGTHS.map((length) => {
    const segment = value.slice(cursor, cursor + length);
    cursor += length;
    return segment;
  });

  return {
    itemCode: itemCode ?? '',
    qty: qty ?? '',
    date: date ?? '',
    supplier: supplier ?? '',
    serial: serial ?? '',
  };
};

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
