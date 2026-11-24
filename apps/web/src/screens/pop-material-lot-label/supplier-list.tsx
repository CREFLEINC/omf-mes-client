import type { MaterialLotPair, MaterialLotSupplier } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, type RefObject } from 'react';

import { formatBaseQty, formatQty } from '../../patterns/package-qty';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { PuChip, puCx } from '../../patterns/pop-uniform';
import { pairKeyOf } from './types';

const t = messages.popMaterialLotLabel;
const tp = t.precreate;
const tc = tp.threeCols;

/**
 * 품목 기본값 한 줄(피처 014 · 시안 P0101) — 「기본 100 EA · ROLL 10 × 10」 / 「기본 500 EA · 포장 없음」.
 * 기본값이 없으면 「기본 단위 설정 없음」, 환산이 없으면 「품목 단위 환산 없음」(빨강 — `isMissing`).
 * `withPackageQty` 면 포장을 「ROLL 10 × 10」(패키징 수 × 패키징당 수량)으로 — 상세 머리.
 */
export const pairDefaultLine = (
  pair: Pick<MaterialLotPair, 'defaultsStatus' | 'lotDefaults' | 'item'>,
  withPackageQty = false,
): { text: string; isMissing: boolean } => {
  if (pair.defaultsStatus === 'NO_DEFAULT') return { text: tp.noDefault, isMissing: true };
  if (pair.defaultsStatus === 'NO_CONVERSION') return { text: tp.noConversion, isMissing: true };

  const defaults = pair.lotDefaults;

  if (defaults === null) return { text: tp.noDefault, isMissing: true };

  const qty = formatBaseQty(defaults.lotQty, pair.item.baseUomCode);

  if (defaults.packageCount === null || defaults.packageUomCode === null) {
    return { text: tp.defaultUnpackaged(qty), isMissing: false };
  }

  const pkg = withPackageQty
    ? `${defaults.packageUomCode} ${formatQty(defaults.packageCount)} × ${formatQty(
        Math.round((defaults.lotQty / defaults.packageCount) * 1e6) / 1e6,
      )}`
    : `${defaults.packageUomCode} ${formatQty(defaults.packageCount)}`;

  return { text: tp.defaultPackaged(qty, pkg), isMissing: false };
};

/**
 * 화면의 「미출력 N」 = 이미 만든 미출력 + 아직 만들지 않은 몫(계약 §1a · §1). 기본값이 없거나 환산이 없는 조합은
 * 만들 몫이 없다 — 이미 만든 미출력만 센다.
 */
export const pairUnprintedOf = (
  pair: Pick<MaterialLotPair, 'unprintedCount' | 'creatableCount' | 'defaultsStatus'>,
): number => pair.unprintedCount + (pair.defaultsStatus === 'OK' ? pair.creatableCount : 0);

/** 공급사 칸 한 줄의 「미출력 N」 — 서버가 합을 준다(만들지 않음). */
export const supplierUnprintedOf = (
  row: Pick<MaterialLotSupplier, 'unprintedCount' | 'creatableCount'>,
): number => row.unprintedCount + row.creatableCount;

/** 품목명 글자 크기 — 넘치면 이 범위에서 줄여 한 줄에 담는다(#1751 · 사용자 지시 2026-11-23). */
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

/** 최근 발행 — 「11-23」(공장 날짜). */
const shortWhen = (value: string): string =>
  toPlantDateTimeParts(value)?.date.slice(5) ?? t.pairs.none;

export interface SupplierListProps {
  /** 이 쪽의 공급사(서버 쪽 — `GET /logistics/material-lot-suppliers`). */
  suppliers: readonly MaterialLotSupplier[];
  selectedId: number | null;
  isLocked: boolean;
  onSelect: (row: MaterialLotSupplier) => void;
  /** 쪽 건수를 재는 칸. */
  fitRef: RefObject<HTMLUListElement | null>;
}

/**
 * 첫째 칸 — **공급사만**(#1751 · 피처 014 FR-010 · 시안 P0101 ①). 공급사명(코드 없이) · 오른쪽 끝에 「미출력 N」
 * (이미 만든 것 + 아직 만들지 않은 몫, 있으면 노랑 굵게 · 0 이면 흐리게). 발행 여부와 상관없이 조회 조건에 맞는
 * 공급사가 모두 선다(FR-011). ⭐ 항목 전체가 누르는 자리다(규범 C-1). 넘치면 서버 쪽으로 나눈다.
 */
