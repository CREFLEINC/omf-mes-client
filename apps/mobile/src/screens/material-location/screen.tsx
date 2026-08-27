import { AlertBanner, Button, Card, EmptyState, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useScanField } from '../../patterns/use-scan-field';
import { useReferenceNames, type ReferenceNames, type ReferenceState } from './lookups';
import { formatMaterialLotNo } from './lot-number';
import {
  useLotBalances,
  useLotHolds,
  useScannedLot,
  type InventoryBalance,
  type LotHold,
} from './queries';
import { byOnHandDesc } from './sort';
import './screen.css';

const t = messages.materialLocation;
const reference = messages.common.reference;

const referenceLabel = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'empty':
      return reference.empty;
    case 'unknown':
      return reference.unknown;
    case 'loading':
      return reference.loading;
    case 'failed':
      return reference.failed;
  }
};

const Quantity = ({
  label,
  value,
  uom,
  suffix,
}: {
  label: string;
  value: number;
  uom: string;
  suffix?: string;
}) => (
  <>
    <dt>{label}</dt>
    <dd className={value < 0 ? 'material-location__negative' : undefined}>
      {`${String(value)} ${uom}`}
      {suffix === undefined ? null : ` ${suffix}`}
    </dd>
  </>
);

const LocationCard = ({ balance, names }: { balance: InventoryBalance; names: ReferenceNames }) => {
  const uom = referenceLabel(names.uom(balance.uomId));
  const depleted = balance.onHandQty === 0 ? t.location.depleted : undefined;

  return (
    <Card bordered>
      <Card.Header>
        <p>{referenceLabel(names.warehouse(balance.warehouseId))}</p>
        <p>{referenceLabel(names.location(balance.locationId))}</p>
        {balance.lotId === null || balance.lotId === undefined ? <p>{t.lot.noLot}</p> : null}
      </Card.Header>
      <Card.Body>
        <dl className="material-location__quantities">
          <Quantity
            label={t.quantity.onHand}
            value={balance.onHandQty}
            uom={uom}
            suffix={depleted}
          />
          <Quantity label={t.quantity.available} value={balance.availableQty} uom={uom} />
          <Quantity label={t.quantity.reserved} value={balance.reservedQty} uom={uom} />
        </dl>
        {balance.onHandQty < 0 ? (
          <p className="material-location__negative">{t.quantity.negativeNotice}</p>
        ) : null}
      </Card.Body>
    </Card>
  );
};

const HoldBanner = ({ holds, names }: { holds: LotHold[]; names: ReferenceNames }) => (
  <AlertBanner variant="warning" title={t.hold.title}>
    {holds.map((hold) => (
      <p key={hold.lotHoldId}>
        {hold.holdQty === null || hold.holdQty === undefined
          ? t.hold.wholeLot
          : t.hold.quantity(`${String(hold.holdQty)} ${referenceLabel(names.uom(hold.uomId))}`)}
        {hold.releaseCondition === null || hold.releaseCondition === undefined
          ? null
          : ` · ${t.hold.releaseCondition(hold.releaseCondition)}`}
      </p>
    ))}
  </AlertBanner>
);

export const MaterialLocationScreen = () => {
  const [code, setCode] = useState<string | null>(null);
  const scanField = useScanField({ onScan: setCode });

  const lot = useScannedLot(code);
  const lotId = lot.data?.lotId ?? null;
  const balances = useLotBalances(lotId);
  const holds = useLotHolds(lotId);
  const names = useReferenceNames(balances.data ?? []);

  const failed = lot.isError || balances.isError || holds.isError;
  const pending =
    code !== null && !failed && (lot.isPending || (lotId !== null && balances.isPending));

  const retry = () => {
    if (lot.isError) {
      void lot.refetch();
      return;
    }
    void balances.refetch();
    void holds.refetch();
  };

  const restart = () => {
    setCode(null);
    scanField.focus();
  };

  return (
    <div className="material-location">
      <TextField
        ref={scanField.ref}
        label={t.scan.label}
        placeholder={t.scan.placeholder}
        size="xl"
        fullWidth
      />
      <Button variant="outlined" size="lg" onClick={scanField.focus}>
        {t.scan.manualEntry}
      </Button>

      {failed ? (
        <AlertBanner
          variant="error"
          title={t.loadFailed.title}
          action={
            <Button variant="text" onClick={retry}>
              {t.loadFailed.retry}
            </Button>
          }
        />
      ) : null}

      {pending ? <p role="status">{t.loading}</p> : null}

      {!pending && !failed && lot.data === null ? (
        <EmptyState live title={t.notFound.title} description={t.notFound.description} />
      ) : null}

      {lot.data !== null && lot.data !== undefined ? (
        <>
          <p className="material-location__lot-no">{formatMaterialLotNo(lot.data.lotNo)}</p>
          {holds.data !== undefined && holds.data.length > 0 ? (
            <HoldBanner holds={holds.data} names={names} />
          ) : null}
          {balances.data !== undefined && balances.data.length > 1 ? (
            <p>{t.location.countSuffix(balances.data.length)}</p>
          ) : null}
          {byOnHandDesc(balances.data ?? []).map((balance) => (
            <LocationCard
              key={`${String(balance.warehouseId)}-${String(balance.locationId)}`}
              balance={balance}
              names={names}
            />
          ))}
          <Button variant="filled" size="xl" onClick={restart}>
            {t.nextScan}
          </Button>
        </>
      ) : null}
    </div>
  );
};
