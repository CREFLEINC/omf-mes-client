import { AlertBanner, Button, Chip, Select, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { BomRevisionFact, RoutingRevisionFact } from '../../production-plan/reference-queries';

const t = messages.erpWorkOrderFlow.process.master;

interface RevisionFieldProps<T> {
  label: string;
  items: readonly T[];
  value: string;
  idOf: (item: T) => number;
  labelOf: (item: T) => string;
  periodOf: (item: T) => string;
  isDefault: (item: T) => boolean;
  locked: boolean;
  onChange: (value: string) => void;
}

const RevisionField = <T,>({
  label,
  items,
  value,
  idOf,
  labelOf,
  periodOf,
  isDefault,
  locked,
  onChange,
}: RevisionFieldProps<T>) => {
  const id = useId();
  const selected = items.find((item) => String(idOf(item)) === value);
  return (
    <div className="field-cell erp-wo-master-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {locked && selected !== undefined ? (
        <p id={id} className="erp-wo-master-value">
          {labelOf(selected)}
        </p>
      ) : (
        <Select
          id={id}
          value={value === '' ? null : value}
          placeholder={t.placeholder}
          options={items.map((item) => ({ value: String(idOf(item)), label: labelOf(item) }))}
          onChange={onChange}
        />
      )}
      {selected !== undefined && (
        <span className="erp-wo-master-note">
          {periodOf(selected)}
          {isDefault(selected) && (
            <Chip variant="status" size="sm" status="info">
              {t.autoSelected}
            </Chip>
          )}
          {locked && <span>{t.fixedByPlan}</span>}
        </span>
      )}
    </div>
  );
};

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
  bomId: string;
  routingId: string;
  /** 확정된 계획이 있으면 그 계획의 개정을 읽기 전용으로 보인다. */
  locked: boolean;
  statusNameOf: (code: string) => string;
  onBomChange: (value: string) => void;
  onRoutingChange: (value: string) => void;
}

/** 마스터 점검 단계: 계획에 쓸 BOM과 Routing 개정. 없으면 「남은 일」이 담당과 할 일을 말한다(하단 바). */
export const MasterStep = ({
  boms,
  routings,
  bomId,
  routingId,
  locked,
  statusNameOf,
  onBomChange,
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

  return (
    <section className="pane erp-wo-step-pane" aria-label={t.heading}>
      <h2 className="section-title">{t.heading}</h2>
      <div className="erp-wo-master-grid">
        <RevisionField
          label={t.bom}
          items={boms.items}
          value={bomId}
          idOf={(item) => item.bomId}
          labelOf={(item) =>
            t.revision(item.bomCode, item.bomVersion, statusNameOf(item.statusCode))
          }
          periodOf={(item) => period(item.effectiveFrom, item.effectiveTo)}
          isDefault={(item) => item.isDefault}
          locked={locked}
          onChange={onBomChange}
        />
        <RevisionField
          label={t.routing}
          items={routings.items}
          value={routingId}
          idOf={(item) => item.routingId}
          labelOf={(item) =>
            t.revision(item.routingCode, item.routingVersion, statusNameOf(item.statusCode))
          }
          periodOf={(item) => period(item.effectiveFrom, item.effectiveTo)}
          isDefault={(item) => item.isDefault}
          locked={locked}
          onChange={onRoutingChange}
        />
      </div>
    </section>
  );
};

/** 기본 BOM 개정이 하나면 그것(기존 W-02-02 규칙). */
export const automaticBomId = (items: readonly BomRevisionFact[]): number | null => {
  const defaults = items.filter((item) => item.isDefault);
  return defaults.length === 1 ? (defaults[0]?.bomId ?? null) : null;
};

/** 후보는 이미 쓸 수 있는 개정뿐이다. 하나면 그것, 여럿이면 기본 개정 하나(기존 W-02-02 규칙). */
export const automaticRoutingId = (items: readonly RoutingRevisionFact[]): number | null => {
  if (items.length === 1) return items[0]?.routingId ?? null;
  const defaults = items.filter((item) => item.isDefault);
  return defaults.length === 1 ? (defaults[0]?.routingId ?? null) : null;
};
