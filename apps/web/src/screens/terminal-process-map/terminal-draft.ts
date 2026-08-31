import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { TerminalView } from './types';

/**
 * 단말 등록·수정 폼의 편집 상태.
 *
 * ⛔ **단말 코드는 등록한 뒤에 바꾸지 않는다** — 키다. 수정 본문에 아예 실리지 않으므로
 * 화면도 그 칸을 잠근다. 잠그기만 하고 보내지 않는 것이 아니라, **보낼 자리가 없다.**
 *
 * ⚠ **유형·상태는 값 목록이 확정되기 전이라 코드를 직접 받는다.** 고르는 칸으로 만들면
 * 채울 값이 없어 단말을 등록할 수 없다 — 열어 두되 그 사정을 화면에 적는다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.terminalProcessMap;

type TerminalCreate = components['schemas']['TerminalCreate'];
type TerminalUpdate = components['schemas']['TerminalUpdate'];

export interface TerminalDraft {
  terminalCode: string;
  plant: string;
  terminalTypeCode: string;
  statusCode: string;
  /** 빈 문자열이 「설비에 붙이지 않음」이다 — 0을 쓰지 않는다. */
  equipment: string;
}

export const EMPTY_TERMINAL: TerminalDraft = {
  terminalCode: '',
  plant: '',
  terminalTypeCode: '',
  statusCode: '',
  equipment: '',
};

export const toTerminalDraft = (view: TerminalView): TerminalDraft => ({
  terminalCode: view.terminalCode,
  plant: String(view.plantId),
  terminalTypeCode: view.terminalTypeCode,
  statusCode: view.statusCode,
  equipment: view.equipmentId === null ? '' : String(view.equipmentId),
});

export type TerminalErrors = Partial<Record<keyof TerminalDraft, string>>;

/**
 * @param isNew 등록인가. 코드는 등록할 때만 받으므로 검사도 그때만 한다.
 */
export const validateTerminal = (draft: TerminalDraft, isNew: boolean): TerminalErrors => {
  const errors: TerminalErrors = {};

  if (isNew && draft.terminalCode.trim() === '') errors.terminalCode = t.terminal.requiredCode;
  if (draft.plant === '') errors.plant = t.terminal.requiredPlant;
  if (draft.terminalTypeCode.trim() === '') errors.terminalTypeCode = t.terminal.requiredType;
  if (draft.statusCode.trim() === '') errors.statusCode = t.terminal.requiredStatus;

  return errors;
};

export const hasTerminalErrors = (errors: TerminalErrors): boolean =>
  Object.keys(errors).length > 0;

/**
 * ⭐ **설비를 비우면 `null` 을 보낸다.** 칸을 아예 빼면 「고치지 않겠다」로 읽혀, 붙어 있던
 * 설비를 떼는 뜻을 전할 길이 없다 — 계약이 이 칸을 널 허용으로 둔 이유가 그것이다.
 */
const equipmentField = (draft: TerminalDraft): { equipmentId: number | null } => ({
  equipmentId: draft.equipment === '' ? null : Number(draft.equipment),
});

export const toCreateBody = (draft: TerminalDraft): TerminalCreate => ({
  terminalCode: draft.terminalCode.trim(),
  plantId: Number(draft.plant),
  terminalTypeCode: draft.terminalTypeCode.trim(),
  statusCode: draft.statusCode.trim(),
  ...equipmentField(draft),
});

/** ⛔ 단말 코드를 싣지 않는다 — 계약이 받지 않는다. */
export const toUpdateBody = (draft: TerminalDraft): TerminalUpdate => ({
  plantId: Number(draft.plant),
  terminalTypeCode: draft.terminalTypeCode.trim(),
  statusCode: draft.statusCode.trim(),
  ...equipmentField(draft),
});
