import type { SelectOption, StockAdjustCodeKey } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다(D-9 · 미결 #64).
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * 등록이 **되돌릴 수 없는** 이 화면에서 그 어긋남은 막다른 길이 된다. 계약의 `@example`
 * (`COUNT_VARIANCE`)도 심지 않는다. 그것은 예시이지 확정이 아니며, 계약 자신이 「서버가
 * 내려주는 선택지를 그대로 쓴다」고 적었다(공유계약 G-2).
 *
 * **이것은 죽은 가지가 아니다.** 계약이 `reasonCode`를 등록 **필수**로 받으므로 화면은 그 값을
 * 보내야 하고, 아래 배열만 채우면 등록이 저절로 살아난다.
 *
 * | 코드 | 자리 | 필수도 | 비어 있으면 무엇이 막히나 | 채우면 무엇이 살아나는가 |
 * | --- | --- | :-: | --- | --- |
 * | `reason` | 헤더 사유 · **이력 조건** | **요청 필수**(등록) | **등록이 통째로 막힌다.** 이력은 그 조건으로 좁힐 수 없을 뿐 열려 있다 | 헤더 사유를 고를 수 있고 등록이 열린다 · 이력을 사유로 좁힐 수 있다 |
 * | `status` | **이력 조건** | 조건(선택) | **아무것도 막지 않는다** — 상태로 좁히지 못할 뿐이다 | 이력을 상태로 좁힐 수 있다 |
 *
 * **막히지 않는 것**: 조정 대상 세우기 · 실사 차이 불러오기 · 장부 확인 · 처리 이력 조회.
 * 값 목록이 비어 있는 동안에도 이 넷은 온전히 쓰인다.
 *
 * ⚠ **`status`를 잠금에 쓰지 않는다**(D-13과 같은 규율). 이력 조회는 조건 없이도 열려 있어야
 * 하므로, 이 배열이 비었다는 사실로 조회나 버튼을 막으면 그 자리가 **영영 잠긴다.**
 *
 * 추적: 조정 사유·상태 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만
 * 참조).
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
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다.
 */
export const PLACEHOLDER_STOCK_ADJUST_CODES: CodeValueLists = {
  reason: [],
  status: [],
};

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 「실사 차이」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  reason: toOptions(values.reason),
  status: toOptions(values.status),
});

/**
 * 등록이 **통째로** 막히는가 — 헤더 사유는 요청 필수인데 고를 값 자체가 없다.
 *
 * 「아직 안 골랐다」와 다르다. 고를 것이 없는데 「고르세요」라고 말하면 사용자가 자기가 놓친
 * 것을 찾다가 화면을 고장으로 읽는다 — 그래서 사유 문구가 갈린다.
 *
 * **이 판정을 잠금에 쓰는 자리는 등록 하나뿐이다.** 대상을 세우는 일은 이 값과 무관하게
 * 열려 있어야 한다 — 값 목록이 서기 전에도 실사 차이를 확인하는 것은 정상 업무다.
 */
export const isReasonCodeListPending = (sets: CodeOptionSets): boolean => sets.reason.length === 0;
