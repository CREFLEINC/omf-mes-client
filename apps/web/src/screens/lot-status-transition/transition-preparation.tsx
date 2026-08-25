import { AlertBanner, Button, Radio, RadioGroup, Select, SkeletonText } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { useLotStatusOptions } from '../lot-status-history/options';
import type { LotStatusCandidate } from './candidate-screen';
import { CreateHoldExecution } from './create-hold-execution';
import { ReleaseHoldExecution } from './release-hold-execution';

type Transition = components['schemas']['LotStatusTransition'];
type LotHold = components['schemas']['LotHold'];

export const lotHoldDetailPath = (lotHoldId: number): `/quality/lot-holds/${number}` =>
  `/quality/lot-holds/${lotHoldId}`;
const transitionKey = (value: Transition): string =>
  `${value.actionCode}:${value.targetLotStatusCode}`;

const useTransitions = (lotId: number, enabled: boolean) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'transitions', lotId],
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-status-transitions', { params: { query: { lotId } } }),
      ),
  });
};

const useOpenHolds = (lotId: number, enabled: boolean, page: number) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'open-holds', lotId, page],
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-holds', {
          params: { query: { lotId, open: true, ...(page > 1 ? { page } : {}) } },
        }),
      ),
  });
};

const useHoldDetail = (lotHoldId: number | null, enabled: boolean) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'hold-detail', lotHoldId],
    enabled: enabled && lotHoldId !== null,
    queryFn: () => {
      if (lotHoldId === null) throw new Error('보류를 고르기 전에는 상세를 조회하지 않습니다.');
      return runRequest(() =>
        client.GET('/quality/lot-holds/{lotHoldId}', { params: { path: { lotHoldId } } }),
      );
    },
  });
};

interface SelectFieldProps {
  disabled: boolean;
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}

