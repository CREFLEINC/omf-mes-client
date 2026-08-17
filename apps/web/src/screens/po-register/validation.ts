import { messages } from '@omf-mes/i18n';

import type { HeaderDraft, LineDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **오류와 경고를 가른다**(계획 결정 5). 오류는 등록을 막고 경고는 막지 않는다 —
 * 하나로 뭉개면 「허용치를 크게 뒀다」가 등록을 막고, 그러면 사용자가 경고를 없애려고
 * 자기 판단으로 정한 값을 되돌린다.
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값(공급사·사업부·공장·발주일) | `validateHeader` — 인라인 오류 |
 * | 형식(수량 > 0인 수 · 허용치 ≥ 0인 수) | `validateLines` — 줄 안의 인라인 오류 |
 * | **하한**(승계 줄의 발주수량 ≥ 승계 수량) | `validateLines` — 저장 뒤에 걸리는 것을 화면이 앞당긴다 |
 * | 경고(허용치 > 0 · 공급사 바뀜) | `validateLines`·`supplierChangeWarning` — 막지 않는다 |
 *
 * 하한 판정의 근거는 데이터 제약이다. 누적 입하가 발주 수량과 허용치를 넘을 수 없으므로,
 * 초과분보다 적게 발주하면 그 초과분은 영영 이 발주에 붙지 못한다 —
 * **저장 뒤에 걸리는 것을 화면이 미리 막는다**(공유계약 A-9 ⓑ 등급).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.poRegister;

/**
 * 이 화면이 소유한 머리 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다.
 *
 * **머리 입력칸만 담는다.** 라인 오류는 계약이 어느 행인지 알려 주지 않아 인라인으로 낼 자리를
 * 고를 수 없다 — 여기에 라인 필드를 넣으면 3번 줄의 오류가 1번 줄에 붙는다.
 */
export const PO_FORM_FIELDS: readonly string[] = [
  'supplierId',
  'businessUnitId',
  'plantId',
  'orderDate',
  'expectedReceiptDate',
];

/** 줄 안에서 오류·경고가 붙을 수 있는 칸. */
export type LineFieldName =
  'itemId' | 'orderedQty' | 'uomId' | 'toleranceOverQty' | 'toleranceUnderQty';

/**
 * 줄 단위 오류의 열쇠. **줄 키가 앞에 온다**(사본 체크리스트 3번) —
 * 칸 이름만으로 열쇠를 만들면 잘못 친 줄이 둘일 때 두 줄이 같은 오류를 가리켜,
 * 사용자가 고치지 않은 줄에서 붉은 글씨를 본다.
 */
export const lineFieldId = (key: string, field: LineFieldName): string => `${key}.${field}`;

/**
 * 머리 입력의 오류.
 *
 * **등록을 누른 뒤에 보인다.** 치는 도중에 붉은 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된
 * 것처럼 보인다(저장소 전례) — 그래서 여기서는 판정만 하고 언제 보일지는 화면이 정한다.
 *
 * 입고 예정일은 계약이 선택으로 둔 값이라 비어도 오류가 아니다.
 */
export const validateHeader = (draft: HeaderDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.supplierId === '') errors.supplierId = t.errors.supplierRequired;
  if (draft.businessUnitId === '') errors.businessUnitId = t.errors.businessUnitRequired;
  if (draft.plantId === '') errors.plantId = t.errors.plantRequired;
  if (draft.orderDate === '') errors.orderDate = t.errors.orderDateRequired;

  return errors;
};

/**
 * 친 글자의 해석 결과. **세 갈래를 타입으로 가른다** — 미입력 · 형식 오류 · 수.
 *
 * **형식 오류를 수의 값역 안에 담지 않는다.** 센티넬(`NaN`)로 두면 검사 한 줄을 빠뜨리는 순간
 * 그 값이 계산과 요청 본문으로 흘러가 JSON `null`로 직렬화된다 — 되돌릴 수 없는 쓰기에서
 * 그 사고가 나는 자리를 전례가 타입으로 막아 두었다(전례 `line-draft.ts`의 `QtyParse`).
 */
export type QtyRead = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'qty'; value: number };

/**
 * 친 글자를 수량으로 읽는다. **문구를 모른다.**
 *
 * `Number()`는 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서 걸러 낸다.
 * 걸러 내지 않으면 요청 본문에 `0`이나 `null`(직렬화한 `Infinity`)이 실린다.
 *
 * **보낼 본문을 만드는 자리도 이 함수를 쓴다**(`po-request.ts`). 읽는 규칙이 두 벌이면
 * 화면이 통과시킨 글자를 조립이 다르게 읽어 **확인한 값과 나가는 값이 갈린다.**
 */
