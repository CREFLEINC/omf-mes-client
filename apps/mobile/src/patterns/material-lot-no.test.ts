import { describe, expect, it } from 'vitest';

import {
  isMaterialLotNo,
  isYymmdd,
  itemCodeOf,
  materialLotNoProblemOf,
  parseMaterialLotNo,
} from './material-lot-no';

const SCANNED = 'RM-1001|12.5|260731|SUP-001|0001';

describe('자재 LOT 번호 읽기', () => {
  it('다섯 칸을 구분자대로 읽는다', () => {
    expect(parseMaterialLotNo(SCANNED)).toEqual({
      itemCode: 'RM-1001',
      qty: '12.5',
      date: '260731',
      supplier: 'SUP-001',
      serial: '0001',
    });
    expect(materialLotNoProblemOf(SCANNED)).toBeNull();
  });

  it('제품코드를 첫 칸에서 꺼낸다', () => {
    expect(itemCodeOf(SCANNED)).toBe('RM-1001');
    expect(itemCodeOf('RM-1001')).toBeNull();
  });

  /* 옛 번호는 소급 변환하지 않는다. 스캔 단계에서 새 형식만 받는다. */
  it('옛 34자리 숫자 번호는 받지 않는다', () => {
    expect(materialLotNoProblemOf('7770001118880002229901015554447777')).toBe('format');
    expect(isMaterialLotNo('7770001118880002229901015554447777')).toBe(false);
  });

  it('칸이 다섯이 아니면 받지 않는다', () => {
    expect(materialLotNoProblemOf('RM-1001|12.5|260731|SUP-001')).toBe('format');
    expect(materialLotNoProblemOf(`${SCANNED}|X`)).toBe('format');
  });

  it('빈 칸이나 출력할 수 없는 글자가 있으면 받지 않는다', () => {
    expect(materialLotNoProblemOf('|12.5|260731|SUP-001|0001')).toBe('format');
    expect(materialLotNoProblemOf('RM-1001|12.5|260731||0001')).toBe('format');
    expect(materialLotNoProblemOf('자재-1001|12.5|260731|SUP-001|0001')).toBe('format');
    expect(materialLotNoProblemOf('RM-1001\t|12.5|260731|SUP-001|0001')).toBe('format');
  });

  it('수량 칸은 숫자 모양만 본다', () => {
    expect(isMaterialLotNo('RM-1001|100|260731|SUP-001|0001')).toBe(true);
    expect(isMaterialLotNo('RM-1001|12.50|260731|SUP-001|0001')).toBe(true);
    expect(materialLotNoProblemOf('RM-1001|12.|260731|SUP-001|0001')).toBe('format');
    expect(materialLotNoProblemOf('RM-1001|-1|260731|SUP-001|0001')).toBe('format');
    expect(materialLotNoProblemOf('RM-1001|1,000|260731|SUP-001|0001')).toBe('format');
  });

  it('번호 칸은 0001~9999 네 자리다', () => {
    expect(isMaterialLotNo('RM-1001|12.5|260731|SUP-001|9999')).toBe(true);
    expect(materialLotNoProblemOf('RM-1001|12.5|260731|SUP-001|0000')).toBe('format');
    expect(materialLotNoProblemOf('RM-1001|12.5|260731|SUP-001|001')).toBe('format');
  });

  it('날짜 칸만 없는 날짜면 따로 알린다', () => {
    expect(materialLotNoProblemOf('RM-1001|12.5|260231|SUP-001|0001')).toBe('badDate');
    expect(parseMaterialLotNo('RM-1001|12.5|260231|SUP-001|0001')).toBeNull();
    expect(materialLotNoProblemOf('RM-1001|12.5|2607A1|SUP-001|0001')).toBe('format');
  });

  /* 서버가 코드를 글자 그대로 견준다. 화면이 바꿔 읽으면 화면만 통과시킨다. */
  it('대소문자를 바꾸지 않는다', () => {
    expect(itemCodeOf('rm-1001|12.5|260731|sup-001|0001')).toBe('rm-1001');
    expect(parseMaterialLotNo('rm-1001|12.5|260731|sup-001|0001')?.supplier).toBe('sup-001');
  });

  it('길이로 막지 않는다', () => {
    const long = `${'A'.repeat(60)}|12.5|260731|${'B'.repeat(30)}|0001`;
    expect(isMaterialLotNo(long)).toBe(true);
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
