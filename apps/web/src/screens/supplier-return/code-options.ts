import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드 **여섯**을 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * **재고를 차감하는** 되돌릴 수 없는 쓰기 화면에서 그 어긋남은 막다른 길이 된다.
 * 계약의 `@example`도 심지 않는다. 그것은 예시이지 확정이 아니며, 계약 자신이
 * 「enum으로 못박으면 값이 정해질 때 계약이 깨진다」고 적었다.
 *
 * **착수 이슈는 셋을 적었으나 계약 필수는 넷이다** — 원천 문서 유형이 빠져 있다(계약 실측).
 * 그 어긋남은 착수 이슈에 코멘트로 올린다(계획 §5.4-3).
 *
 * **결과의 무게**: 필수 넷이 비어 있는 동안 이 화면으로는 **어떤 반품도 처리할 수 없다.**
 * 대상 조회·줄 선택·수량 입력까지는 쓰인다. 값이 확정되면 **이 파일의 배열만 채우면** 처리가
 * 저절로 살아난다 — 화면·검증·요청 조립은 배열을 읽을 뿐이다.
 *
 * 추적: 공통코드 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 이 화면이 다루는 코드 여섯.
 *
 * 앞 넷은 **반품 정보**에, 뒤 둘은 **조회 조건**에 놓인다. 한 파일이 여섯을 함께 갖는 이유는
 * 값이 확정될 때 고칠 자리를 하나로 두기 위해서다.
 */
export type SupplierReturnCodeKey =
  | 'issueType'
  | 'sourceDocumentType'
  | 'destinationType'
  | 'reason'
  | 'receiptType'
  | 'status';

/**
 * 계약이 **요청 필수**로 요구하는 넷.
 *
 * `sourceDocumentType`·`destinationType`이 여기 있는 것이 눈에 걸릴 수 있다 — 원천이 입고
 * 전표임을·도착지가 공급사임을 가리키는 **구조 값**이라 사용자가 고를 성질이 아니다.
 * 그런데도 자리표시로 두는 이유는, 그 값이 무엇이어야 하는지도 아직 확정되지 않았기
 * 때문이다. 화면이 「입고 전표를 뜻하는 코드」를 정해 심으면 그것도 지어내는 것이다.
 *
 * `reason`은 계약 스키마에서 nullable이지만 설명이 「반품·기타 출고에서는 필수」라
 * **설명을 따른다**(계획 §5.4-4).
 */
export const REQUIRED_CODE_KEYS: readonly SupplierReturnCodeKey[] = [
  'issueType',
  'sourceDocumentType',
  'destinationType',
  'reason',
];

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<SupplierReturnCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<SupplierReturnCodeKey, SelectOption[]>;

/**
 * 값 목록 — **여섯 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다. 조회 조건 쪽에 넣으면 결과가 늘
 * 비어 보인다.
 */
export const PLACEHOLDER_SUPPLIER_RETURN_CODES: CodeValueLists = {
  issueType: [],
  sourceDocumentType: [],
  destinationType: [],
  reason: [],
  receiptType: [],
  status: [],
};

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 「공급사 반품」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  issueType: toOptions(values.issueType),
  sourceDocumentType: toOptions(values.sourceDocumentType),
  destinationType: toOptions(values.destinationType),
  reason: toOptions(values.reason),
  receiptType: toOptions(values.receiptType),
  status: toOptions(values.status),
});

/**
 * 필수 코드 중 **고를 값 자체가 없는** 것이 있는가.
 *
 * 참이면 사용자가 아무리 애써도 요청을 만들 수 없다 — 그 사정은 「값을 아직 안 골랐다」와
 * 다르므로 사유 문구도 갈라야 한다. 「고르세요」라고 말하는데 고를 것이 없으면 사용자는
 * 자기가 무엇을 놓쳤는지 찾다가 화면을 고장으로 읽는다.
 *
 * **조회 조건의 코드 둘은 판정에 들지 않는다** — 비어 있어도 아무것도 막지 않는다.
 *
 * 이 값을 읽어 「반품 처리」를 잠그는 자리는 뒤따르는 회차에 있다. 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
export const isRequiredCodeListPending = (sets: CodeOptionSets): boolean =>
  REQUIRED_CODE_KEYS.some((key) => sets[key].length === 0);

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
