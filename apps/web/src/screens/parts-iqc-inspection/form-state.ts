import type { XrfResult, ItemJudgment } from './judgment';

/** 입력 칸 글자 그대로 둔다 — 「1.」처럼 쓰는 중인 값을 숫자로 바꾸면 커서 앞 글자가 사라진다. */
export interface PartsIqcForm {
  inspectedAt: string;
  /** 항목 id → 시료 순서대로 입력 글자 */
  values: Record<number, string[]>;
  /** 기타 합격/불합격 항목 id → 판정 */
  checks: Record<number, ItemJudgment>;
  visualInspectedQty: string;
  visualDefectQty: string;
  xrf: XrfResult;
  /** 외관 불량 유형 — 여럿 고른다. 둘 이상이면 유형마다 수량을 적는다(OA 화면 불량 내역과 같은 규칙). */
  defectCodeIds: number[];
  defectQtys: Record<number, string>;
  remarks: string;
}

export const emptyForm = (inspectedAt: string): PartsIqcForm => ({
  inspectedAt,
  values: {},
  checks: {},
  visualInspectedQty: '',
  visualDefectQty: '0',
  xrf: 'NOT_DONE',
  defectCodeIds: [],
  defectQtys: {},
  remarks: '',
});

/**
 * 되돌리기·다시 실행(레퍼런스 화면 아래 줄) — 바뀐 값마다 한 칸씩 쌓는다. 되돌린 뒤 새로 고치면 앞으로 갈 칸을 버린다.
 */
export interface FormHistory {
  past: PartsIqcForm[];
  present: PartsIqcForm;
  future: PartsIqcForm[];
}

/** 되돌리기 칸 수 — 측정값 수십 칸을 다 적어도 넘지 않을 만큼. */
const LIMIT = 200;

export type FormAction =
  | { type: 'change'; next: PartsIqcForm }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; form: PartsIqcForm };

export const startHistory = (form: PartsIqcForm): FormHistory => ({
  past: [],
  present: form,
  future: [],
});

export const historyReducer = (state: FormHistory, action: FormAction): FormHistory => {
  switch (action.type) {
    case 'change':
      if (action.next === state.present) return state;
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: action.next,
        future: [],
      };
    case 'undo': {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    case 'reset':
      return startHistory(action.form);
  }
};

/** 측정값 칸 하나를 바꾼다. */
export const withValue = (
  form: PartsIqcForm,
  itemId: number,
  index: number,
  text: string,
): PartsIqcForm => {
  const row = [...(form.values[itemId] ?? [])];
  row[index] = text;
  return { ...form, values: { ...form.values, [itemId]: row } };
};

/** 숫자로 읽을 수 있는 글자만 값이다. 빈칸·「-」·「1.2.3」은 아직 값이 아니다. */
export const numberOf = (text: string | undefined): number | null => {
  const trimmed = (text ?? '').trim();
  if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
};

/** 수량 칸 — 0 이상 정수만 받는다. */
export const countOf = (text: string): number | null => {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
};
