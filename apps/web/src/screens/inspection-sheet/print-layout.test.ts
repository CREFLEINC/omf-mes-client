import type { InspectionSheet, InspectionSheetStep } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { itemColumns, itemMark, LEFT_ITEM_ROWS, ngSlots, stepJudgment } from './print-layout';

const step = (
  code: InspectionSheetStep['stepCode'],
  count: number,
  nameVi: string | null = null,
): InspectionSheetStep => ({
  stepCode: code,
  sequenceNo: 1,
  nameKo: code,
  nameVi,
  signRequired: true,
  result: null,
  items: Array.from({ length: count }, (_, index) => ({
    inspectionSheetTemplateItemId: index + 1,
    sequenceNo: index + 1,
    checkItemCode: `${code}-${index + 1}`,
    nameKo: `항목 ${index + 1}`,
    nameVi: `Hạng mục ${index + 1}`,
    methodCode: index % 2 === 0 ? 'FULL' : 'SAMPLE',
    judgmentCode: index === 0 ? 'NG' : 'OK',
  })),
});

const sheet = (steps: InspectionSheetStep[], ngCount = 0, layout: 'OP' | 'PP' = 'OP') =>
  ({
    formLayoutCode: layout,
    steps,
    ngs: Array.from({ length: ngCount }, (_, index) => ({ sequenceNo: index + 1 })),
  }) as unknown as InspectionSheet;

describe('제품 검사표 출력 배치', () => {
  it('항목은 가운데 칸 49줄을 채운 뒤 오른쪽 칸으로 넘어가고, 넘어간 단계는 이름을 다시 적는다', () => {
    const { left, right } = itemColumns(
      sheet([step('PROCESS_1', 30), step('PROCESS_2', 30)]),
      'ko',
    );

    expect(left).toHaveLength(LEFT_ITEM_ROWS.OP);
    expect(right).toHaveLength(11);
    expect(left[0]?.step).toEqual({ label: 'PROCESS_1', span: 30 });
    expect(left[30]?.step).toEqual({ label: 'PROCESS_2', span: 19 });
    expect(right[0]?.step).toEqual({ label: 'PROCESS_2', span: 11 });
    expect(left[1]?.step).toBeNull();
  });

  it('PP 양식은 가운데 칸이 33줄이다', () => {
    const { left, right } = itemColumns(sheet([step('PROCESS_1', 40)], 0, 'PP'), 'ko');

    expect(left).toHaveLength(LEFT_ITEM_ROWS.PP);
    expect(right).toHaveLength(7);
  });

  it('판정은 그 항목의 전수/발취 칸에만 들어가고, 베트남어 출력은 베트남어 이름을 쓴다', () => {
    const { left } = itemColumns(sheet([step('PROCESS_1', 2, 'Kiểm tra 1')]), 'vi');

    expect(left[0]).toMatchObject({
      full: 'NG',
      sample: null,
      name: 'Hạng mục 1',
      step: { label: 'Kiểm tra 1', span: 2 },
    });
    expect(left[1]).toMatchObject({ full: null, sample: 'OK' });
  });

  it('단계 판정은 양식 상자에 칠한다 — 미입력은 빈 상자, NG 를 재검으로 넘겼으면 NG 와 재검 OK 를 칠한다', () => {
    const base = step('PROCESS_1', 0);
    expect(stepJudgment(base)).toBe('□OK □NG\n↳ □OK');
    expect(itemMark('OK')).toBe('√');
    expect(itemMark('NG')).toBe('×');
    expect(itemMark(null)).toBe('');
    expect(
      stepJudgment({
        ...base,
        result: {
          firstJudgmentCode: 'NG',
          finalJudgmentCode: 'OK',
          sourceCode: 'SHEET',
          inspectedWorkerNo: null,
          inspectedWorkerName: null,
          inspectedAt: '2026-10-21T00:00:00Z',
          signedBy: null,
          signedByName: null,
          signedAt: null,
        },
      }),
    ).toBe('□OK ■NG\n↳ ■OK');
  });

  it('NG 블록은 양식 칸 수(OP 3 · PP 5)만큼 채우고 넘친 건수를 센다', () => {
    expect(ngSlots(sheet([], 1)).slots).toHaveLength(3);
    expect(ngSlots(sheet([], 4))).toMatchObject({ more: 1 });
    expect(ngSlots(sheet([], 4, 'PP'))).toMatchObject({ more: 0 });
  });
});
