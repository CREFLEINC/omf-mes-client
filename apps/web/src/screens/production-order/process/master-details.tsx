import { Button } from '@crefle/web-ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useRoutingOperations } from '../../routing/queries';
import { AdjustableLayout } from './adjustable-layout';
import { BomTable, RoutingTable } from './revision-tables';

const readableRevision = (label: string) => label.replace(/\bRev\.?\s*/g, '개정 ');

interface Option {
  value: string;
  label: string;
  period?: string;
  isDefault?: boolean;
}
export const MasterDetails = ({
  bomId,
  routingId,
  options,
  locked,
  itemId,
  onRoutingChange,
  disabled = false,
}: {
  bomId: string;
  routingId: string;
  options: Option[];
  locked: boolean;
  itemId?: number;
  onRoutingChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const [preview, setPreview] = useState(routingId);
  useEffect(() => setPreview(routingId), [routingId]);
  const candidate = options.find((option) => option.value === preview);
  const operations = useRoutingOperations(candidate ? Number(preview) : null);
  const applied = options.find((option) => option.value === routingId);
  return (
    <AdjustableLayout
      storageKey="omf-mes:work-planning:bom-routing"
      label="BOM Routing"
      initial="stack"
      className="erp-wo-master-details"
    >
      <section className="pane erp-wo-inline-revision" aria-label="BOM 상세 정보">
        <div className="section-heading-row">
          <h2 className="section-title">BOM 구성</h2>
          <span className="field-note">
            {locked ? '확정 계획 적용 개정' : 'ERP 기본 개정 자동 적용'}
          </span>
        </div>
        {Number(bomId) > 0 ? (
          <BomTable key={bomId} id={Number(bomId)} />
        ) : (
          <p>사용 가능한 ERP 기본 BOM이 없습니다.</p>
        )}
      </section>
      <section className="pane erp-wo-inline-revision" aria-label="Routing 상세 정보">
        <div className="section-heading-row">
          <h2 className="section-title">Routing</h2>
          <span className="field-note">
            {applied ? `현재 적용: ${readableRevision(applied.label)}` : 'Routing 미지정'}
          </span>
        </div>
        {!locked && (
          <div
            className="erp-wo-inline-routing-options"
            role="group"
            aria-label="Routing 개정 목록"
          >
            {options.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant="outlined"
                disabled={disabled}
                aria-pressed={preview === option.value}
                onClick={() => setPreview(option.value)}
              >
                {readableRevision(option.label)}
                {option.isDefault ? ' · 기본' : ''}
              </Button>
            ))}
          </div>
        )}
        {candidate ? (
          <>
            <RoutingTable key={preview} id={Number(preview)} />
            {!locked && (
              <p className="field-note" aria-live="polite">
                {preview === routingId
                  ? '현재 적용한 작업 순서입니다.'
                  : '확인 중인 작업 순서입니다. 적용하면 계획에 반영됩니다.'}
              </p>
            )}
            <div className="section-heading-row erp-wo-inline-routing-actions">
              {itemId != null && (
                <Link
                  to={`/master-data/routing?item=${itemId}&rev=${preview}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Routing 관리 화면 열기 ↗
                </Link>
              )}
              {!locked && (
                <Button
                  size="sm"
                  disabled={
                    disabled ||
                    preview === routingId ||
                    !operations.data?.items.length ||
                    operations.isError
                  }
                  onClick={() => onRoutingChange(preview)}
                >
                  이 작업 순서 적용
                </Button>
              )}
            </div>
          </>
        ) : (
          <p>사용 가능한 Routing이 없습니다.</p>
        )}
      </section>
    </AdjustableLayout>
  );
};
