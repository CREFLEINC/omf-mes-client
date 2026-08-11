import { messages } from '@omf-mes/i18n';

import type { GoodsReceiptCodeKey, SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드 다섯을 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * 되돌릴 수 없는 쓰기 화면에서 그 어긋남은 막다른 길이 된다. 계약의 `@example`
 * (`PURCHASE`·`INBOUND_RECEIPT`·`RELEASED`·`AVAILABLE`)도 심지 않는다. 그것은 예시이지
 * 확정이 아니며, 계약 자신이 「enum으로 못박으면 값이 정해질 때 계약이 깨진다」고 적었다.
 *
 * **앞선 화면들과 다른 점이 하나 있다.** W-01-07·W-01-09·W-01-03에서 자리표시가 놓인 자리는
 * 전부 **조회 조건**이거나 **선택 필드**라 비어 있어도 화면이 돌았다. 여기서는 넷이 **요청의
 * 필수 필드**라, 비어 있는 동안 「입고 처리」가 잠긴다 — 그 사실을 사유 문구로 밝힌다.
 *
 * **값이 확정되면 이 파일의 배열만 채우면 된다.** 화면·검증·요청 조립은 배열을 읽을 뿐이라
 * 다른 자리를 고칠 필요가 없고, 채우는 순간 「입고 처리」가 저절로 살아난다
 * (`isRequiredCodeListPending`). 그 전환은 감지기가 고정한다.
 *
 * 추적: 공통코드 값 목록 미확정 — 설계 저장소 이슈로 관리한다(비공개 저장소는 번호로만 참조).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 계약이 **필수**로 요구하는 넷.
 *
 * `sourceDocumentType`이 여기 있는 것이 눈에 걸릴 수 있다 — 원천이 입하 전표임을 가리키는
 * **구조 값**이라 사용자가 고를 성질이 아니다. 그런데도 자리표시로 두는 이유는, 그 값이
 * 무엇이어야 하는지도 아직 확정되지 않았기 때문이다. 화면이 「입하 전표를 뜻하는 코드」를
 * 정해 심으면 그것도 지어내는 것이다.
 */
export const REQUIRED_CODE_KEYS: readonly GoodsReceiptCodeKey[] = [
  'receiptType',
  'sourceDocumentType',
  'qualityStatus',
  'inventoryStatus',
];

/** 코드마다의 값 목록. **비어 있는 것이 지금의 사실이다.** */
export type CodeValueLists = Record<GoodsReceiptCodeKey, readonly string[]>;

/** 코드마다의 선택지. */
export type CodeOptionSets = Record<GoodsReceiptCodeKey, SelectOption[]>;

/**
 * 값 목록 — **다섯 다 비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것을 고를 수 있고, 고르면
 * 서버가 모르는 코드가 되돌릴 수 없는 전표에 실린다.
 */
export const PLACEHOLDER_GOODS_RECEIPT_CODES: CodeValueLists = {
  receiptType: [],
  sourceDocumentType: [],
  qualityStatus: [],
  inventoryStatus: [],
  reason: [],
};

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 「구매 입고」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptionSets = (values: CodeValueLists): CodeOptionSets => ({
  receiptType: toOptions(values.receiptType),
  sourceDocumentType: toOptions(values.sourceDocumentType),
  qualityStatus: toOptions(values.qualityStatus),
  inventoryStatus: toOptions(values.inventoryStatus),
  reason: toOptions(values.reason),
});

const toOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 필수 코드 중 **고를 값 자체가 없는** 것이 있는가.
 *
 * 참이면 사용자가 아무리 애써도 요청을 만들 수 없다 — 그 사정은 「값을 아직 안 골랐다」와
 * 다르므로 사유 문구도 갈라야 한다. 「고르세요」라고 말하는데 고를 것이 없으면 사용자는
 * 자기가 무엇을 놓쳤는지 찾다가 화면을 고장으로 읽는다.
 */
export const isRequiredCodeListPending = (sets: CodeOptionSets): boolean =>
  REQUIRED_CODE_KEYS.some((key) => sets[key].length === 0);

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
