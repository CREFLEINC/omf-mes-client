import type { SupplierItemDefault, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { RefObject } from 'react';

import { formatBaseQty, formatPackageQty } from '../../patterns/package-qty';
import { puCx } from '../../patterns/pop-uniform';
import { pairKeyOf } from './types';

const t = messages.popMaterialLotLabel.pairs;

/**
 * 기본 정보 한 줄(screens/P-01-01.md 「왼쪽 행」) — 포장이 있으면 「기본 봉지 10 × 100 = 1,000 EA」, 포장 없음이면
 * 「기본 1 TON · 포장 없음」, 기본 정보가 없으면 「기본 정보 없음」.
 */
export const defaultLineOf = (defaults: SupplierItemDefault | undefined): string => {
  if (defaults === undefined) return t.noDefault;

  return defaults.package === null
    ? t.defaultUnpackaged(formatBaseQty(defaults.lotQty, defaults.uomCode))
    : t.defaultPackaged(formatPackageQty(defaults.lotQty, defaults.uomCode, defaults.package));
};

export interface SupplierListProps {
  /** 이 쪽에 보일 공급사·품목(쪽 넘김은 화면이 자른다). */
  groups: readonly WaitingMaterialLotGroup[];
  defaults: ReadonlyMap<string, SupplierItemDefault>;
  selectedKey: string | null;
  isLocked: boolean;
  onSelect: (key: string) => void;
  /** 쪽 건수를 재는 칸. */
  fitRef: RefObject<HTMLUListElement | null>;
}

/**
 * 왼쪽 **공급사·품목** 목록(005 · screens/P-01-01.md · #295 시안).
 *
 * ⭐ 항목 전체가 누르는 자리다(규범 C-1).
 * ⭐ 항목마다 공급사 · 기본 포장이 늘 보인다. 넘치면 화면이 쪽으로 나눈다(구획 안 스크롤 없음).
 */
export const SupplierList = ({
  groups,
  defaults,
  selectedKey,
  isLocked,
  onSelect,
  fitRef,
}: SupplierListProps) => (
  <ul ref={fitRef} className="pu-list pu-fit mll-pairs" aria-label={t.label}>
    {groups.map((group) => {
      const key = pairKeyOf(group.supplierId, group.itemId);
      const defaultLine = defaultLineOf(defaults.get(key));
      const hasDefault = defaults.has(key);

      return (
        <li key={key}>
          <button
            type="button"
            className={puCx('pu-item', key === selectedKey && 'is-selected')}
            aria-pressed={key === selectedKey}
            disabled={isLocked}
            onClick={() => {
              onSelect(key);
            }}
          >
            {/* 「입하 대기 N」 칩은 걷었다(사용자 지시 2026-11-23). */}
            <span className="pu-item-top">
              <span className="mll-pair-name">{`${group.itemCode} ${group.itemName}`}</span>
            </span>
            <span className="pu-item-sub">
              <span>
                {group.supplierName} <b>{group.supplierCode}</b>
              </span>
            </span>
            <span className={puCx('pu-item-sub', !hasDefault && 'mll-miss')}>
              <span>
                {group.unprintedCount > 0
                  ? t.withUnprinted(defaultLine, group.unprintedCount)
                  : defaultLine}
              </span>
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);
