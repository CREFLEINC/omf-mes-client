import type { SupplierItemDefault, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, type RefObject } from 'react';

import { formatBaseQty, formatPackageQty } from '../../patterns/package-qty';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
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

/** 왼쪽 공급사 목록의 한 줄 — 찾기에 걸린 공급사·품목을 공급사별로 모은 것. */
/** 최근 발행 — 「11-23」(공장 날짜). */
const shortWhen = (value: string): string => toPlantDateTimeParts(value)?.date.slice(5) ?? t.none;

export interface SupplierRow {
  supplierId: number;
  supplierName: string;
  /** 그 공급사 품목들의 라벨 미출력 합. */
  unprintedCount: number;
}

/** 공급사·품목을 공급사별로 모은다 — 순서는 처음 나온 차례(서버 정렬: 공급사 코드 · 품목 코드). */
export const supplierRowsOf = (groups: readonly WaitingMaterialLotGroup[]): SupplierRow[] => {
  const rows = new Map<number, SupplierRow>();

  for (const group of groups) {
    const row = rows.get(group.supplierId);

    if (row === undefined) {
      rows.set(group.supplierId, {
        supplierId: group.supplierId,
        supplierName: group.supplierName,
        unprintedCount: group.unprintedCount,
      });
    } else {
      row.unprintedCount += group.unprintedCount;
    }
  }

  return [...rows.values()];
};

export interface SupplierListProps {
  /** 이 쪽에 보일 공급사(쪽 넘김은 화면이 자른다). */
  suppliers: readonly SupplierRow[];
  selectedId: number | null;
  isLocked: boolean;
  onSelect: (supplierId: number) => void;
  /** 쪽 건수를 재는 칸. */
  fitRef: RefObject<HTMLUListElement | null>;
}

/**
 * 첫째 목록 — **공급사만**(사용자 지시 2026-11-23). 공급사명(코드 없이) · 오른쪽 끝에 라벨 미출력 수.
 * ⭐ 항목 전체가 누르는 자리다(규범 C-1). 넘치면 화면이 쪽으로 나눈다(구획 안 스크롤 없음).
 */
export const SupplierList = ({
  suppliers,
  selectedId,
  isLocked,
  onSelect,
  fitRef,
}: SupplierListProps) => (
  <ul ref={fitRef} className="pu-list pu-fit mll-pairs" aria-label={t.suppliersLabel}>
    {suppliers.map((supplier) => (
      <li key={supplier.supplierId}>
        <button
          type="button"
          className={puCx('pu-item', supplier.supplierId === selectedId && 'is-selected')}
          aria-pressed={supplier.supplierId === selectedId}
          disabled={isLocked}
          onClick={() => {
            onSelect(supplier.supplierId);
          }}
        >
          <span className="pu-item-top mll-pair-item">
            <span className="mll-pair-name">{supplier.supplierName}</span>
            {supplier.unprintedCount > 0 && (
              <span className="mll-pair-unprinted">{t.unprinted(supplier.unprintedCount)}</span>
            )}
          </span>
        </button>
      </li>
    ))}
  </ul>
);

export interface ItemTableProps {
  /** 이 쪽에 보일 고른 공급사의 품목(쪽 넘김은 화면이 자른다). */
  groups: readonly WaitingMaterialLotGroup[];
  selectedKey: string | null;
  isLocked: boolean;
  onSelect: (key: string) => void;
  /** 쪽 줄 수를 재는 칸(표를 감싼 칸). */
  fitRef: RefObject<HTMLDivElement | null>;
}

/**
 * 둘째 목록 — **고른 공급사의 품목 표**(사용자 지시 2026-11-23).
 * 품목코드 · 품목명(길면 글자를 줄여 한 줄) · 입하 대기 LOT 수 · 그 수량 · 라벨 출력(출력 / 대기) · IQC 대상 · 최근 발행.
 * ⭐ 줄 어디를 눌러도 고른다 — 품목코드 칸의 단추가 읽어 주는 도구의 이름을 갖는다.
 */
export const ItemTable = ({ groups, selectedKey, isLocked, onSelect, fitRef }: ItemTableProps) => (
  <div ref={fitRef} className="mll-items" role="group" aria-label={t.itemsLabel}>
    <div className="pu-table-wrap">
      <table className="pu-table">
        <thead>
          <tr>
            <th className="fit">{t.columns.itemCode}</th>
            <th>{t.columns.itemName}</th>
            <th className="num fit">{t.columns.lots}</th>
            <th className="num fit">{t.columns.qty}</th>
            <th className="num fit">{t.columns.printed}</th>
            <th className="fit mid">{t.columns.iqc}</th>
            <th className="fit">{t.columns.lastIssued}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const key = pairKeyOf(group.supplierId, group.itemId);
            const isSelected = key === selectedKey;
            const printed = group.waitingCount - group.unprintedCount;

            return (
              <tr
                key={key}
                className={puCx('is-pick', isSelected && 'is-selected')}
                onClick={
                  isLocked
                    ? undefined
                    : () => {
                        onSelect(key);
                      }
                }
              >
                <td className="fit">
                  <button
                    type="button"
                    className="mll-item-code"
                    aria-pressed={isSelected}
                    disabled={isLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(key);
                    }}
                  >
                    {group.itemCode}
                  </button>
                </td>
                <td className="mll-item-name-cell">
                  <FitItemName name={group.itemName} />
                </td>
                <td className="num fit">
                  {group.waitingCount === 0 ? t.none : group.waitingCount}
                </td>
                <td className="num fit">
                  {group.waitingCount === 0
                    ? t.none
                    : formatBaseQty(group.waitingQty, group.uomCode)}
                </td>
                <td className={puCx('num fit', group.unprintedCount > 0 && 'mll-unprinted-cell')}>
                  {group.waitingCount === 0 ? t.none : t.printedOf(printed, group.waitingCount)}
                </td>
                <td className="fit mid">{group.inspectionRequired ? t.iqcRequired : t.none}</td>
                <td className="fit">
                  {group.lastIssuedAt === null ? t.none : shortWhen(group.lastIssuedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
