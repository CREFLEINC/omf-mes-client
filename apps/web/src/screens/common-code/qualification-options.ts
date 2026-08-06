import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 자격 유형의 선택지.
 *
 * 계약이 `qualificationTypeCode`를 「공통코드 — 값 목록 미정 §8-5」로 두었다.
 * **값을 지어내지 않는다** — 자리표시 하나만 두고 화면이 「선택지 준비 중」 안내를 함께 낸다.
 * 값을 지어내면 그것이 확정 목록으로 오해되고, 그 코드로 저장된 자료가 남는다.
 *
 * 흥미로운 자리가 하나 있다 — 자격 유형은 공통코드이고 **이 화면이 그 공통코드를 관리한다.**
 * 「자격유형」 코드그룹의 그룹코드가 정해지면 이 파일 한 곳을 조회로 바꾸면 된다.
 * 다만 그 그룹코드가 계약에도 이슈에도 없어 지금은 이을 근거가 없다.
 */

export const PENDING_QUALIFICATION_TYPE = 'PENDING';

export const QUALIFICATION_TYPE_OPTIONS: SelectOption[] = [
  { value: PENDING_QUALIFICATION_TYPE, label: messages.pendingCode.placeholder },
];