const SelectField = ({ disabled, label, options, value, onChange }: SelectFieldProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <Select
        id={id}
        disabled={disabled}
        placeholder="하나를 선택하세요"
        options={options}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

export interface LotStatusTransitionPreparationProps {
  lot: LotStatusCandidate;
  onConfirmationChange?: (pinned: boolean) => void;
}

export const LotStatusTransitionPreparation = ({
  lot,
  onConfirmationChange,
}: LotStatusTransitionPreparationProps) => {
  const { etags } = useApiClient();
  const [confirmationPinned, setConfirmationPinned] = useState(false);
  const changeConfirmation = useCallback(
    (pinned: boolean): void => {
      setConfirmationPinned(pinned);
      onConfirmationChange?.(pinned);
    },
    [onConfirmationChange],
  );
  const transitions = useTransitions(lot.lotId, !confirmationPinned);
  const statuses = useLotStatusOptions();
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);
  const [autoSelectOwner, setAutoSelectOwner] = useState<string | null>(null);
  const [holdPage, setHoldPage] = useState(1);
  const [selectedHoldId, setSelectedHoldId] = useState<number | null>(null);
  const allowed = transitions.data?.transitions.filter((item) => item.allowed) ?? [];
  const selectedTransition = allowed.find((item) => transitionKey(item) === selectedTransitionKey);
  const isCreate = selectedTransition?.actionCode === 'CREATE_HOLD';
  const isRelease = selectedTransition?.actionCode === 'RELEASE_HOLD';
  const holds = useOpenHolds(lot.lotId, isRelease && !confirmationPinned, holdPage);
  const holdsData =
    confirmationPinned || (!holds.isFetching && !holds.isError) ? holds.data : undefined;
  const automaticHoldId =
    holdsData?.page.total === 1 && holdsData.items.length === 1
      ? (holdsData.items[0]?.lotHoldId ?? null)
      : null;
  const selectedHold = holdsData?.items.find((item) => item.lotHoldId === selectedHoldId);

  useEffect(() => {
    if (confirmationPinned || !isRelease || holdsData === undefined) return;
    if (autoSelectOwner === selectedTransitionKey) {
      setAutoSelectOwner(null);
      setSelectedHoldId(automaticHoldId);
    } else if (selectedHoldId !== null && selectedHold === undefined) {
      setSelectedHoldId(null);
    }
  }, [
    autoSelectOwner,
    automaticHoldId,
    confirmationPinned,
    holdsData,
    isRelease,
    selectedHold,
    selectedHoldId,
    selectedTransitionKey,
  ]);

  const detail = useHoldDetail(
    isRelease ? (selectedHold?.lotHoldId ?? null) : null,
    !confirmationPinned,
  );
  const detailData =
    confirmationPinned || (!detail.isFetching && !detail.isError) ? detail.data : undefined;
  const token =
    selectedHold === undefined || detailData === undefined
      ? undefined
      : etags.ifMatch(lotHoldDetailPath(selectedHold.lotHoldId));
  const chooseTransition = (value: string): void => {
    if (confirmationPinned) return;
    const next = allowed.find((item) => transitionKey(item) === value);
    setSelectedTransitionKey(value);
    setAutoSelectOwner(next?.actionCode === 'RELEASE_HOLD' ? value : null);
    setHoldPage(1);
    setSelectedHoldId(null);
  };
  const clearExecutionOwner = (): void => {
    setSelectedTransitionKey(null);
    setAutoSelectOwner(null);
    setHoldPage(1);
    setSelectedHoldId(null);
  };
  const refreshPreparation = (): void => {
    void transitions.refetch();
    if (isRelease) {
      void holds.refetch();
      void detail.refetch();
    }
  };
  const reloadExecutionOwner = (): void => {
    refreshPreparation();
    clearExecutionOwner();
  };
  const changeHoldPage = (page: number): void => {
    if (confirmationPinned) return;
    setAutoSelectOwner(null);
    setHoldPage(page);
    setSelectedHoldId(null);
  };
  const targetLabel = (code: string): string =>
    statuses.data?.items.find((item) => item.code === code)?.label ?? code;
  const holdOptions =
    holdsData?.items.map((item: LotHold) => ({
      value: String(item.lotHoldId),
      label: `${String(item.lotHoldId)} · ${item.reasonCode} · ${item.heldAt}`,
    })) ?? [];
  const holdMeta = holdsData?.page;
  const holdTotalPages =
    holdMeta === undefined || !Number.isFinite(holdMeta.size) || holdMeta.size < 1
      ? 1
      : Math.max(1, Math.ceil(holdMeta.total / holdMeta.size));

  if (transitions.isFetching && !confirmationPinned)
    return (
      <div role="status" aria-label="전이 선택지를 불러오는 중">
        <SkeletonText lines={1} />
      </div>
    );
  if (transitions.isError && !confirmationPinned)
    return (
      <AlertBanner
        variant="error"
        title="전이 선택지를 불러오지 못했습니다."
        action={<Button onClick={() => void transitions.refetch()}>다시 시도</Button>}
      />
    );
  if (allowed.length === 0)
    return (
      <AlertBanner variant="info">
        {transitions.data?.note ?? '현재 LOT은 전이할 수 없습니다.'}
      </AlertBanner>
    );

  let preparation: string | null = null;
  if (isCreate) {
    preparation = Number.isSafeInteger(lot.versionNo)
      ? '보류 등록 준비가 완료되었습니다.'
      : 'LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.';
  } else if (isRelease) {
    preparation = holds.isFetching
      ? '열린 보류를 불러오는 중입니다.'
      : holds.isError
        ? '열린 보류를 불러오지 못했습니다.'
        : holdsData?.items.length === 0
          ? '해제할 열린 보류가 없습니다.'
          : detail.isFetching
            ? '보류 상세를 불러오는 중입니다.'
            : detail.isError
              ? '보류 상세를 불러오지 못했습니다.'
              : selectedHold !== undefined && token !== undefined
                ? '보류 해제 준비가 완료되었습니다.'
                : selectedHold === undefined
                  ? null
                  : 'LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.';
  }

  return (
    <section className="pane" aria-label="상태 전이 준비">
      <RadioGroup
        name={`lot-status-transition-${String(lot.lotId)}`}
        orientation="horizontal"
        value={selectedTransitionKey ?? ''}
        disabled={confirmationPinned}
        aria-label="전이"
        onChange={chooseTransition}
      >
        {allowed.map((item) => (
          <Radio key={transitionKey(item)} value={transitionKey(item)}>
            {targetLabel(item.targetLotStatusCode)}
          </Radio>
        ))}
      </RadioGroup>
      {isRelease && holdsData !== undefined && holdsData.page.total > 1 && (
        <>
          <SelectField
            disabled={confirmationPinned}
            label="해제할 보류"
            options={holdOptions}
            value={selectedHold === undefined ? null : String(selectedHold.lotHoldId)}
            onChange={(value) => setSelectedHoldId(Number(value))}
          />
          {holdTotalPages > 1 && (
            <nav className="form-actions" aria-label="열린 보류 쪽 이동">
              <Button
                variant="outlined"
                disabled={confirmationPinned || holdPage <= 1}
                onClick={() => changeHoldPage(holdPage - 1)}
              >
                이전 쪽
              </Button>
              <Button
                variant="outlined"
                disabled={confirmationPinned || holdPage >= holdTotalPages}
                onClick={() => changeHoldPage(holdPage + 1)}
              >
                다음 쪽
              </Button>
            </nav>
          )}
        </>
      )}
      {preparation !== null && <p role="status">{preparation}</p>}
      {isCreate &&
        selectedTransition !== undefined &&
        lot.versionNo !== undefined &&
        Number.isSafeInteger(lot.versionNo) && (
          <CreateHoldExecution
            key={`${String(lot.lotId)}:${String(lot.versionNo)}:${selectedTransitionKey ?? ''}`}
            lotId={lot.lotId}
            lotNo={lot.lotNo}
            versionNo={lot.versionNo}
            maxHoldQty={lot.availableQty}
            warehouseId={lot.warehouseId}
            locationId={lot.locationId}
            targetLotStatusCode={selectedTransition.targetLotStatusCode}
            onCreated={() => {
              refreshPreparation();
              setSelectedTransitionKey(null);
            }}
            onConfirmationChange={changeConfirmation}
            onStale={reloadExecutionOwner}
          />
        )}
      {isRelease &&
        selectedTransition !== undefined &&
        selectedHold !== undefined &&
        detailData !== undefined &&
        token !== undefined && (
          <ReleaseHoldExecution
            key={`${String(selectedHold.lotHoldId)}:${token}:${selectedTransitionKey ?? ''}`}
            etagPath={lotHoldDetailPath(selectedHold.lotHoldId)}
            lotHoldId={selectedHold.lotHoldId}
            lotNo={lot.lotNo}
            maxReleaseQty={detailData.holdQty ?? lot.heldQty}
            warehouseId={lot.warehouseId}
            locationId={lot.locationId}
            targetLotStatusCode={selectedTransition.targetLotStatusCode}
            onReleased={() => {
              refreshPreparation();
              setSelectedHoldId(null);
            }}
            onConfirmationChange={changeConfirmation}
            onStale={reloadExecutionOwner}
          />
        )}
    </section>
  );
};
