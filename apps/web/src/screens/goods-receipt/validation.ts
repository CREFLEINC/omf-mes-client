import { messages } from '@omf-mes/i18n';

import { REQUIRED_CODE_KEYS } from './code-options';
import type { GoodsReceiptCodeKey, ReceiptDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **검증을 세 층에 나눠 심고 층마다 맡는 것을 겹치지 않게 둔다**(계획 결정 11).
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값(헤더 7종·라인 7종) | 계약 타입 + `gr-request.ts`가 늘 채운다 |
 * | **조건부 필수**(라인 최소 1행 · 창고 · 위치 · 필수 코드 · 입고 일시) | 이 파일의 `postBlockReason` — 버튼 활성/비활성과 사유 |
 * | **길이**(코드 50자) | 이 파일의 `validateDraft` — 인라인 오류 |
 *
 * **화면이 막지 않는 것은 서버가 막는다.** 그 실패는 저장 실패 배너로 보인다.
 *
 * **막는 곳이 화면뿐인 자리가 둘 있다**(실측). 계약의 `lines`에 `minItems`가 없어 목 서버가
 * 빈 배열을 201로 통과시키고, 코드에 `minLength`가 없어 빈 문자열도 201로 통과한다 —
 * 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.goodsReceipt;

/** 계약이 정한 코드 길이 상한. */
export const CODE_MAX = 50;

/**
 * 코드 자리 ↔ 계약 필드 이름.
 *
 * **한 곳에 모은다.** 오류를 세우는 자리(`validateDraft`)와 그 오류를 읽어 내는 자리
 * (`code-fields.tsx`)와 서버 오류를 인라인으로 낼지 가르는 자리(`POST_FORM_FIELDS`)가
 * 같은 이름을 봐야, 서버가 준 오류와 화면이 잡은 오류가 같은 칸에 붙는다.
 */
export const CODE_FIELD_NAMES: Record<GoodsReceiptCodeKey, string> = {
  receiptType: 'receiptTypeCode',
  sourceDocumentType: 'sourceDocumentTypeCode',
  qualityStatus: 'qualityStatusCode',
  inventoryStatus: 'inventoryStatusCode',
  reason: 'reasonCode',
};

/**
 * 이 화면이 소유한 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다.
 *
 * 라인 코드(`qualityStatusCode`·`inventoryStatusCode`)와 위치도 담는다 — 이 화면은 라인마다
 * 따로 받지 않고 **한 벌을 모든 줄에 같게** 싣기 때문에 가리킬 칸이 하나로 정해진다.
 * 라인별 코드 입력을 나중에 붙이면 그때 이 목록에서 빼야 한다 — 3번 줄의 오류가 1번 줄에 붙는다.
 *
 * `plantId`·`sourceDocumentId`·`businessDate`는 화면이 값을 정하지 않는다(고른 전표와 일시에서
 * 나온다). 인라인으로 낼 칸이 없으므로 담지 않는다 — 담으면 어디에도 보이지 않는 오류가 된다.
 */
export const POST_FORM_FIELDS: readonly string[] = [
  ...Object.values(CODE_FIELD_NAMES),
  'warehouseId',
  'destinationLocationId',
  'receiptDatetime',
  'remarks',
];

/** 「입고 처리」를 열지 말지 가르는 입력. */
export interface PostGateInput {
  /**
   * 필수 코드의 **값 목록 자체가 없는가**(`code-options.ts`).
   *
   * 「아직 안 골랐다」와 다르다 — 고를 것이 없는데 「고르세요」라고 말하면 사용자가
   * 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다.
   */
  isCodeListPending: boolean;
  draft: ReceiptDraft;
}

/*
 * **「라인을 골랐는가」는 여기서 판정하지 않는다.** 확정 구획 자체가 고른 줄 아래에만 그려지므로
 * (닿을 수 없는 가지를 만들지 않는다) 이 함수에 그 조건을 두면 늘 참인 가지가 된다.
 * 「라인이 없으면 보내지 않는다」는 **구획이 없다**는 사실이 지키고, 요청 조립의
 * `toReceiptLines`가 LOT 없는 줄을 걸러 한 겹 더 받친다.
 */

const isBlank = (value: string): boolean => value.trim() === '';

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다.** 코드 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를
 * 아무리 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다.
 * 그다음은 어디에 넣는가(창고 → 위치) → 무엇으로 넣는가(코드) → 언제(일시) 차례다.
 */
export const postBlockReason = (input: PostGateInput): string | null => {
  if (input.isCodeListPending) return t.actionReasons.postCodeListPending;
  if (input.draft.warehouse === '') return t.actionReasons.postNeedsWarehouse;
  if (input.draft.location === '') return t.actionReasons.postNeedsLocation;
  if (REQUIRED_CODE_KEYS.some((key) => isBlank(input.draft.codes[key]))) {
    return t.actionReasons.postNeedsCodes;
  }
  if (input.draft.receiptDatetime === '') return t.actionReasons.postNeedsReceiptDatetime;

  return null;
};

/**
 * 인라인으로 낼 오류.
 *
 * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
 * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다.
 *
 * 선택지에서 고른 값이 상한을 넘는 일은 드물다 — 그래도 잡는 이유는, 값 목록이 확정돼
 * 배열이 채워질 때 그 값의 길이를 화면이 정하지 않기 때문이다. 서버가 400으로 되돌려도
 * 되돌릴 수 없는 요청이 이미 나간 뒤가 아니라 나가기 전에 막는 편이 싸다.
 */
export const validateDraft = (draft: ReceiptDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [key, field] of Object.entries(CODE_FIELD_NAMES) as [
    GoodsReceiptCodeKey,
    string,
  ][]) {
    if (draft.codes[key].trim().length > CODE_MAX) {
      errors[field] = t.errors.codeTooLong(CODE_MAX);
    }
  }

  return errors;
};
