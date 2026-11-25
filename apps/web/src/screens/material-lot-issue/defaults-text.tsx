import { messages } from '@omf-mes/i18n';

import type { UomOption } from '../../patterns/material-lot-batch';
import { formatBaseQty, formatQty } from '../../patterns/package-qty';
import type { Pair } from './types';

const tp = messages.materialLotIssue.precreate;

/** 품목 기본 보관 단위 글 — 「봉지 100 EA」(환산이 없으면 단위만). 없으면 null. 단위는 이름, 이름이 비면 코드(G2 L17). */
export const storageText = (
  storage: { uomId: number; qtyPerPackage: number | null } | null | undefined,
  uoms: readonly UomOption[] | undefined,
  baseUomCode: string,
): string | null => {
  if (storage === null || storage === undefined) return null;
  const found = uoms?.find((row) => row.uomId === storage.uomId);
  const unit =
    found === undefined ? '' : found.uomName.trim() === '' ? found.uomCode : found.uomName;
  return storage.qtyPerPackage === null
    ? unit
    : `${unit} ${formatBaseQty(storage.qtyPerPackage, baseUomCode)}`;
};

/**
 * 기본 정보 한 줄 — 품목 기본값(피처 014 · W-06-05 자재 LOT 기본크기 · 패키징). 「1,000 EA · BAG 10」 /
 * 「500 EA · 패키징 없음」, 기본값이 없으면 「기본 단위 설정 없음」, 환산이 없으면 「품목 단위 환산 없음」(빨강).
 * `withPackageQty` 면 패키징을 「BAG 10 × 100」(패키징 수 × 패키징당 수량)으로 — 상세 머리.
 */
export const pairDefaultLine = (
  pair: Pick<Pair, 'defaultsStatus' | 'lotDefaults' | 'item'>,
  withPackageQty = false,
): { text: string; isMissing: boolean } => {
  if (pair.defaultsStatus === 'NO_CONVERSION') return { text: tp.noConversion, isMissing: true };
  const defaults = pair.lotDefaults;
  if (pair.defaultsStatus === 'NO_DEFAULT' || defaults === null) {
    return { text: tp.noDefault, isMissing: true };
  }
  const qty = formatBaseQty(defaults.lotQty, pair.item.baseUomCode);
  if (defaults.packageCount === null || defaults.packageUomCode === null) {
    return { text: tp.defaultUnpackaged(qty), isMissing: false };
  }
  const per = Math.round((defaults.lotQty / defaults.packageCount) * 1e6) / 1e6;
  const pkg = withPackageQty
    ? `${defaults.packageUomCode} ${formatQty(defaults.packageCount)} × ${formatQty(per)}`
    : `${defaults.packageUomCode} ${formatQty(defaults.packageCount)}`;
  return { text: tp.defaultPackaged(qty, pkg), isMissing: false };
};

export const PairDefaultsText = ({
  pair,
  withPackageQty = false,
}: {
  pair: Pick<Pair, 'defaultsStatus' | 'lotDefaults' | 'item'>;
  withPackageQty?: boolean;
}) => {
  const line = pairDefaultLine(pair, withPackageQty);
  return (
    <span className={line.isMissing ? 'mlot-issue-bad' : undefined}>
      {line.isMissing || !withPackageQty ? line.text : tp.headDefault(line.text)}
    </span>
  );
};
