import { messages } from '@omf-mes/i18n';

import type { SelectOption, WarehouseEntry } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 **한 파일에 격리한다.**
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * **재고를 차감하는** 되돌릴 수 없는 쓰기로 이어지는 화면에서 그 어긋남은 막다른 길이 된다.
 * 계약의 `@example`도 심지 않는다. 그것은 예시이지 확정이 아니며, 계약 자신이
 * 「enum으로 못박으면 값이 정해질 때 계약이 깨진다」는 취지를 적었다.
 *
 * **착수 이슈는 둘(폐기 계정 · 승인 유형·상태)을 적었으나 이 화면에 걸리는 자리는 더 많다**
 * (계획 결정 8 · §5.4-9). 이 회차가 다루는 것은 그중 **여덟 + 창고 유형**이다.
 *
 * | 자리 | 키 | 이 회차에 쓰이나 | 비면 무엇이 막히나 |
 * | --- | --- | :-: | --- |
 * | 폐기 정보 — 출고 유형 · **이력 조건 — 출고 유형** | `issueType` | **이력 조건이 쓴다** | **품의 등록 전체** |
 * | 폐기 정보 — 원천 문서 유형 | `sourceDocumentType` | 뒤 회차 | 같은 위 |
 * | 폐기 정보 — 도착지 유형 | `destinationType` | 뒤 회차 | 같은 위 |
 * | 폐기 정보 — **폐기 계정** | `disposalAccount` | 뒤 회차 | 같은 위 |
 * | 폐기 정보 — 폐기 사유 · **이력 조건 — 폐기 사유** | `reason` | **이력 조건이 쓴다** | 같은 위 |
 * | 대상 조회 조건 — 입고 유형 | `receiptType` | 쓰인다 | 아무것도 막히지 않는다 |
 * | 대상 조회 조건 — 입고 상태 | `status` | 쓰인다 | 아무것도 막히지 않는다 |
 * | **이력 조건 — 출고 상태** | `issueStatus` | **이 회차** | 아무것도 막히지 않는다 |
 * | 창고 선택칸을 좁히는 축 | `DEFECT_WAREHOUSE_TYPE_CODES` | 쓰인다 | 창고가 좁혀지지 않는다 |
 *
 * **출고 유형·폐기 사유는 두 자리가 한 키를 함께 쓴다.** 폐기 정보 폼이 고를 값과 이력 조건이
 * 거를 값이 **같은 공통코드**라, 갈라 두면 값이 확정될 때 채울 자리가 둘이 되고 한쪽만 채워지는
 * 순간 「고를 수는 있는데 그것으로 거를 수는 없는」 화면이 된다. 반대로 **출고 상태는 입고
 * 상태와 갈라 둔다** — 서로 다른 공통코드라 한 키로 묶으면 한쪽 확정이 다른 쪽 선택칸까지 연다.
 *
 * **승인 완료를 뜻하는 상태 코드 집합**은 `approval-progress.ts`가 갖는다 — 승인 축 판정이
 * 그 파일 한 곳에 모여 있어야 「채우면 무엇이 살아나는가」를 한 자리에서 읽는다.
 *
 * **결과의 무게**: 필수 다섯이 비어 있는 동안 이 화면으로는 **폐기 품의를 등록할 수 없다.**
 * 대상 조회·줄 선택·수량 입력·처리 이력·결재 진행·기타출고 처리는 그동안에도 쓰인다.
 * 값이 확정되면 **이 파일의 배열만 채우면** 등록이 저절로 살아난다.
 *
 * 추적: 공통코드 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 이 화면이 자리표시로 다루는 선택지 코드 여덟. */
export type DisposalIssueCodeKey =
  | 'issueType'
  | 'sourceDocumentType'
  | 'destinationType'
  | 'disposalAccount'
  | 'reason'
  | 'receiptType'
  | 'status'
  | 'issueStatus';

/**
 * 계약이 **등록 필수**로 요구하는 다섯.
 *
 * `sourceDocumentType`·`destinationType`이 여기 있는 것이 눈에 걸릴 수 있다 — 원천이 입고
 * 전표임을·도착지가 어디임을 가리키는 **구조 값**이라 사용자가 고를 성질이 아니다.
 * 그런데도 자리표시로 두는 이유는, 그 값이 무엇이어야 하는지도 아직 확정되지 않았기 때문이다.
 *
 * `disposalAccount`(폐기 계정)는 **계약에 대응하는 필드 이름이 확정되지 않았다** — 가장 가까운
 * 자리가 도착지 유형·도착지 식별자인데 계약은 그것을 「도착지」로만 적었고 폐기에는 물리적
 * 도착지가 없다. 그래서 값 목록과 배선 자리를 **함께** 미결로 둔다(계획 §5.4-4).
 *
 * `reason`은 계약 스키마에서 nullable이지만 설명이 「반품·기타 출고에서는 필수」라
 * **설명을 따른다**(계획 §5.4-17).
 */
