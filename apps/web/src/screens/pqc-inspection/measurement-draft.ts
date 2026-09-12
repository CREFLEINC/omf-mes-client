import type { components } from '@omf-mes/api-client';

import { judgeAutomatically } from './auto-judgment';
import type { MeasurementRow } from './measurement-rows';

/**
 * 검사 항목 한 줄의 **편집 상태.**
 *
 * ⭐ **이 화면의 액션이 여기 있다**(스펙 §5-9) — 항목 판정과 측정값 입력. 좌측 구획이
 * 읽기 표가 아니라 입력 구획인 이유다.
 *
 * ⛔ **측정치에 자체 쓰기 경로가 없다.** 계약이 「검사 결과 저장에 함께 실린다」고 못박았다 —
 * 그래서 이 초안은 저장 시점에 `InspectionMeasurementInput[]` 으로 접혀 결과 본문에 실린다.
 *
 * ⛔ **세 값 칸 중 «하나만» 채운다.** 어느 칸인지는 그 항목의 `dataTypeCode` 가 정하고
 * (`ck_inspection_measurement num_nonnulls ≤ 1`), 셋 다 비어도 된다 — 육안 항목은 판정만으로
 * 성립한다. **판정은 언제나 필수다.**
 *
 * ⭐ **자동 판정이 서는 항목은 채운 채로 시작한다**(§5-11 · `auto-judgment.ts`). 채운 값은
 * 시작점이지 확정이 아니라 **사람이 바꿀 수 있다.** 「자동 불합격이 아니다」(§6)는 «종합»
 * 판정이 자동으로 내려지지 않는다는 뜻이고, 항목 판정을 채우는 것과 층이 다르다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type InspectionMeasurementInput = components['schemas']['InspectionMeasurementInput'];

/** 값 칸을 어느 것으로 열지 정하는 코드. **화면이 지어내지 않는다** — 항목 규격이 준다. */
export const DATA_TYPES = {
  numeric: 'NUMERIC',
  text: 'TEXT',
  boolean: 'BOOLEAN',
} as const;

/**
 * 한 줄이 편집 중인 값. **전부 문자열이다** — 치는 동안에는 아직 수치가 아니다.
 *
 * 불리언 항목도 문자열로 든다(`''`·`'true'`·`'false'`) — 「아직 안 골랐다」와 「거짓을
 * 골랐다」가 `boolean` 하나로는 구분되지 않는다.
 */
export interface MeasurementDraft {
  judgment: string;
  value: string;
  /**
   * 이 판정을 **사람이 골랐는가.**
   *
   * ⛔ **「판정 칸이 비었는가」로 가르지 않는다.** 자동 판정이 한 번 채우면 칸이 다시 비지
   * 않아, 그 뒤로는 값을 고쳐도 자동 판정이 영영 서지 않는다 — POP 은 키패드로 한 자씩 치는
   * 화면이라 **첫 글자의 판정이 그대로 박힌다.** 규격 7.97~8.03 항목에 8.00 을 치면 첫 자
   * 「8」이 합격을 박고, 8.5 로 고쳐도 합격이 남는다(88단계 2회차 실측 · #1091).
   *
   * ⭐ 출처를 초안이 들면 §5-11 의 두 문장이 동시에 선다 — **채운 값은 값이 바뀔 때마다 다시
   * 계산되고**(시작점), **사람이 고른 값은 덮이지 않는다**(확정이 아니다).
   */
  judgmentByPerson: boolean;
}

export const EMPTY_MEASUREMENT_DRAFT: MeasurementDraft = {
  judgment: '',
  value: '',
  judgmentByPerson: false,
};

/** 줄의 열쇠 → 그 줄의 초안. 항목과 샘플이 함께 한 줄을 가리킨다. */
export type MeasurementDrafts = Record<string, MeasurementDraft>;

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * 저장된 측정치를 편집 초안으로 옮긴다. 아직 재지 않은 줄은 빈 초안이다.
 *
 * ⭐ **저장된 판정이 우선한다.** 사람이 이미 내린 판정을 자동 판정으로 덮지 않는다 — 덮으면
 * 검사자가 고친 값이 재조회마다 되돌아간다.
 *
 * ⭐ **판정이 비어 있고 자동 판정이 서면 그때 채운다**(§5-11). 채운 값은 시작점이라 사람이
 * 바꿀 수 있고, 서지 않는 항목은 비운 채 둔다 — 「사람이 합격으로 판정했다」와 「아직 판정
 * 하지 않았다」가 화면에서 같아 보이면 안 된다.
 */
