/**
 * 자재 LOT 번호의 분절 자릿수 — 제품코드9·수량9·날짜6·공급사6·번호4.
 * 자릿수는 자재 LOT 번호 체계에 종속되므로 다른 번호 체계에 그대로 쓰지 않는다.
 */
const SEGMENT_LENGTHS = [9, 9, 6, 6, 4];

const SEPARATOR = ' · ';

export const MATERIAL_LOT_NO_LENGTH = SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0);

export const isMaterialLotNo = (value: string): boolean => value.length === MATERIAL_LOT_NO_LENGTH;

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
