import type { InspectionSheet, InspectionSheetNg } from '@omf-mes/api-client';
import { ko } from '@omf-mes/i18n';
import type { Workbook, Worksheet } from 'exceljs';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { itemColumns, itemMark, ngSlots, type PrintItemRow } from './print-layout';

/**
 * 제품 검사표 엑셀 — 고객 양식(OP·PP향 제품검사표 공검및출하 KR · B-05-101)을 빈 양식으로 만든 것(`templates/*.xlsx`)에
 * 이 검사표의 값을 칸마다 채운다(사용자 결정 2026-11-02 · #217). 테두리 · 글꼴 · 칸 합치기는 고객 양식 그대로다.
 * 빈 양식은 고객 파일에서 견본 값 · 사람 이름 · 수식 · 항목 목록만 지운 것이다 — □ 상자 · 빈칸 틀 · 주의 · 주 같은 안내 글은 남겼다
 * (작업 폴더 밖 스크립트로 만들었다). 값이 없는 칸 · 빈 NG 블록 · 남는 단계 칸은 그 안내 글이 그대로 보인다.
 */
const l = ko.inspectionSheetPrint;

/** 양식별 칸 자리 — 고객 파일의 「WY1 한국어」 시트에서 읽었다. */
interface FormCells {
  head: {
    model: string;
    spec: string;
    destination: string;
    serial: string;
    writtenAt: string;
    approved: string;
    checked: string;
    writer: string;
  };
  /** NG 블록 — 열(왼쪽부터 NG 1 · 2 …)과 줄. */
  ngColumns: readonly string[];
  ngRows: Partial<Record<NgRowKey, number>>;
  /** 단계 판정 칸 — 줄마다 [단계 이름 칸, 판정 칸, 서명 칸]. */
  stepSlots: readonly (readonly [string, string, string])[];
  /** 항목 칸 둘 — 단계 · 항목 번호 · 이름 · 전수 · 발취 열과 줄 범위. */
  items: readonly {
    step: string;
    code: string;
    name: string;
    full: string;
    sample: string;
    rows: readonly [number, number];
  }[];
}

type NgRowKey =
  | 'foundDepartment'
  | 'foundStep'
  | 'occurrence'
  | 'standardNo'
  | 'itemNo'
  | 'content'
  | 'investigation'
  | 'ngType'
  | 'repairDepartment'
  | 'repairWorker'
  | 'repairedAt'
  | 'recheckResult'
  | 'recheckWorker'
  | 'recheckedAt';

const FORMS: Record<InspectionSheet['formLayoutCode'], FormCells> = {
  OP: {
    head: {
      model: 'B2',
      spec: 'B3',
      destination: 'B4',
      serial: 'B5',
      writtenAt: 'H3',
      approved: 'I3',
      checked: 'J3',
      writer: 'L3',
    },
    ngColumns: ['B', 'D', 'F'],
    ngRows: {
      foundDepartment: 19,
      foundStep: 20,
      occurrence: 21,
      standardNo: 22,
      itemNo: 23,
      content: 24,
      investigation: 30,
      ngType: 36,
      repairDepartment: 37,
      repairWorker: 38,
      repairedAt: 41,
      recheckResult: 44,
      recheckWorker: 47,
      recheckedAt: 50,
    },
    stepSlots: [19, 23, 27, 31, 35, 39, 42].map((r) => [`H${r}`, `I${r}`, `K${r}`] as const),
    items: [
      { step: 'N', code: 'O', name: 'P', full: 'S', sample: 'T', rows: [4, 52] },
      { step: 'V', code: 'W', name: 'X', full: 'AA', sample: 'AB', rows: [4, 55] },
    ],
  },
  PP: {
    head: {
      model: 'B2',
      spec: 'B3',
      destination: 'B4',
      serial: 'B5',
      writtenAt: 'F3',
      approved: 'G3',
      checked: 'H3',
      writer: 'I3',
    },
    ngColumns: ['B', 'C', 'D', 'E', 'F'],
    ngRows: {
      foundStep: 15,
      standardNo: 16,
      itemNo: 17,
      occurrence: 18,
      content: 19,
      investigation: 24,
      ngType: 29,
      repairDepartment: 30,
      repairWorker: 31,
      repairedAt: 32,
      recheckWorker: 33,
      recheckResult: 34,
      recheckedAt: 35,
    },
    stepSlots: [15, 17, 19, 21, 23, 25, 27, 29].map((r) => [`G${r}`, `H${r}`, `I${r}`] as const),
    items: [
      { step: 'J', code: 'K', name: 'L', full: 'N', sample: 'O', rows: [4, 36] },
      { step: 'P', code: 'Q', name: 'R', full: 'Z', sample: 'AA', rows: [4, 30] },
    ],
  },
};

