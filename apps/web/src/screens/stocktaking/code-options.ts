import { messages } from '@omf-mes/i18n';

import type { SelectOption, StocktakingCodeKey } from './types';

/**
 * 값 목록이 확정되지 않은 코드 셋을 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * 개시와 마감이 **되돌릴 수 없는** 이 화면에서 그 어긋남은 막다른 길이 된다. 계약의 `@example`
 * (`CYCLE`·`MISPLACED`·`IN_PROGRESS`)도 심지 않는다. 그것은 예시이지 확정이 아니며,
 * 계약 자신이 「서버가 내려주는 선택지를 그대로 쓴다」고 적었다(공유계약 G-2).
 *
 * **필수도로 갈라 적용한다**(계획 결정 10 · 승인 G1). 이것이 W-01-10과 다른 점이다 —
 * 비어 있는 동안 잠기는 범위가 코드마다 다르고, 잠기지 않은 경로는 온전히 쓰인다.
 *
 * | 코드 | 자리 | 필수도 | 비어 있으면 무엇이 막히나 |
 * | --- | --- | :-: | --- |
 * | `countType` | 개시 — 실사 유형 | **요청 필수** | **개시가 통째로 막힌다**(PR ②) |
 * | `varianceReason` | 결과 등록 — 차이 사유 | **조건부 필수** | **차이가 있는 위치만** 저장이 막힌다(PR ③) |
 * | `status` | 조회 조건 | 선택 | 아무것도 막히지 않는다. 조건 칸이 비고 안내가 붙는다 |
 *
 * **이 PR에서 쓰이는 것은 조회 조건 둘**(실사 유형·상태)이고 둘 다 조회를 막지 않는다 —
 * 값 목록이 없으면 그 조건으로 좁힐 수 없을 뿐, 목록은 조건 없이도 보인다.
 * 잠금 판정과 그 사유 문구는 **막히는 조작이 생기는 PR**이 소유한다.
 *
 * **값이 확정되면 이 파일의 배열만 채우면 된다.** 화면·검증·요청 조립은 배열을 읽을 뿐이라
 * 다른 자리를 고칠 필요가 없고, 채우는 순간 개시와 저장이 저절로 살아난다.
 * 그 전환은 감지기가 고정한다(M19 · M40).
 *
 * 추적: 공통코드 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<StocktakingCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<StocktakingCodeKey, SelectOption[]>;

/**
 * 값 목록 — **셋 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다.
 */
export const PLACEHOLDER_STOCKTAKING_CODES: CodeValueLists = {
  countType: [],
  status: [],
  varianceReason: [],
};

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 「순환 실사」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  countType: toOptions(values.countType),
  status: toOptions(values.status),
  varianceReason: toOptions(values.varianceReason),
});

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
