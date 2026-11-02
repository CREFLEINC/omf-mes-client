import { Icon, Radio, RadioGroup, TextField } from '@crefle/web-ui';
import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
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
        .map((value) => ({
          ...value,
          code: value.code.trim(),
          /* 표시명은 고른 언어의 다국어 컬럼이 먼저, 기본 이름이 fallback(G-33). */
          label: masterName(value, value.codeName.trim()),
        })) ?? [],
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

  /*
   * 「의심자재 보류 등록」 카드의 첫 구획 — 보류 범위 · 사유 · 해제 조건 · 비고, 그 아래 보류 영향(사용자 시안 2026-11-02).
   * 카드 자체는 screen.tsx 가 세운다.
   */
  return (
    <div className="suspicious-material-hold-section" role="group" aria-label={t.pane}>
      {/* 보류 범위 · 사유 · 해제 조건 · 비고를 한 줄에(사용자 2026-11-02) — 좁으면 다음 줄로 넘긴다. */}
      <div className="suspicious-material-hold-input-row">
        <div className="field-cell suspicious-material-hold-range">
          <span className="field-label">{t.range}</span>
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
        </div>
        {draft.mode === 'PARTIAL' && selection.length === 1 && (
          <TextField
            label={t.quantity}
            inputMode="decimal"
            value={draft.holdQty}
            disabled={isLocked}
            onChange={(event) => update('holdQty', event.target.value)}
          />
        )}
        <div className="field-cell">
          <label className="field-label" htmlFor={reasonId}>
            {t.reason}{' '}
            {/* 보류 사유 · 해제 조건은 등록을 막는 필수 칸이다 — 이름 옆 빨간 *(화면 규칙). */}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            id={reasonId}
            value={draft.reasonCode || null}
            options={activeReasons.map(({ code, label }) => ({ value: code, label }))}
            placeholder={t.reasonPlaceholder}
            disabled={isLocked || reasonUnavailable}
            onChange={(value) => update('reasonCode', value)}
          />
        </div>
        <TextField
          label={t.releaseCondition}
          required
          placeholder={t.releaseConditionPlaceholder}
          value={draft.releaseCondition}
          disabled={isLocked}
          onChange={(event) => update('releaseCondition', event.target.value)}
        />
        <TextField
          label={t.remarks}
          placeholder={t.remarksPlaceholder}
          value={draft.remarks}
          disabled={isLocked}
          onChange={(event) => update('remarks', event.target.value)}
        />
      </div>
      {/* 등록을 막는 까닭 — 검사 조회·판정 화면의 안내 줄 모양(정보 아이콘 + 파란 바탕, 글 폭만큼). */}
      {reasonUnavailable && (
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.reasonUnavailable}
        </p>
      )}
      {(labelsUnavailable || (targetLotStatusCode?.trim() ?? '') === '') && (
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.factsUnavailable}
        </p>
      )}
      {/* 보류 시 제한 사항 — LOT 마다 번호, 못 받은 값은 「수량 · 위치 · 단위 미확인」 한 줄로, 붉은 제한 안내(사용자 시안 2026-11-02). */}
      <section className="suspicious-material-hold-impact" aria-label={t.impact}>
        <div className="suspicious-material-hold-section-head">
          <h3 className="suspicious-material-hold-subtitle">{t.impact}</h3>
          <span className="suspicious-material-hold-count">{t.impactTarget(selection.length)}</span>
        </div>
        <ul className="suspicious-material-hold-impact-list">
          {selection.map((lot) => {
            const facts = [
              [t.quantityName, lot.onHandQty === undefined ? null : String(lot.onHandQty)],
              [t.locationName, lot.locationLabel],
              [t.uomName, lot.uomLabel],
            ] as const;
            const known = facts.flatMap(([, value]) => (value === null ? [] : [value]));
            const unknown = facts.flatMap(([name, value]) => (value === null ? [name] : []));
            return (
              <li key={lot.lotId}>
                <strong>{lot.lotNo}</strong>
                {known.length > 0 && (
                  <span className="suspicious-material-hold-impact-facts">{known.join(' · ')}</span>
                )}
                {unknown.length > 0 && (
                  <span className="suspicious-material-hold-impact-facts">
                    <Icon name="error" size={16} aria-hidden />
                    {t.unknownFacts(unknown.join(' · '))}
                  </span>
                )}
                <span className="suspicious-material-hold-impact-restriction">
                  {t.impactRestriction}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="iqc-inspection-action-note">
          <Icon name="info" size={14} aria-hidden />
          {t.recovery}
        </p>
      </section>
    </div>
  );
};
