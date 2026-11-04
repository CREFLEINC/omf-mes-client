import { Button, Chip, DatePicker, Dialog, Table, TextField, type Column } from '@crefle/web-ui';
import type { ConcessionAppliedForward, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import { toBusinessDate } from './decision-form';
import { dispositionKeys } from './queries';
import type { NonconformanceLotRow } from './types';

type ConcessionCreate = components['schemas']['ConcessionCreate'];

type Concession = components['schemas']['Concession'];

const t = messages.dispositionDecision.concession;
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PENDING = 'PENDING';
const STATUS_LABEL: Record<string, string> = t.status;

const concessionKey = (nonconformanceId: number) =>
  [...dispositionKeys.all, 'concessions', nonconformanceId] as const;

interface Draft {
  lotId: string;
  qty: string;
  validFrom: string;
  validTo: string;
  reason: string;
}

const emptyDraft = (lots: readonly NonconformanceLotRow[], today: string): Draft => ({
  lotId: lots.length === 1 ? String(lots[0]?.lotId) : '',
  qty: '',
  validFrom: today,
  validTo: '',
  reason: '',
});

const blockedOf = (draft: Draft): string | null => {
  if (draft.lotId === '') return t.blocked.lot;
  if (!DECIMAL.test(draft.qty.trim()) || Number(draft.qty) <= 0) return t.blocked.qty;
  if (!DATE.test(draft.validFrom)) return t.blocked.date;
  if (draft.validTo !== '' && (!DATE.test(draft.validTo) || draft.validTo < draft.validFrom)) {
    return t.blocked.date;
  }
  if (draft.reason.trim() === '') return t.blocked.reason;
  return null;
};

export interface ConcessionRequestDialogProps {
  nonconformanceId: number;
  lots: readonly NonconformanceLotRow[];
  /** 지금 날짜 — 시험이 고정할 수 있게 받는다. */
  today?: Date;
  /** 요청이 끝나면 `true` 로 닫는다 — 화면이 완료 알림을 띄운다. */
  onClose: (requested: boolean) => void;
}

export interface ConcessionHistoryProps {
  nonconformanceId: number;
  /** 처분 이력 탭은 보기만 — 결재 대기 특채의 「적용」 단추를 두지 않는다(#223). */
  readOnly?: boolean;
}

/**
 * W-03-10 의 「특채」 구획(omf-all-around#84 · 서버 선행 P-79).
 *
 * ⭐ 요청 → 결재(W-03-09) → 적용. 이 구획은 요청과 적용만 한다 — 승인은 결재 경로의 몫이다.
 * ⭐ 적용은 서버가 LOT 을 정상으로 열고 수입검사 대기 보류를 닫고 처분 판정(특채)을 남긴다 — 그래서
 *    성공하면 이 화면의 상세·판정을 함께 다시 부른다.
 * ⭐ 일부 특채면 적용이 승인 안 된 수량을 «불량으로 남은 LOT»(새 번호)·새 부적합으로 나눈다(#207) — 응답의 `splitResult` 로 알린다.
 * ⛔ 사용 가능 수량·허용 조건은 기록일 뿐 출고·투입에서 막지 않는다(#84 범위 · #207 결정).
 */
/** 이 부적합의 특채 목록 — 구획과 탭 이름의 건수가 같은 조회를 쓴다(#223). */
export const useConcessions = (nonconformanceId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: concessionKey(nonconformanceId ?? 0),
    enabled: nonconformanceId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/concessions', {
          params: { query: { nonconformanceId: nonconformanceId as number } },
        }),
      ).then((response) => response.items),
  });
};

/**
 * 특채 요청 팝업(사용자 지시 · #223) — 처분 대기에서 부적합을 고른 뒤 「특채 요청」 단추로 연다.
 * 요청 본문 · 쓰기는 종전 그대로다(요청 → W-03-09 결재 → 적용).
 */
