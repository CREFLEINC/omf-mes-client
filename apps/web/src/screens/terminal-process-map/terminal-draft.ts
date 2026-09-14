import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { TerminalView } from './types';

/**
 * 단말 등록·수정 폼의 편집 상태.
 *
 * ⛔ **단말 코드는 등록한 뒤에 바꾸지 않는다** — 키다. 수정 본문에 아예 실리지 않으므로
 * 화면도 그 칸을 잠근다. 잠그기만 하고 보내지 않는 것이 아니라, **보낼 자리가 없다.**
 *
 * 새 단말의 운영 상태는 화면에서 묻지 않는다. 생성 계약은 필수 `statusCode`를 요구하므로
 * 서버가 허용하는 RUNNING으로 시작하고, 이후 수정에서만 운영 상태를 바꾼다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.terminalProcessMap;
const NEW_TERMINAL_STATUS = 'RUNNING';

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
  if (!isNew && draft.statusCode.trim() === '') errors.statusCode = t.terminal.requiredStatus;

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
  statusCode: NEW_TERMINAL_STATUS,
  ...equipmentField(draft),
});

/** ⛔ 단말 코드를 싣지 않는다 — 계약이 받지 않는다. */
export const toUpdateBody = (draft: TerminalDraft): TerminalUpdate => ({
  plantId: Number(draft.plant),
  terminalTypeCode: draft.terminalTypeCode.trim(),
  statusCode: draft.statusCode.trim(),
  ...equipmentField(draft),
});
