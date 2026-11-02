import type { InspectionSheet } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import opTemplateUrl from './templates/op-ko.xlsx?url';
import ppTemplateUrl from './templates/pp-ko.xlsx?url';
import { fillSheetWorkbook } from './xlsx-form';

const t = messages.inspectionSheet;

const TEMPLATES: Record<InspectionSheet['formLayoutCode'], string> = {
  OP: opTemplateUrl,
  PP: ppTemplateUrl,
};

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 브라우저의 「다른 이름으로 저장」 창(크롬 · 엣지) — 없는 브라우저는 기본 내려받기 폴더로 받는다. */
interface SaveFilePicker {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

/** 검사표 한 장을 고객 양식(OP · PP향) 엑셀로 만든다 — 엑셀 부품은 내려받을 때만 불러온다. */
export const buildSheetXlsx = async (sheet: InspectionSheet): Promise<Blob> => {
  const [{ default: ExcelJS }, template] = await Promise.all([
    import('exceljs'),
    fetch(TEMPLATES[sheet.formLayoutCode]).then((response) => {
      // 양식을 못 받으면(404 등) 깨진 파일을 만들지 않고 실패로 알린다.
      if (!response.ok) throw new Error(`template ${String(response.status)}`);
      return response.arrayBuffer();
    }),
  ]);
  const content = await fillSheetWorkbook(new ExcelJS.Workbook(), template, sheet);
  return new Blob([content], { type: XLSX_TYPE });
};

/**
 * 엑셀 내려받기 — 고객 양식(B-05-101)에 값을 채운 .xlsx(사용자 결정 2026-11-02 · #217). 저장할 곳과 이름을 고르는 창을 띄우고,
 * 창을 닫으면(취소) 아무것도 하지 않는다. 창을 못 띄우는 브라우저는 기본 내려받기 폴더로 받는다.
 */
export const downloadSheetXlsx = async (sheet: InspectionSheet): Promise<void> => {
  const fileName = t.excel.fileName(sheet.serialNo);
  const picker = (window as unknown as SaveFilePicker).showSaveFilePicker;
  if (picker === undefined) {
    const url = URL.createObjectURL(await buildSheetXlsx(sheet));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    // 문서에 붙여 눌러야 받는 브라우저가 있고, 주소는 내려받기가 시작된 뒤에 푼다.
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  try {
    // 창을 먼저 띄운다 — 파일을 만드는 사이 사용자 동작(클릭)의 유효 시간이 지나면 창이 막힌다.
    const handle = await picker({
      suggestedName: fileName,
      types: [{ description: t.excel.fileType, accept: { [XLSX_TYPE]: ['.xlsx'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(await buildSheetXlsx(sheet));
    await writable.close();
  } catch (error) {
    // 저장 창에서 취소하면 AbortError — 받지 않은 것이 맞다.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    throw error;
  }
};
