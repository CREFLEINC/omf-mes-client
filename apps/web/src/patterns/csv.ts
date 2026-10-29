/**
 * 화면이 만드는 CSV 파일(엑셀 내보내기). 서버에 내려받기 경로가 없는 화면이 받은 줄로 파일을 만든다.
 *
 * 만드는 일(`escapeCsvField`, `toCsvText`)은 순수 함수, 내보내는 일(`saveCsv`)은 부수 효과만 둔다.
 * 한 함수에 두면 감싸기가 틀려도 시험으로 잡을 자리가 없다.
 */

/** 표 계산 프로그램이 수식으로 읽는 첫 글자. 탭과 CR도 수식 앞에 붙어 같은 일을 한다. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** 숫자 칸(음수, 소수, 지수 포함). 수식 첫 글자로 시작해도 값 그대로 둔다. */
const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/**
 * 칸 하나를 RFC 4180으로 감싼다. 큰따옴표, 쉼표, 줄바꿈이 든 값은 감싸고 안쪽 큰따옴표는 두 번 적는다.
 *
 * 수식 첫 글자(`=`, `+`, `-`, `@`, 탭, CR)로 시작하는 글자 칸은 앞에 작은따옴표를 붙인다. 품목명,
 * 거래처명처럼 사람이 적은 값이 파일을 연 사람의 엑셀에서 수식으로 실행되지 않게 한다(CSV 수식 주입).
 * 숫자 칸은 바꾸지 않는다. 음수가 글자로 바뀌면 합계가 틀린다.
 */
export const escapeCsvField = (value: string): string => {
  const guarded = FORMULA_START.test(value) && !NUMERIC.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

export interface CsvColumn<Row> {
  header: string;
  /** 칸 하나의 글자. 값이 없으면 빈 칸으로 둔다. 0으로 채우면 잰 값처럼 읽힌다. */
  value: (row: Row) => string;
}

/** 머리줄과 자료 줄. 줄 끝은 `\r\n`이다. `\n`만 쓰면 한 줄로 붙어 열리는 환경이 있다. */
export const toCsvText = <Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string =>
  [
    columns.map((column) => escapeCsvField(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvField(column.value(row))).join(',')),
  ].join('\r\n');

/**
 * 한글이 깨지지 않게 앞에 붙이는 표식(UTF-8 BOM). 붙이지 않으면 표 계산 프로그램이 파일을 현지
 * 인코딩으로 읽어 한글이 전부 깨진다.
 */
const BOM = '﻿';

/** 만든 글자를 파일로 내보낸다. 만든 주소는 되돌려준다. 돌려주지 않으면 내려받을 때마다 메모리에 남는다. */
export const saveCsv = (fileName: string, content: string): void => {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
};
