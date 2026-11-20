import { messages } from '@omf-mes/i18n';

import type { VerifiedTerminal } from '../../../patterns/pop-registration';

/**
 * 단말 등록이 확인해 준 설비·공정을 화면 글자로 — 등록 확인 단계와 사번 입력 화면의 정보 띠가
 * 같은 말을 하게 한 자리에 둔다(#295 로그인 시안).
 *
 * ⛔ 이름이 없으면 코드·번호를 보이고, 어느 것도 없으면 미지정이다 — 지어내지 않는다.
 */
const t = messages.workerAssignment.registration;

export const equipmentText = (terminal: VerifiedTerminal): string =>
  terminal.equipmentName ??
  terminal.equipmentCode ??
  (terminal.equipmentId === null ? t.unassigned : String(terminal.equipmentId));

/** 받지 못했으면(`null`) 「확인하지 못함」, 빈 목록이면 「미지정」. */
export const processText = (names: readonly string[] | null): string =>
  names === null ? t.processUnknown : names.length === 0 ? t.unassigned : names.join(', ');