export const readQty = (raw: string): QtyRead => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid' };

  return { kind: 'qty', value };
};

type QtyParse =
  { kind: 'empty' } | { kind: 'invalid'; message: string } | { kind: 'qty'; value: number };

/**
 * 읽은 값에 문구를 붙인다.
 *
 * 문구를 **인자로 받는다** — 발주수량과 허용치가 같은 규칙을 쓰지만 사용자에게는 서로 다른
 * 이름으로 말해야 한다.
 */
const parseQty = (raw: string, invalidMessage: string): QtyParse => {
  const read = readQty(raw);

  return read.kind === 'invalid' ? { kind: 'invalid', message: invalidMessage } : read;
};

/** 발주수량 한 칸의 오류. 없으면 `null`이다. */
const orderedQtyError = (line: LineDraft): string | null => {
  const parsed = parseQty(line.orderedQty, t.errors.qtyNotNumber);

  if (parsed.kind === 'empty') return t.errors.qtyRequired;
  if (parsed.kind === 'invalid') return parsed.message;

  const value = parsed.value;

  if (value <= 0) return t.errors.qtyNotPositive;

  /*
   * **승계 줄에만 하한이 있다.** 사용자가 더한 줄은 승계 근거가 없어 견줄 값이 없다 —
   * 여기에 하한을 두면 「초과분과 무관한 줄」을 더할 수 없게 된다.
   */
  if (line.sourceQty !== null && value < line.sourceQty) {
    return t.errors.qtyBelowSource(line.sourceQty);
  }

  return null;
};

/** 허용치 한 칸의 오류. 비어 있으면 0으로 보므로 오류가 아니다. */
const toleranceError = (raw: string): string | null => {
  const parsed = parseQty(raw, t.errors.toleranceNotNumber);

  if (parsed.kind === 'empty') return null;
  if (parsed.kind === 'invalid') return parsed.message;

  return parsed.value < 0 ? t.errors.toleranceNegative : null;
};

/** 허용치가 0보다 큰가. **읽을 수 있는 수일 때만 참이다** — 형식 오류는 경고가 아니라 오류다. */
const isPositiveTolerance = (raw: string): boolean => {
  const parsed = parseQty(raw, t.errors.toleranceNotNumber);

  return parsed.kind === 'qty' && parsed.value > 0;
};

export interface LineValidation {
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * 라인 전체의 오류와 경고.
 *
 * **줄마다 자기 열쇠에 붙는다** — 두 줄이 동시에 잘못돼도 각 칸이 자기 줄의 사유를 가리킨다.
 */
export const validateLines = (lines: readonly LineDraft[]): LineValidation => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const line of lines) {
    if (line.itemId === '') errors[lineFieldId(line.key, 'itemId')] = t.errors.itemRequired;
    if (line.uomId === '') errors[lineFieldId(line.key, 'uomId')] = t.errors.uomRequired;

    const qtyError = orderedQtyError(line);

    if (qtyError !== null) errors[lineFieldId(line.key, 'orderedQty')] = qtyError;

    const overError = toleranceError(line.toleranceOverQty);
    const underError = toleranceError(line.toleranceUnderQty);

    if (overError !== null) errors[lineFieldId(line.key, 'toleranceOverQty')] = overError;
    if (underError !== null) errors[lineFieldId(line.key, 'toleranceUnderQty')] = underError;

    /*
     * **경고는 막지 않는다.** 허용치를 크게 두는 것은 사용자의 판단이고 계약도 허락한다 —
     * 다만 다음 초과 입하가 같은 처리를 다시 부른다는 사실을 알린다.
     */
    if (overError === null && isPositiveTolerance(line.toleranceOverQty)) {
      warnings[lineFieldId(line.key, 'toleranceOverQty')] = t.warnings.toleranceOverPositive;
    }
  }

  return { errors, warnings };
};

/**
 * 승계값과 다른 공급사를 고른 경우의 경고. **막지 않는다**(계획 결정 5).
 *
 * 초과분을 보낸 곳과 발주를 받는 곳이 갈리는 것은 잘못이 아니라 드문 일이다 —
 * 드문 일을 막으면 그 업무가 화면 밖에서 처리된다.
 */
export const supplierChangeWarning = (
  draft: HeaderDraft,
  sourceSupplierId: number | null,
): string | null => {
  if (sourceSupplierId === null) return null;
  if (draft.supplierId === '') return null;

  return draft.supplierId === String(sourceSupplierId) ? null : t.warnings.supplierChanged;
};