export const toMeasurementDrafts = (rows: readonly MeasurementRow[]): MeasurementDrafts => {
  const drafts: MeasurementDrafts = {};

  for (const row of rows) {
    const stored = row.measured === null ? '' : row.measured.judgmentCode;

    drafts[row.key] = {
      judgment: stored === '' ? (judgeAutomatically(row) ?? '') : stored,
      value: storedValueOf(row),
      /*
       * 저장된 판정은 **사람이 남긴 결론으로 본다** — 자동이 채운 값으로 덮지 않는다.
       *
       * ⚠ **측정치 조회가 붙으면 이 줄을 다시 봐야 한다.** 저장된 판정의 상당수는 «자동이 채워
       * 준 값을 그대로 저장한 것»인데 여기서는 그것까지 사람 것으로 접는다 — 지금은 이 화면이
       * 저장된 측정치를 부르지 않아(요구서 §3-7 · `screen.tsx` 가 언제나 빈 배열을 넘긴다) 이
       * 줄이 실행되지 않지만, 조회가 붙는 순간 **불러온 회차에서 값을 고쳐도 자동 판정이 다시
       * 서지 않는다**(#1091 이 고친 것이 그 자리에서 부활한다). 그때는 판정의 출처를 서버가
       * 함께 내려 주어야 한다(리뷰 지적).
       */
      judgmentByPerson: stored !== '',
    };
  }

  return drafts;
};

/**
 * 저장된 측정치를 편집 상태로 되돌린다.
 *
 * ⭐ **육안 항목에 값이 남아 있으면 그대로 둔다**(설계 회신 2026-09-11 · 스펙 §4-C). 그 항목은
 * 화면에 값 칸이 없지만, §4-C 는 「셋 다 비어도 된다」이지 「비워야 한다」가 아니다 — 이미
 * 기록된 측정치를 화면이 지울 까닭이 없다.
 *
 * ⛔ **없던 값을 만들지도 않는다.** 새로 넣는 육안 항목은 값 칸이 없으니 빈 채로 남고, 보내는
 * 본문에도 실리지 않는다(`valueOf`). 「측정값과 판정은 다른 축」이라는 §4-C 그대로다.
 */
const storedValueOf = (row: MeasurementRow): string => {
  const measured = row.measured;

  if (measured === null) return '';
  if (measured.numericValue !== null) return String(measured.numericValue);
  if (measured.textValue !== null) return measured.textValue;
  if (measured.booleanValue !== null) return String(measured.booleanValue);

  return '';
};

/**
 * 지금 친 값을 **자동 판정이 볼 수 있는 모양**으로 감싼다. 저장된 측정치를 부르지 않으므로
 * (요구서 §3-7) 대조할 값은 화면의 초안뿐이다 — 수치가 아니면 잴 것이 없어 비운다.
 */
export const toProbe = (raw: string): MeasurementRow['measured'] => {
  const trimmed = raw.trim();
  const numeric = Number(trimmed);

  if (trimmed === '' || Number.isNaN(numeric)) return null;

  return {
    numericValue: numeric,
    textValue: null,
    booleanValue: null,
    judgmentCode: '',
    measuredAt: '',
    inspectionEquipmentId: null,
    calibrationExpired: false,
  };
};

/**
 * 측정값을 고친 뒤의 초안 — **자동 판정은 값이 바뀔 때마다 다시 계산한다**(§5-11 「채운 값은
 * 시작점이지 확정이 아니다」).
 *
 * ⛔ **사람이 고른 판정은 건드리지 않는다.** 덮으면 검사자의 판단이 한 자 칠 때마다 지워진다.
 *
 * ⚠ 자동 판정이 서다가 **값을 지우면 판정도 거둔다** — `judgeAutomatically` 가 잴 값이 없을 때
 * `null` 을 내므로 빈 문자열이 된다. 재지 않은 줄에 판정이 남아 있으면 「사람이 합격으로
 * 판정했다」로 읽힌다.
 */
export const withMeasuredValue = (
  row: MeasurementRow | undefined,
  draft: MeasurementDraft,
  value: string,
): MeasurementDraft => {
  if (draft.judgmentByPerson || row === undefined) return { ...draft, value };

  return {
    ...draft,
    value,
    judgment: judgeAutomatically({ ...row, measured: toProbe(value) }) ?? '',
  };
};

/**
 * 판정을 **사람이 고른 뒤**의 초안.
 *
 * ⚠ 같은 값을 다시 눌러 «해제»하면 사람 선택이 풀리고 **자동 판정이 되돌아온다** — 해제는
 * 「판정하지 않은 상태로 돌린다」는 뜻이고, 그 상태의 시작점이 자동 판정이다.
 *
 * ⚠ **그래서 자동 판정이 서는 줄에서는 해제가 «빈 칸»을 만들지 않는다.** 규격 안의 값이 든
 * 줄에서 「합격」을 다시 누르면 자동 판정이 같은 합격을 도로 채운다 — 검사자에게는 버튼이 안
 * 먹는 것처럼 보인다. 빈 칸으로 돌리려면 측정값을 지우면 된다(리뷰 지적).
 */
