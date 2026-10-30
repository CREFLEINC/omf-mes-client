import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toDraft } from './draft';

const t = messages.inspectionSheetTemplate;

/** 두 버전의 값 한 줄 — 기준 · 비교, 다르면 changed(#208). */
export interface CompareRow {
  key: string;
  label: string;
  base: string;
  target: string;
  changed: boolean;
}

export type ItemChange = 'added' | 'removed' | 'changed' | 'same';

/** 검사 항목 한 줄 — 단계 · 항목 번호로 짝짓는다. */
export interface ItemCompareRow {
  key: string;
  step: string;
  code: string;
  base: string;
  target: string;
  change: ItemChange;
}

const text = (value: string): string => (value.trim() === '' ? '—' : value);

/** 검사표 상단 정보 · LOT 표시 자재를 두 버전으로 견준다. */
export const compareSettings = (
  base: InspectionSheetTemplate,
  target: InspectionSheetTemplate,
): CompareRow[] => {
  const left = toDraft(base);
  const right = toDraft(target);
  const lots = (draft: ReturnType<typeof toDraft>) =>
    draft.lotSources
      .map((row) => `${t.slots[row.slotCode] ?? row.slotCode}: ${row.label}`)
      .sort()
      .join(', ');

  const rows: [string, string, string, string][] = [
    [
      'layout',
      t.editor.layout,
      t.layouts[left.formLayoutCode] ?? left.formLayoutCode,
      t.layouts[right.formLayoutCode] ?? right.formLayoutCode,
    ],
    ['material', t.editor.materialText, text(left.materialText), text(right.materialText)],
    ['structure', t.editor.structureText, text(left.structureText), text(right.structureText)],
    [
      'rohs',
      t.editor.rohsFlag,
      left.rohsFlag ? t.compare.yes : t.compare.no,
      right.rohsFlag ? t.compare.yes : t.compare.no,
    ],
    ['product', t.editor.productNameText, text(left.productNameText), text(right.productNameText)],
    ['power', t.editor.powerText, text(left.powerText), text(right.powerText)],
    ['motor', t.editor.motorText, text(left.motorText), text(right.motorText)],
    ['remarks', t.editor.remarks, text(left.remarks), text(right.remarks)],
    ['lots', t.editor.lotSection, text(lots(left)), text(lots(right))],
  ];

  return rows.map(([key, label, a, b]) => ({ key, label, base: a, target: b, changed: a !== b }));
};

/** 쓰는 단계의 검사 항목을 두 버전으로 견준다 — 단계 · 항목 번호가 같으면 같은 항목이다. */
export const compareItems = (
  base: InspectionSheetTemplate,
  target: InspectionSheetTemplate,
): ItemCompareRow[] => {
  const describe = (nameKo: string, methodCode: string) =>
    `${nameKo} · ${t.methods[methodCode] ?? methodCode}`;
  const index = (template: InspectionSheetTemplate) => {
    const map = new Map<string, { step: string; code: string; value: string }>();
    for (const step of toDraft(template).steps.filter((each) => each.enabled)) {
      for (const item of step.items) {
        map.set(`${step.stepCode}/${item.checkItemCode}`, {
          step: step.nameKo || (t.steps[step.stepCode] ?? step.stepCode),
          code: item.checkItemCode,
          value: describe(item.nameKo, item.methodCode),
        });
      }
    }
    return map;
  };

  const left = index(base);
  const right = index(target);
  const keys = [...new Set([...left.keys(), ...right.keys()])];

  return keys.map((key) => {
    const a = left.get(key);
    const b = right.get(key);
    const any = (a ?? b)!;
    const change: ItemChange =
      a === undefined
        ? 'added'
        : b === undefined
          ? 'removed'
          : a.value === b.value
            ? 'same'
            : 'changed';
    return {
      key,
      step: any.step,
      code: any.code,
      base: a?.value ?? '—',
      target: b?.value ?? '—',
      change,
    };
  });
};