export const ConcessionRequestDialog = ({
  nonconformanceId,
  lots,
  today,
  onClose,
}: ConcessionRequestDialogProps) => {
  const lotFieldId = useId();
  const fromFieldId = useId();
  const toFieldId = useId();
  const { client } = useApiClient();
  const todayText = toBusinessDate(today ?? new Date());
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(lots, todayText));

  const requestWrite = useMasterWrite<ConcessionCreate, Concession>({
    request: (body, headers) =>
      client.POST('/quality/concessions', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [concessionKey(nonconformanceId)],
    knownFields: ['lotId', 'approvedQty', 'uomId', 'validFrom', 'validTo', 'reason'],
    keyLifetime: 'until-applied',
    onSuccess: () => onClose(true),
  });

  const lot = lots.find((row) => String(row.lotId) === draft.lotId);
  const blocked = blockedOf(draft);
  const isSaving = requestWrite.isSaving;

  const submit = (): void => {
    if (blocked !== null || lot === undefined) return;
    requestWrite.write({
      nonconformanceId,
      lotId: lot.lotId,
      approvedQty: Number(draft.qty.trim()),
      uomId: lot.uomId,
      validFrom: draft.validFrom,
      ...(draft.validTo === '' ? {} : { validTo: draft.validTo }),
      reason: draft.reason.trim(),
    });
  };

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      size="md"
      title={t.requestHeading}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button
            variant="outlined"
            className="app-button-neutral"
            disabled={isSaving}
            onClick={() => onClose(false)}
          >
            {messages.common.cancel}
          </Button>
          <Button disabled={blocked !== null || isSaving} onClick={submit}>
            {isSaving ? t.requesting : t.request}
          </Button>
        </>
      }
    >
      <div className="disposition-concession-dialog">
        <p className="field-note">{t.requestNote}</p>
        <SaveErrorBanner error={requestWrite.error} />
        {lots.length > 1 && (
          <div className="field-cell">
            <label className="field-label" htmlFor={lotFieldId}>
              {t.lot}
            </label>
            <Select
              id={lotFieldId}
              options={lots.map((row) => ({ value: String(row.lotId), label: row.lotNoText }))}
              value={draft.lotId}
              disabled={isSaving}
              onChange={(value) => setDraft({ ...draft, lotId: value })}
            />
          </div>
        )}
        <div className="disposition-concession-fields">
          <TextField
            label={t.qty}
            placeholder={t.qtyPlaceholder}
            required
            fullWidth
            inputMode="decimal"
            value={draft.qty}
            disabled={isSaving}
            error={requestWrite.fieldErrors.approvedQty}
            onChange={(event) => setDraft({ ...draft, qty: event.target.value })}
          />
          <TextField
            label={t.reason}
            placeholder={t.reasonPlaceholder}
            required
            fullWidth
            value={draft.reason}
            disabled={isSaving}
            error={requestWrite.fieldErrors.reason}
            onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
          />
          <div className="field-cell">
            <label className="field-label" htmlFor={fromFieldId}>
              {t.validFrom}
            </label>
            <DatePicker
              id={fromFieldId}
              value={draft.validFrom === '' ? null : draft.validFrom}
              max={draft.validTo === '' ? undefined : draft.validTo}
              disabled={isSaving}
              onChange={(value) => setDraft({ ...draft, validFrom: value ?? '' })}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={toFieldId}>
              {t.validTo}
            </label>
            <DatePicker
              id={toFieldId}
              clearable
              placeholder={t.validToPlaceholder}
              value={draft.validTo === '' ? null : draft.validTo}
              min={draft.validFrom === '' ? undefined : draft.validFrom}
              disabled={isSaving}
              onChange={(value) => setDraft({ ...draft, validTo: value ?? '' })}
            />
            {requestWrite.fieldErrors.validTo !== undefined && (
              <span className="field-error">{requestWrite.fieldErrors.validTo}</span>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

/**
 * 특채 요청 이력 — 상세 아래 「특채 요청 이력」 탭의 내용(#223). 결재 대기 특채는 처분 대기 탭에서만 적용한다.
 */
export const ConcessionHistory = ({
  nonconformanceId,
  readOnly = false,
}: ConcessionHistoryProps) => {
  const { client } = useApiClient();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setNotice(null);
  }, [nonconformanceId]);

  const list = useConcessions(nonconformanceId);

  const applyWrite = useMasterWrite<{ concessionId: number }, ConcessionAppliedForward>({
    /* 일부 특채는 LOT 을 나누며 재고도 원장으로 나눈다 — 그때 쓰는 영업일을 늘 싣는다(#207 · C-8). */
    request: ({ concessionId }, headers) =>
      client.POST('/quality/concessions/{concessionId}:apply', {
        params: {
          path: { concessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { businessDate: toBusinessDate(new Date()) },
      }),
    etagPath: null,
    /* 적용은 LOT·부적합·판정을 함께 바꾼다 — 이 화면의 뿌리 키를 다시 부른다. */
    invalidateKeys: [dispositionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: (data) =>
      setNotice(
        data.statusCode === 'REJECTED'
          ? t.rejected
          : data.splitResult
            ? t.appliedSplit(data.splitResult.splitLotNo, data.splitResult.splitNonconformanceNo)
            : t.applied,
      ),
  });

  const statusChip = (row: Concession) => (
    <Chip
      variant="status"
      size="sm"
      status={
        row.statusCode === 'APPROVED' ? 'success' : row.statusCode === PENDING ? 'warning' : 'error'
      }
    >
      {STATUS_LABEL[row.statusCode] ?? row.statusCode}
    </Chip>
  );

  const columns: Column<Concession>[] = [
    {
      key: 'concessionNo',
      align: 'center',
      header: t.columns.concessionNo,
      render: (row) => row.concessionNo,
    },
    {
      key: 'lotNo',
      align: 'center',
      header: t.columns.lotNo,
      render: (row) => row.lotNo ?? String(row.lotId),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.columns.qty,
      render: (row) => String(row.approvedQty),
    },
    {
      key: 'period',
      align: 'center',
      header: t.columns.period,
      render: (row) => `${row.validFrom} ~ ${row.validTo ?? t.validToPlaceholder}`,
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      render: (row) =>
        row.statusCode === PENDING && !readOnly ? (
          <Button
            variant="outlined"
            size="sm"
            disabled={applyWrite.isSaving}
            onClick={() => {
              setNotice(null);
              applyWrite.write({ concessionId: row.concessionId });
            }}
          >
            {applyWrite.isSaving ? t.applying : t.apply}
          </Button>
        ) : (
          statusChip(row)
        ),
    },
  ];

  if (list.isError) return <p className="field-note">{t.loadFailed}</p>;

  return (
    <div className="disposition-concession" role="group" aria-label={t.historyHeading}>
      <SaveErrorBanner error={applyWrite.error} />
      {notice !== null && <p className="field-note">{notice}</p>}
      <div className="disposition-table disposition-decision-table">
        <Table
          caption={<span className="disposition-table-caption">{t.caption}</span>}
          density="compact"
          columns={columns}
          rows={list.data ?? []}
          getRowId={(row) => String(row.concessionId)}
          /* 판정 이력과 같이 — 없으면 표 안 행 자리 가운데 한 줄(사용자 지시 · #223). */
          empty={
            <p className="field-note disposition-table-empty">
              {list.isPending ? t.loading : t.none}
            </p>
          }
        />
      </div>
    </div>
  );
};
