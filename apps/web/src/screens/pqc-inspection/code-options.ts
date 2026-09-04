import type { components } from '@omf-mes/api-client';

/**
 * 공통코드 값 목록을 선택칸의 선택지로 옮긴다.
 *
 * ⭐ **값 목록을 화면에 고정하지 않는다.** 계약이 판정을 `enum` 으로 못박지 않았고, 값 목록은
 * 공통코드가 갖고 늘 수 있다(공유계약 G-2·G-6). 그래서 실행 시점에 조회해 채운다.
 *
 * ⭐ **판정을 버튼으로 고정하지 않는 이유가 여기 있다**(스펙 §5-4) — 목록에서 고르는 형태면
 * 값이 셋이든 열이든 화면 골격이 같다. 고정 버튼으로 그리면 값이 하나 늘 때 화면을 다시 짠다.
 *
 * ⭐ **그룹을 이름으로 부른다** — `codeGroupCode` 문자열이다. ⛔ `codeGroupId` 정수를 코드에
 * 박지 않는다: **환경마다 다르다**.
 *
 * ⛔ **판정 그룹이 둘이고 합치면 안 된다.**
 *
 * | 쓰는 곳 | 그룹 | 값 |
 * | --- | --- | --- |
 * | 종합 판정 | `INSPECTION_RESULT_OVERALL_JUDGMENT` | 합격·불합격·**보류** |
 * | 항목 판정 | `INSPECTION_MEASUREMENT_JUDGMENT` | 합격·불합격 |
 *
 * **항목 판정에는 보류가 없다** — 항목은 규격에 드는지 아닌지 둘뿐이고 보류 수량은 검사 결과
 * 수준에만 있다. 합쳐 쓰면 항목 선택칸에 보류가 떠서 **화면이 설계와 어긋난 값을 저장한다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type CodeValueResponse = components['schemas']['CodeValue'];

/**
 * 이 화면이 쓰는 코드 그룹. **이름으로 부르는 자리가 여기 하나다** — 흩어 두면 그룹 이름이
 * 바뀔 때 어디를 고쳐야 하는지 알 수 없다.
 */
export const CODE_GROUPS = {
  overallJudgment: 'INSPECTION_RESULT_OVERALL_JUDGMENT',
  measurementJudgment: 'INSPECTION_MEASUREMENT_JUDGMENT',
  itemDataType: 'INSPECTION_ITEM_SPEC_DATA_TYPE',
} as const;

export interface CodeOption {
  value: string;
  label: string;
}

/**
 * 선택지로 옮긴다.
 *
 * **쓰지 않는 값을 내리지 않는다** — `isActive` 가 거짓인 값은 과거 자료에는 남아 있으나
 * 지금 고를 것은 아니다.
 *
 * **차례는 `displayOrder` 다.** 그 값이 뜻을 담는다(합격·불합격·보류 순). 이름순으로 다시
 * 정렬하면 설계가 정한 차례가 사라진다.
 *
 * ⛔ **라벨을 지어내지 않는다** — `codeName` 이 사람이 읽을 이름이고, 그것이 비면 코드를
 * 그대로 쓴다. 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 */
export const toCodeOptions = (values: readonly CodeValueResponse[]): CodeOption[] =>
  values
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({
      value: value.code,
      label: value.codeName.trim() === '' ? value.code : value.codeName,
    }));

/**
 * 고른 값이 지금 목록에 있는가.
 *
 * ⚠ **저장된 값이 목록에서 사라질 수 있다** — 코드값이 사용 중지되면 그렇다. 그때 선택칸이
 * 조용히 빈 것으로 보이면 **사용자가 고르지 않았는데 고른 것이 지워진다.** 부르는 쪽이 이
 * 판정으로 「저장된 값이 목록에 없다」를 알린다.
 */
export const isKnownCode = (options: readonly CodeOption[], code: string): boolean =>
  code === '' || options.some((option) => option.value === code);
