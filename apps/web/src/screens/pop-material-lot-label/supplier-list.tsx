import type { MaterialLotPair } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { RefObject } from 'react';

import { formatBaseQty, formatQty } from '../../patterns/package-qty';
import { PuChip, puCx } from '../../patterns/pop-uniform';
import { pairKeyOf } from './types';

const tp = messages.popMaterialLotLabel.precreate;

/**
 * 품목 기본값 한 줄(피처 014 · 시안 P0101 ①) — 「기본 100 EA · ROLL 10」 / 「기본 500 EA · 포장 없음」.
 * 기본값이 없으면 「기본 단위 설정 없음」, 환산이 없으면 「품목 단위 환산 없음」(빨강 — `isMissing`).
 * `withPackageQty` 면 포장을 「ROLL 10 × 10」(패키징 수 × 패키징당 수량)으로 — 오른쪽 머리.
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

export interface PairListProps {
  /** 이 쪽의 공급사·품목(서버 쪽 — `GET /logistics/material-lot-pairs`). */
  pairs: readonly MaterialLotPair[];
  selectedKey: string | null;
  isLocked: boolean;
  onSelect: (pair: MaterialLotPair) => void;
  /** 쪽 건수를 재는 칸. */
  fitRef: RefObject<HTMLUListElement | null>;
}

/**
 * 왼쪽 공급사·품목 목록(피처 014 FR-010 · FR-011 · 시안 P0101 ①). 발행 여부와 상관없이 조회 조건에 맞는 조합이 모두
 * 선다. 칩은 「미출력 N」(이미 만든 미출력)과 「생성 예정 N」(아직 만들지 않은 몫 — 계산만, 기본값이 없으면 칩 없음).
 * 둘 다 0 이면 흐리게. ⭐ 항목 전체가 누르는 자리다(규범 C-1). 넘치면 서버 쪽으로 나눈다(구획 안 스크롤 없음).
 */
export const PairList = ({ pairs, selectedKey, isLocked, onSelect, fitRef }: PairListProps) => (
  <ul ref={fitRef} className="pu-list pu-fit mll-pairs" aria-label={tp.listTitle}>
    {pairs.map((pair) => {
      const key = pairKeyOf(pair.supplier.supplierId, pair.item.itemId);
      const isSelected = key === selectedKey;
      const line = pairDefaultLine(pair);
      const hasCreatable = pair.defaultsStatus === 'OK';
      const isIdle = pair.unprintedCount === 0 && (!hasCreatable || pair.creatableCount === 0);

      return (
        <li key={key}>
          <button
            type="button"
            className={puCx(
              'pu-item',
              isSelected && 'is-selected',
              isIdle && !isSelected && 'mll-idle',
            )}
            aria-pressed={isSelected}
            disabled={isLocked}
            onClick={() => {
              onSelect(pair);
            }}
          >
            <span className="pu-item-top mll-pair-item">
              <span className="mll-pair-name">
                <b>{pair.item.code}</b> {pair.item.name}
              </span>
              <span className="mll-pair-chips">
                <PuChip tone={pair.unprintedCount > 0 ? 'warn' : 'idle'}>
                  {tp.chipUnprinted(pair.unprintedCount)}
                </PuChip>
                {hasCreatable ? (
                  <PuChip tone={pair.creatableCount > 0 ? 'info' : 'idle'}>
                    {tp.chipCreatable(pair.creatableCount)}
                  </PuChip>
                ) : null}
              </span>
            </span>
            <span className="pu-item-sub mll-pair-sub">
              {pair.supplier.name} <b>{pair.supplier.code}</b>
            </span>
            <span className={puCx('pu-item-sub mll-pair-sub', line.isMissing && 'mll-miss')}>
              {line.text}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);
