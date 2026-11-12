import { Button, Checkbox } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPackage, formatQty } from '../../patterns/package-qty';

const t = messages.iqcInboundLot.drawer;

export interface LotMatchFieldProps {
  /** 이 입하 LOT 의 자재 관리 LOT 만(US3-7). */
  lots: readonly InspectionLotForward[];
  /** 다른 결과의 매칭 — 「결과 n에도 매칭됨」(지금 고치는 결과는 뺀다). */
  otherResults: readonly InspectionResultSummaryForward[];
  uomCode: string;
  value: readonly number[];
  disabled?: boolean;
  /** 「자재 관리 LOT를 1개 이상 고르세요」 — [저장]을 눌렀는데 비었을 때. */
  error?: string | null;
  onChange: (next: number[]) => void;
}

/** LOT 번호의 끝 마디를 굵게 — 같은 입하 LOT 의 LOT 은 끝 마디만 다르다. */
export const LotNo = ({ lotNo }: { lotNo: string }) => {
  const cut = lotNo.lastIndexOf('|') + 1;

  return cut > 0 && cut < lotNo.length ? (
    <span className="iqc-inbound-lot-no" title={lotNo}>
      {lotNo.slice(0, cut)}
      <strong>{lotNo.slice(cut)}</strong>
    </span>
  ) : (
    <span className="iqc-inbound-lot-no">{lotNo}</span>
  );
};

/**
 * 결과 드로어의 「자재 관리 LOT 매칭」(screens/W-01-01.md) — 1개 이상 필수(FR-021 · 2026-11-12), 여러 결과에 같은 LOT 을 매칭해도
 * 된다(US3-3). [전부 선택]은 LOT 마다 매칭으로 저장한다(「전체」라는 따로 된 표시는 없다).
 */
export const LotMatchField = ({
  lots,
  otherResults,
  uomCode,
  value,
  disabled = false,
  error = null,
  onChange,
}: LotMatchFieldProps) => (
  <section className="parts-iqc-card iqc-inbound-match" aria-labelledby="iqc-inbound-match-head">
    <div className="parts-iqc-block-head">
      <h3 id="iqc-inbound-match-head" className="parts-iqc-sub-title">
        {t.matchHeading}{' '}
        <span className="required-mark" aria-hidden="true">
          *
        </span>
      </h3>
      <span className="parts-iqc-footer-gap" />
      <Button
        variant="outlined"
        size="sm"
        disabled={disabled || lots.length === 0 || value.length === lots.length}
        onClick={() => onChange(lots.map((lot) => lot.lotId))}
      >
        {t.selectAll}
      </Button>
    </div>
    <p className="field-note">{t.matchHelp}</p>
    <ul className="iqc-inbound-match-list">
      {lots.map((lot) => {
        const also = otherResults
          .filter((result) => result.matchedLotIds.includes(lot.lotId))
          .map((result) => String(result.seqNo));
        const checked = value.includes(lot.lotId);

        return (
          <li key={lot.lotId}>
            <Checkbox
              checked={checked}
              disabled={disabled}
              aria-label={lot.lotNo}
              onChange={() =>
                onChange(
                  checked
                    ? value.filter((id) => id !== lot.lotId)
                    : lots
                        .map((each) => each.lotId)
                        .filter((id) => id === lot.lotId || value.includes(id)),
                )
              }
            />
            <LotNo lotNo={lot.lotNo} />
            <span>{`${formatQty(lot.lotQty)} ${uomCode}`}</span>
            {lot.package === null ? null : (
              <span className="parts-iqc-muted">{formatPackage(lot.package)}</span>
            )}
            {also.length === 0 ? null : (
              <span className="iqc-inbound-also">{t.alsoMatched(also.join(', '))}</span>
            )}
          </li>
        );
      })}
    </ul>
    {error === null ? null : (
      <p className="field-error" role="alert">
        {error}
      </p>
    )}
    <p className="field-note">{t.matchNote}</p>
  </section>
);
