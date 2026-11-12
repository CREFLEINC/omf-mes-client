import { Button, Chip, DatePicker, Dialog, Table, TextField, type Column } from '@crefle/web-ui';
import type {
  ConcessionAppliedForward,
  ConcessionCreatedForward005,
  ConcessionCreateForward005,
  components,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { toBusinessDate } from './decision-form';
import type { DispositionLookup } from './lookups';
import { dispositionKeys } from './queries';
import { formatQty, type NonconformanceLotRow } from './types';

type Concession = components['schemas']['Concession'];

const t = messages.dispositionDecision.concession;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PENDING = 'PENDING';
const STATUS_LABEL: Record<string, string> = t.status;

const concessionKey = (nonconformanceId: number) =>
  [...dispositionKeys.all, 'concessions', nonconformanceId] as const;

interface Draft {
  validFrom: string;
  validTo: string;
  reason: string;
}

const emptyDraft = (today: string): Draft => ({ validFrom: today, validTo: '', reason: '' });

/** 자재 관리 LOT 의 단위가 하나면 그 단위 — 섞이면 고르지 않는다(판정 저장과 같은 규칙). */
const lotsUomId = (lots: readonly NonconformanceLotRow[]): number | undefined => {
  const first = lots[0];
  return first !== undefined && lots.every((lot) => lot.uomId === first.uomId)
    ? first.uomId
    : undefined;
};

const blockedOf = (
  draft: Draft,
  remainingQty: number | undefined,
  uomId: number | undefined,
): string | null => {
  if (remainingQty === undefined || remainingQty <= 0 || uomId === undefined) return t.blocked.qty;
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
  /** 남은 수량 — 특채는 이 값 전부만 요청한다(FR-038 · 일부 특채 없음). 모르면 요청할 수 없다. */
  remainingQty: number | undefined;
  /** 입하 LOT(자재 입하 IQC 부적합) — 대상 줄에 보인다. */
  inboundLotNo?: string | null | undefined;
  /** 단위 이름을 붙인다. 없으면 수만. */
  uoms?: DispositionLookup | undefined;
  /** 지금 날짜 — 시험이 고정할 수 있게 받는다. */
  today?: Date;
  /**
   * 요청이 끝나면 `true` 로 닫는다 — 화면이 완료 알림을 띄운다. 자재 관리 LOT 이 여럿이면 서버가 만든 특채 행 수
   * (`concessionIds`)를 함께 넘긴다.
   */
  onClose: (requested: boolean, lotCount?: number) => void;
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
 * ⭐ 005 FR-038 · D-14 — 특채는 남은 수량 전부만(입력 없음). 자재 관리 LOT 이 여럿이면 `lotId` 없이 요청하고 서버가
 *    LOT 마다 특채 행을 같은 결재로 묶어 만든다. 적용은 묶음 중 어느 행으로 불러도 같은 결재의 행 전부를 함께 적용한다.
 * ⛔ 사용 가능 수량 · 허용 조건은 기록일 뿐 출고 · 투입에서 막지 않는다(#84 범위 · #207 결정).
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
 * 문서 스크롤을 지금 자리에 붙든다 — 다음 두 틀에서 밀렸으면 되돌린다. 정리 함수를 돌려준다.
 * 특채 요청 창이 열리며 포커스가 옮겨갈 때 문서 전체가 위로 밀렸다(G2 L14-1 — html scrollTop 152, 앱 머리 −152, 아래 검은 띠).
 * 셸은 문서를 굴리지 않으므로 창을 여는 순간(누른 때)의 자리를 기억해 되돌린다 — 창이 그려진 뒤 기억하면 이미 밀린 자리다.
 */
export const keepDocumentScroll = (): (() => void) => {
  const root = document.scrollingElement ?? document.documentElement;
  const top = root.scrollTop;
  const left = root.scrollLeft;
  const restore = (): void => {
    if (root.scrollTop !== top) root.scrollTop = top;
    if (root.scrollLeft !== left) root.scrollLeft = left;
  };
  let second = 0;
  const first = requestAnimationFrame(() => {
    restore();
    second = requestAnimationFrame(restore);
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
};

/**
 * 특채 요청 팝업(사용자 지시 · #223) — 처분 판정의 「특채」 칸으로 연다.
 * 대상은 자재 관리 LOT 전부, 사용 가능 수량은 남은 수량 고정(005 · mockups/W0310-After.html).
 */
export const ConcessionRequestDialog = ({
  nonconformanceId,
  lots,
  remainingQty,
  inboundLotNo = null,
  uoms,
  today,
  onClose,
}: ConcessionRequestDialogProps) => {
  const fromFieldId = useId();
  const toFieldId = useId();
  const noteId = useId();
  const blockedId = useId();
  const { client } = useApiClient();
  const todayText = toBusinessDate(today ?? new Date());
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(todayText));
  const uomId = lotsUomId(lots);
  const uomLabel = uomId === undefined || uoms === undefined ? '' : lookupDisplayLabel(uoms, uomId);

  const requestWrite = useMasterWrite<ConcessionCreateForward005, ConcessionCreatedForward005>({
    request: (body, headers) =>
      client.POST('/quality/concessions', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [concessionKey(nonconformanceId)],
    knownFields: ['lotId', 'approvedQty', 'uomId', 'validFrom', 'validTo', 'reason'],
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      const count = data.concessionIds?.length ?? 0;
      if (count > 1) onClose(true, count);
      else onClose(true);
    },
  });

  const blocked = blockedOf(draft, remainingQty, uomId);
  const isSaving = requestWrite.isSaving;
  const onlyLot = lots.length === 1 ? lots[0] : undefined;

  const submit = (): void => {
    if (blocked !== null || remainingQty === undefined || uomId === undefined) return;
    requestWrite.write({
      nonconformanceId,
      /* 자재 관리 LOT 이 하나면 지금처럼 그 LOT, 여럿이면 비운다 — 서버가 LOT 마다 특채 행을 만든다(D-14). */
      ...(onlyLot === undefined ? {} : { lotId: onlyLot.lotId }),
      approvedQty: remainingQty,
      uomId,
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
          <Button
            disabled={blocked !== null || isSaving}
            aria-describedby={blocked === null ? undefined : blockedId}
            onClick={submit}
          >
            {isSaving ? t.requesting : t.request}
          </Button>
        </>
      }
    >
      <div className="disposition-concession-dialog">
        <p className="field-note">{t.requestNote}</p>
        <SaveErrorBanner error={requestWrite.error} />
        <div className="disposition-concession-fields">
          <TextField
            label={t.target}
            value={t.targetAll(inboundLotNo, lots.length)}
            readOnly
            fullWidth
          />
          <TextField
            label={t.qty}
            value={`${formatQty(remainingQty)}${uomLabel === '' ? '' : ` ${uomLabel}`}`}
            readOnly
            fullWidth
            aria-describedby={noteId}
            error={requestWrite.fieldErrors.approvedQty}
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
        <p id={noteId} className="field-note disposition-concession-whole">
          {t.qtyLocked} — {t.wholeHint}
        </p>
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
        {/* 칸별 안내 문구 없이 필수 표시로 알린다 — 단추가 읽을 이유만 가려 둔다. */}
        {blocked !== null && (
          <span id={blockedId} className="visually-hidden">
            {t.requestBlocked}
          </span>
        )}
      </div>
    </Dialog>
  );
};

interface ConcessionGroup {
  first: Concession;
  rows: Concession[];
}

/** 결재 하나에 묶인 특채 행들 — 옛 행은 결재마다 한 행이라 홀로 한 줄이다. 차례는 받은 차례. */
export const groupConcessions = (rows: readonly Concession[]): ConcessionGroup[] => {
  const groups = new Map<string, ConcessionGroup>();
  for (const row of rows) {
    const key = String(row.approvalRequestId);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { first: row, rows: [row] });
    else group.rows.push(row);
  }
  return [...groups.values()];
};

/**
 * 이력 표의 [특채 적용] — 위 상자와 같은 기준으로 결재가 승인 · 반려된 때만 연다(G2 5차). 결재 대기 중이면 잠그고 까닭을 단다.
 */
const ApplyButton = ({
  approvalRequestId,
  disabled,
  onClick,
  children,
}: {
  approvalRequestId: number;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) => {
  const approval = useConcessionApprovalStatus(approvalRequestId);
  const decided = approval.data === 'APPROVED' || approval.data === 'REJECTED';

  return (
    <Button
      variant="outlined"
      size="sm"
      disabled={disabled || !decided}
      title={decided ? undefined : t.applyWaiting}
      onClick={onClick}
    >
      {children}
    </Button>
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

  /* 같은 결재(`approvalRequestId`)의 행(자재 관리 LOT 마다 한 행)은 한 줄로 묶어 보인다(005 D-14). */
  const groups = groupConcessions(list.data ?? []);
  /* 적용한 묶음의 행 수 — 알림 문구에 쓴다(쓰기 응답은 첫 행만 돌려준다). */
  const appliedCount = useRef(1);

  const applyWrite = useMasterWrite<{ concessionId: number }, ConcessionAppliedForward>({
    /* 옛 일부 특채 적용은 LOT 을 나누며 재고도 원장으로 나눴다 — 그때 쓰는 영업일을 늘 싣는다(#207 · C-8). */
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
            : appliedCount.current > 1
              ? t.appliedLots(appliedCount.current)
              : t.applied,
      ),
  });

  const statusChip = (row: Concession) => (
    <Chip
      variant="status"
      size="sm"
      status={
        row.statusCode === 'APPROVED' || row.statusCode === 'APPLIED'
          ? 'success'
          : row.statusCode === PENDING
            ? 'warning'
            : 'error'
      }
    >
      {STATUS_LABEL[row.statusCode] ?? row.statusCode}
    </Chip>
  );

  const columns: Column<ConcessionGroup>[] = [
    {
      key: 'concessionNo',
      align: 'center',
      header: t.columns.concessionNo,
      render: (group) => group.first.concessionNo,
    },
    {
      key: 'target',
      align: 'center',
      header: t.columns.target,
      render: (group) =>
        group.rows.length > 1
          ? t.targetGroup(group.rows.length)
          : (group.first.lotNo ?? String(group.first.lotId)),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.columns.qty,
      render: (group) => formatQty(group.rows.reduce((sum, row) => sum + row.approvedQty, 0)),
    },
    {
      key: 'period',
      align: 'center',
      header: t.columns.period,
      render: (group) =>
        `${group.first.validFrom} ~ ${group.first.validTo ?? t.validToPlaceholder}`,
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      render: (group) =>
        group.first.statusCode === PENDING && !readOnly ? (
          <ApplyButton
            approvalRequestId={group.first.approvalRequestId}
            disabled={applyWrite.isSaving}
            onClick={() => {
              setNotice(null);
              appliedCount.current = group.rows.length;
              /* 묶음 중 어느 행으로 불러도 같은 결재의 대기 행 전부가 함께 적용된다(계약 §10). */
              applyWrite.write({ concessionId: group.first.concessionId });
            }}
          >
            {applyWrite.isSaving ? t.applying : t.apply}
          </ApplyButton>
        ) : (
          statusChip(group.first)
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
          rows={groups}
          getRowId={(group) => String(group.first.concessionId)}
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

/** 특채 결재 요청의 상태(W-03-09) — 특채는 적용 전까지 PENDING 이라 결재가 끝났는지는 결재 요청이 말한다(G2 M3). */
export const useConcessionApprovalStatus = (approvalRequestId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...dispositionKeys.all, 'concession-approval', approvalRequestId ?? 0] as const,
    enabled: approvalRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId: approvalRequestId as number } },
        }),
      ).then((detail) => detail.request.statusCode),
  });
};

export interface PendingConcessionBoxProps {
  concession: Concession;
  /** 이 결재로 묶인 자재 관리 LOT 수. */
  lotCount: number;
}

/**
 * 처분 판정 상자의 「적용 전 특채」 줄(screens/W-03-10.md · 시안 W0310-After — 같은 상자에 [특채 적용]). 결재 대기면 「결재 대기 중」,
 * 승인이면 「승인됨 — 적용 대기」와 [특채 적용], 반려면 [특채 닫기](적용 경로가 반려를 닫는다)(G2 M3).
 */
export const PendingConcessionBox = ({ concession, lotCount }: PendingConcessionBoxProps) => {
  const { client } = useApiClient();
  const approval = useConcessionApprovalStatus(concession.approvalRequestId);
  const [notice, setNotice] = useState<string | null>(null);
  const applyWrite = useMasterWrite<{ concessionId: number }, ConcessionAppliedForward>({
    request: ({ concessionId }, headers) =>
      client.POST('/quality/concessions/{concessionId}:apply', {
        params: {
          path: { concessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { businessDate: toBusinessDate(new Date()) },
      }),
    etagPath: null,
    invalidateKeys: [dispositionKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: (data) =>
      setNotice(
        data.statusCode === 'REJECTED'
          ? t.rejected
          : lotCount > 1
            ? t.appliedLots(lotCount)
            : t.applied,
      ),
  });
  const status = approval.data;
  const decided = status === 'APPROVED' || status === 'REJECTED';

  return (
    <div
      className="iqc-inspection-action-note disposition-pending-concession"
      data-tone={status === 'APPROVED' ? 'success' : 'warning'}
      role="status"
    >
      <span>
        {status === 'APPROVED'
          ? t.approvedBanner(concession.concessionNo, lotCount)
          : status === 'REJECTED'
            ? t.rejectedBanner(concession.concessionNo)
            : t.pendingBanner(concession.concessionNo, lotCount)}
      </span>
      {decided ? (
        <Button
          size="sm"
          variant={status === 'APPROVED' ? 'filled' : 'outlined'}
          loading={applyWrite.isSaving}
          onClick={() => {
            setNotice(null);
            /* 묶음 중 어느 행으로 불러도 같은 결재의 대기 행 전부가 함께 적용된다(계약 §10). */
            applyWrite.write({ concessionId: concession.concessionId });
          }}
        >
          {status === 'APPROVED' ? t.apply : t.close}
        </Button>
      ) : null}
      <SaveErrorBanner error={applyWrite.error} />
      {notice !== null && <span className="field-note">{notice}</span>}
    </div>
  );
};
