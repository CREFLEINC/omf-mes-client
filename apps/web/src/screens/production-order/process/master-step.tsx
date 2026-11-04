import { RevisionDetailButton } from './revision-detail';
import { AlertBanner, Button, Chip, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { plantToday } from '../../../patterns/plant-time';
import { RoutingPicker } from './routing-picker';
import type { BomRevisionFact, RoutingRevisionFact } from '../../production-plan/reference-queries';

const t = messages.erpWorkOrderFlow.process.master;

export interface MasterStepProps {
  boms: {
    items: readonly BomRevisionFact[];
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  routings: {
    items: readonly RoutingRevisionFact[];
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
  orderNo?: string;
  itemLabel?: string;
  bomId: string;
  routingId: string;
  /** 확정된 계획이 있으면 그 계획의 개정을 읽기 전용으로 보인다. */
  locked: boolean;
  statusNameOf: (code: string) => string;
  onRoutingChange: (value: string) => void;
}

/** BOM·Routing 단계: 계획에 쓸 BOM과 Routing 개정. 없으면 「남은 일」이 담당과 할 일을 말한다(하단 바). */
export const MasterStep = ({
  boms,
  routings,
  orderNo,
  itemLabel,
  bomId,
  routingId,
  locked,
  statusNameOf,
  onRoutingChange,
}: MasterStepProps) => {
  if (boms.isLoading || routings.isLoading) return <SkeletonText lines={3} />;
  if (boms.isError || routings.isError) {
    return (
      <AlertBanner
        variant="error"
        title={messages.erpWorkOrderFlow.process.remaining.loadFailed}
        action={
          <Button
            size="sm"
            variant="outlined"
            onClick={() => {
              boms.refetch();
              routings.refetch();
            }}
          >
            {messages.common.retry}
          </Button>
        }
      />
    );
  }
  const period = (from: string | null, to: string | null) =>
    t.effective(from ?? '', to ?? t.periodOpen);

  const selectedBom = boms.items.find((item) => String(item.bomId) === bomId);
  const selectedRouting = routings.items.find((item) => String(item.routingId) === routingId);
  const checked =
    boms.items.some((item) => String(item.bomId) === bomId) &&
    routings.items.some((item) => String(item.routingId) === routingId);
  return (
    <section className="erp-wo-master-workspace" aria-label={t.heading}>
      <div className="section-heading-row">
        <h2 className="section-title">{t.heading}</h2>
        <Chip size="sm" variant="status" status={checked ? 'success' : 'warning'}>
          {checked ? t.checked : t.needsCheck}
        </Chip>
      </div>
      <div className="pane erp-wo-master-board">
        <table className="erp-wo-master-table" role="table">
          <thead>
            <tr>
              <th>{t.orderNo}</th>
              <th>{t.item}</th>
              <th>{t.bom}</th>
              <th>{t.routing}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label={t.orderNo}>
                <span className="mono-cell">{orderNo ?? '—'}</span>
              </td>
              <td data-label={t.item}>
                <span className="erp-wo-master-item">{itemLabel ?? '—'}</span>
              </td>
              <td data-label={t.bom} className="erp-wo-master-revision">
                <p className="erp-wo-master-value">
                  {selectedBom
                    ? t.revision(
                        selectedBom.bomCode,
                        selectedBom.bomVersion,
                        statusNameOf(selectedBom.statusCode),
                      )
                    : '사용 가능한 ERP 기본 BOM 없음'}
                </p>
                <span className="erp-wo-master-note">
                  {locked ? '확정 계획 적용 개정' : 'ERP 기본 개정 자동 적용'}
                </span>
                <RevisionDetailButton kind="BOM" value={bomId} />
              </td>
              <td data-label={t.routing} className="erp-wo-master-revision">
                <p className="erp-wo-master-value">
                  {selectedRouting
                    ? t.revision(
                        selectedRouting.routingCode,
                        selectedRouting.routingVersion,
                        statusNameOf(selectedRouting.statusCode),
                      )
                    : 'Routing 미지정'}
                </p>
                {!locked && (
                  <RoutingPicker
                    value={routingId}
                    options={routings.items.map((item) => ({
                      value: String(item.routingId),
                      label: t.revision(
                        item.routingCode,
                        item.routingVersion,
                        statusNameOf(item.statusCode),
                      ),
                      period: period(item.effectiveFrom, item.effectiveTo),
                      isDefault: item.isDefault,
                    }))}
                    onChange={onRoutingChange}
                  />
                )}
                <RevisionDetailButton
                  kind="Routing"
                  itemId={selectedRouting?.itemId}
                  value={routingId}
                  label={
                    selectedRouting
                      ? t.revision(
                          selectedRouting.routingCode,
                          selectedRouting.routingVersion,
                          statusNameOf(selectedRouting.statusCode),
                        )
                      : undefined
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {locked && <p className="field-note">{t.fixedByPlan}</p>}
    </section>
  );
};

/** 기본 BOM 개정이 하나면 그것(기존 W-02-02 규칙). */
export const automaticBomId = (items: readonly BomRevisionFact[]): number | null => {
  const today = plantToday();
  const defaults = items.filter(
    (item) =>
      item.isDefault &&
      item.statusCode === 'CONFIRMED' &&
      item.effectiveFrom <= today &&
      (item.effectiveTo == null || item.effectiveTo >= today),
  );
  return defaults.length === 1 ? (defaults[0]?.bomId ?? null) : null;
};

/** 후보는 이미 쓸 수 있는 개정뿐이다. 하나면 그것, 여럿이면 기본 개정 하나(기존 W-02-02 규칙). */
export const automaticRoutingId = (items: readonly RoutingRevisionFact[]): number | null => {
  if (items.length === 1) return items[0]?.routingId ?? null;
  const defaults = items.filter((item) => item.isDefault);
  return defaults.length === 1 ? (defaults[0]?.routingId ?? null) : null;
};
