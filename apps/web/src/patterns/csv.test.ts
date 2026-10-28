import { describe, expect, it } from 'vitest';

import { escapeCsvField, toCsvText } from './csv';

describe('escapeCsvField', () => {
  it('평범한 값은 그대로 둔다', () => {
    expect(escapeCsvField('합성 품목 A')).toBe('합성 품목 A');
  });

  it('큰따옴표, 쉼표, 줄바꿈이 든 값은 감싸고 안쪽 큰따옴표를 두 번 적는다', () => {
    expect(escapeCsvField('합성, "가"')).toBe('"합성, ""가"""');
    expect(escapeCsvField('합성\r\n가')).toBe('"합성\r\n가"');
  });

  it.each([
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+합성', "'+합성"],
    ['-합성', "'-합성"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=1', "'\t=1"],
    ['\r=1', `"'\r=1"`],
  ])('수식 첫 글자로 시작하는 글자 칸 %j 은 앞에 작은따옴표를 붙인다', (value, expected) => {
    expect(escapeCsvField(value)).toBe(expected);
  });

  it.each(['-5', '-0.25', '+3', '1e-3', '-1.5E+2'])('숫자 칸 %j 은 그대로 둔다', (value) => {
    expect(escapeCsvField(value)).toBe(value);
  });
});

describe('toCsvText', () => {
  it('머리줄과 자료 줄을 CRLF로 잇고 칸마다 같은 규칙을 쓴다', () => {
    const rows = [{ name: '=CMD()', qty: -2 }];
    expect(
      toCsvText(
        [
          { header: '이름', value: (row: (typeof rows)[number]) => row.name },
          { header: '수량', value: (row: (typeof rows)[number]) => String(row.qty) },
        ],
        rows,
      ),
    ).toBe("이름,수량\r\n'=CMD(),-2");
  });
});
