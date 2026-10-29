import {
  escapeCsvField,
  saveCsv,
  toCsvText,
  type CsvColumn as SharedCsvColumn,
} from '../../patterns/csv';
import type { DistributionRow } from './types';

/**
 * 내려받기 — **서버에 경로가 없어 화면이 파일을 만든다.**
 *
 * 그래서 파일에 담기는 것은 **지금 화면이 받은 분포 그대로**다. 서버가 다시 세는 것이 아니므로
 * 화면과 파일이 어긋날 수 없고, 반대로 화면에 없는 줄은 파일에도 없다.
 *
 * 칸 감싸기, 수식 주입 막기, 줄 끝, BOM은 공용 `patterns/csv`가 정한다. 이 파일은 이 화면의 줄 모양만 잇는다.
 */

export { escapeCsvField, saveCsv };

export type CsvColumn = SharedCsvColumn<DistributionRow>;

/** 표를 CSV 글자로 만든다. */
export const toCsv = (rows: readonly DistributionRow[], columns: readonly CsvColumn[]): string =>
  toCsvText(columns, rows);