/** 날짜 칸 — 현장 시각의 날짜만(양식의 작성일 · 수리일 · 재검일). */
const day = (iso: string | null): string =>
  iso === null ? '' : (formatPlantDateTime(iso) ?? '').slice(0, 10);

const box = (on: boolean, label: string): string => `${on ? '■' : '□'} ${label}`;

/** 판정 칸 — 양식의 「□ OK / □ NG / → □ OK」에 결과를 칠한다(첫 줄 1차, 셋째 줄 NG 뒤 재검 OK). */
const judgmentBoxes = (step: InspectionSheet['steps'][number]): string => {
  const first = step.result?.firstJudgmentCode ?? null;
  const recheckOk = first === 'NG' && step.result?.finalJudgmentCode === 'OK';
  return `${box(first === 'OK', 'OK')}\n${box(first === 'NG', 'NG')}\n　→ ${box(recheckOk, 'OK')}`;
};

const set = (ws: Worksheet, address: string, value: string | null | undefined): void => {
  const cell = ws.getCell(address);
  (cell.isMerged ? cell.master : cell).value = value ?? '';
};

/** 값이 있을 때만 쓴다 — 없으면 양식의 안내 글(「구조 : ( )×( )」 · 기본 재료 문구 등)을 그대로 둔다(사용자 지시 2026-11-02). */
const setIf = (ws: Worksheet, address: string, value: string | null | undefined): void => {
  if (value !== null && value !== undefined && value !== '') set(ws, address, value);
};
const labeled = (label: string, value: string | null): string | null =>
  value === null || value === '' ? null : `${label} : ${value}`;

const fillHead = (ws: Worksheet, sheet: InspectionSheet, form: FormCells): void => {
  const h = form.head;
  set(ws, h.model, sheet.modelText);
  set(ws, h.spec, sheet.specText);
  set(ws, h.destination, sheet.destinationText);
  // 양식의 바코드 글꼴(Code 39)은 앞뒤 별표가 있어야 읽힌다.
  set(ws, h.serial, `*${sheet.serialNo}*`);
  set(ws, h.writtenAt, day(sheet.createdAt));
  set(ws, h.approved, sheet.approvedByName);
  set(ws, h.checked, sheet.checkedByName);
  set(ws, h.writer, sheet.writtenWorkerName);
  const rohs = `${box(sheet.rohsFlag, l.rohsYes)} ${box(!sheet.rohsFlag, l.rohsNo)}`;
  if (sheet.formLayoutCode === 'OP') {
    setIf(ws, 'B9', sheet.materialText);
    setIf(ws, 'A10', labeled(l.structure, sheet.structureText));
    set(ws, 'C11', sheet.pcbLotNo);
    set(ws, 'C13', sheet.fwProductionVersion);
    set(ws, 'J13', sheet.fwQualityVersion);
    set(ws, 'C15', sheet.sdLotNo);
    set(ws, 'J15', sheet.stapleLotNo);
    set(ws, 'H45', `${l.rohs} : ${rohs}`);
    set(ws, 'H48', sheet.tempPackNote);
    set(ws, 'J50', sheet.overallResultCode);
  } else {
    setIf(ws, 'A8', labeled(l.productName, sheet.productNameText));
    setIf(ws, 'A9', labeled(l.power, sheet.powerText));
    setIf(ws, 'E9', labeled(l.motor, sheet.motorText));
    setIf(ws, 'B10', sheet.materialText);
    setIf(ws, 'A11', labeled(l.structure, sheet.structureText));
    set(ws, 'G11', rohs);
    set(ws, 'A12', `${l.inputTime} : ${formatPlantDateTime(sheet.createdAt) ?? ''}`);
    set(ws, 'C13', sheet.fwProductionVersion);
    set(ws, 'H13', sheet.fwQualityVersion);
    set(ws, 'H31', sheet.tempPackNote);
    set(ws, 'H33', rohs);
    set(ws, 'H35', sheet.overallResultCode);
  }
};

