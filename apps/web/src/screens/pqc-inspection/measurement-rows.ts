import type { components } from '@omf-mes/api-client';

/**
 * 항목별 측정치 그리드의 줄.
 *
 * ⭐ **줄은 「항목 × 샘플」이다.** 기준 버전의 항목마다 `measurementCount` 만큼 샘플이 있고
 * (그 값이 `sample_no` 의 상한이다), 각 샘플이 한 줄이다. 검사기준이 「치수를 3개 재라」고
 * 하면 세 줄이 선다.
 *
 * ⚠ **`sequenceNo` 를 그대로 보이지 않는다.** 계약이 「화면은 이 값을 그대로 보여주지 않고
 * 목록 내 위치로 1부터 연속 표시한다」고 못박았다 — 채번 값에 구멍이 있어도 사용자에게는
 * 1, 2, 3 으로 보여야 한다.
 *
 * ⛔ **미검교정 여부를 화면이 계산하지 않는다.** 서버가 측정 시점 기준으로 판정해
 * `calibrationExpiredAtMeasurement` 로 내려 준다(공유계약 L-2). 화면은 그것을 그대로 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type InspectionItemSpecResponse = components['schemas']['InspectionItemSpec'];
export type InspectionMeasurementResponse = components['schemas']['InspectionMeasurement'];

/**
 * 규격 한 줄이 보이는 값. **없는 것을 지어내지 않는다.**
 *
 * ⛔ **단위(`uomId`)를 싣지 않는다.** 계약이 식별자만 주고 이름을 주지 않아, 그대로 그리면
 * 「목표 10 · 20」 같은 숫자가 붙어 노이즈가 된다. 이름을 채우는 참조 조회를 얹지 않는 것이
 * 이 슬라이스의 규율이다(`queries.ts` 머리). 쓰지 않을 값을 모아 두면 다음 사람이
 * 「왜 안 그리지」를 되짚으므로 **아예 담지 않는다.**
 */
export interface SpecRange {
  target: number | null;
  lower: number | null;
  upper: number | null;
}

export interface MeasurementRow {
  /** 화면 열쇠 — 항목과 샘플이 함께 한 줄을 가리킨다 */
  key: string;
  inspectionItemSpecId: number;
  /** **목록 내 위치로 1부터.** 채번 값(`sequenceNo`)이 아니다 */
  displayNo: number;
  itemName: string;
  itemCode: string;
  /**
   * 측정치를 **어느 칸에 담는지** 정한다(`NUMERIC`·`TEXT`·`BOOLEAN`). 화면이 값 입력 칸의
   * 모양을 이 값으로 고르고, 규격 대비 판정도 수치형에만 뜻이 있다.
   */
  dataTypeCode: string;
  /**
   * 이 항목을 **상·하한으로 자동 판정할지**(§5-11). 기준정보가 항목마다 갖는 스위치다.
   * ⛔ 화면이 정하는 값이 아니다 — 검사기준 등록 화면에서 사람이 켜고 끈다.
   */
  automaticJudgment: boolean;
  /** 이 항목의 몇 번째 샘플인가. 1부터 */
  sampleNo: number;
  /** 이 항목이 요구하는 샘플 수 — 같은 항목의 줄들이 공유한다 */
  sampleCount: number;
  required: boolean;
  spec: SpecRange;
  /** 저장된 측정치. 아직 재지 않았으면 `null` */
  measured: MeasuredValue | null;
}

export interface MeasuredValue {
  numericValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  judgmentCode: string;
  measuredAt: string;
  inspectionEquipmentId: number | null;
  /** ⭐ 서버가 판정한 값. 화면이 계산하지 않는다 */
  calibrationExpired: boolean;
}

const toMeasuredValue = (item: InspectionMeasurementResponse): MeasuredValue => ({
  numericValue: item.numericValue ?? null,
  textValue: item.textValue ?? null,
  booleanValue: item.booleanValue ?? null,
  judgmentCode: item.judgmentCode,
  measuredAt: item.measuredAt,
  inspectionEquipmentId: item.inspectionEquipmentId ?? null,
  calibrationExpired: item.calibrationExpiredAtMeasurement ?? false,
});

