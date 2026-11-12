import type { SupplierItemDefault, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatBaseQty, formatPackageQty } from '../../patterns/package-qty';
import { pairKeyOf } from './types';

const t = messages.popMaterialLotLabel.pairs;

/**
 * 기본 정보 한 줄(screens/P-01-01.md 「왼쪽 행」) — 패키징이 있으면 「기본 봉지 10 × 100 = 1,000 EA」, 패키징 없음이면
 * 「기본 1 TON · 패키징 없음」, 기본 정보가 없으면 「기본 정보 없음」.
 */
export const defaultLineOf = (defaults: SupplierItemDefault | undefined): string => {
  if (defaults === undefined) return t.noDefault;

  return defaults.package === null
    ? t.defaultUnpackaged(formatBaseQty(defaults.lotQty, defaults.uomCode))
    : t.defaultPackaged(formatPackageQty(defaults.lotQty, defaults.uomCode, defaults.package));
};

export interface SupplierListProps {
  groups: readonly WaitingMaterialLotGroup[];
  defaults: ReadonlyMap<string, SupplierItemDefault>;
  selectedKey: string | null;
  isLocked: boolean;
  /** 찾기 칸에 값이 있는데 맞는 것이 없다 — 「찾는 공급사·품목이 없습니다.」 */
  isFiltered: boolean;
  onSelect: (key: string) => void;
}

/**
 * 왼쪽 **공급사·품목** 목록(005 · screens/P-01-01.md). 옛 「공급사 → 라벨 대기 입하 줄」 목록을 바꿨다.
 *
 * ⭐ 타일 전체가 누르는 자리다(규범 C-1). 칩은 대기 자재 관리 LOT 수 — 0 이면 회색 「대기 0」.
 */
export const SupplierList = ({
  groups,
  defaults,
  selectedKey,
  isLocked,
  isFiltered,
  onSelect,
}: SupplierListProps) => {
  if (groups.length === 0) {
    return <p className="pop-mlot-empty">{isFiltered ? t.noMatch : t.empty}</p>;
  }

  return (
    <ul className="pop-mlot-suppliers" aria-label={t.label}>
      {groups.map((group) => {
        const key = pairKeyOf(group.supplierId, group.itemId);
        const defaultLine = defaultLineOf(defaults.get(key));
        const hasDefault = defaults.has(key);

        return (
          <li key={key}>
            <button
              type="button"
              className="pop-mlot-supplier pop-mlot-pair"
              aria-pressed={key === selectedKey}
              disabled={isLocked}
              onClick={() => {
                onSelect(key);
              }}
            >
              <span className="pop-mlot-supplier-name">
                <span className="pop-mlot-pair-code">{group.itemCode}</span> {group.itemName}
              </span>
              <span
                className="pop-mlot-pair-chip"
                data-tone={group.waitingCount > 0 ? 'warning' : 'idle'}
              >
                {t.waiting(group.waitingCount)}
              </span>
              <span className="pop-mlot-supplier-sub">
                {group.supplierName} <span className="pop-mlot-pair-dim">{group.supplierCode}</span>
              </span>
              <span className="pop-mlot-supplier-sub" data-missing={!hasDefault}>
                {group.unprintedCount > 0
                  ? t.withUnprinted(defaultLine, group.unprintedCount)
                  : defaultLine}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
