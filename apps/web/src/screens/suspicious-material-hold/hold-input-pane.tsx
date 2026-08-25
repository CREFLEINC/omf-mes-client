import { AlertBanner, Radio, RadioGroup, Select, TextField } from '@crefle/web-ui';
import type { ApiClient, components } from '@omf-mes/api-client';
import { TextArea } from '@omf-mes/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { SelectedLotSnapshot } from './candidate-model';

type LotHoldCreate = components['schemas']['LotHoldCreate'];
type CodeValue = components['schemas']['CodeValue'];
export interface HoldDraft {
  mode: 'FULL' | 'PARTIAL';
  holdQty: string;
  reasonCode: string;
  releaseCondition: string;
  remarks: string;
}
export interface HoldInputLot extends SelectedLotSnapshot {
  locationLabel: string | null;
  uomLabel: string | null;
}
export interface SuspiciousMaterialHoldInputPaneProps {
  selection: HoldInputLot[];
  targetLotStatusCode: string | null;
  isLocked: boolean;
  onBodyChange: (body: LotHoldCreate | null) => void;
}
const EMPTY_DRAFT: HoldDraft = {
  mode: 'FULL',
  holdQty: '',
  reasonCode: '',
  releaseCondition: '',
  remarks: '',
};

export const buildSuspiciousMaterialHoldBody = (
  draft: HoldDraft,
  selected: SelectedLotSnapshot[],
  targetLotStatusCode: string | null,
): LotHoldCreate | null => {
  const reasonCode = draft.reasonCode.trim();
  const releaseCondition = draft.releaseCondition.trim();
  const target = targetLotStatusCode?.trim() ?? '';
  if (selected.length === 0 || reasonCode === '' || releaseCondition === '' || target === '')
    return null;
  if (
    selected.some(
      ({ lotId, versionNo }) =>
        !Number.isSafeInteger(lotId) ||
        lotId <= 0 ||
        !Number.isSafeInteger(versionNo) ||
        versionNo <= 0,
    )
  )
    return null;
  let partial: Pick<LotHoldCreate, 'holdQty' | 'uomId'> = {};
  if (draft.mode === 'PARTIAL') {
    const quantity = Number(draft.holdQty.trim());
    const uomId = selected[0]?.uomId;
    if (
      selected.length !== 1 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      uomId === undefined ||
      !Number.isSafeInteger(uomId) ||
      uomId <= 0
    )
      return null;
    partial = { holdQty: quantity, uomId };
  }
  const remarks = draft.remarks.trim();
  return {
    lots: selected.map(({ lotId, versionNo }) => ({ lotId, versionNo })),
    ...partial,
    reasonCode,
    releaseCondition,
    targetLotStatusCode: target,
    ...(remarks === '' ? {} : { remarks }),
  };
};

const fetchReasons = (client: ApiClient['client']) =>
  runRequest(() =>
    client.GET('/mdm/code-values', {
      params: { query: { codeGroupCode: 'LOT_HOLD_REASON', page: 1, size: 100 } },
    }),
  );

export const SuspiciousMaterialHoldInputPane = ({
  selection,
  targetLotStatusCode,
  isLocked,
  onBodyChange,
}: SuspiciousMaterialHoldInputPaneProps) => {
  const { client } = useApiClient();
  const reasonId = useId();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const owner = selection
    .map(({ lotId, versionNo }) => `${String(lotId)}:${String(versionNo)}`)
    .join('|');
  const reasons = useQuery({
    queryKey: ['suspicious-material-hold', 'reasons'],
    queryFn: () => fetchReasons(client),
  });
  const activeReasons = useMemo(
    () => reasons.data?.items.filter((value: CodeValue) => value.isActive) ?? [],
    [reasons.data],
  );
  const reasonUnavailable =
    reasons.isPending ||
    reasons.isError ||
    reasons.data === undefined ||
    reasons.data.page.total > reasons.data.items.length ||
    activeReasons.length === 0;
  const labelsUnavailable = selection.some(
    ({ locationLabel, uomLabel }) => locationLabel === null || uomLabel === null,
  );
  const allowedReason = activeReasons.some(({ code }) => code === draft.reasonCode);
  const body =
    reasonUnavailable || labelsUnavailable || !allowedReason
      ? null
      : buildSuspiciousMaterialHoldBody(draft, selection, targetLotStatusCode);

  useEffect(() => {
    setDraft(EMPTY_DRAFT);
    onBodyChange(null);
  }, [onBodyChange, owner]);
  useEffect(() => onBodyChange(body), [body, onBodyChange]);
  if (selection.length === 0) return null;
  const update = <K extends keyof HoldDraft>(key: K, value: HoldDraft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="pane" aria-label="보류 등록 입력">
      <RadioGroup
        name="suspicious-material-hold-mode"
        orientation="horizontal"
        value={selection.length > 1 ? 'FULL' : draft.mode}
        disabled={isLocked}
        aria-label="보류 범위"
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            mode: value === 'PARTIAL' ? 'PARTIAL' : 'FULL',
            holdQty: '',
          }))
        }
      >
        <Radio value="FULL">전량 보류</Radio>
        {selection.length === 1 && <Radio value="PARTIAL">일부 보류</Radio>}
      </RadioGroup>
      <p>전량 보류는 현재 수량을 숫자로 복사하지 않고 서버가 적용 시점의 전량을 처리합니다.</p>
      {draft.mode === 'PARTIAL' && selection.length === 1 && (
        <TextField
          label="보류 수량"
          inputMode="decimal"
          value={draft.holdQty}
          disabled={isLocked}
          onChange={(event) => update('holdQty', event.target.value)}
        />
      )}
      <div>
        <label htmlFor={reasonId}>보류 사유</label>
        <Select
          id={reasonId}
          value={draft.reasonCode || null}
          options={activeReasons.map(({ code, codeName }) => ({ value: code, label: codeName }))}
          placeholder="사유를 선택하세요"
          disabled={isLocked || reasonUnavailable}
          onChange={(value) => update('reasonCode', value)}
        />
      </div>
      <TextField
        label="해제 조건"
        value={draft.releaseCondition}
        disabled={isLocked}
        onChange={(event) => update('releaseCondition', event.target.value)}
      />
      <TextArea
        label="비고"
        rows={3}
        value={draft.remarks}
        disabled={isLocked}
        onChange={(event) => update('remarks', event.target.value)}
      />
      {reasonUnavailable && (
        <AlertBanner
          variant="warning"
          title="보류 사유 목록이 완결되지 않았습니다. 사유를 확인할 때까지 등록할 수 없습니다."
        />
      )}
      {(labelsUnavailable || (targetLotStatusCode?.trim() ?? '') === '') && (
        <AlertBanner
          variant="warning"
          title="위치·단위 또는 도착 상태를 확인할 때까지 등록할 수 없습니다."
        />
      )}
      <section aria-label="보류 영향 확인">
        <h3>보류 영향</h3>
        <p>{selection.length}개 LOT을 출고·출하·피킹할 수 없게 합니다.</p>
        {selection.map((lot) => (
          <p key={lot.lotId}>
            {lot.lotNo}: {lot.onHandQty === undefined ? '수량 미확인' : String(lot.onHandQty)}{' '}
            {lot.uomLabel ?? '단위 이름 미확인'} · {lot.locationLabel ?? '위치 이름 미확인'}
          </p>
        ))}
        <p>
          해제하려면 W-03-02에서 별도 Release 전이가 필요하며 이미 출고된 수량은 회수되지 않습니다.
        </p>
      </section>
    </section>
  );
};
