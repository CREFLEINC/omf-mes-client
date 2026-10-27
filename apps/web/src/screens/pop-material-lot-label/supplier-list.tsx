import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { SupplierLookup } from './lookups';
import { receiptWhen, type SupplierGroup } from './pending';

const t = messages.popMaterialLotLabel.suppliers;

/** 공급사 이름 — 거래처 목록에서 푼다. 못 풀었으면 그 사유(불러오는 중 · 알 수 없음)를 적는다. */
export const supplierNameOf = (lookup: SupplierLookup, supplierId: number): string =>
  lookup.byId.get(supplierId)?.name ?? lookupDisplayLabel(lookup, supplierId);

/** 라벨의 공급사 줄 — 「이름 (코드)」. 못 풀었으면 `null` 이고 라벨은 그 줄을 비운다. */
export const supplierLabelOf = (lookup: SupplierLookup, supplierId: number): string | null => {
  const supplier = lookup.byId.get(supplierId);

  return supplier === undefined ? null : `${supplier.name} (${supplier.code})`;
};

const whenText = (value: string | undefined): string => {
  const when = value === undefined ? null : receiptWhen(value);

  return when === null ? '' : `${when.day} ${when.time}`;
};

export interface SupplierListProps {
  groups: readonly SupplierGroup[];
  selectedId: number | null;
  supplierLookup: SupplierLookup;
  /** 발행 대기는 가장 이른 입하, 다시 인쇄는 가장 최근 입하를 적는다. */
  mode: 'pending' | 'reprint';
  /** 발행 중에는 공급사를 바꾸지 못한다 — 결과가 다른 공급사 표 밑에 서게 된다. */
  isLocked: boolean;
  onSelect: (supplierId: number) => void;
}

/**
 * 왼쪽 공급사 목록 — **타일 전체가 누르는 자리**다(규범 C-1). 큰 숫자가 남은 장수다.
 *
 * ⭐ 고른 타일은 차콜로 채운다 — 빨강은 주 동작과 진짜 오류에만 쓴다(개편안 2026-10-24).
 */
export const SupplierList = ({
  groups,
  selectedId,
  supplierLookup,
  mode,
  isLocked,
  onSelect,
}: SupplierListProps) => (
  <ul className="pop-mlot-suppliers" aria-label={t.label}>
    {groups.map((group) => {
      const sub =
        mode === 'reprint'
          ? t.latest(whenText(group.rows.at(-1)?.receiptDatetime))
          : group.receiptCount > 1
            ? t.since(whenText(group.firstReceiptDatetime))
            : t.at(whenText(group.firstReceiptDatetime));

      return (
        <li key={group.supplierId}>
          <button
            type="button"
            className="pop-mlot-supplier"
            aria-pressed={group.supplierId === selectedId}
            disabled={isLocked}
            onClick={() => {
              onSelect(group.supplierId);
            }}
          >
            <span className="pop-mlot-supplier-name">
              {supplierNameOf(supplierLookup, group.supplierId)}
            </span>
            <span className="pop-mlot-supplier-count">
              {group.rows.length}
              <span className="pop-mlot-supplier-unit">{t.unit}</span>
            </span>
            <span className="pop-mlot-supplier-sub">{sub}</span>
          </button>
        </li>
      );
    })}
  </ul>
);
