import { describe, expect, it } from 'vitest';

import {
  MATERIAL_LOT_NO_LENGTH,
  formatMaterialLotNo,
  isMaterialLotNo,
  isYymmdd,
  parseMaterialLotNo,
} from './material-lot-no';

const SCANNED = '7770001118880002229901015554447777';

describe('자재 LOT 번호 표시', () => {
  it('분절 자릿수의 합이 34다', () => {
    expect(MATERIAL_LOT_NO_LENGTH).toBe(34);
  });

  it('다섯 토막으로 끊어 보인다', () => {
    expect(formatMaterialLotNo(SCANNED)).toBe('777000111 · 888000222 · 990101 · 555444 · 7777');
  });

  it('끊은 값을 이어 붙이면 원문이다', () => {
    expect(formatMaterialLotNo(SCANNED).split(' · ').join('')).toBe(SCANNED);
  });

  it('자릿수가 다르면 끊지 않고 그대로 둔다', () => {
    expect(formatMaterialLotNo('SYN-LOT-0001')).toBe('SYN-LOT-0001');
    expect(formatMaterialLotNo(`${SCANNED}9`)).toBe(`${SCANNED}9`);
  });

  it('34자리인지 판정한다', () => {
    expect(isMaterialLotNo(SCANNED)).toBe(true);
    expect(isMaterialLotNo(SCANNED.slice(1))).toBe(false);
  });
});

describe('숫자 전용', () => {
  /* 자릿수와 숫자 전용은 저장소가 막지 않는다. 화면이 지키지 않으면 분절이 어긋난 채 남는다. */
  it('숫자가 아닌 글자가 섞이면 자재 LOT 번호로 보지 않는다', () => {
    expect(isMaterialLotNo('7770001118880002229901015554447777')).toBe(true);
    expect(isMaterialLotNo('777000111888000222990101555444777A')).toBe(false);
    expect(isMaterialLotNo('777000111888000222990101555444-777')).toBe(false);
  });
});

describe('분절 읽기', () => {
  it('다섯 분절을 자릿수대로 끊는다', () => {
    expect(parseMaterialLotNo(SCANNED)).toEqual({
      itemCode: '777000111',
      qty: '888000222',
      date: '990101',
      supplier: '555444',
      serial: '7777',
    });
  });

  /* 어긋난 자리에서 끊으면 옆 분절의 숫자가 수량이나 날짜로 읽힌다. */
  it('자릿수가 다르면 끊지 않는다', () => {
    expect(parseMaterialLotNo(SCANNED.slice(1))).toBeNull();
  });
});

describe('라벨 날짜', () => {
  it('있는 날짜를 받는다', () => {
    expect(isYymmdd('260731')).toBe(true);
  });

  /* Date 는 2월 31일을 3월 3일로 굴려 받는다. 없는 날짜가 있는 날짜로 바뀐다. */
  it('없는 날짜를 막는다', () => {
    expect(isYymmdd('260231')).toBe(false);
    expect(isYymmdd('261301')).toBe(false);
    expect(isYymmdd('260700')).toBe(false);
  });

  it('여섯 자리 숫자가 아니면 막는다', () => {
    expect(isYymmdd('26073')).toBe(false);
    expect(isYymmdd('2607A1')).toBe(false);
  });
});