export const REQUIRED_CODE_KEYS: readonly DisposalIssueCodeKey[] = [
  'issueType',
  'sourceDocumentType',
  'destinationType',
  'disposalAccount',
  'reason',
];

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<DisposalIssueCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<DisposalIssueCodeKey, SelectOption[]>;

/**
 * 값 목록 — **여덟 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다. 조회 조건 쪽에 넣으면 결과가 늘
 * 비어 보인다.
 */
export const PLACEHOLDER_DISPOSAL_ISSUE_CODES: CodeValueLists = {
  issueType: [],
  sourceDocumentType: [],
  destinationType: [],
  disposalAccount: [],
  reason: [],
  receiptType: [],
  status: [],
  issueStatus: [],
};

/**
 * 「불량창고」를 가리는 창고 유형 코드.
 *
 * **화면이 불량창고를 판정할 수 없다**(계획 결정 2 · §5.4-5). 폐기 대상은 불량 판정을 받아
 * 들어온 자재이고 그것이 놓이는 창고가 있으나, 창고 유형의 값 목록이 확정되지 않아
 * 「이 창고가 그 창고인가」를 화면이 물을 수 없다. 그래서 지금은 **사용자가 창고를 고른다.**
 *
 * 이 배열이 채워지면 창고 선택칸이 그 유형만 보이고, 좁히지 못한다는 안내가 사라진다.
 */
export const DEFECT_WAREHOUSE_TYPE_CODES: readonly string[] = [];

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
  issueType: toOptions(values.issueType),
  sourceDocumentType: toOptions(values.sourceDocumentType),
  destinationType: toOptions(values.destinationType),
  disposalAccount: toOptions(values.disposalAccount),
  reason: toOptions(values.reason),
  receiptType: toOptions(values.receiptType),
  status: toOptions(values.status),
  issueStatus: toOptions(values.issueStatus),
});

/**
 * 필수 코드 중 **고를 값 자체가 없는** 것이 있는가.
 *
 * 참이면 사용자가 아무리 애써도 요청을 만들 수 없다 — 그 사정은 「값을 아직 안 골랐다」와
 * 다르므로 사유 문구도 갈라야 한다. 「고르세요」라고 말하는데 고를 것이 없으면 사용자는
 * 자기가 무엇을 놓쳤는지 찾다가 화면을 고장으로 읽는다.
 *
 * **조회 조건의 코드 셋은 판정에 들지 않는다** — 비어 있어도 아무것도 막지 않는다.
 *
 * 이 값을 읽어 「품의 등록」을 잠그는 자리는 뒤따르는 회차에 있다. 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
export const isRequiredCodeListPending = (sets: CodeOptionSets): boolean =>
  REQUIRED_CODE_KEYS.some((key) => sets[key].length === 0);

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;

/**
 * 창고를 유형으로 좁힐 수 있는가. **거짓이 되는 순간 화면의 안내가 사라진다.**
 *
 * 상수를 함수 안에서 직접 읽지 않고 **인자로 받는다.** 그래야 「값이 채워졌을 때 무엇이
 * 달라지는가」를 감지기가 실제로 잴 수 있다 — 안에서 읽으면 그 전환을 시험할 길이 없어
 * 자리표시가 죽은 가지가 된다.
 */
export const isDefectWarehouseTypePending = (typeCodes: readonly string[]): boolean =>
  typeCodes.length === 0;

/**
 * 창고 선택지를 폐기 대상 창고 유형으로 좁힌다.
 *
 * **좁힐 수 없으면 전부 낸다.** 값 목록이 없다고 빈 목록을 내면 사용자가 아무 창고도 고를 수
 * 없어 화면이 통째로 막힌다 — 좁히지 못한다는 사실은 안내가 말하고, 고르는 것은 사용자가 한다.
 *
 * **좁힌 결과가 비는 것은 그대로 낸다.** 맞는 유형이 하나도 없으면 그것이 사실이며,
 * 전체로 되돌리면 좁혔다고 말하면서 좁히지 않은 목록을 보이는 셈이 된다.
 *
 * 유형 코드를 인자로 받는 이유는 **채워졌을 때 무엇이 달라지는지를 잴 수 있게** 하기 위해서다.
 * 상수를 함수 안에서 직접 읽으면 그 전환을 시험할 길이 없다.
 */
export const narrowToDefectWarehouses = (
  entries: readonly WarehouseEntry[],
  typeCodes: readonly string[],
): WarehouseEntry[] =>
  typeCodes.length === 0
    ? [...entries]
    : entries.filter((entry) => typeCodes.includes(entry.warehouseTypeCode));
