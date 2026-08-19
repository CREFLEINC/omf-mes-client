import { messages } from '@omf-mes/i18n';

/**
 * 처리 경과 한 줄이 남긴 **원장 참조**.
 *
 * ⭐ **번호와 영업일이 둘 다 있을 때만 짝이다.** 원장은 영업일이 키의 일부라
 * (계약 경로 `/inventory/transactions/{businessDate}/{inventoryTransactionId}`) 번호만으로는
 * 찾을 수 없다. 계약이 두 필드를 **둘 다 선택**으로 두어(실측) 반쪽으로 오는 갈래가 실재하며,
 * 그때 번호만 내면 **찾을 수 있는 것처럼 보이는** 값이 화면에 남는다.
 *
 * ⛔ **원장 진입을 만들지 않는다.** 원장 조회 화면이 이 저장소에 없다(라우트 실측). 번호와
 * 영업일을 **함께 표시**만 하며, 나중에 진입이 붙을 때 필요한 두 값이 이미 화면에 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.documentProgress;

/**
 * 원장 참조의 세 갈래.
 *
 * `incomplete`가 어느 쪽이 왔는지 함께 나르는 이유는 **없는 쪽을 말해야** 하기 때문이다 —
 * 「원장 정보가 불완전합니다」로 뭉개면 사용자가 무엇을 담당자에게 물어야 할지 모른다.
 */
export type LedgerRef =
  | { kind: 'none' }
  | { kind: 'pair'; transactionNo: string; businessDate: string }
  | { kind: 'incomplete'; transactionNo: string | null; businessDate: string | null };

/** 빈 문자열은 값이 아니다 — 계약이 선택으로 둔 자리라 빈 글자가 스키마를 통과한다. */
const readValue = (raw: string | null | undefined): string | null =>
  raw === null || raw === undefined || raw === '' ? null : raw;

export const readLedgerRef = (step: {
  inventoryTransactionNo?: string | null;
  businessDate?: string | null;
}): LedgerRef => {
  const transactionNo = readValue(step.inventoryTransactionNo);
  const businessDate = readValue(step.businessDate);

  if (transactionNo !== null && businessDate !== null) {
    return { kind: 'pair', transactionNo, businessDate };
  }

  if (transactionNo === null && businessDate === null) return { kind: 'none' };

  return { kind: 'incomplete', transactionNo, businessDate };
};

/**
 * 원장 참조를 사람이 읽는 글자로 옮긴다.
 *
 * 없음은 **값 없음 표식**이다 — 빈 칸으로 두면 원장을 만들지 않은 단계인지 화면이 빠뜨린
 * 것인지 구분되지 않는다.
 */
export const describeLedgerRef = (ref: LedgerRef): string => {
  switch (ref.kind) {
    case 'pair':
      return t.ledger.pair(ref.transactionNo, ref.businessDate);
    case 'incomplete':
      return ref.transactionNo === null
        ? t.ledger.noTransactionNo(ref.businessDate ?? '')
        : t.ledger.noBusinessDate(ref.transactionNo);
    case 'none':
      return t.values.empty;
  }
};
