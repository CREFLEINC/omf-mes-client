import type { components } from '@omf-mes/api-client';

type ItemSpec = components['schemas']['InspectionItemSpec'];

/** 시드 `INSPECTION_MEASUREMENT_JUDGMENT` · `INSPECTION_RESULT_OVERALL_JUDGMENT` */
export const ACCEPTED = 'ACCEPTED';
export const REJECTED = 'REJECTED';
export const HELD = 'HELD';

export type ItemJudgment = 'ACCEPTED' | 'REJECTED' | null;

/** XRF 결과 — 「미실시」는 측정값을 싣지 않는다. */
export type XrfResult = 'NOT_DONE' | 'OK' | 'NG';

/**
 * 부품 IQC 성적서의 항목 갈래(omf-all-around#211).
 *   - 치수: 수치 항목 — 시료마다 값(n1~nN)을 받아 규격으로 판정한다.
 *   - 외관: 육안(`VISUAL`) 「Bề ngoài·Ngoại quan」 항목 — 외관 불량 수로 판정한다.
 *   - XRF: 이름에 RoHS·XRF 가 든 합격/불합격 항목 — XRF 결과로 판정한다.
 *   - 그 밖: 자재 서류 확인·RESIN 시험 등 — OK/NG 를 고른다.
 */
export type ItemKind = 'dimension' | 'visual' | 'xrf' | 'check';

export const kindOf = (item: ItemSpec): ItemKind => {
  if (item.dataTypeCode === 'NUMERIC') return 'dimension';
  if (/ROHS|XRF/i.test(item.inspectionItemName)) return 'xrf';
  // 육안 항목 중 「Bề ngoài·Ngoại quan(외관)」만 외관 불량 수로 판정한다 — AF Coating·수지 색상 같은 다른 육안 항목은 OK/NG 를 고른다.
  if (
    item.inspectionMethodCode === 'VISUAL' &&
    /^(BỀ NGOÀI|NGOẠI QUAN)/i.test(item.inspectionItemName.normalize('NFC').trim())
  )
    return 'visual';
  return 'check';
};

/** 값 하나가 규격 안인가. 값이 없으면 `null`. 하한·상한 중 없는 쪽은 보지 않는다. */
export const judgeValue = (
  value: number | null,
  item: Pick<ItemSpec, 'lowerLimit' | 'upperLimit'>,
): ItemJudgment => {
  if (value === null) return null;
  const { lowerLimit, upperLimit } = item;
  if (lowerLimit !== undefined && lowerLimit !== null && value < lowerLimit) return REJECTED;
  if (upperLimit !== undefined && upperLimit !== null && value > upperLimit) return REJECTED;
  return ACCEPTED;
};

/** 항목의 허용 불량 수(c) — 항목에 없으면 버전의 합격판정개수, 그것도 없으면 0 이다. */
export const acceptanceOf = (
  item: Pick<ItemSpec, 'acceptanceNumber'>,
  versionAcceptance: number | null,
): number => item.acceptanceNumber ?? versionAcceptance ?? 0;

/**
 * 치수 항목 하나의 판정 — 시료를 다 재야 낸다. 규격을 벗어난 시료 수가 c 이하이면 합격이다(「n=5c=1」).
 */
export const judgeDimension = (
  values: readonly (number | null)[],
  item: ItemSpec,
  versionAcceptance: number | null,
): { judgment: ItemJudgment; outCount: number } => {
  const judged = values.map((value) => judgeValue(value, item));
  const outCount = judged.filter((j) => j === REJECTED).length;
  if (judged.some((j) => j === null)) return { judgment: null, outCount };
  return {
    judgment: outCount > acceptanceOf(item, versionAcceptance) ? REJECTED : ACCEPTED,
    outCount,
  };
};

export interface JudgmentInput {
  inspectedQty: number | null;
  visualDefectQty: number | null;
  dimensions: { judgment: ItemJudgment; outCount: number }[];
  xrf: { required: boolean; result: XrfResult };
  checks: ItemJudgment[];
}

