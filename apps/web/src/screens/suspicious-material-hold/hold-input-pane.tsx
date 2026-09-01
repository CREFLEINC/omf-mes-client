import { AlertBanner, Radio, RadioGroup, Select, TextArea, TextField } from '@crefle/web-ui';
import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { SelectedLotSnapshot } from './candidate-model';

type LotHoldCreate = components['schemas']['LotHoldCreate'];
type CodeValue = components['schemas']['CodeValue'];
const t = messages.suspiciousMaterialHold.input;
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
    () =>
      reasons.data?.items
        .filter(
          (value: CodeValue) =>
            value.isActive && value.code.trim() !== '' && value.codeName.trim() !== '',
        )
        .map((value) => ({ ...value, code: value.code.trim(), codeName: value.codeName.trim() })) ??
      [],
    [reasons.data],
  );
  const reasonUnavailable =
    reasons.isPending ||
    reasons.isFetching ||
    reasons.isError ||
    reasons.data === undefined ||
    reasons.data.page.total > reasons.data.items.length ||
    activeReasons.length === 0;
  const labelsUnavailable = selection.some(
    ({ locationLabel, uomLabel }) => locationLabel === null || uomLabel === null,
  );
  const allowedReason = activeReasons.some(({ code }) => code === draft.reasonCode);
  const body = useMemo(
    () =>
      reasonUnavailable || labelsUnavailable || !allowedReason
        ? null
        : buildSuspiciousMaterialHoldBody(draft, selection, targetLotStatusCode),
    [allowedReason, draft, labelsUnavailable, reasonUnavailable, selection, targetLotStatusCode],
  );

  useEffect(() => {
    setDraft(EMPTY_DRAFT);
    onBodyChange(null);
  }, [onBodyChange, owner]);
  useEffect(() => onBodyChange(body), [body, onBodyChange]);
  if (selection.length === 0) return null;
  const update = <K extends keyof HoldDraft>(key: K, value: HoldDraft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <section className="pane" aria-label={t.pane}>
      <RadioGroup
        name="suspicious-material-hold-mode"
        orientation="horizontal"
        value={selection.length > 1 ? 'FULL' : draft.mode}
        disabled={isLocked}
        aria-label={t.range}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            mode: value === 'PARTIAL' ? 'PARTIAL' : 'FULL',
            holdQty: '',
          }))
        }
      >
        <Radio value="FULL">{t.full}</Radio>
        {selection.length === 1 && <Radio value="PARTIAL">{t.partial}</Radio>}
      </RadioGroup>
      <p>{t.fullDescription}</p>
      {draft.mode === 'PARTIAL' && selection.length === 1 && (
        <TextField
          label={t.quantity}
          inputMode="decimal"
          value={draft.holdQty}
          disabled={isLocked}
          onChange={(event) => update('holdQty', event.target.value)}
        />
      )}
      <div>
        <label htmlFor={reasonId}>{t.reason}</label>
        <Select
          id={reasonId}
          value={draft.reasonCode || null}
          options={activeReasons.map(({ code, codeName }) => ({ value: code, label: codeName }))}
          placeholder={t.reasonPlaceholder}
          disabled={isLocked || reasonUnavailable}
          onChange={(value) => update('reasonCode', value)}
        />
      </div>
      <TextField
        label={t.releaseCondition}
        value={draft.releaseCondition}
        disabled={isLocked}
        onChange={(event) => update('releaseCondition', event.target.value)}
      />
      <TextArea
        label={t.remarks}
        rows={3}
        value={draft.remarks}
        disabled={isLocked}
        onChange={(event) => update('remarks', event.target.value)}
      />
      {reasonUnavailable && <AlertBanner variant="warning" title={t.reasonUnavailable} />}
      {(labelsUnavailable || (targetLotStatusCode?.trim() ?? '') === '') && (
        <AlertBanner variant="warning" title={t.factsUnavailable} />
      )}
      <section aria-label={t.impact}>
        <h3>{t.impact}</h3>
        <p>{t.impactCount(selection.length)}</p>
        {selection.map((lot) => (
          <p key={lot.lotId}>
            {lot.lotNo}: {lot.onHandQty === undefined ? t.quantityUnknown : String(lot.onHandQty)}{' '}
            {lot.uomLabel ?? t.uomUnknown} · {lot.locationLabel ?? t.locationUnknown}
          </p>
        ))}
        <p>{t.recovery}</p>
      </section>
    </section>
  );
};