/** 측정치를 「항목·샘플」로 찾을 수 있게 접는다. */
const indexOf = (measurements: InspectionMeasurementResponse[]): Map<string, MeasuredValue> => {
  const index = new Map<string, MeasuredValue>();

  for (const item of measurements) {
    index.set(`${item.inspectionItemSpecId}-${item.sampleNo}`, toMeasuredValue(item));
  }

  return index;
};

/** 계약이 준 차례(`sequenceNo` 오름차순)를 믿지 않고 다시 정렬한다 — 표시 번호가 그것을 따른다. */
const bySequence = (left: InspectionItemSpecResponse, right: InspectionItemSpecResponse): number =>
  left.sequenceNo - right.sequenceNo;

/**
 * 항목 규격과 저장된 측정치를 합쳐 그리드의 줄을 만든다.
 *
 * **아직 재지 않은 자리도 줄로 만든다** — 검사기준이 요구하는 항목이 몇 개인지가 화면의
 * 정보이고, 빠진 줄을 감추면 검사자가 무엇을 더 재야 하는지 알 수 없다.
 */
export const toMeasurementRows = (
  specs: InspectionItemSpecResponse[],
  measurements: InspectionMeasurementResponse[],
): MeasurementRow[] => {
  const index = indexOf(measurements);

  return [...specs].sort(bySequence).flatMap((spec, position) => {
    /* 계약이 최솟값 1을 두었으나 0이 와도 줄이 사라지지 않게 한다. */
    const sampleCount = spec.measurementCount > 0 ? spec.measurementCount : 1;

    return Array.from({ length: sampleCount }, (_unused, offset) => {
      const sampleNo = offset + 1;

      return {
        key: `${spec.inspectionItemSpecId}-${sampleNo}`,
        inspectionItemSpecId: spec.inspectionItemSpecId,
        displayNo: position + 1,
        itemName: spec.inspectionItemName,
        itemCode: spec.inspectionItemCode,
        dataTypeCode: spec.dataTypeCode,
        /* 계약 기본값이 참이다 — 값이 안 오면 「자동 판정한다」로 읽는다. */
        automaticJudgment: spec.automaticJudgment ?? true,
        sampleNo,
        sampleCount,
        required: spec.requiredFlag,
        spec: {
          target: spec.targetValue ?? null,
          lower: spec.lowerLimit ?? null,
          upper: spec.upperLimit ?? null,
        },
        measured: index.get(`${spec.inspectionItemSpecId}-${sampleNo}`) ?? null,
      };
    });
  });
};

/**
 * 잰 값이 규격을 벗어났는가.
 *
 * ⛔ **이 판정이 불합격을 만들지 않는다**(스펙 §6). 규격 밖 측정치는 **표시하고 사람이
 * 판정한다** — 화면이 자동으로 불합격을 매기면 검사자가 보지 못한 사이에 판정이 굳는다.
 * 이 함수의 유일한 쓸모는 「눈에 띄게 하는 것」이다.
 *
 * **한쪽만 있는 규격도 규격이다.** 상한만 있으면 상한만 견주고, 하한만 있으면 하한만
 * 견준다 — 둘 다 있을 때만 견주면 「9.9 이상」 같은 흔한 공차가 판정에서 빠진다.
 *
 * **숫자가 아닌 측정치는 규격 밖이 아니다.** 문자·불리언 항목에는 상하한이 뜻을 갖지
 * 않는다 — 없는 규격을 어겼다고 말하지 않는다.
 */
export const isOutOfSpec = (row: MeasurementRow): boolean => {
  const value = row.measured?.numericValue;

  if (value === null || value === undefined) return false;

  const { lower, upper } = row.spec;

  if (lower !== null && value < lower) return true;

  return upper !== null && value > upper;
};