/**
 * 불합격 수량 — 외관 불량 수 + 불합격 치수 항목의 벗어난 시료 수 + NG 인 XRF·기타 항목(항목당 1).
 * 검사 수량을 넘지 않는다(합격 + 불합격 = 검사 수량).
 */
export const rejectedQtyOf = (input: JudgmentInput): number => {
  const dimension = input.dimensions
    .filter((d) => d.judgment === REJECTED)
    .reduce((sum, d) => sum + d.outCount, 0);
  const others =
    (input.xrf.result === 'NG' ? 1 : 0) + input.checks.filter((j) => j === REJECTED).length;
  const total = (input.visualDefectQty ?? 0) + dimension + others;
  return input.inspectedQty === null ? total : Math.min(total, input.inspectedQty);
};

/**
 * 제안 판정 — 하나라도 NG 면 불합격, 모두 OK 면 합격. 다 적지 않았으면 `null`(제출할 수 없다).
 * XRF 가 필요한 기준인데 「미실시」면 판정을 내지 않는다.
 */
export const suggestedJudgmentOf = (input: JudgmentInput): 'ACCEPTED' | 'REJECTED' | null => {
  if (input.inspectedQty === null || input.inspectedQty <= 0 || input.visualDefectQty === null)
    return null;
  const parts: ItemJudgment[] = [
    input.visualDefectQty > 0 ? REJECTED : ACCEPTED,
    ...input.dimensions.map((d) => d.judgment),
    ...input.checks,
  ];
  if (input.xrf.required)
    parts.push(
      input.xrf.result === 'NOT_DONE' ? null : input.xrf.result === 'NG' ? REJECTED : ACCEPTED,
    );
  if (parts.some((p) => p === REJECTED)) return REJECTED;
  if (parts.some((p) => p === null)) return null;
  return ACCEPTED;
};

/**
 * 서버가 기대하는 판정(`inspection-rules.ts` · omf-all-around#125) — 버전의 합격판정개수가 있을 때만 잰다.
 * 고른 판정이 이것과 다르면 서버가 판정 변경 사유를 요구한다.
 */
export const serverExpectedOf = (
  rejectedQty: number,
  versionAcceptance: number | null,
): 'ACCEPTED' | 'REJECTED' | null => {
  if (versionAcceptance === null) return null;
  return rejectedQty > versionAcceptance ? REJECTED : ACCEPTED;
};

/**
 * 불량 기록 — 불합격으로 확정할 때 싣는다(서버는 불합격 IQC 에 한 줄 이상을 요구한다).
 * 수량의 기준은 외관 불량 수, 외관 불량이 없으면(치수·XRF 불합격) 불합격 수량이다.
 * 유형이 하나면 그 기준 수량 그대로, 둘 이상이면 유형마다 적은 수량이고 합계가 기준 수량과 같아야 한다(OA 화면 #197 과 같은 규칙).
 */
export const resolveDefectRows = (
  codeIds: readonly number[],
  qtys: Readonly<Record<number, string>>,
  target: number,
):
  | { rows: { defectCodeId: number; defectQty: number }[] }
  | { blocked: 'required' | 'qty' | 'sum' } => {
  if (codeIds.length === 0) return { blocked: 'required' };
  if (codeIds.length === 1)
    return { rows: [{ defectCodeId: codeIds[0] as number, defectQty: Math.max(1, target) }] };
  const rows = codeIds.map((id) => ({
    defectCodeId: id,
    defectQty: Number((qtys[id] ?? '').trim()),
  }));
  if (rows.some((row) => !Number.isInteger(row.defectQty) || row.defectQty <= 0))
    return { blocked: 'qty' };
  const sum = rows.reduce((total, row) => total + row.defectQty, 0);
  if (target > 0 && sum !== target) return { blocked: 'sum' };
  return { rows };
};
