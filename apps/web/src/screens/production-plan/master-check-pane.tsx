import { AlertBanner, Button, Card, Chip, Select, SkeletonText } from '@crefle/web-ui';
import { useEffect } from 'react';
import { Link } from 'react-router';

import type { BomRevisionFact, RoutingRevisionFact } from './reference-queries';

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
  if (defaults.length === 1) return defaults[0]?.bomId ?? null;
  return defaults.length === 0 && items.length === 1 ? (items[0]?.bomId ?? null) : null;
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
  `${from ?? '시작일 미확인'} ~ ${to ?? '종료일 없음'}`;

const bomLabel = (item: BomRevisionFact): string =>
  `${item.bomCode} · Rev ${String(item.bomVersion)} · ${item.statusCode}`;

const routingLabel = (item: RoutingRevisionFact): string =>
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
          title={`${kind} 개정을 불러오지 못했습니다.`}
          action={
            <Button size="sm" variant="outlined" onClick={reference.refetch}>
              {kind} 다시 시도
            </Button>
          }
        />
      );
    if (options.length === 0)
      return kind === 'BOM' ? (
        <AlertBanner variant="error" title="BOM이 없어 전개할 수 없습니다." />
      ) : (
        <AlertBanner variant="error" title="Routing이 없어 전개할 수 없습니다.">
          <Link to="/master-data/routing">Routing 등록으로 이동</Link>
        </AlertBanner>
      );

    return (
      <>
        <Select
          aria-label={`${kind} Rev`}
          value={value}
          options={options}
          placeholder="사용할 개정을 선택하세요"
          onChange={onChange}
        />
        {kind === 'BOM' && automaticBom !== null && <p>기본 BOM Rev를 자동으로 선택했습니다.</p>}
        {kind === 'BOM' && automaticBom === null && options.length > 1 && (
          <AlertBanner variant="warning">기본 BOM Rev를 하나로 판단할 수 없습니다.</AlertBanner>
        )}
        {kind === 'Routing' && options.length > 1 && (
          <AlertBanner variant="warning">
            Routing 기본 Rev 플래그가 없습니다. 사용할 개정을 직접 선택하세요.
          </AlertBanner>
        )}
      </>
    );
  };

  return (
    <section className="pane" aria-label="마스터 점검">
      <h2>① 마스터 점검</h2>
      <div className="two-pane">
        <Card bordered>
          <Card.Header>
            <h3>BOM (ERP 정본)</h3>
            {isBomSelected && <Chip status="success">선택됨</Chip>}
          </Card.Header>
          <Card.Body>
            {referenceBody(
              'BOM',
              boms,
              boms.items.map((item) => ({ value: String(item.bomId), label: bomLabel(item) })),
              bomId,
              onBomChange,
            )}
            {boms.items
              .filter((item) => String(item.bomId) === bomId)
              .map((item) => (
                <p key={item.bomId}>유효기간 {period(item.effectiveFrom, item.effectiveTo)}</p>
              ))}
          </Card.Body>
        </Card>
        <Card bordered>
          <Card.Header>
            <h3>Routing (MES 정본)</h3>
            {isRoutingSelected && <Chip status="success">선택됨</Chip>}
          </Card.Header>
          <Card.Body>
            {referenceBody(
              'Routing',
              routings,
              routings.items.map((item) => ({
                value: String(item.routingId),
                label: routingLabel(item),
              })),
              routingId,
              onRoutingChange,
            )}
            {routings.items
              .filter((item) => String(item.routingId) === routingId)
              .map((item) => (
                <p key={item.routingId}>유효기간 {period(item.effectiveFrom, item.effectiveTo)}</p>
              ))}
          </Card.Body>
        </Card>
      </div>
    </section>
  );
};
