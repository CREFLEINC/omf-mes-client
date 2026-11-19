import type { InspectionSheetStep } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  firstFromItems,
  fullProgress,
  sameJudgments,
  savedJudgments,
  stepSave,
} from './step-judgment';

const item = (
  id: number,
  methodCode: 'FULL' | 'SAMPLE',
  judgmentCode: 'OK' | 'NG' | null = null,
) => ({
  inspectionSheetTemplateItemId: id,
  sequenceNo: id,
  checkItemCode: `S ${id}`,
  nameKo: `항목 ${id}`,
  nameVi: null,
  methodCode,
  judgmentCode,
});

const step = (items: ReturnType<typeof item>[]): InspectionSheetStep => ({
  stepCode: 'PROCESS_1',
  sequenceNo: 1,
  nameKo: '공정검사1',
  nameVi: null,
  signRequired: true,
  result: null,
  items,
});

describe('단계 판정', () => {
  const twoItems = step([item(1, 'FULL'), item(2, 'SAMPLE')]);

  it('NG 를 눌러도 남은 전수 항목이 있으면 판정이 정해지지 않아 임시 저장이다', () => {
    expect(firstFromItems(twoItems, { 2: 'NG' })).toBeNull();
    expect(stepSave(twoItems, { 2: 'NG' }, null)).toEqual({ mode: 'draft' });
  });

  it('전수 항목을 다 판정하면 하나라도 NG(발취 포함)면 NG 다', () => {
    expect(stepSave(twoItems, { 1: 'OK', 2: 'NG' }, null)).toEqual({ mode: 'final', first: 'NG' });
    expect(stepSave(twoItems, { 1: 'NG' }, null)).toEqual({ mode: 'final', first: 'NG' });
  });

  it('전수 항목이 모두 OK 면 OK 다 — 발취 항목은 비어도 된다', () => {
    expect(firstFromItems(twoItems, { 1: 'OK' })).toBe('OK');
    expect(stepSave(twoItems, { 1: 'OK' }, null)).toEqual({ mode: 'final', first: 'OK' });
  });

  it('전수 항목이 남았으면 항목 판정만 임시 저장한다 — 판정이 기록된 단계는 막는다', () => {
    expect(firstFromItems(twoItems, {})).toBeNull();
    expect(stepSave(twoItems, { 2: 'OK' }, null)).toEqual({ mode: 'draft' });
    const recorded = {
      ...twoItems,
      result: {
        firstJudgmentCode: 'NG',
        finalJudgmentCode: 'NG',
        sourceCode: 'SHEET',
        inspectedAt: '2026-10-21T03:00:00Z',
        signedAt: null,
      },
    } as unknown as InspectionSheetStep;
    expect(stepSave(recorded, { 2: 'OK' }, null).mode).toBe('blocked');
  });

  it('전수 항목 진행을 센다 · 저장값과 같은지 본다', () => {
    expect(fullProgress(twoItems, { 1: 'OK', 2: 'OK' })).toEqual({ done: 1, total: 1 });
    expect(sameJudgments({ 1: 'OK' }, { 1: 'OK' })).toBe(true);
    expect(sameJudgments({ 1: 'OK' }, { 1: 'NG' })).toBe(false);
    expect(sameJudgments({}, { 1: 'OK' })).toBe(false);
  });

  it('항목이 없는 단계는 사람이 판정을 고른다', () => {
    const empty = step([]);
    expect(firstFromItems(empty, {})).toBeNull();
    expect(stepSave(empty, {}, null).mode).toBe('blocked');
    expect(stepSave(empty, {}, 'OK')).toEqual({ mode: 'final', first: 'OK' });
  });

  it('저장된 항목 판정을 입력 시작값으로 읽는다', () => {
    expect(savedJudgments(step([item(1, 'FULL', 'OK'), item(2, 'SAMPLE')]))).toEqual({ 1: 'OK' });
  });
});
