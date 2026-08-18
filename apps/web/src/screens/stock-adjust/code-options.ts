import type { SelectOption, StockAdjustCodeKey } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다(D-9 개정 · 미결 #64).
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다.
 * 계약의 `@example`도 심지 않는다 — 그것은 예시이지 확정이 아니며, 계약 자신이 「서버가
 * 내려주는 선택지를 그대로 쓴다」고 적었다(공유계약 G-2).
 *
 * ⭐ **남은 것은 상태 하나다.** 조정 사유는 여기서 나갔다 — **고객이 공통코드 마스터에
 * 등록하는 마스터 데이터**로 결정돼(#36 회신 · 공유계약 `G-31`) 실행 시점 조회로 바뀌었고,
 * 그 자리는 `reason-options.ts`가 진다. 남은 자리와 나간 자리를 가르는 기준은 하나다 —
 * **그 값에 동작이 걸리는가.**
 *
 * | 코드 | 동작이 걸리나 | 누가 정하나 | 지금 어디에 |
 * | --- | :-: | --- | --- |
 * | 조정 사유 | 아니오 | **고객**(공통코드 마스터) | `reason-options.ts` — 조회 |
 * | 조정 상태 | **예**(전이·분기) | 설계 | **여기** — 자리표시 |
 *
 * | 코드 | 자리 | 필수도 | 비어 있으면 무엇이 막히나 | 채우면 무엇이 살아나는가 |
 * | --- | --- | :-: | --- | --- |
 * | `status` | **이력 조건** | 조건(선택) | **아무것도 막지 않는다** — 상태로 좁히지 못할 뿐이다 | 이력을 상태로 좁힐 수 있다 |
 *
 * ⚠ **`status`를 잠금에 쓰지 않는다**(D-13과 같은 규율). 이력 조회는 조건 없이도 열려 있어야
 * 하므로, 이 배열이 비었다는 사실로 조회나 버튼을 막으면 그 자리가 **영영 잠긴다.**
 *
 * 추적: 조정 상태 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<StockAdjustCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<StockAdjustCodeKey, SelectOption[]>;

/**
 * 값 목록 — **비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것으로 이력을 좁히는데,
 * 서버는 그 상태를 모른다.
 */
export const PLACEHOLDER_STOCK_ADJUST_CODES: CodeValueLists = {
  status: [],
};

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  status: toOptions(values.status),
});
