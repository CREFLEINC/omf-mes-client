import { Button, Icon } from '@crefle/web-ui';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Select } from '../../../patterns/select';
import { useRoutingOperations } from '../../routing/queries';
import { AdjustableLayout } from './adjustable-layout';
import { BomTable, RoutingTable } from './revision-tables';

const readableRevision = (label: string) => label.replace(/\bRev\.?\s*/g, '개정 ');

/**
 * 없는 경우 표시 — 무엇이 없는지 한 줄과, 고칠 화면으로 가는 단추(사용자 결정 2026-11-27).
 * 설명 문장과 제목 옆 상태 칩은 두지 않는다.
 */
export const MissingNotice = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="erp-wo-missing-notice">
    <p>
      <Icon name="error" size={18} aria-hidden />
      {title}
    </p>
    {action}
  </div>
);

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
  orderItemId,
  onRoutingChange,
  disabled = false,
  plantId,
  quantity,
}: {
  bomId: string;
  routingId: string;
  options: Option[];
  locked: boolean;
  itemId?: number;
  /** ERP W/O 의 품목 — Routing 이 하나도 없을 때 등록 화면을 이 품목으로 연다. */
  orderItemId?: number;
  onRoutingChange: (value: string) => void;
  disabled?: boolean;
  /** 둘 다 주면 BOM 구성에 가용 수량·부족 판정을 보인다(omf-all-around#320). */
  plantId?: number | null;
  quantity?: number | null;
}) => {
  /* 적용한 개정이 없으면 기본 개정을 먼저 보인다. */
  const initial = routingId || (options.find((option) => option.isDefault)?.value ?? '');
  const [preview, setPreview] = useState(initial);
  useEffect(() => setPreview(initial), [initial]);
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
          <BomTable key={bomId} id={Number(bomId)} plantId={plantId} quantity={quantity} />
        ) : (
          <MissingNotice
            title="ERP에서 받은 기본 BOM이 없습니다"
            action={
              <Link className="action-link-button" to="/system/erp-data/boms">
                BOM 조회 열기
              </Link>
            }
          />
        )}
      </section>
      <section className="pane erp-wo-inline-revision" aria-label="Routing 상세 정보">
        <div className="section-heading-row">
          <h2 className="section-title">Routing</h2>
          {applied && (
            <span className="field-note">현재 적용: {readableRevision(applied.label)}</span>
          )}
        </div>
        {!locked && options.length > 0 && (
          /* Routing 개정은 선택 칸으로 고른다 — 처음 값은 기본 개정이다(사용자 지시 2026-11-27). */
          <div className="erp-wo-inline-routing-options">
            <Select
              aria-label="Routing 개정"
              value={preview}
              disabled={disabled}
              placeholder="Routing을 선택하세요"
              options={options.map((option) => ({
                value: option.value,
                label: `${readableRevision(option.label)}${option.isDefault ? ' · 기본' : ''}`,
              }))}
              onChange={setPreview}
            />
          </div>
        )}
        {candidate ? (
          <>
            <RoutingTable key={preview} id={Number(preview)} />
            {/*
             * 적용한 개정을 볼 때는 제목 옆 「현재 적용: …」이 이미 말하므로 비워 둔다 — 다른 개정을 보는 동안만
             * 알린다(관리웹 정리 시안 A). 알림 자리는 숨겨 남겨 두어 바뀔 때 읽히게 한다.
             */}
            {!locked && (
              <p
                className={preview === routingId ? 'visually-hidden' : 'field-note'}
                aria-live="polite"
              >
                {preview === routingId
                  ? null
                  : '확인 중인 작업 순서입니다. 적용하면 계획에 반영됩니다.'}
              </p>
            )}
            <div className="section-heading-row erp-wo-inline-routing-actions">
              {itemId != null && (
                <Link
                  className="action-link-button"
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
          <MissingNotice
            title={
              options.length === 0 ? '이 품목에 등록된 Routing이 없습니다' : 'Routing을 선택하세요'
            }
            action={
              options.length === 0 && (
                <Link
                  className="action-link-button"
                  to={
                    orderItemId == null
                      ? '/master-data/routing'
                      : `/master-data/routing?item=${String(orderItemId)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Routing 등록 화면 열기 ↗
                </Link>
              )
            }
          />
        )}
      </section>
    </AdjustableLayout>
  );
};
