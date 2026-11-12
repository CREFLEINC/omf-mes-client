import type { ItemJudgment } from './judgment';

/** 입력 칸 글자 그대로 둔다 — 「1.」처럼 쓰는 중인 값을 숫자로 바꾸면 커서 앞 글자가 사라진다. */
export interface PartsIqcForm {
  inspectedAt: string;
  /** 항목 id → 시료 순서대로 입력 글자 */
  values: Record<number, string[]>;
  /** 기타 합격/불합격 항목 id → 판정 */
  checks: Record<number, ItemJudgment>;
  /** 기타 항목 중 텍스트 항목 id → 적은 글(#247 · 사용자 지시 2026-11-10) */
  texts: Record<number, string>;
  /** AQL 기준에서 NG 인 기타 항목 id → 찾은 불량 수 글자(omf-all-around#264) */
  defects: Record<number, string>;
  visualInspectedQty: string;
  remarks: string;
}

export const emptyForm = (inspectedAt: string): PartsIqcForm => ({
  inspectedAt,
  values: {},
  checks: {},
  texts: {},
  defects: {},
  visualInspectedQty: '',
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

/**
 * 두 입력이 같은 내용인가 — 빈 칸 · 고르지 않은 판정은 없는 것과 같다. OK 를 눌렀다 풀거나 적었다 지우면 처음과 같다
 * (임시 저장 · 떠날 때 묻기의 기준 · #247 사용자 지시 2026-11-10).
 */
export const sameForm = (a: PartsIqcForm, b: PartsIqcForm): boolean => {
  const key = (form: PartsIqcForm) =>
    JSON.stringify({
      ...form,
      values: Object.fromEntries(
        Object.entries(form.values)
          .map(([id, row]) => [id, row.map((text) => text.trim())] as const)
          .filter(([, row]) => row.some((text) => text !== ''))
          .map(([id, row]) => [id, row.join('|').replace(/\|+$/, '')]),
      ),
      checks: Object.fromEntries(Object.entries(form.checks).filter(([, j]) => j != null)),
      texts: Object.fromEntries(
        Object.entries(form.texts)
          .map(([id, text]) => [id, text.trim()] as const)
          .filter(([, text]) => text !== ''),
      ),
      defects: Object.fromEntries(
        Object.entries(form.defects)
          .map(([id, text]) => [id, text.trim()] as const)
          .filter(([id, text]) => text !== '' && form.checks[Number(id)] === 'REJECTED'),
      ),
      visualInspectedQty: form.visualInspectedQty.trim(),
      remarks: form.remarks.trim(),
    });
  return key(a) === key(b);
};
