import { messages } from '@omf-mes/i18n';

import { convertedShots, type ConversionState } from './conversion';
import { COLLECTION_METHOD, type UsageDraft } from './types';

const t = messages.toolUsage;

/**
 * 초안이 실제로 얼마를 보내는가. **보낼 수 없으면 `null`** — 0 으로 떨어뜨리지 않는다.
 *
 * ⛔ **비어 있는 칸을 0 으로 읽지 않는다.** 0 은 「0 회 찍었다」는 사실이고 빈 칸은 「아직
 * 기입하지 않았다」이다. 뭉개면 저장 버튼이 열려 **0 회짜리 실적**이 서버로 나간다.
 */
const parsePositiveInt = (value: string): number | null => {
  const trimmed = value.trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** 생산 수량은 소수를 받는다 — 환산 비율이 소수라 수량까지 정수로 묶을 이유가 없다. */
const parsePositiveNumber = (value: string): number | null => {
  const trimmed = value.trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * 이번에 더할 타발수. **환산이면 비율을 곱한 값**이고, 환산을 쓸 수 없는 상태면 `null` 이다 —
 * 비율 없이 수량만으로 타발수를 지어내지 않는다.
 */
export const incrementOf = (draft: UsageDraft, conversion: ConversionState): number | null => {
  if (draft.method === COLLECTION_METHOD.direct) return parsePositiveInt(draft.shotCount);

  if (conversion.kind !== 'ready') return null;

  const baseQty = parsePositiveNumber(draft.baseQty);

  if (baseQty === null) return null;

  const shots = convertedShots(baseQty, conversion.ratio);

  /* 비율이 아주 작으면 반올림이 0 을 낸다 — 그것은 「아직 안 찍었다」가 아니라 보낼 값이 없는 것이다. */
  return shots > 0 ? shots : null;
};

/** 저장이 막힌 사정. **화면 전체가 지는 것부터 본다** — 뒤에 두면 값을 다 채운 사용자가 잠긴 버튼을 본다. */
export interface SaveGuard {
  hasTool: boolean;
  hasEntry: boolean;
  isOnline: boolean;
  isSaving: boolean;
  increment: number | null;
}

/**
 * 저장이 막힌 사유. 열려 있으면 `undefined`.
 *
 * **순서가 뜻을 정한다** — 나가는 중 → 화면이 지는 사정(진입·연결) → 값의 사정. 값의 사정을
 * 앞에 두면 애초에 저장할 수 없는 화면에서 「타발수를 기입하세요」를 읽고 기입하게 된다.
 */
export const saveDisabledReason = (guard: SaveGuard): string | undefined => {
  if (guard.isSaving) return t.actionReasons.saving;
  if (!guard.hasEntry) return t.actionReasons.noEntry;
  if (!guard.isOnline) return t.actionReasons.offline;
  if (!guard.hasTool) return t.actionReasons.noTool;
  if (guard.increment === null) return t.actionReasons.noShot;

  return undefined;
};

export const canSave = (guard: SaveGuard): boolean => saveDisabledReason(guard) === undefined;

/** 「다시 입력」이 열리는 조건 — 지울 것이 있을 때만(스펙 §5-1). */
export const hasInput = (draft: UsageDraft): boolean =>
  draft.shotCount.trim() !== '' || draft.baseQty.trim() !== '';

/**
 * 타발수 칸이 받는 글자 — **숫자만이다.**
 *
 * ⛔ 저장 단계에서만 거르면 안 된다. 계약의 타발수는 정수이고 이 칸의 입력 수단은 숫자
 * 키패드(스펙 §4-A · D-4)라, 문자가 들어간 값은 **애초에 있을 수 없는 값**이다. 치는 대로
 * 두었다가 저장에서 막으면 작업자는 다 치고 나서야 안 되는 것을 안다.
 *
 * ⚠ 빈 문자열은 그대로 둔다 — 지우는 중이 정상 상태다.
 */
export const digitsOnly = (value: string): string => value.replace(/[^0-9]/g, '');

/**
 * 생산 수량 칸이 받는 글자 — 숫자와 소수점 하나.
 *
 * 수량은 소수가 올 수 있다(환산 비율이 소수라 수량까지 정수로 묶을 이유가 없다). 다만
 * **소수점은 하나뿐**이다 — 둘 이상이면 숫자가 아니다.
 */
export const decimalOnly = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');

  return rest.length === 0 ? cleaned : `${head ?? ''}.${rest.join('')}`;
};
