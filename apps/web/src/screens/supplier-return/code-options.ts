import { messages } from '@omf-mes/i18n';
import type { components } from '@omf-mes/api-client';

import { masterName } from '../../patterns/master-name';
import type { ReturnCodeKey, SelectOption } from './types';

/**
 * 고정 OpenAPI가 닫은 구조 코드와 운영 목록을 기다리는 코드를 한 파일에 격리한다.
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
export type SupplierReturnCodeKey = ReturnCodeKey | 'receiptType' | 'status';

/**
 * 계약이 **요청 필수**로 요구하는 넷.
 *
 * `sourceDocumentType`·`destinationType`은 원천이 입고 전표임을·도착지가 공급사임을
 * 가리키는 **구조 값**이며, OpenAPI가 닫은 `GOODS_RECEIPT`·`PARTNER`를 그대로 쓴다.
 *
 * `reason`은 계약 스키마에서 nullable이지만 설명이 「반품·기타 출고에서는 필수」라
 * **설명을 따른다**(계획 §5.4-4).
 */
export const REQUIRED_CODE_KEYS: readonly ReturnCodeKey[] = [
  'issueType',
  'sourceDocumentType',
  'destinationType',
  'reason',
];

/** 코드마다의 값 목록. 구조 enum은 채우고 운영 공통코드는 비워 둔다. */
export type CodeValueLists = Record<SupplierReturnCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<SupplierReturnCodeKey, SelectOption[]>;
type CodeValue = components['schemas']['CodeValue'];

/**
 * 코드 그룹 — 계약 설명의 확정 문구(공유계약 G-32): `issueTypeCode` → ISSUE_TYPE, `reasonCode` →
 * GOODS_ISSUE_REASON, 입고 전표 `receiptTypeCode` → RECEIPT_TYPE, `statusCode` → LOGISTICS_DOCUMENT_STATUS.
 * 값 목록은 `GET /mdm/code-values?codeGroupCode=…` 로 받는다(#360 — 코드 대신 이름을 보인다).
 */
export const SUPPLIER_RETURN_CODE_GROUPS = {
  issueType: 'ISSUE_TYPE',
  reason: 'GOODS_ISSUE_REASON',
  receiptType: 'RECEIPT_TYPE',
  status: 'LOGISTICS_DOCUMENT_STATUS',
} as const;

/** 고정 OpenAPI가 닫은 구조 코드만 채운다. 운영 공통코드 축은 실행 시점 조회 전까지 비워 둔다. */
export const PLACEHOLDER_SUPPLIER_RETURN_CODES: CodeValueLists = {
  issueType: [],
  sourceDocumentType: ['GOODS_RECEIPT'],
  destinationType: ['PARTNER'],
  reason: [],
  receiptType: [],
  status: [],
};

const activeCodes = (values: readonly CodeValue[] | undefined): string[] =>
  (values ?? [])
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => value.code);

/** 서버에서 받는 코드 그룹 넷의 응답. */
export interface RuntimeCodeValues {
  issueType?: readonly CodeValue[];
  reason?: readonly CodeValue[];
  receiptType?: readonly CodeValue[];
  status?: readonly CodeValue[];
}

export const withRuntimeSupplierReturnCodes = (values: RuntimeCodeValues): CodeValueLists => ({
  ...PLACEHOLDER_SUPPLIER_RETURN_CODES,
  issueType: activeCodes(values.issueType),
  reason: activeCodes(values.reason),
  receiptType: activeCodes(values.receiptType),
  status: activeCodes(values.status),
});

/** 코드마다 보일 이름(코드 → 이름). 없는 코드는 코드 그대로 보인다. */
export type CodeNames = Record<SupplierReturnCodeKey, ReadonlyMap<string, string>>;

const namesOf = (values: readonly CodeValue[] | undefined): Map<string, string> =>
  new Map((values ?? []).map((value) => [value.code, masterName(value, value.codeName)]));

/**
 * 코드 이름. 서버 코드값 그룹 넷은 받은 이름(미사용 값 포함 — 지난 전표가 쓴 값도 이름으로 보이게),
 * 구조 코드 둘(원천 문서 유형 · 도착지 유형)은 계약이 공통코드로 받지 말라고 적은 값이라 계약 설명의
 * 이름(「입고 전표」·「거래처」)을 사전에서 쓴다. **보내는 값은 코드 그대로다.**
 */
export const toSupplierReturnCodeNames = (values: RuntimeCodeValues): CodeNames => ({
  issueType: namesOf(values.issueType),
  sourceDocumentType: new Map(Object.entries(messages.supplierReturn.codeNames.sourceDocumentType)),
  destinationType: new Map(Object.entries(messages.supplierReturn.codeNames.destinationType)),
  reason: namesOf(values.reason),
  receiptType: namesOf(values.receiptType),
  status: namesOf(values.status),
});

const NO_NAMES: CodeNames = {
  issueType: new Map(),
  sourceDocumentType: new Map(),
  destinationType: new Map(),
  reason: new Map(),
  receiptType: new Map(),
  status: new Map(),
};

/** 코드 → 이름. 이름이 없으면 코드를 그대로 낸다. */
export const codeNameOf = (names: ReadonlyMap<string, string>, code: string): string =>
  names.get(code) ?? code;

const toOptions = (values: readonly string[], names: ReadonlyMap<string, string>): SelectOption[] =>
  values.map((code) => ({ value: code, label: codeNameOf(names, code) }));

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 서버 코드값 이름 · 계약이 적은 이름(`names`)이 있으면 그것을, 없으면
 * 코드값을 그대로 라벨로 쓴다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (
  values: CodeValueLists,
  names: CodeNames = NO_NAMES,
): CodeOptionSets => ({
  issueType: toOptions(values.issueType, names.issueType),
  sourceDocumentType: toOptions(values.sourceDocumentType, names.sourceDocumentType),
  destinationType: toOptions(values.destinationType, names.destinationType),
  reason: toOptions(values.reason, names.reason),
  receiptType: toOptions(values.receiptType, names.receiptType),
  status: toOptions(values.status, names.status),
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
