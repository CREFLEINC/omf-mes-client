/**
 * 이 화면이 주소에서 읽는 값.
 *
 * **설비는 주소가 소유한다.** POP 단말은 설비에 붙어 있고(스펙 §4-A — 헤더에서 고정), 그
 * 붙임을 셸이 알려 주는 자리가 이 저장소에 아직 없다. 그때까지 진입 경로는 주소뿐이며,
 * 셸이 알려 주게 되어도 화면이 읽는 방식은 같은 한 자리로 남는다.
 *
 * ⛔ **설비를 기억해 두지 않는다.** 앞서 본 설비를 화면이 들고 있으면 주소만 보고는 무엇을
 * 기록하는 화면인지 알 수 없게 되고, **남의 설비에 비가동이 붙는다.** 비가동은 되돌리는
 * 경로가 없다.
 */

/** 주소가 설비를 담는 키. */
export const EQUIPMENT_PARAM = 'equipmentId';

/** 주소가 설비 코드를 담는 키 — 표시용이다. 없으면 번호를 보인다. */
export const EQUIPMENT_CODE_PARAM = 'equipmentCode';

/**
 * 주소에서 설비 번호를 읽는다. 읽을 수 없으면 `null`이다.
 *
 * **양의 정수만 받는다.** 계약이 `int64`를 요구하므로 소수·음수·0은 있을 수 없는 값이고,
 * 그대로 조회에 실으면 서버가 거절할 요청을 화면이 한 번 더 만든다. `Number`는 빈 문자열과
 * 공백을 0으로 읽으므로 **자릿수 검사를 먼저 한다.**
 */
export const readEquipmentId = (params: URLSearchParams): number | null => {
  const raw = params.get(EQUIPMENT_PARAM);
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

/** 표시용 설비 코드. 비어 있으면 `null`이다 — 빈 글자를 이름 자리에 넣지 않는다. */
export const readEquipmentCode = (params: URLSearchParams): string | null => {
  const raw = params.get(EQUIPMENT_CODE_PARAM);

  return raw === null || raw.trim() === '' ? null : raw.trim();
};
