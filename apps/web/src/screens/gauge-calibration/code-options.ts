import { messages } from '@omf-mes/i18n';

/**
 * 값 목록이 아직 확정되지 않은 코드 선택칸들.
 *
 * ⭐ **계약이 이름을 확정해 준 값만 담는다.** 계약 설명이 「검교정(CALIBRATION)·점검(CHECK)」과
 * 「합격(PASS)·불합격(FAIL)」의 이름을 못 박았고, 그 밖(수리·폐기·조정 후 합격·정상·이상·완료·
 * 불가)은 공통코드 마스터가 정할 때까지 이름이 없다. **없는 이름을 지어내지 않는다** — 지어낸
 * 코드로 저장하면 서버가 거부하거나, 더 나쁘게는 아무도 모르는 값이 원장에 남는다.
 *
 * ⛔ **`enum`으로 좁히지 않는다**(계약의 지시). 값이 늘어도 이 배열만 채우면 되고 타입이
 * 막지 않는다.
 *
 * 값 목록이 서면 이 파일의 배열 셋을 채운다 — 그때 선택칸이 저절로 열린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.gaugeCalibration;

export interface CodeOption {
  value: string;
  label: string;
}

/** 검교정 유형. 이 값일 때만 검교정 전용 칸이 열리고 마스터 갱신이 일어난다. */
export const CALIBRATION_TYPE_CODE = 'CALIBRATION';

/** 합격. 이 결과일 때만 계측기의 검교정일이 갱신된다(불합격은 유효기한을 늘리면 안 된다). */
export const PASS_RESULT_CODE = 'PASS';

/**
 * 이력 유형. **계약이 이름을 준 둘만** 담는다 — 수리·폐기는 이름이 확정되지 않았다.
 * ⚠ 수리 유형은 설비 사용 가부 판정의 한 항이라 빠질 수 없다. 값이 서면 여기에 더한다.
 */
export const PLACEHOLDER_HISTORY_TYPES: readonly CodeOption[] = [
  { value: CALIBRATION_TYPE_CODE, label: '검교정' },
  { value: 'CHECK', label: '점검' },
];

/**
 * 결과. **계약이 이름을 준 둘만** 담는다.
 *
 * ⚠ 값 집합이 이력 유형마다 다르다(검교정은 합격·조정 후 합격·불합격, 점검은 정상·이상 …).
 * 유형으로 거르는 규칙은 값 이름이 서야 세울 수 있으므로, 지금은 **거르지 않고 전부 보이고**
 * 목록이 잠정임을 밝힌다 — 거르는 규칙을 지어내면 고를 수 있어야 할 값이 사라진다.
 */
export const PLACEHOLDER_RESULT_CODES: readonly CodeOption[] = [
  { value: PASS_RESULT_CODE, label: '합격' },
  { value: 'FAIL', label: '불합격' },
];

/**
 * 교정 기관 구분(내부·외부). **이름이 하나도 확정되지 않았다** — 비어 있는 것이 지금 맞다.
 *
 * ⚠ 이 칸이 비어 있는 동안 **「외부면 기관명 필수」 짝 제약을 걸 수 없다.** 어느 값이 외부인지
 * 화면이 알 수 없기 때문이다. 그래서 기관 이름은 선택 입력으로 둔다.
 */
export const PLACEHOLDER_AGENCY_TYPES: readonly CodeOption[] = [];

/** 선택칸 아래 안내. 값이 아예 없으면 그 사실을, 일부만 있으면 잠정임을 밝힌다. */
export const codeNote = (options: readonly CodeOption[], name: string): string | undefined =>
  options.length === 0 ? t.codes.empty(name) : t.codes.provisional;

/** 코드 하나의 이름. 못 찾으면 코드를 그대로 보인다 — 「알 수 없음」을 쓰지 않는다. */
export const codeLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;
