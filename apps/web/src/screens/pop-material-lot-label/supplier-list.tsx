import type { SupplierItemDefault, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, type RefObject } from 'react';

import { formatBaseQty, formatPackageQty } from '../../patterns/package-qty';
import { puCx } from '../../patterns/pop-uniform';
import { pairKeyOf } from './types';

const t = messages.popMaterialLotLabel.pairs;

/**
 * 기본 정보 한 줄(screens/P-01-01.md 「왼쪽 행」) — 포장이 있으면 「기본 봉지 10 × 100 = 1,000 EA」, 포장 없음이면
 * 「기본 1 TON · 포장 없음」. 기본 정보가 없으면 `null` — 「기본 정보 없음」은 적지 않는다(사용자 지시 2026-11-23).
 */
export const defaultLineOf = (defaults: SupplierItemDefault | undefined): string | null => {
  if (defaults === undefined) return null;

  return defaults.package === null
    ? t.defaultUnpackaged(formatBaseQty(defaults.lotQty, defaults.uomCode))
    : t.defaultPackaged(formatPackageQty(defaults.lotQty, defaults.uomCode, defaults.package));
};

/** 품목명 글자 크기 — 넘치면 이 범위에서 줄여 한 줄에 담는다(사용자 지시 2026-11-23). */
const NAME_FONT_MAX = 15;
const NAME_FONT_MIN = 10;

/**
 * 품목명 — 칸에 넘치면 글자를 0.5px 씩 줄여 말줄임 없이 한 줄에 담는다. 가장 작게(10px)도 넘치는
 * 아주 긴 이름만 말줄임 + title 로 남는다. 칸 폭이 바뀌면(화면 크기) 다시 잰다.
 */
const FitItemName = ({ name }: { name: string }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const fit = () => {
      let size = NAME_FONT_MAX;
      element.style.fontSize = `${size}px`;
      while (element.scrollWidth > element.clientWidth && size > NAME_FONT_MIN) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(element.parentElement ?? element);

    return () => {
      observer.disconnect();
    };
  }, [name]);

  return (
    <span ref={ref} className="mll-pair-name mll-pair-item-name" title={name}>
      {name}
    </span>
  );
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
 * ⭐ 항목마다 공급사명 · 품목이 늘 보이고, 라벨 미출력은 공급사명 줄 오른쪽에, 기본 포장은 있을 때만 한 줄 더 붙는다. 넘치면 화면이 쪽으로 나눈다(구획 안 스크롤 없음).
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
            {/* 첫 줄은 공급사명(코드 없이) · 오른쪽 끝에 라벨 미출력 수, 둘째 줄은 품목(사용자 지시 2026-11-23).
                「입하 대기 N」 칩은 걷었다. */}
            <span className="pu-item-sub mll-pair-supplier">
              <span>{group.supplierName}</span>
              {group.unprintedCount > 0 && (
                <span className="mll-pair-unprinted">{t.unprinted(group.unprintedCount)}</span>
              )}
            </span>
            {/* 품목코드는 왼쪽, 품목명은 오른쪽 끝(사용자 지시 2026-11-23). */}
            <span className="pu-item-top mll-pair-item">
              <span className="mll-pair-name">{group.itemCode}</span>
              <FitItemName name={group.itemName} />
            </span>
            {defaultLine !== null && (
              <span className="pu-item-sub">
                <span>{defaultLine}</span>
              </span>
            )}
          </button>
        </li>
      );
    })}
  </ul>
);
