import type {
  InspectionSheet,
  InspectionSheetJudgment,
  InspectionSheetStep,
} from '@omf-mes/api-client';

export type PrintLang = 'ko' | 'vi';

/** 양식 가운데 항목 칸의 줄 수 — OP 4~52행 · PP 4~36행. 넘치면 오른쪽 칸으로 이어진다. */
export const LEFT_ITEM_ROWS = { OP: 49, PP: 33 } as const;
/** 양식의 NG 블록 수 — OP 3 · PP 5. */
export const NG_SLOTS = { OP: 3, PP: 5 } as const;

export interface PrintItemRow {
  /** 단계 묶음의 첫 줄에만 단계 이름과 묶음 줄 수가 붙는다(표의 rowspan). */
  step: { label: string; span: number } | null;
  code: string;
  name: string;
  full: InspectionSheetJudgment | null;
  sample: InspectionSheetJudgment | null;
}

const nameIn = (lang: PrintLang, names: { nameKo: string; nameVi: string | null }): string =>
  lang === 'vi' ? (names.nameVi ?? names.nameKo) : names.nameKo;

/** 단계별 항목을 출력 줄로 편다 — 판정은 전수/발취 칸 중 그 항목의 칸에만 들어간다. */
const flatten = (steps: readonly InspectionSheetStep[], lang: PrintLang) =>
  steps.flatMap((step) =>
    step.items.map((item) => ({
      stepLabel: nameIn(lang, step),
      code: item.checkItemCode,
      name: nameIn(lang, item),
      full: item.methodCode === 'FULL' ? item.judgmentCode : null,
      sample: item.methodCode === 'SAMPLE' ? item.judgmentCode : null,
    })),
  );

/** 한 칸 안에서 같은 단계가 이어지는 줄을 묶는다 — 칸이 바뀌면 단계 이름을 다시 적는다(양식의 「공정검사3」 이어짐). */
const group = (rows: ReturnType<typeof flatten>): PrintItemRow[] =>
  rows.map((row, index) => {
    if (index > 0 && rows[index - 1]?.stepLabel === row.stepLabel) {
      return { step: null, code: row.code, name: row.name, full: row.full, sample: row.sample };
    }
    let span = 1;
    while (rows[index + span]?.stepLabel === row.stepLabel) span += 1;
    return {
      step: { label: row.stepLabel, span },
      code: row.code,
      name: row.name,
      full: row.full,
      sample: row.sample,
    };
  });

/** 항목 줄을 가운데 칸(양식별 {@link LEFT_ITEM_ROWS}줄)과 오른쪽 칸으로 나눈다. */
export const itemColumns = (
  sheet: InspectionSheet,
  lang: PrintLang,
): { left: PrintItemRow[]; right: PrintItemRow[] } => {
  const rows = flatten(sheet.steps, lang);
  const size = LEFT_ITEM_ROWS[sheet.formLayoutCode];
  return { left: group(rows.slice(0, size)), right: group(rows.slice(size)) };
};

const box = (on: boolean, label: string): string => `${on ? '■' : '□'}${label}`;

/**
 * 판정 칸 — 양식의 「□OK □NG / ↳ □OK」 상자에 결과를 칠한다(첫 줄 1차 판정, 둘째 줄 NG 뒤 재검 OK). 미입력은 빈 상자.
 */
export const stepJudgment = (step: InspectionSheetStep): string => {
  const first = step.result?.firstJudgmentCode ?? null;
  const recheckOk = first === 'NG' && step.result?.finalJudgmentCode === 'OK';
  return `${box(first === 'OK', 'OK')} ${box(first === 'NG', 'NG')}\n↳ ${box(recheckOk, 'OK')}`;
};

/** 항목 판정 표시 — 양식 주의 ①② 대로 합격은 √, 불량은 ×. */
export const itemMark = (judgment: InspectionSheetJudgment | null): string =>
  judgment === 'OK' ? '√' : judgment === 'NG' ? '×' : '';

/** NG 블록 — 양식 칸 수만큼 채우고(빈 칸 포함), 넘친 건수를 따로 센다. */
export const ngSlots = (sheet: InspectionSheet) => {
  const size = NG_SLOTS[sheet.formLayoutCode];
  return {
    slots: Array.from({ length: size }, (_, index) => sheet.ngs[index] ?? null),
    more: Math.max(0, sheet.ngs.length - size),
  };
};
