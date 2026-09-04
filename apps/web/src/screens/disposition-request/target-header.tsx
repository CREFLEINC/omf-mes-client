import { Chip, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { sourceCodeLabel, stageLabel } from './codes';
import { LoadErrorBanner } from './load-error';
import type { RequestLookup } from './lookups';
import type { Nonconformance, TargetRow } from './types';

export interface TargetDetailState {
  isPending: boolean;
  isError: boolean;
  isNotFound: boolean;
  error: unknown;
  view: Nonconformance | null;
}

export interface TargetHeaderProps {
  row: TargetRow | null;
  detail: TargetDetailState;
  uoms: RequestLookup;
  onRetry: () => void;
}

/**
 * 선택한 대상의 머리 — 목업(§3 우측 상단)의 「LOT · 품목 · 수량 · 창고 · 원천」이다.
 * 원천은 **읽기 표시**다 — 화면이 고르지 않고 서버가 입고 유형으로 정한다(스펙 §5-1-1).
 * 반품 갈래는 입고 전표(입고번호·입고일·거래처)가, 제품 갈래는 OQC 불합격 검사 결과가 근거다.
 */
export const TargetHeader = ({ row, detail, uoms, onRetry }: TargetHeaderProps): ReactNode => {
  const t = messages.dispositionRequest;

  if (row === null) {
    return <EmptyState size="sm" title={t.target.select} />;
  }

  const uomLabel = lookupDisplayLabel(uoms, row.uomId);
  const sourceParts: (string | null)[] =
    row.sourceCode === 'RETURN'
      ? [t.target.returnSource, row.receiptNo, row.receivedAtText, row.partnerName]
      : [
          t.target.productSource,
          row.inspectionResultId === null ? null : t.fields.inspectionResult,
        ];
  const sourceDetail = sourceParts
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

  return (
    <div className="disposition-request-target">
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.fields.lotNo}</dt>
          <dd>{row.lotNo}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.fields.item}</dt>
          <dd>{row.itemText}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.fields.qty}</dt>
          <dd>{`${row.qtyText} ${uomLabel}`.trim()}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.fields.warehouse}</dt>
          <dd>{row.warehouseName ?? t.values.notAvailable}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.fields.sourceCode}</dt>
          <dd>
            <Chip variant="status" size="sm">
              {sourceCodeLabel(row.sourceCode)}
            </Chip>{' '}
            {sourceDetail}
          </dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.fields.stage}</dt>
          <dd>
            <Chip variant="status" size="sm">
              {stageLabel(row.stage, row.stageCodeText)}
            </Chip>
          </dd>
        </div>
      </dl>
      {/* 원천은 묻지 않는다 — 그 사실을 읽기 표시 옆에 상시 둔다(§5-1-1). */}
      <p className="field-note">{t.register.sourceDerived}</p>

      {row.nonconformanceId !== null && (
        <div className="disposition-request-subsection" aria-label={t.fields.nonconformanceNo}>
          {detail.isError && !detail.isNotFound && (
            <LoadErrorBanner error={detail.error} isDetail onRetry={onRetry} />
          )}
          {detail.isNotFound && (
            <EmptyState
              size="sm"
              live
              title={t.target.notFound}
              description={t.target.notFoundDescription}
            />
          )}
          {detail.isPending && !detail.isError && (
            <div role="status" aria-label={t.target.loading}>
              <SkeletonText lines={2} />
            </div>
          )}
          {detail.view !== null && (
            <dl className="filter-bar">
              <div className="field-cell">
                <dt className="field-label">{t.fields.nonconformanceNo}</dt>
                <dd>{detail.view.nonconformanceNo}</dd>
              </div>
              <div className="field-cell">
                <dt className="field-label">{t.fields.severity}</dt>
                <dd>{detail.view.severityCode}</dd>
              </div>
              <div className="field-cell disposition-request-description">
                <dt className="field-label">{t.fields.description}</dt>
                <dd>{detail.view.description}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
};
