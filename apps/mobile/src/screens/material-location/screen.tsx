import { AlertBanner, Button, Card, EmptyState, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { playErrorTone } from '../../patterns/error-tone';
import { useScannedLot } from '../../patterns/lots';
import { toApiError } from '../../patterns/request';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useReferenceNames, type ReferenceNames, type ReferenceState } from './lookups';
import { MATERIAL_LOT_NO_LENGTH, formatMaterialLotNo, isMaterialLotNo } from '../../patterns/material-lot-no';
import {
  useLotBalances,
  useLotHolds,
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

/*
 * 잔액은 위치 하나에 여러 줄이 올 수 있다 — 계약이 소유 구분을 어떤 축에서도 합치지
 * 않고 품질·재고 상태도 유일축에 남는다. 위치까지만으로 키를 만들면 줄이 겹친다.
 * groupBy 로 묶인 줄에는 식별자가 없어 축을 이어 붙인다.
 */
const balanceKey = (balance: InventoryBalance): string =>
  [
    balance.warehouseId,
    balance.locationId,
    balance.lotId,
    balance.itemId,
    balance.qualityStatusCode,
    balance.inventoryStatusCode,
    balance.ownershipTypeCode,
    balance.ownerPartnerId,
  ]
    .map((axis) => String(axis))
    .join('/');

const LocationCard = ({ balance, names }: { balance: InventoryBalance; names: ReferenceNames }) => {
  const uom = referenceLabel(names.uom(balance.uomId));
  const depleted = balance.onHandQty === 0 ? t.location.depleted : undefined;

  return (
    <Card bordered aria-label={t.location.title}>
      <Card.Header>
        <p>{referenceLabel(names.warehouse(balance.warehouseId))}</p>
        <p>{referenceLabel(names.location(balance.locationId))}</p>
        {balance.lotId === null || balance.lotId === undefined ? <p>{t.lot.noLot}</p> : null}
      </Card.Header>
      <Card.Body className="card-body">
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
  const [rejectedLength, setRejectedLength] = useState<number | null>(null);
  const [manual, setManual] = useState('');

  const accept = (value: string) => {
    if (!isMaterialLotNo(value)) {
      // 앞 LOT 의 결과를 남기면 잘못 읽은 직후의 잔상이 새 결과로 읽힌다.
      setCode(null);
      setRejectedLength(value.length);
      playErrorTone();
      return;
    }

    setRejectedLength(null);
    setCode(value);
  };

  useScreenTitle(t.title);
  const scanField = useScanField({ onScan: accept });

  const lot = useScannedLot(code);
  const lotId = lot.data?.lotId ?? null;
  const balances = useLotBalances(lotId);
  const holds = useLotHolds(lotId);
  const names = useReferenceNames(balances.data ?? [], lot.data?.itemId);
  const queryClient = useQueryClient();

  const errors = [lot.error, balances.error, holds.error].filter((error) => error !== null);
  const failed = errors.length > 0;
  const unreachable = errors.some((error) => toApiError(error).kind === 'network');
  // 실패한 조회를 이유로 끄지 않는다. 나머지가 도착하는 동안 화면이 빈 채로 남는다.
  const pending = code !== null && (lot.isPending || (lotId !== null && balances.isPending));

  /*
   * 확인 못 한 보류를 조용히 지나가면 묶인 자재가 자유 재고로 읽힌다. 잔액보다 늦게
   * 오는 구간이 있어 도착 여부까지 세 갈래로 가른다.
   */
  const holdState = holds.isSuccess ? 'known' : holds.isError ? 'failed' : 'checking';

  // 이름 해석까지 함께 되살린다. 이 버튼이 화면의 유일한 복구 수단이다.
  const retry = () => {
    void queryClient.refetchQueries({ predicate: (query) => query.state.status === 'error' });
  };

  const restart = () => {
    setCode(null);
    setRejectedLength(null);
    setManual('');
    scanField.focus();
  };

  return (
    <div className="material-location">
      <div className="material-location__body">
        <TextField
          ref={scanField.ref}
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          size="xl"
          fullWidth
          error={
            rejectedLength === null
              ? undefined
              : t.invalidLength(rejectedLength, MATERIAL_LOT_NO_LENGTH)
          }
        />
        {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="material-location__manual">
          <TextField
            label={t.scan.manualEntry}
            size="xl"
            fullWidth
            value={manual}
            onChange={(event) => {
              setManual(event.target.value);
            }}
          />
          <Button
            variant="outlined"
            size="xl"
            onClick={() => {
              accept(manual.trim());
              /* 넣은 값을 남기면 다음 것을 적을 때 앞 값에 이어 붙는다. */
              setManual('');
            }}
          >
            {t.scan.manualSubmit}
          </Button>
        </div>

        {unreachable ? (
          <EmptyState
            live
            title={t.offline.title}
            description={t.offline.description}
            action={
              <Button variant="outlined" onClick={retry}>
                {t.offline.retry}
              </Button>
            }
          />
        ) : null}

        {failed && !unreachable ? (
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
            <p>{referenceLabel(names.item(lot.data.itemId))}</p>
            {holdState === 'checking' ? (
              <AlertBanner variant="info" title={t.hold.checking} />
            ) : null}
            {holdState === 'failed' ? (
              <AlertBanner variant="warning" title={t.hold.unconfirmed}>
                {t.hold.unconfirmedDescription}
              </AlertBanner>
            ) : null}
            {holds.data !== undefined && holds.data.length > 0 ? (
              <HoldBanner holds={holds.data} names={names} />
            ) : null}
            {balances.data !== undefined && balances.data.length > 1 ? (
              <p>{t.location.countSuffix(balances.data.length)}</p>
            ) : null}
            {balances.data !== undefined && balances.data.length === 0 ? (
              <EmptyState
                live
                title={t.location.emptyTitle}
                description={t.location.emptyDescription}
              />
            ) : null}
            {byOnHandDesc(balances.data ?? []).map((balance) => (
              <LocationCard key={balanceKey(balance)} balance={balance} names={names} />
            ))}
          </>
        ) : null}
      </div>

      {lot.data !== null && lot.data !== undefined ? (
        <div className="material-location__actions">
          <Button variant="filled" size="2xl" onClick={restart}>
            {t.nextScan}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
