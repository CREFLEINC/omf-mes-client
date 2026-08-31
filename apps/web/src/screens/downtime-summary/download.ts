import type { DistributionRow } from './types';

/**
 * 내려받기 — **서버에 경로가 없어 화면이 파일을 만든다.**
 *
 * 그래서 파일에 담기는 것은 **지금 화면이 받은 분포 그대로**다. 서버가 다시 세는 것이 아니므로
 * 화면과 파일이 어긋날 수 없고, 반대로 화면에 없는 줄은 파일에도 없다.
 *
 * **만드는 일과 내보내는 일을 가른다.** 문자열을 만드는 쪽(`toCsv`)은 순수 함수라 감지기를
 * 붙일 수 있고, 브라우저에 넘기는 쪽(`saveCsv`)은 부수 효과만 남는다. 한 함수에 두면 감싸기가
 * 없는 자리에서 이스케이프가 틀려도 아무도 모른다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 칸 하나를 CSV 규칙(RFC 4180)으로 감싼다.
 *
 * ⭐ **쉼표만 보고 감싸면 안 된다.** 큰따옴표·줄바꿈이 든 값을 그대로 흘리면 그 줄부터 칸이
 * 통째로 밀린다 — 파일은 열리고 숫자만 엉뚱한 열에 앉으므로 **아무도 눈치채지 못한다.**
 * 사유 이름과 설비 이름은 사람이 적는 값이라 셋 다 실제로 들어올 수 있다.
 *
 * 감싼 안쪽의 큰따옴표는 두 번 적어 벗어난다 — 백슬래시가 아니다.
 */
export const escapeCsvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export interface CsvColumn {
  header: string;
  /** 칸 하나의 글자. 값이 없으면 **빈 칸**으로 둔다 — 0으로 채우면 잰 값처럼 읽힌다. */
  value: (row: DistributionRow) => string;
}

/**
 * 표를 CSV 글자로 만든다.
 *
 * 줄 끝은 `\r\n`이다 — 표 계산 프로그램들이 그것을 기대하고, `\n`만 쓰면 한 줄로 붙어 열리는
 * 환경이 있다.
 */
export const toCsv = (rows: readonly DistributionRow[], columns: readonly CsvColumn[]): string => {
  const lines = [
    columns.map((column) => escapeCsvField(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvField(column.value(row))).join(',')),
  ];

  return lines.join('\r\n');
};

/**
 * 한글이 깨지지 않게 앞에 붙이는 표식(UTF-8 BOM).
 *
 * ⚠ 붙이지 않으면 표 계산 프로그램이 파일을 현지 인코딩으로 읽어 **사유 이름이 전부 깨진다.**
 * 사용자는 그것을 「이 시스템이 한글을 못 쓴다」로 읽는다.
 */
const BOM = '﻿';

/**
 * 만든 글자를 파일로 내보낸다. **브라우저에만 닿는 자리**라 순수하지 않다.
 *
 * 만든 주소는 반드시 되돌려준다 — 돌려주지 않으면 내려받을 때마다 그 문서가 메모리에 남는다.
 */
export const saveCsv = (fileName: string, content: string): void => {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
};
