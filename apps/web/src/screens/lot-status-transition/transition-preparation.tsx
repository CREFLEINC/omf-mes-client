import { AlertBanner, Button, Select, SkeletonText } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LotStatusCandidate } from './candidate-screen';
import { CreateHoldExecution } from './create-hold-execution';
import { ReleaseHoldExecution } from './release-hold-execution';

type Transition = components['schemas']['LotStatusTransition'];
type LotHold = components['schemas']['LotHold'];

export const lotHoldDetailPath = (lotHoldId: number): `/quality/lot-holds/${number}` =>
  `/quality/lot-holds/${lotHoldId}`;
const transitionKey = (value: Transition): string =>
  `${value.actionCode}:${value.targetLotStatusCode}`;

const useTransitions = (lotId: number) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'transitions', lotId],
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-status-transitions', { params: { query: { lotId } } }),
      ),
  });
};

const useOpenHolds = (lotId: number, enabled: boolean) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'open-holds', lotId],
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-holds', { params: { query: { lotId, open: true } } }),
      ),
  });
};

const useHoldDetail = (lotHoldId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['lot-status-transition', 'hold-detail', lotHoldId],
    enabled: lotHoldId !== null,
    queryFn: () => {
      if (lotHoldId === null) throw new Error('보류를 고르기 전에는 상세를 조회하지 않습니다.');
      return runRequest(() =>
        client.GET('/quality/lot-holds/{lotHoldId}', { params: { path: { lotHoldId } } }),
      );
    },
  });
};

interface SelectFieldProps {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}

const SelectField = ({ label, options, value, onChange }: SelectFieldProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <Select
        id={id}
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
}

export const LotStatusTransitionPreparation = ({ lot }: LotStatusTransitionPreparationProps) => {
  const { etags } = useApiClient();
  const transitions = useTransitions(lot.lotId);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<string | null>(null);
  const [selectedHoldId, setSelectedHoldId] = useState<number | null>(null);
  const allowed = transitions.data?.transitions.filter((item) => item.allowed) ?? [];
  const selectedTransition = allowed.find((item) => transitionKey(item) === selectedTransitionKey);
  const isCreate = selectedTransition?.actionCode === 'CREATE_HOLD';
  const isRelease = selectedTransition?.actionCode === 'RELEASE_HOLD';
  const holds = useOpenHolds(lot.lotId, isRelease);
  const automaticHoldId =
    holds.data?.page.total === 1 && holds.data.items.length === 1
      ? (holds.data.items[0]?.lotHoldId ?? null)
      : null;

  useEffect(() => {
    if (isRelease && automaticHoldId !== null) setSelectedHoldId(automaticHoldId);
  }, [automaticHoldId, isRelease, selectedTransitionKey]);

  const detail = useHoldDetail(isRelease ? selectedHoldId : null);
  const token =
    selectedHoldId === null || detail.data === undefined
      ? undefined
      : etags.ifMatch(lotHoldDetailPath(selectedHoldId));
  const chooseTransition = (value: string): void => {
    setSelectedTransitionKey(value);
    setSelectedHoldId(null);
  };
  const transitionOptions = allowed.map((item) => ({
    value: transitionKey(item),
    label: item.targetLotStatusCode,
  }));
  const holdOptions =
    holds.data?.items.map((item: LotHold) => ({
      value: String(item.lotHoldId),
      label: item.reasonCode,
    })) ?? [];

  if (transitions.isFetching)
    return (
      <div role="status" aria-label="전이 선택지를 불러오는 중">
        <SkeletonText lines={1} />
      </div>
    );
  if (transitions.isError)
    return (
      <AlertBanner
        variant="error"
        title="전이 선택지를 불러오지 못했습니다."
        action={<Button onClick={() => void transitions.refetch()}>다시 시도</Button>}
      />
    );
  if (transitionOptions.length === 0)
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
        : holds.data?.items.length === 0
          ? '해제할 열린 보류가 없습니다.'
          : detail.isFetching
            ? '보류 상세를 불러오는 중입니다.'
            : detail.isError
              ? '보류 상세를 불러오지 못했습니다.'
              : selectedHoldId !== null && token !== undefined
                ? '보류 해제 준비가 완료되었습니다.'
                : selectedHoldId === null
                  ? null
                  : 'LOT 잠금 정보를 확인하지 못해 진행할 수 없습니다.';
  }

  return (
    <section className="pane" aria-label="상태 전이 준비">
      <SelectField
        label="전이"
        options={transitionOptions}
        value={selectedTransitionKey}
        onChange={chooseTransition}
      />
      {isRelease && holds.data !== undefined && holds.data.page.total > 1 && (
        <SelectField
          label="해제할 보류"
          options={holdOptions}
          value={selectedHoldId === null ? null : String(selectedHoldId)}
          onChange={(value) => setSelectedHoldId(Number(value))}
        />
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
            targetLotStatusCode={selectedTransition.targetLotStatusCode}
            onCreated={() => setSelectedTransitionKey(null)}
          />
        )}
      {isRelease &&
        selectedTransition !== undefined &&
        selectedHoldId !== null &&
        detail.data !== undefined &&
        token !== undefined &&
        !detail.isFetching && (
          <ReleaseHoldExecution
            key={`${String(selectedHoldId)}:${token}:${selectedTransitionKey ?? ''}`}
            etagPath={lotHoldDetailPath(selectedHoldId)}
            lotHoldId={selectedHoldId}
            lotNo={lot.lotNo}
            maxReleaseQty={detail.data.holdQty ?? lot.heldQty}
            targetLotStatusCode={selectedTransition.targetLotStatusCode}
            onReleased={() => setSelectedHoldId(null)}
          />
        )}
    </section>
  );
};
