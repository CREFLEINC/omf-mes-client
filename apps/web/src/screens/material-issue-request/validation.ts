import { messages } from '@omf-mes/i18n';

import type { MaterialIssueLineDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 도착 위치 필수 · 필요 시각의 날짜/시각 짝 | `validateHeader` |
 * | 라인 형식(품목·단위 필수 · 요청 수량 형식) | `validateLines` |
 * | **발행 활성 조건** | `publishBlockReason` — 이 화면에서 그 판정의 **유일한 자리**다 |
 * | BOM 밖 품목 | **막지 않는다** — 경고만 낸다(스펙 §5-3) |
 * | 중복 요청 | **막지 않는다** — 경고만 낸다(스펙 §6) |
 * | 재고 부족 | **판정하지 않는다** — 피킹 화면이 진다(스펙 §6) |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.materialIssueRequest;

/**
 * 화면이 오류를 그릴 자리를 가진 이름 — 서버의 400 필드 오류를 인라인으로 낼지 배너로 올릴지
 * 가르는 기준이다(`patterns/master`의 `knownFields`).
 */
export const HEADER_FORM_FIELDS: readonly string[] = [
  'workOrderId',
  'destinationLocationId',
  'requiredAt',
  'reasonCode',
  'remarks',
  'lines',
];

export type LineFieldName = 'itemId' | 'uomId' | 'requestedQty';

/** 줄 단위 오류의 열쇠. 줄 키가 앞에 온다 — 잘못 친 줄이 둘일 때 서로 섞이지 않는다. */
export const lineFieldId = (key: string, field: LineFieldName): string => `${key}.${field}`;

/** 친 글자의 해석 결과. 형식 오류를 수의 값역 안에 담지 않는다(`NaN`을 그대로 흘리지 않는다). */
export type QtyRead = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'qty'; value: number };

/**
 * 친 글자를 수량으로 읽는다.
 *
 * ⚠ `Number('')`은 **0**이고 `Number('12x')`는 `NaN`이라, 그대로 흘리면 **0 수량 줄이 전표에
 * 실린다.** 빈 칸과 못 읽는 값을 수의 값역 밖으로 밀어내는 것이 이 함수의 전부다.
 */
export const readQty = (raw: string): QtyRead => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid' };

  return { kind: 'qty', value };
};

export interface HeaderDraft {
  workOrderId: string;
  warehouseId: string;
  destinationLocationId: string;
  requiredDate: string;
  requiredTime: string;
  reasonCode: string;
  remarks: string;
}

/**
 * 머리 필수 값.
 *
 * **필요 시각은 선택이지만 반쪽은 허용하지 않는다** — 날짜만 있고 시각이 없으면 화면이 시각을
 * 지어내야 하고, 시각만 있고 날짜가 없으면 값을 만들 수 없다. 둘 다 비우거나 둘 다 채운다.
 */
export const validateHeader = (draft: HeaderDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.destinationLocationId === '') {
    errors.destinationLocationId = t.errors.destinationRequired;
  }

  const hasDate = draft.requiredDate.trim() !== '';
  const hasTime = draft.requiredTime.trim() !== '';

  if (hasDate && !hasTime) errors.requiredAt = t.errors.requiredTimeMissing;
  if (!hasDate && hasTime) errors.requiredAt = t.errors.requiredDateMissing;

  return errors;
};

export interface LineValidation {
  errors: Record<string, string>;
}

/**
 * 요청 수량 오류.
 *
 * **빈 칸과 0 은 오류가 아니다** — 그 줄은 「이번에 안 받는다」는 뜻이고 본문 조립에서 빠진다
 * (스펙 §6). 음수와 못 읽는 값만 막는다.
 */
const requestedQtyError = (raw: string): string | null => {
  const read = readQty(raw);

  if (read.kind === 'empty') return null;
  if (read.kind === 'invalid') return t.errors.requestedQtyNotNumber;

  return read.value < 0 ? t.errors.requestedQtyNotPositive : null;
};

export const validateLines = (lines: readonly MaterialIssueLineDraft[]): LineValidation => {
  const errors: Record<string, string> = {};

  for (const line of lines) {
    if (line.itemId === '') errors[lineFieldId(line.key, 'itemId')] = t.errors.itemRequired;
    if (line.uomId === '') errors[lineFieldId(line.key, 'uomId')] = t.errors.uomRequired;

    const qtyError = requestedQtyError(line.requestedQty);

    if (qtyError !== null) errors[lineFieldId(line.key, 'requestedQty')] = qtyError;
  }

  return { errors };
};