export const SupplierList = ({
  suppliers,
  selectedId,
  isLocked,
  onSelect,
  fitRef,
}: SupplierListProps) => (
  <ul ref={fitRef} className="pu-list pu-fit mll-pairs" aria-label={tc.suppliers}>
    {suppliers.map((row) => {
      const isSelected = row.supplier.supplierId === selectedId;
      const unprinted = supplierUnprintedOf(row);

      return (
        <li key={row.supplier.supplierId}>
          <button
            type="button"
            className={puCx('pu-item', isSelected && 'is-selected')}
            aria-pressed={isSelected}
            disabled={isLocked}
            onClick={() => {
              onSelect(row);
            }}
          >
            <span className="pu-item-top mll-pair-item">
              <span className="mll-pair-name">{row.supplier.name}</span>
              <span className={puCx('mll-pair-unprinted', unprinted > 0 ? 'has' : 'is-zero')}>
                {tp.chipUnprinted(unprinted)}
              </span>
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

export interface ItemTableProps {
  /** 이 쪽의 고른 공급사 품목(서버 쪽 — `GET /logistics/material-lot-pairs?supplierId`). */
  pairs: readonly MaterialLotPair[];
  selectedKey: string | null;
  isLocked: boolean;
  onSelect: (pair: MaterialLotPair) => void;
  /** 쪽 줄 수를 재는 칸(표를 감싼 칸). */
  fitRef: RefObject<HTMLDivElement | null>;
}

/**
 * 둘째 칸 — **고른 공급사의 품목 표**(#1751 · 피처 014 FR-010 세 칸 · 시안 P0101 ②).
 * 품목코드 · 품목명(길면 글자를 줄여 한 줄) · 미출력(이미 만든 것 + 아직 만들지 않은 몫) · 출력됨 · IQC · 최근 발행.
 * 기본값이 없거나 환산이 없으면 미출력 칸에 빨간 칩(「기본값 없음」 · 「환산 없음」) — 이미 만든 미출력 수는 앞에 그대로.
 * ⭐ 줄 어디를 눌러도 고른다 — 품목코드 칸의 단추가 읽어 주는 도구의 이름을 갖는다.
 */
export const ItemTable = ({ pairs, selectedKey, isLocked, onSelect, fitRef }: ItemTableProps) => (
  <div ref={fitRef} className="mll-items" role="group" aria-label={tc.items}>
    <div className="pu-table-wrap">
      <table className="pu-table">
        <thead>
          <tr>
            <th className="fit">{tc.columns.itemCode}</th>
            <th>{tc.columns.itemName}</th>
            <th className="num fit">{tc.columns.unprinted}</th>
            <th className="num fit">{tc.columns.printed}</th>
            <th className="fit mid">{tc.columns.iqc}</th>
            <th className="fit">{tc.columns.lastIssued}</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => {
            const key = pairKeyOf(pair.supplier.supplierId, pair.item.itemId);
            const isSelected = key === selectedKey;
            const unprinted = pairUnprintedOf(pair);
            const miss = pair.defaultsStatus === 'OK' ? null : tc.miss[pair.defaultsStatus];
            const isIdle = unprinted === 0 && pair.printedCount === 0;

            return (
              <tr
                key={key}
                className={puCx(
                  'is-pick',
                  isSelected && 'is-selected',
                  isIdle && !isSelected && 'mll-idle',
                )}
                onClick={
                  isLocked
                    ? undefined
                    : () => {
                        onSelect(pair);
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
                      onSelect(pair);
                    }}
                  >
                    {pair.item.code}
                  </button>
                </td>
                <td className="mll-item-name-cell">
                  <FitItemName name={pair.item.name} />
                </td>
                <td className={puCx('num fit', unprinted > 0 && 'mll-unprinted-cell')}>
                  {unprinted === 0 && miss !== null
                    ? null
                    : unprinted === 0
                      ? t.pairs.none
                      : unprinted}
                  {miss === null ? null : (
                    <>
                      {unprinted === 0 ? null : ' '}
                      <PuChip tone="bad">{miss}</PuChip>
                    </>
                  )}
                </td>
                <td className="num fit">
                  {pair.printedCount === 0 ? t.pairs.none : pair.printedCount}
                </td>
                <td className="fit mid">
                  {pair.inspectionRequired ? tc.iqcRequired : t.pairs.none}
                </td>
                <td className="fit">
                  {pair.lastIssuedAt === null ? t.pairs.none : shortWhen(pair.lastIssuedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
