import { AlertBanner, Button, Card, Chip, Select, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { Link } from 'react-router';

import type { BomRevisionFact, RoutingRevisionFact } from './reference-queries';

const t = messages.productionPlan.masterCheck;

interface ReferenceState<T> {
  items: readonly T[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface MasterCheckPaneProps {
  boms: ReferenceState<BomRevisionFact>;
  routings: ReferenceState<RoutingRevisionFact>;
  bomId: string;
  routingId: string;
  onBomChange: (value: string) => void;
  onRoutingChange: (value: string) => void;
}

export const automaticBomId = (items: readonly BomRevisionFact[]): number | null => {
  const defaults = items.filter((item) => item.isDefault);
  return defaults.length === 1 ? (defaults[0]?.bomId ?? null) : null;
};

export const automaticRoutingId = (items: readonly RoutingRevisionFact[]): number | null =>
  items.length === 1 ? (items[0]?.routingId ?? null) : null;

export const isMasterCheckReady = (
  boms: readonly BomRevisionFact[],
  routings: readonly RoutingRevisionFact[],
  bomId: string,
  routingId: string,
): boolean =>
  boms.some((item) => String(item.bomId) === bomId) &&
  routings.some((item) => String(item.routingId) === routingId);

const period = (from: string | null, to: string | null): string =>
  `${from ?? t.periodFrom} ~ ${to ?? t.periodTo}`;

export const bomRevisionLabel = (item: BomRevisionFact): string =>
  `${item.bomCode} · Rev ${String(item.bomVersion)} · ${item.statusCode}`;

export const routingRevisionLabel = (item: RoutingRevisionFact): string =>
  `${item.routingCode} · Rev ${String(item.routingVersion)} · ${item.statusCode}`;

export const MasterCheckPane = ({
  boms,
  routings,
  bomId,
  routingId,
  onBomChange,
  onRoutingChange,
}: MasterCheckPaneProps) => {
  const automaticBom = automaticBomId(boms.items);
  const automaticRouting = automaticRoutingId(routings.items);
  const isBomSelected = boms.items.some((item) => String(item.bomId) === bomId);
  const isRoutingSelected = routings.items.some((item) => String(item.routingId) === routingId);

  useEffect(() => {
    if (!boms.isLoading && !boms.isError && bomId !== '' && !isBomSelected) {
      onBomChange('');
      return;
    }
    if (bomId === '' && automaticBom !== null) onBomChange(String(automaticBom));
  }, [automaticBom, bomId, boms.isError, boms.isLoading, isBomSelected, onBomChange]);
  useEffect(() => {
    if (!routings.isLoading && !routings.isError && routingId !== '' && !isRoutingSelected) {
      onRoutingChange('');
      return;
    }
    if (routingId === '' && automaticRouting !== null) onRoutingChange(String(automaticRouting));
  }, [
    automaticRouting,
    isRoutingSelected,
    onRoutingChange,
    routingId,
    routings.isError,
    routings.isLoading,
  ]);

  const referenceBody = <T,>(
    kind: 'BOM' | 'Routing',
    reference: ReferenceState<T>,
    options: { value: string; label: string }[],
    value: string,
    onChange: (next: string) => void,
  ) => {
    if (reference.isLoading) return <SkeletonText lines={2} />;
    if (reference.isError)
      return (
        <AlertBanner
          variant="error"
          title={t.loadFailed(kind)}
          action={
            <Button size="sm" variant="outlined" onClick={reference.refetch}>
              {t.retry(kind)}
            </Button>
          }
        />
      );
    if (options.length === 0)
      return kind === 'BOM' ? (
        <AlertBanner variant="error" title={t.bomMissing} />
      ) : (
        <AlertBanner variant="error" title={t.routingMissing}>
          <Link to="/master-data/routing">{t.openRouting}</Link>
        </AlertBanner>
      );

    return (
      <>
        <Select
          aria-label={t.revisionLabel(kind)}
          value={value}
          options={options}
          placeholder={t.revisionPlaceholder}
          onChange={onChange}
        />
        {kind === 'BOM' && automaticBom !== null && <p>{t.bomAutoSelected}</p>}
        {kind === 'BOM' && automaticBom === null && options.length > 0 && (
          <AlertBanner variant="warning">{t.bomAmbiguous}</AlertBanner>
        )}
        {kind === 'Routing' && options.length > 1 && (
          <AlertBanner variant="warning">{t.routingNoDefault}</AlertBanner>
        )}
      </>
    );
  };

  return (
    <section className="pane production-plan-section" aria-label={t.pane}>
      <div className="production-plan-section-heading">
        <span className="production-plan-step" aria-hidden="true">
          1
        </span>
        <h2>{t.heading}</h2>
      </div>
      <div className="production-plan-master-grid">
        <Card bordered className="production-plan-master-card">
          <Card.Header className="production-plan-master-card-header">
            <h3>{t.bomCard}</h3>
            {isBomSelected && <Chip status="success">{t.selected}</Chip>}
          </Card.Header>
          <Card.Body className="production-plan-master-card-body">
            {referenceBody(
              'BOM',
              boms,
              boms.items.map((item) => ({
                value: String(item.bomId),
                label: bomRevisionLabel(item),
              })),
              bomId,
              onBomChange,
            )}
            {boms.items
              .filter((item) => String(item.bomId) === bomId)
              .map((item) => (
                <p key={item.bomId}>
                  {t.effectivePeriod(period(item.effectiveFrom, item.effectiveTo))}
                </p>
              ))}
          </Card.Body>
        </Card>
        <Card bordered className="production-plan-master-card">
          <Card.Header className="production-plan-master-card-header">
            <h3>{t.routingCard}</h3>
            {isRoutingSelected && <Chip status="success">{t.selected}</Chip>}
          </Card.Header>
          <Card.Body className="production-plan-master-card-body">
            {referenceBody(
              'Routing',
              routings,
              routings.items.map((item) => ({
                value: String(item.routingId),
                label: routingRevisionLabel(item),
              })),
              routingId,
              onRoutingChange,
            )}
            {routings.items
              .filter((item) => String(item.routingId) === routingId)
              .map((item) => (
                <p key={item.routingId}>
                  {t.effectivePeriod(period(item.effectiveFrom, item.effectiveTo))}
                </p>
              ))}
          </Card.Body>
        </Card>
      </div>
    </section>
  );
};