/** 보낼 줄이 하나라도 남는가 — 요청 수량이 0 보다 큰 줄이 있어야 한다(계약 `CHECK > 0`). */
export const hasRequestableLine = (lines: readonly MaterialIssueLineDraft[]): boolean =>
  lines.some((line) => {
    const read = readQty(line.requestedQty);

    return read.kind === 'qty' && read.value > 0;
  });

/** 사유를 골랐거나 비고를 한 글자라도 적었는가(스펙 §5-6 의 「또는」). */
export const hasReasonOrRemarks = (reasonCode: string, remarks: string): boolean =>
  reasonCode.trim() !== '' || remarks.trim() !== '';

/**
 * 아직 만지지 않은 칸의 오류를 감춘다.
 *
 * 진입 직후 도착 위치는 비어 있지만 그것은 사용자의 잘못이 아니라 **아직 W/O 를 고르지 않은
 * 상태**이고, 그 상태의 안내는 「먼저 W/O 를 고르세요」다. 그 자리에 붉은 글씨를 세우면 사용자가
 * 아무 일도 하지 않았는데 무언가 잘못한 것으로 읽는다(검증 발견 6).
 *
 * ⛔ **잠금 판정에는 쓰지 않는다.** 보이지 않는 오류로도 발행은 닫혀 있어야 하고, 그 사유는
 * 버튼 옆에 글자로 선다 — 감추는 것은 **오류 표시**이지 **판정**이 아니다.
 */
export const visibleHeaderErrors = (
  errors: Record<string, string>,
  touched: Record<string, boolean>,
  hasAttemptedPublish: boolean,
): Record<string, string> =>
  hasAttemptedPublish
    ? errors
    : Object.fromEntries(Object.entries(errors).filter(([field]) => touched[field] === true));

export interface PublishBlockInput {
  header: HeaderDraft;
  lines: readonly MaterialIssueLineDraft[];
  isSaving: boolean;
  /** 이번 대상으로 이미 발행했는가. 되돌릴 수 없는 쓰기의 둘째 잠금이다 */
  hasPublished: boolean;
}

/**
 * 발행이 막힌 사유 — **이 화면에서 발행 활성 조건의 유일한 구현 자리**다.
 *
 * ⭐ 스펙 두 절이 갈리는 지점이다. **§5-6 액션 표를 정본으로 둔다** — 「라인 1건 이상(수량 > 0)
 * AND (사유 선택 **또는** 비고 입력)」. §6 예외 표의 「사유 미선택은 화면이 막는다」는 사유를
 * 담을 자리가 비고뿐이던 시절의 문면이고, §5-6 의 조건이 그 상황(둘 다 비었을 때)을 이미 닫는다.
 * 계약도 `reasonCode`·`remarks` 를 둘 다 비필수로 두어 서버가 막지 않는다.
 *
 * ⚠ 설계가 §6 을 좁게 의도했다면 **이 함수의 마지막 조건 한 줄만** 바꾸면 된다 —
 * `hasReasonOrRemarks(...)` 를 `reasonCode.trim() !== ''` 로 좁히는 것이 그 변경의 전부다.
 *
 * 차례가 뜻이다 — 사용자가 **먼저 할 수 있는 일**부터 말한다.
 */
export const publishBlockReason = (input: PublishBlockInput): string | null => {
  const { header } = input;

  if (input.hasPublished) return t.actionReasons.alreadyPublished;
  if (input.isSaving) return t.actionReasons.saving;
  if (header.workOrderId === '') return t.actionReasons.noWorkOrder;
  if (header.destinationLocationId === '') return t.actionReasons.noDestination;
  if (!hasRequestableLine(input.lines)) return t.actionReasons.noRequestableLine;
  if (Object.keys(validateLines(input.lines).errors).length > 0) return t.actionReasons.lineInvalid;

  /*
   * 도착 위치는 위에서 이미 걸렀으므로 여기 남는 것은 **필요 시각의 반쪽**뿐이다. 막지 않으면
   * 본문 조립이 `requiredAt` 키를 통째로 빼고 나가 사용자가 적은 날짜가 조용히 사라진다.
   */
  if (Object.keys(validateHeader(header)).length > 0) return t.actionReasons.requiredAtIncomplete;

  if (!hasReasonOrRemarks(header.reasonCode, header.remarks)) {
    return t.actionReasons.noReasonOrRemarks;
  }

  return null;
};
