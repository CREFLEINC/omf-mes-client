import { messages } from '@omf-mes/i18n';

import type { AdjustLineDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **이 파일이 이 화면에서 가장 조심할 자리다**(조심 ② · D-4). 줄이는 조정이 정상 경로라
 * **수량에 하한을 두지 않는다** — 계약에도 `minimum`이 없고 예시값이 음수다. 0 이상으로 막으면
 * 화면이 성립하지 않는다.
 *
 * **오류와 제외를 가른다.**
 *
 * | 갈래 | 무엇인가 | 무엇을 하나 |
 * | --- | --- | --- |
 * | **오류** | 차이가 비었음 · 수로 못 읽음 · 위치·품목·단위 미선택 | **막는다** — 그 줄의 칸에 인라인으로 붙는다 |
 * | **제외** | 차이가 0 | **막지 않는다** — 표식으로 밝히고 등록 본문에서 그 줄을 뺀다 |
 *
 * 둘을 뭉개면 실사에서 차이 없는 줄이 함께 넘어온 화면이 통째로 잠긴다 — 그 줄은 사용자가
 * 고칠 잘못을 저지른 것이 아니다(스펙 §6의 「차이 0인 라인 자동 제외」).
 *
 * **음수 재고 트리거는 서버 몫이다**(스펙 §6 · 품목의 음수 재고 허용 여부). 화면은 그 400을
 * 그대로 보인다 — 화면이 미리 판정하면 허용 품목의 정상 조정까지 막는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockAdjust;

/** 줄 안에서 오류가 붙을 수 있는 칸. */
export type LineFieldName = 'locationId' | 'itemId' | 'uomId' | 'adjustmentQty';

/**
 * 줄 단위 오류의 열쇠. **줄 키가 앞에 온다**(사본 체크리스트 3번) —
 * 칸 이름만으로 열쇠를 만들면 잘못 친 줄이 둘일 때 두 줄이 같은 오류를 가리켜,
 * 사용자가 고치지 않은 줄에서 붉은 글씨를 본다.
 */
export const lineFieldId = (key: string, field: LineFieldName): string => `${key}.${field}`;

/**
 * 친 글자의 해석 결과. **세 갈래를 타입으로 가른다** — 미입력 · 형식 오류 · 수.
 *
 * **형식 오류를 수의 값역 안에 담지 않는다.** 센티넬(`NaN`)로 두면 검사 한 줄을 빠뜨리는 순간
 * 그 값이 계산과 요청 본문으로 흘러가 JSON `null`로 직렬화된다 — 되돌릴 수 없는 쓰기에서
 * 그 사고가 나는 자리를 전례가 타입으로 막아 두었다.
 */
export type QtyRead = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'qty'; value: number };

/**
 * 친 글자를 차이 수량으로 읽는다. **문구를 모른다.**
 *
 * `Number()`는 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서 걸러 낸다.
 * 걸러 내지 않으면 요청 본문에 `0`이나 `null`(직렬화한 `Infinity`)이 실린다. 이 화면에서 `0`은
 * 「제외」라는 뜻을 갖는 값이라, 공백이 0으로 읽히면 **아직 치지 않은 줄이 말없이 빠진다.**
 *
 * **실물을 파생하는 자리와 보낼 본문을 만드는 자리가 이 함수를 함께 쓴다.** 읽는 규칙이
 * 두 벌이면 화면이 보여 준 실물과 나가는 값이 갈린다.
 */
export const readQty = (raw: string): QtyRead => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid' };

  return { kind: 'qty', value };
};

/**
 * 차이 한 칸의 오류. 없으면 `null`이다.
 *
 * ⭐ **하한이 없다**(조심 ② · D-4). 읽을 수 있는 수이기만 하면 음수도 0도 오류가 아니다 —
 * 음수는 그대로 보내고, **0은 오류가 아니라 제외**다(아래 `isExcludedLine`).
 */
const adjustmentQtyError = (raw: string): string | null => {
  const parsed = readQty(raw);

  if (parsed.kind === 'empty') return t.errors.adjustmentQtyRequired;
  if (parsed.kind === 'invalid') return t.errors.adjustmentQtyNotNumber;

  return null;
};

/**
 * 등록에서 **빠질 줄인가** — 차이가 0인 줄이다(스펙 §6).
 *
 * **오류가 아니다.** 실사 차이를 불러오면 차이 0인 줄이 함께 오는 일이 있고, 사용자가 그것을
 * 지우게 만들 이유가 없다 — 화면은 표식으로 밝히고 본문을 만들 때 뺀다.
 *
 * 아직 치지 않았거나 수로 읽히지 않는 줄은 **제외가 아니다** — 그 줄은 오류가 막는다.
 * 제외로 접으면 잘못 친 줄이 조용히 사라져 사용자가 보낸 줄과 나간 줄이 갈린다.
 */
export const isExcludedLine = (line: AdjustLineDraft): boolean => {
  const parsed = readQty(line.adjustmentQtyText);

  return parsed.kind === 'qty' && parsed.value === 0;
};

/** 제외될 줄 수. **안내와 등록 본문이 같은 판정을 쓴다.** */
export const excludedLineCount = (lines: readonly AdjustLineDraft[]): number =>
  lines.filter(isExcludedLine).length;

export interface LineValidation {
  errors: Record<string, string>;
}

/**
 * 라인 전체의 오류.
 *
 * **줄마다 자기 열쇠에 붙는다** — 두 줄이 동시에 잘못돼도 각 칸이 자기 줄의 사유를 가리킨다.
 *
 * **자재 LOT을 필수로 두지 않는다.** 계약이 선택으로 두었고 LOT 관리를 하지 않는 품목이
 * 실재한다 — 필수로 두면 그 품목의 조정을 이 화면에서 만들 수 없다.
 *
 * **장부를 못 찾은 것은 오류가 아니다**(C8). 현장 실측 갈래는 장부를 모른 채로도 조정해야 하고,
 * 계약이 요구하는 것은 차이 수량뿐이다.
 */
export const validateLines = (lines: readonly AdjustLineDraft[]): LineValidation => {
  const errors: Record<string, string> = {};

  for (const line of lines) {
    if (line.locationId === '') {
      errors[lineFieldId(line.key, 'locationId')] = t.errors.locationRequired;
    }

    if (line.itemId === '') errors[lineFieldId(line.key, 'itemId')] = t.errors.itemRequired;
    if (line.uomId === '') errors[lineFieldId(line.key, 'uomId')] = t.errors.uomRequired;

    const qtyError = adjustmentQtyError(line.adjustmentQtyText);

    if (qtyError !== null) errors[lineFieldId(line.key, 'adjustmentQty')] = qtyError;
  }

  return { errors };
};
