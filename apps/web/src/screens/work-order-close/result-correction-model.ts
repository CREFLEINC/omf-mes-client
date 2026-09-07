import type { components } from '@omf-mes/api-client';

type ProductionResult = components['schemas']['ProductionResult'];
export type ProductionResultCorrect = components['schemas']['ProductionResultCorrect'];

export const CORRECTION_QUANTITY_FIELDS = [
  'goodQty',
  'defectQty',
  'holdQty',
  'scrapQty',
  'reworkQty',
] as const;

export type CorrectionQuantityField = (typeof CORRECTION_QUANTITY_FIELDS)[number];

export interface ProductionResultRow {
  productionResultId: number;
  resultSequence: number;
  correctsProductionResultId: number | null;
  goodQty: number;
  defectQty: number;
  holdQty: number;
  scrapQty: number;
  reworkQty: number;
  occurredAt: string;
  recordedAt: string | null;
  workerId: number;
}

export interface ProductionResultCorrectionDraft {
  reasonCode: string;
  note: string;
  goodQty: string;
  defectQty: string;
  holdQty: string;
  scrapQty: string;
  reworkQty: string;
}

export interface CorrectionDraftResult {
  body: ProductionResultCorrect | null;
  fieldErrors: Partial<Record<keyof ProductionResultCorrectionDraft, string>>;
}

export const toProductionResultRow = (result: ProductionResult): ProductionResultRow => ({
  productionResultId: result.productionResultId,
  resultSequence: result.resultSequence,
  correctsProductionResultId: result.correctsProductionResultId ?? null,
  goodQty: result.goodQty,
  defectQty: result.defectQty,
  holdQty: result.holdQty,
  scrapQty: result.scrapQty,
  reworkQty: result.reworkQty,
  occurredAt: result.occurredAt,
  recordedAt: result.recordedAt ?? null,
  workerId: result.workerId,
});

export const createProductionResultCorrectionDraft = (
  result: ProductionResultRow,
): ProductionResultCorrectionDraft => ({
  reasonCode: '',
  note: '',
  goodQty: String(result.goodQty),
  defectQty: String(result.defectQty),
  holdQty: String(result.holdQty),
  scrapQty: String(result.scrapQty),
  reworkQty: String(result.reworkQty),
});

const quantityError = '0 이상의 수량을 입력하세요.';

/**
 * 화면은 등급을 계산하지 않는다. 입력값을 계약 본문으로 옮기고 A/B 판정은 서버 응답에 맡긴다.
 * 원본과 같은 수량은 보내지 않아 서버가 실제 변경 필드만 판정할 수 있게 한다.
 */
export const toProductionResultCorrect = (
  original: ProductionResultRow,
  draft: ProductionResultCorrectionDraft,
): CorrectionDraftResult => {
  const fieldErrors: CorrectionDraftResult['fieldErrors'] = {};
  const reasonCode = draft.reasonCode.trim();

  if (reasonCode === '') fieldErrors.reasonCode = '정정 사유를 선택하세요.';

  const body: ProductionResultCorrect = { reasonCode };
  const note = draft.note.trim();
  if (note !== '') body.note = note;

  for (const field of CORRECTION_QUANTITY_FIELDS) {
    const text = draft[field].trim();
    const value = Number(text);
    if (text === '' || !Number.isFinite(value) || value < 0) {
      fieldErrors[field] = quantityError;
      continue;
    }
    if (value !== original[field]) body[field] = value;
  }

  return {
    body: Object.keys(fieldErrors).length === 0 ? body : null,
    fieldErrors,
  };
};

const RFC3339_MINUTE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export const formatProductionResultAt = (value: string): string => {
  const matched = RFC3339_MINUTE.exec(value);
  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