export const withJudgment = (
  row: MeasurementRow | undefined,
  draft: MeasurementDraft,
  judgment: string,
): MeasurementDraft => {
  if (judgment !== '') return { ...draft, judgment, judgmentByPerson: true };

  return withMeasuredValue(row, { ...draft, judgment: '', judgmentByPerson: false }, draft.value);
};

/**
 * 이 줄의 값 칸이 수치가 아닌가.
 *
 * **수치형이 아니면 판정하지 않는다** — 문자·불리언 항목에 숫자 규칙을 걸면 정상 입력이
 * 틀렸다고 나온다. 빈 칸도 오류가 아니다: 육안 항목은 판정만으로 성립한다.
 */
export const isValueInvalid = (row: MeasurementRow, draft: MeasurementDraft): boolean => {
  if (row.dataTypeCode !== DATA_TYPES.numeric) return false;

  const raw = draft.value.trim();

  return raw !== '' && !NUMBER_PATTERN.test(raw);
};

/** 값 칸이 잘못된 줄이 하나라도 있는가. **저장을 막는 것은 이 경우뿐이다.** */
export const hasValueError = (
  rows: readonly MeasurementRow[],
  drafts: MeasurementDrafts,
): boolean => rows.some((row) => isValueInvalid(row, drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT));

/**
 * 판정이 끝난 줄 수 — 좌측 구획의 「진행 n / m」이 이 값이다(스펙 §3).
 *
 * **판정으로 센다.** 측정값이 아니라 판정이 그 줄의 결론이고, 육안 항목에는 측정값이 아예
 * 없다 — 값으로 세면 육안 항목이 영영 안 끝난 것으로 보인다.
 */
export const judgedCount = (rows: readonly MeasurementRow[], drafts: MeasurementDrafts): number =>
  rows.filter((row) => (drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT).judgment !== '').length;

/**
 * 모든 줄이 판정됐는가 — **확정의 조건 하나다**(스펙 §5-9 「전 항목 판정」).
 *
 * ⚠ 줄이 하나도 없으면 참이다. 검사기준에 항목이 없는 경우이며, 그때 확정을 막는 것은
 * 이 조건이 아니라 「검사기준에 항목이 없습니다」 안내가 할 일이다.
 */
export const isAllJudged = (rows: readonly MeasurementRow[], drafts: MeasurementDrafts): boolean =>
  judgedCount(rows, drafts) === rows.length;

/**
 * 초안을 보내는 값으로 접는다.
 *
 * **판정이 없는 줄은 싣지 않는다** — 계약이 `judgmentCode` 를 필수로 두었고, 아직 판정하지
 * 않은 줄을 억지로 채워 보내면 사람이 내리지 않은 판정이 저장된다.
 *
 * ⛔ **값 칸은 그 항목의 유형이 정한 자리 «하나»에만 넣는다.** 셋 중 둘 이상을 채우면
 * 저장 제약에 걸린다.
 */
export const toMeasurementInputs = (
  rows: readonly MeasurementRow[],
  drafts: MeasurementDrafts,
  measuredAt: string,
): InspectionMeasurementInput[] =>
  rows.flatMap((row) => {
    const draft = drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT;

    if (draft.judgment === '') return [];

    return [
      {
        inspectionItemSpecId: row.inspectionItemSpecId,
        sampleNo: row.sampleNo,
        judgmentCode: draft.judgment,
        measuredAt,
        ...valueOf(row, draft),
      },
    ];
  });

/**
 * 값 칸 하나를 고른다. **비어 있으면 아무 칸도 싣지 않는다** — 육안 항목이 그 자리다.
 *
 * 수치형에서 수치가 아닌 값은 **싣지 않는다.** 부르는 쪽이 `hasValueError` 로 먼저 막지만,
 * 보내는 자리에서도 같은 자를 쓴다 — 두 자리가 다른 자를 쓰면 언젠가 갈린다.
 */
const valueOf = (
  row: MeasurementRow,
  draft: MeasurementDraft,
): Partial<Pick<InspectionMeasurementInput, 'numericValue' | 'textValue' | 'booleanValue'>> => {
  const raw = draft.value.trim();

  if (raw === '') return {};

  if (row.dataTypeCode === DATA_TYPES.numeric) {
    return NUMBER_PATTERN.test(raw) ? { numericValue: Number(raw) } : {};
  }

  if (row.dataTypeCode === DATA_TYPES.boolean) {
    return raw === 'true' || raw === 'false' ? { booleanValue: raw === 'true' } : {};
  }

  return { textValue: raw };
};
