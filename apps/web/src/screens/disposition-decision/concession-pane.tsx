import { Button, Chip, DatePicker, Table, TextField, type Column } from '@crefle/web-ui';
import type { components, ConcessionCreate } from '@omf-mes/api-client';
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

export interface ConcessionPaneProps {
  nonconformanceId: number;
  lots: readonly NonconformanceLotRow[];
  /** 종결된 부적합은 요청을 막는다(서버도 400). */
  isClosed: boolean;
  /** 지금 날짜 — 시험이 고정할 수 있게 받는다. */
  today?: Date;
}

/**
 * W-03-10 의 「특채」 구획(omf-all-around#84 · 서버 선행 P-79).
 *
 * ⭐ 요청 → 결재(W-03-09) → 적용. 이 구획은 요청과 적용만 한다 — 승인은 결재 경로의 몫이다.
 * ⭐ 적용은 서버가 LOT 을 정상으로 열고 수입검사 대기 보류를 닫고 처분 판정(특채)을 남긴다 — 그래서
 *    성공하면 이 화면의 상세·판정을 함께 다시 부른다.
 * ⛔ 사용 가능 수량은 기록일 뿐 출고·투입에서 막지 않는다(#84 범위).
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

export const ConcessionPane = ({
  nonconformanceId,
  lots,
  isClosed,
  today,
}: ConcessionPaneProps) => {
  const lotFieldId = useId();
  const fromFieldId = useId();
  const toFieldId = useId();
  const { client } = useApiClient();
  const todayText = toBusinessDate(today ?? new Date());
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(lots, todayText));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(emptyDraft(lots, todayText));
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonconformanceId]);

  const list = useConcessions(nonconformanceId);

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
    onSuccess: () => {
      setDraft(emptyDraft(lots, todayText));
      setNotice(t.requested);
    },
  });

  const applyWrite = useMasterWrite<{ concessionId: number }, Concession>({
    request: ({ concessionId }, headers) =>
      client.POST('/quality/concessions/{concessionId}:apply', {
        params: {
          path: { concessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    /* 적용은 LOT·부적합·판정을 함께 바꾼다 — 이 화면의 뿌리 키를 다시 부른다. */
    invalidateKeys: [dispositionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: (data) => setNotice(data.statusCode === 'REJECTED' ? t.rejected : t.applied),
  });

  const lot = lots.find((row) => String(row.lotId) === draft.lotId);
  const blocked = isClosed ? t.closedNote : blockedOf(draft);
  const isSaving = requestWrite.isSaving || applyWrite.isSaving;

  const submit = (): void => {
    if (blocked !== null || lot === undefined) return;
    setNotice(null);
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
      render: (row) => `${row.validFrom} ~ ${row.validTo ?? ''}`,
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      render: (row) =>
        row.statusCode === PENDING ? (
          <Button
            variant="outlined"
            size="sm"
            disabled={isSaving}
            onClick={() => {
              setNotice(null);
              applyWrite.write({ concessionId: row.concessionId });
            }}
          >
            {applyWrite.isSaving ? t.applying : t.apply}
          </Button>
        ) : (
          <Chip
            variant="status"
            size="sm"
            status={row.statusCode === 'APPROVED' ? 'success' : 'error'}
          >
            {STATUS_LABEL[row.statusCode] ?? row.statusCode}
          </Chip>
        ),
    },
  ];

  /*
   * 상세 아래 「특채 요청 및 이력」 탭의 내용(사용자 시안 · #223) — 위 요청 입력(두 칸씩 두 줄), 구분선 아래 요청 이력.
   * 긴 절차 안내 · 칸별 입력 안내 문구는 걷었다 — 필수 칸은 빨간 * 로 알린다.
   */
  const rows = list.data ?? [];
  return (
    <div className="disposition-concession" role="group" aria-label={t.heading}>
      <section className="disposition-concession-part" aria-label={t.requestHeading}>
        <div className="disposition-side-head">
          <h4 className="pane-subtitle">{t.requestHeading}</h4>
          <span className="field-note">{t.requestNote}</span>
        </div>
        {lots.length > 1 && (
          <div className="field-cell">
            <label className="field-label" htmlFor={lotFieldId}>
              {t.lot}
            </label>
            <Select
              id={lotFieldId}
              options={lots.map((row) => ({ value: String(row.lotId), label: row.lotNoText }))}
              value={draft.lotId}
              disabled={isClosed || isSaving}
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
            disabled={isClosed || isSaving}
            error={requestWrite.fieldErrors.approvedQty}
            onChange={(event) => setDraft({ ...draft, qty: event.target.value })}
          />
          <TextField
            label={t.reason}
            placeholder={t.reasonPlaceholder}
            required
            fullWidth
            value={draft.reason}
            disabled={isClosed || isSaving}
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
              disabled={isClosed || isSaving}
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
              disabled={isClosed || isSaving}
              onChange={(value) => setDraft({ ...draft, validTo: value ?? '' })}
            />
            {requestWrite.fieldErrors.validTo !== undefined && (
              <span className="field-error">{requestWrite.fieldErrors.validTo}</span>
            )}
          </div>
        </div>
        <SaveErrorBanner error={requestWrite.error} />
        {notice !== null && <p className="field-note">{notice}</p>}
        <div className="form-actions">
          {isClosed && <p className="field-note form-actions-secondary">{t.closedNote}</p>}
          <Button disabled={blocked !== null || isSaving} onClick={submit}>
            {requestWrite.isSaving ? t.requesting : t.request}
          </Button>
        </div>
      </section>
      <section className="disposition-concession-part" aria-label={t.historyHeading}>
        <div className="disposition-side-head">
          <h4 className="pane-subtitle">{t.historyHeading}</h4>
          {!list.isPending && !list.isError && (
            <span className="field-note">{t.total(rows.length)}</span>
          )}
        </div>
        {list.isError ? (
          <p className="field-note">{t.loadFailed}</p>
        ) : (
          <div className="disposition-table disposition-decision-table">
            <Table
              caption={<span className="disposition-table-caption">{t.caption}</span>}
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.concessionId)}
              /* 판정 이력과 같이 — 없으면 표 안 행 자리 가운데 한 줄(사용자 지시 · #223). */
              empty={
                <p className="field-note disposition-table-empty">
                  {list.isPending ? t.loading : t.none}
                </p>
              }
            />
          </div>
        )}
        <SaveErrorBanner error={applyWrite.error} />
      </section>
    </div>
  );
};
