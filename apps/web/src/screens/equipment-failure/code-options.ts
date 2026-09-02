import { messages } from '@omf-mes/i18n';

/**
 * 값 목록이 확정되지 않은 코드.
 *
 * ⚠ **고장 원인 코드는 이름이 하나도 없다.** 계약에도 스펙에도 값이 없고, 고객사가 정해야 하는
 * 분류다. 그런데 **완료의 실질 선행 조건**이라(계약이 완료 본문에 필수로 두었다) 목록이 비면
 * 완료 자체가 막힌다 — 그 사실을 감추지 않고 버튼의 사유로 낸다.
 *
 * ⛔ **값을 지어내지 않는다.** 지어낸 코드로 완료하면 서버가 거부하거나, 더 나쁘게는 아무도
 * 모르는 원인이 원장에 남고 **되돌릴 수 없다**.
 *
 * 값 목록이 서면 이 배열만 채운다 — 그때 선택칸과 완료 버튼이 저절로 열린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.equipmentFailure;

export interface CodeOption {
  value: string;
  label: string;
}

/** 고장 원인 코드. **비어 있는 것이 지금 맞다.** */
export const PLACEHOLDER_CAUSE_CODES: readonly CodeOption[] = [];

/** 선택칸 아래 안내. 값이 아예 없으면 그 사실을, 일부만 있으면 잠정임을 밝힌다. */
export const causeNote = (): string =>
  PLACEHOLDER_CAUSE_CODES.length === 0 ? t.codes.causeEmpty : t.codes.provisional;

/** 코드 하나의 이름. 못 찾으면 코드를 그대로 보인다 — 「알 수 없음」을 쓰지 않는다. */
export const codeLabel = (code: string): string =>
  PLACEHOLDER_CAUSE_CODES.find((option) => option.value === code)?.label ?? code;
