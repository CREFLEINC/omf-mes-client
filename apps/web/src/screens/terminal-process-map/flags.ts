import { messages } from '@omf-mes/i18n';

/**
 * 이 단말에서 이 공정의 무엇을 열어 둘 것인가 — 여덟 갈래.
 *
 * ⭐ **오조작 방지이지 보안이 아니다.** 보안 경계는 단말 토큰 하나뿐이고, 실제 게이팅은
 * 서버의 거부가 맡는다. 여기서 닫는 것은 「현장에서 잘못 누르는 것」을 줄이는 일이다.
 *
 * ⛔ **승인 플래그를 만들지 않는다.** 계약에 없다.
 *
 * ⚠ **이름만 보면 창고 작업이 있어 보이지만 실재하는 여덟은 전부 생산 축이다.** 그래서
 * 창고 전용 단말은 이 표에서 **행 0건이 정상**이고, 빈 결과를 오류로 그리지 않는다.
 *
 * 순서가 화면의 열 순서다 — 작업의 흐름(시작 → 완료 → 투입 → 실적 → 검사)을 따른다.
 * 되돌리는 것(투입 취소 · 자재 반납)은 뒤에 둔다.
 */

const t = messages.terminalProcessMap;

export const FLAG_KEYS = [
  'canStartWork',
  'canCompleteWork',
  'canInputMaterial',
  'canInputResult',
  'canInputInspection',
  'canPrintLabel',
  'canCancelInput',
  'canReturnMaterial',
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export const flagLabel = (key: FlagKey): string => t.flags[key];

/** 기본은 **닫힘**이다 — 새 행을 더할 때 아무것도 열려 있지 않다. */
export const ALL_CLOSED: Record<FlagKey, boolean> = {
  canStartWork: false,
  canCompleteWork: false,
  canInputMaterial: false,
  canInputResult: false,
  canInputInspection: false,
  canPrintLabel: false,
  canCancelInput: false,
  canReturnMaterial: false,
};
