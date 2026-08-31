import { readQty } from './validation';
import type { ShipmentRequestLineDraft } from './types';

/**
 * 라인 초안의 로컬 합계 — **아직 보내지 않은 입력을 훑어보기 위한 화면 전용 셈이다.**
 *
 * 서버가 이미 계산해 내려주는 값(잔여 유효기간·검사 롤업 등)을 다시 유도하는 것과 다르다 —
 * 여기서 더하는 값은 **서버가 아직 본 적 없는, 사용자가 지금 치고 있는 글자**다.
 * 그래서 계획서가 「로컬 초안 합산, L-2 위반 아님」이라 못 박았다.
 *
 * 읽을 수 없는 칸(빈 값·형식 오류)은 **0으로 본다** — 화면 맨 위 합계 하나 때문에 표 전체를
 * 못 쓰게 막을 이유가 없다. 그 칸의 오류는 표의 인라인 오류(`validation.ts`)가 이미 말한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const sumField = (
  lines: readonly ShipmentRequestLineDraft[],
  field: 'requestedQty' | 'allocatedQty',
): number =>
  lines.reduce((total, line) => {
    const read = readQty(line[field]);

    return total + (read.kind === 'qty' ? read.value : 0);
  }, 0);

export const sumRequested = (lines: readonly ShipmentRequestLineDraft[]): number =>
  sumField(lines, 'requestedQty');

export const sumAllocated = (lines: readonly ShipmentRequestLineDraft[]): number =>
  sumField(lines, 'allocatedQty');

/** 요청 − 배정. 편집 도중에는 음수가 될 수 있다(배정이 아직 안 채워졌을 때) — 그대로 보인다. */
export const unallocatedTotal = (lines: readonly ShipmentRequestLineDraft[]): number =>
  sumRequested(lines) - sumAllocated(lines);