const fillNgs = (ws: Worksheet, sheet: InspectionSheet, form: FormCells): void => {
  const dept = (code: string | null): string =>
    code === null ? '' : (l.departments[code] ?? code);
  const stepName = (code: string | null): string =>
    sheet.steps.find((s) => s.stepCode === code)?.nameKo ?? code ?? '';
  const values: Record<NgRowKey, (ng: InspectionSheetNg) => string> = {
    foundDepartment: (ng) =>
      `${box(ng.foundDepartmentCode === 'PRODUCTION', l.departments.PRODUCTION ?? '')}\n${box(ng.foundDepartmentCode === 'QUALITY', l.departments.QUALITY ?? '')}`,
    foundStep: (ng) => stepName(ng.foundStepCode),
    occurrence: (ng) => ng.occurrenceProcessText ?? '',
    standardNo: (ng) => ng.standardNo ?? '',
    itemNo: (ng) => ng.checkItemCode ?? '',
    content: (ng) => ng.ngContent,
    investigation: (ng) => ng.investigationText ?? '',
    ngType: (ng) =>
      `${box(ng.ngTypeCode === 'WORK', l.types.WORK ?? '')}\n${box(ng.ngTypeCode === 'PART', l.types.PART ?? '')}`,
    repairDepartment: (ng) =>
      sheet.formLayoutCode === 'OP'
        ? `${box(ng.repairDepartmentCode === 'PRODUCTION', l.departments.PRODUCTION ?? '')}\n${box(ng.repairDepartmentCode === 'TECH', l.departments.TECH ?? '')}`
        : dept(ng.repairDepartmentCode),
    repairWorker: (ng) => ng.repairWorkerName ?? ng.repairWorkerNo ?? '',
    repairedAt: (ng) => day(ng.repairedAt),
    recheckResult: (ng) => ng.recheckResultCode ?? '',
    recheckWorker: (ng) => ng.recheckWorkerName ?? ng.recheckWorkerNo ?? '',
    recheckedAt: (ng) => day(ng.recheckedAt),
  };
  ngSlots(sheet).slots.forEach((ng, index) => {
    const column = form.ngColumns[index];
    if (ng === null || column === undefined) return;
    for (const [key, row] of Object.entries(form.ngRows) as [NgRowKey, number][]) {
      set(ws, `${column}${String(row)}`, values[key](ng));
    }
  });
};

const fillSteps = (ws: Worksheet, sheet: InspectionSheet, form: FormCells): void => {
  /* 단계 수보다 남는 칸은 양식 그대로(단계 이름 · 빈 □ 상자) 둔다. */
  form.stepSlots.forEach(([name, judgment, sign], index) => {
    const step = sheet.steps[index];
    if (step === undefined) return;
    set(ws, name, step.nameKo);
    set(ws, judgment, judgmentBoxes(step));
    set(ws, sign, step.result?.signedByName ?? '');
  });
};

/** 항목 칸 — 단계가 이어지는 줄은 단계 칸을 합친다(양식의 「공정검사1」 묶음). 칸 수를 넘친 줄은 싣지 않는다. */
const fillItems = (ws: Worksheet, sheet: InspectionSheet, form: FormCells): void => {
  const { left, right } = itemColumns(sheet, 'ko');
  const write = (rows: PrintItemRow[], area: FormCells['items'][number]) => {
    const [first, last] = area.rows;
    rows.slice(0, last - first + 1).forEach((row, index) => {
      const r = first + index;
      if (row.step !== null) {
        set(ws, `${area.step}${String(r)}`, row.step.label);
        const end = Math.min(last, r + row.step.span - 1);
        if (end > r) ws.mergeCells(`${area.step}${String(r)}:${area.step}${String(end)}`);
      }
      set(ws, `${area.code}${String(r)}`, row.code);
      set(ws, `${area.name}${String(r)}`, row.name);
      set(ws, `${area.full}${String(r)}`, itemMark(row.full));
      set(ws, `${area.sample}${String(r)}`, itemMark(row.sample));
    });
  };
  const [leftArea, rightArea] = form.items;
  if (leftArea !== undefined) write(left, leftArea);
  if (rightArea !== undefined) write(right, rightArea);
};

/** 빈 양식(엑셀 파일 내용)에 검사표를 채워 새 엑셀 파일 내용으로 돌려준다. */
export const fillSheetWorkbook = async (
  workbook: Workbook,
  template: ArrayBuffer,
  sheet: InspectionSheet,
): Promise<ArrayBuffer> => {
  await workbook.xlsx.load(template);
  const ws = workbook.worksheets[0];
  if (ws === undefined) throw new Error('template has no sheet');
  const form = FORMS[sheet.formLayoutCode];
  fillHead(ws, sheet, form);
  fillNgs(ws, sheet, form);
  fillSteps(ws, sheet, form);
  fillItems(ws, sheet, form);
  return workbook.xlsx.writeBuffer();
};
