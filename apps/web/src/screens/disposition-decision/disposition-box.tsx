import type {
  ApiError,
  ConcessionCreatedForward005,
  ConcessionCreateForward005,
  DispositionDecisionCreatedForward005,
} from '@omf-mes/api-client';
import { Chip, Icon, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { DecisionConfirmDialog, type DecisionConfirmRow } from './decision-confirm-dialog';
import {
  CONCESSION,
  EMPTY_DECISION_FORM,
  hasBlockingError,
  hasDecisionInput,
  SORT,
  toDecisionCreateBody,
  validateDecisionForm,
  type DecisionCreateBody,
  type DecisionFormValue,
} from './decision-form';
import { DecisionFormPane, typeLockLines } from './decision-form-pane';
import { DecisionHistory } from './decision-history';
import { toDecisionLock } from './decision-lock';
import { DetailSlot } from './detail-slot';
import {
  codeValueLabel,
  DISPOSITION_TYPE_CODES,
  dispositionOptionLock,
  dispositionTypeLabel,
  dispositionTypeOptions,
  isClosedNonconformance,
  selectableDispositionCodes,
  type DispositionOptionContext,
} from './disposition-codes';
import {
  useItemLookupFor,
  useNonconformanceStatusLookup,
  useSeverityLookup,
  useUomLookup,
} from './lookups';
import {
  dispositionKeys,
  nonconformanceDetailPath,
  useDispositionDecisions,
  useLotStatuses,
  useNonconformanceDetail,
  useOpenConcessionCount,
} from './queries';
import { toRemainingQty } from './remaining-qty';
import { lotNames, sumQty } from './sort-split-pane';
import { decisionUomIdOf, formatQty, toDecisionRow, toDetailView } from './types';

/**
 * 저장에 실어 보내는 값. **대상 식별자를 함께 싣는다** — 멱등 키의 지문이 여기서 나오므로,
 * 경로에만 두면 다른 부적합에 같은 본문을 보낼 때 같은 키가 나간다.
 */
interface DecisionWriteVariables {
  nonconformanceId: number;
  body: DecisionCreateBody;
}

/** 결과를 아직 모르는 판정이 겨눈 부적합. 번호까지 기억해야 사용자에게 어디를 확인할지 말할 수 있다. */
interface PendingWriteTarget {
  nonconformanceId: number;
  nonconformanceNo: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 저장 409 중 «다시 불러도 안 풀리는» 것(종결 · 판정 있음 · 특채 있음 · 남은 수량 초과)은 「다른 사용자가 먼저 저장했습니다」가 아니라
 * 저장할 수 없는 상태로 그 까닭과 함께 보인다(omf-all-around#354). 서버가 공용 충돌 봉투(`conflictCause`)에 실어 보내
 * 정규화기가 `conflict` 로 접지만, 까닭은 위 `request` 가 되말해 둔 `message` 에 있다. 판 번호 충돌만 「최신 불러오기」로 푼다.
 */
/** 판정 저장 `request` 가 화면 문구로 되말한 409 코드 — 이 밖의 409 는 서버 원문을 띄우지 않고 공용 처리에 둔다(공유계약 A-9 ⓑ). */
const RESTATED_CONFLICT_CODES: readonly string[] = ['DISPOSITION_QTY_EXCEEDED', 'INVALID_STATE'];

const shownWriteError = (error: ApiError | null): ApiError | null =>
  error !== null &&
  error.kind === 'conflict' &&
  error.code !== undefined &&
  RESTATED_CONFLICT_CODES.includes(error.code)
    ? {
        kind: 'stateLocked',
        status: 409,
        errors: [{ scope: 'screen', code: error.code, message: error.message }],
      }
    : error;

export interface DispositionBoxProps {
  /** 보여 줄 부적합. `null` 이면 고르기 전 안내만. */
  nonconformanceId: number | null;
  /** 상자 안에서 다른 부적합(선별로 생긴 건 · 원래 건)을 열 때. 없으면 상자가 스스로 바꿔 연다. */
  onOpenNonconformance?: (nonconformanceId: number) => void;
  /** 고르기 전 안내 문구. */
  emptyTitle?: string;
  dispositionTypeCodes?: readonly string[];
  today?: Date;
  /** 저장 뒤 함께 다시 읽을 바깥 화면의 조회 — 검사 목록 · LOT 품질 상태 · 불합격 안내가 옛 값으로 남지 않게. */
  refreshKeys?: readonly (readonly unknown[])[];
}

/**
 * 부적합 처분 상자(omf-all-around#354) — 부적합 상세 · 처분 판정 · 처분 이력. 「부적합 처분 관리」 메뉴를 없애며
 * 그 화면 오른쪽 구획을 그대로 떼어 IQC · OQC 판정 화면에 검사 상세와 따로 세운다. 저장 규칙은 #352 그대로다.
 */
export const DispositionBox = ({
  nonconformanceId,
  onOpenNonconformance,
  emptyTitle,
  dispositionTypeCodes = DISPOSITION_TYPE_CODES,
  today,
  refreshKeys = [],
}: DispositionBoxProps) => {
  const t = messages.dispositionDecision;
  /* 상자 안에서 연 다른 부적합 — 바깥이 고른 건이 바뀌면 그 건으로 돌아간다. */
  const [openedId, setOpenedId] = useState<number | null>(nonconformanceId);
  useEffect(() => setOpenedId(nonconformanceId), [nonconformanceId]);
  const selectedId = onOpenNonconformance === undefined ? openedId : nonconformanceId;
  const openNonconformance = (id: number): void => {
    if (onOpenNonconformance === undefined) setOpenedId(id);
    else onOpenNonconformance(id);
  };

  const severity = useSeverityLookup();
  const status = useNonconformanceStatusLookup();
  const detail = useNonconformanceDetail(selectedId);
  const decisions = useDispositionDecisions(selectedId);
  const openConcessions = useOpenConcessionCount(selectedId);
  const items = useItemLookupFor([detail.data?.itemId]);
  const uoms = useUomLookup();

  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const remaining = toRemainingQty(decisions.data?.summary);
  /** 이 부적합의 판정으로 새로 생긴 부적합(선별로 떼어 낸 불량) — 상세 상자의 「신규 부적합 건」 칸(#352). */
  const derivedNonconformances = (decisions.data?.items ?? [])
    .flatMap((item) =>
      item.newNonconformanceId == null
        ? []
        : [
            {
              id: item.newNonconformanceId,
              no: item.newNonconformanceNo ?? String(item.newNonconformanceId),
            },
          ],
    )
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);
  const uomId = decisionUomIdOf(detail.data?.lots);
  const detailView = useMemo(
    () => (detail.data === undefined ? null : toDetailView(detail.data)),
    [detail.data],
  );
  const lotRows = detailView?.lots ?? [];
  const lotStatuses = useLotStatuses(
    useMemo(() => (detail.data?.lots ?? []).map((lot) => lot.lotId), [detail.data]),
  );
  const decisionRows = useMemo(
    () => (decisions.data?.items ?? []).map(toDecisionRow),
    [decisions.data],
  );

  const [form, setForm] = useState<DecisionFormValue>(EMPTY_DECISION_FORM);
  /* 판정 확인 팝업 — 폐기 · 선별 · 특채 모두 저장 전에 띄운다(omf-all-around#352 사용자 지시). */
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  /** 선택을 옮겨도 쓰기가 따라다니지 않도록, 겨눈 부적합을 기억한다. */
  const [pendingTarget, setPendingTarget] = useState<PendingWriteTarget | null>(null);
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

  /**
   * ⭐ **대상 식별자를 «본문 밖»이 아니라 쓰기 변수에 싣는다.** 멱등 키의 지문은 쓰기 변수에서 나오는데
   * `nonconformanceId`는 경로에 있다. 변수에 얹지 않으면 다른 부적합에 같은 본문을 보낼 때 같은 키가 나간다(공유계약 C-1).
   */
  const write = useMasterWrite<DecisionWriteVariables, DispositionDecisionCreatedForward005>({
    request: async (variables, headers) => {
      const result = await client.POST(
        '/quality/nonconformances/{nonconformanceId}/disposition-decisions',
        {
          params: {
            path: { nonconformanceId: variables.nonconformanceId },
            header: {
              'Idempotency-Key': headers['Idempotency-Key'],
              /* ⛔ 계약이 이 헤더를 **필수**로 바꿨다 — 없으면 빈 값을 채우지 않고 멈춘다. */
              'If-Match': requireIfMatch(headers),
            },
          },
          body: variables.body,
        },
      );

      /*
       * ⭐ raw `error`를 가로채 구조화 필드로 문구를 되말한다 — 이 둘은 `conflictCause`를 싣지 않아 공유 정규화기가
       * `kind: 'http'`로 떨어뜨린다. ⛔ 서버 `message` 원문은 표시·파싱하지 않는다(W-03-10 §6 · 공유계약 A-9 ⓑ).
       */
      if (result.response.status !== 409 || !isRecord(result.error)) return result;

      const raw = result.error as Record<string, unknown>;
      if (raw.code === 'DISPOSITION_QTY_EXCEEDED') {
        const remainingText = formatQty(
          typeof raw.remainingQty === 'number' ? raw.remainingQty : undefined,
        );
        return {
          ...result,
          error: { ...raw, message: t.form.qtyExceededByServer(remainingText) },
        };
      }
      if (raw.code === 'INVALID_STATE') {
        const message =
          variables.body.dispositionTypeCode === SORT ? t.form.sortRefused : t.form.alreadyClosed;
        return { ...result, error: { ...raw, message } };
      }

      return result;
    },
    /* ⭐ 토큰은 부적합 «상세»가 내린다 — 저장 경로가 아니다(공유계약 B-1). */
    etagPath: selectedId === null ? null : nonconformanceDetailPath(selectedId),
    invalidateKeys: [dispositionKeys.all, ...refreshKeys],
    knownFields: [
      'dispositionTypeCode',
      'decisionQty',
      'uomId',
      'reason',
      'lotIds',
      'goodQty',
      'defectQty',
    ],
    /* 되돌릴 수 없는 쓰기다 — 취소 API가 없고 LOT 상태 전이를 함께 부른다(공유계약 B-8). */
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.form.success });
      setForm(EMPTY_DECISION_FORM);
      setShowErrors(false);
      setPendingTarget(null);
    },
  });

  /*
   * 특채 저장 — 결재 없이 바로 적용된다(omf-all-around#352). 사유는 판정 사유 칸 하나를 쓴다.
   * 수량은 남은 수량 전부, 자재 관리 LOT 이 여럿이면 `lotId` 없이 보낸다(FR-038 · D-14).
   */
  const concessionWrite = useMasterWrite<ConcessionCreateForward005, ConcessionCreatedForward005>({
    request: (body, headers) =>
      client.POST('/quality/concessions', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [dispositionKeys.all, ...refreshKeys],
    knownFields: ['lotId', 'approvedQty', 'uomId', 'validFrom', 'validTo', 'reason'],
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      const count = data.concessionIds?.length ?? 0;
      const description = count > 1 ? t.concession.appliedLots(count) : t.concession.applied;
      toast.show({ variant: 'success', description });
      setForm(EMPTY_DECISION_FORM);
      setShowErrors(false);
    },
  });

  useEffect(() => {
    setForm(EMPTY_DECISION_FORM);
    setShowErrors(false);
    setIsConfirmOpen(false);
  }, [selectedId]);

  /* 서버가 되돌린 필드 오류가 화면 검증을 덮는다 — 계약이 정본이다. */
  const formContext = { remainingQty: remaining.value, lotCount: lotRows.length };
  const serverFieldErrors = { ...write.fieldErrors, ...concessionWrite.fieldErrors };
  const errors = { ...validateDecisionForm(form, formContext), ...serverFieldErrors };
  /* 005 — 처분 유형마다 막힘(종결 · 선별 규칙 · 선별로 생긴 부적합의 정상). */
  const optionContext: DispositionOptionContext = {
    isClosed:
      detail.data !== undefined &&
      isClosedNonconformance(detail.data.statusCode, remaining.isSettled),
    inboundLotNo: detailView?.inboundLotNo,
    lotCount: lotRows.length,
    decisionCount: decisions.data?.items.length ?? 0,
    isSortedOff: detailView?.sortedFrom !== null && detailView?.sortedFrom !== undefined,
    hasOpenConcession: (openConcessions.data ?? 0) > 0,
  };
  const dispositionOptions = dispositionTypeOptions(
    selectableDispositionCodes(dispositionTypeCodes),
  ).map((option) => {
    const lockReason = dispositionOptionLock(option.value, optionContext);
    return {
      ...option,
      ...(lockReason === undefined ? {} : { lockReason }),
    };
  });
  const concessionLock = dispositionOptionLock(CONCESSION, optionContext);
  /* 특채도 처분 유형 칸 하나로 — 고르면 아래에 적용 기간 칸이 펼쳐진다(#352). */
  const decisionOptions = [
    ...dispositionOptions,
    {
      ...dispositionTypeOptions([CONCESSION])[0],
      ...(concessionLock === undefined ? {} : { lockReason: concessionLock }),
    } as (typeof dispositionOptions)[number],
  ];
  const uomText = uomId === undefined ? '' : ` ${lookupDisplayLabel(uoms, uomId)}`;
  /** 판정 확인 팝업에 늘어놓을 저장 내용 — 고른 유형에 맞춰. */
  const confirmRows = (): DecisionConfirmRow[] => {
    const qty = (value: number | undefined): string => `${formatQty(value)}${uomText}`;
    const rows: DecisionConfirmRow[] = [
      {
        label: t.confirm.type,
        value: dispositionTypeLabel(form.dispositionTypeCode),
        strong: true,
      },
    ];
    if (form.dispositionTypeCode === SORT) {
      const picked = new Set(form.sortLotIds);
      const moved = lotRows.filter((lot) => picked.has(lot.lotId));
      const rest = lotRows.filter((lot) => !picked.has(lot.lotId));
      rows.push(
        {
          label: t.confirm.sortRest,
          value: t.sort.previewTarget(lotNames(lotRows, rest), qty(sumQty(rest))),
        },
        {
          label: t.confirm.sortMoved,
          value: t.sort.previewTarget(lotNames(lotRows, moved), qty(sumQty(moved))),
        },
      );
    } else {
      rows.push(
        { label: t.confirm.target, value: t.confirm.targetLots(lotRows.length), strong: true },
        { label: t.confirm.qty, value: qty(remaining.value), strong: true },
      );
    }
    if (form.dispositionTypeCode === CONCESSION) {
      rows.push({
        label: t.confirm.period,
        value: t.confirm.periodText(form.validFrom, form.validTo === '' ? null : form.validTo),
      });
    }
    rows.push({ label: t.confirm.reason, value: form.reason.trim() });
    return rows;
  };
  const isOtherTarget = pendingTarget !== null && pendingTarget.nonconformanceId !== selectedId;
  const lock = toDecisionLock({
    selectedId,
    isSaving: write.isSaving || concessionWrite.isSaving,
    writeError: write.error ?? concessionWrite.error,
    detailError,
    uomId,
    dispositionTypeCodes: selectableDispositionCodes(dispositionTypeCodes),
    ...(isOtherTarget && pendingTarget !== null
      ? { otherPendingWriteNo: pendingTarget.nonconformanceNo }
      : {}),
  });

  /** [판정 저장] — 화면 검증을 통과하면 확인 팝업을 연다. 실제 저장은 팝업의 [확인]이 한다. */
  const save = (): void => {
    setShowErrors(true);
    if (uomId === undefined || selectedId === null) return;
    if (hasBlockingError(validateDecisionForm(form, formContext))) return;
    setIsConfirmOpen(true);
  };

  const submit = (): void => {
    setIsConfirmOpen(false);
    if (uomId === undefined || selectedId === null) return;

    if (form.dispositionTypeCode === CONCESSION) {
      const remainingQty = remaining.value;
      if (hasBlockingError(validateDecisionForm(form, formContext)) || remainingQty === undefined)
        return;
      const onlyLot = lotRows.length === 1 ? lotRows[0] : undefined;
      concessionWrite.write({
        nonconformanceId: selectedId,
        /* 자재 관리 LOT 이 하나면 그 LOT, 여럿이면 비운다 — 서버가 LOT 마다 특채 행을 만든다(D-14). */
        ...(onlyLot === undefined ? {} : { lotId: onlyLot.lotId }),
        approvedQty: remainingQty,
        uomId,
        validFrom: form.validFrom,
        ...(form.validTo === '' ? {} : { validTo: form.validTo }),
        reason: form.reason.trim(),
      });
      return;
    }

    /* 검증을 통과하지 못하면 본문이 만들어지지 않는다 — 그 자체가 마지막 문이다. */
    const body = toDecisionCreateBody(form, uomId, formContext);
    if (body === undefined) return;

    setPendingTarget({
      nonconformanceId: selectedId,
      nonconformanceNo: detail.data?.nonconformanceNo ?? String(selectedId),
    });
    write.write({ nonconformanceId: selectedId, body });
  };

  /**
   * 적용 여부를 모르는 저장에서 빠져나가는 길 — 쓰기가 «겨눈» 부적합을 다시 읽고 오류 표시를 지운다.
   * **멱등 키는 버리지 않는다**(훅이 그렇게 둔다). 다른 것을 겨눴으면 그리로 데려간다.
   */
  const checkOutcome = (): void => {
    const target = pendingTarget?.nonconformanceId ?? selectedId;
    if (target === null) return;
    void queryClient.invalidateQueries({ queryKey: dispositionKeys.detail(target) });
    void queryClient.invalidateQueries({ queryKey: dispositionKeys.decisions(target) });
    if (target !== selectedId) openNonconformance(target);
    write.reset();
    setPendingTarget(null);
  };

  /* 고른 부적합의 상태 — 부적합번호 옆(omf-all-around#275). */
  const statusChip =
    detail.data === undefined ? undefined : (
      <Chip size="sm" status={detail.data.statusCode === 'DECIDED' ? 'success' : 'warning'}>
        {codeValueLabel(status, detail.data.statusCode)}
      </Chip>
    );

  return (
    <section className="disposition-box" aria-label={t.box.title}>
      <h3 className="pane-title disposition-box-title">{t.box.title}</h3>
      <div className="disposition-side-part" aria-label={t.panes.detail} role="group">
        <DetailSlot
          selectedId={selectedId}
          detail={{
            isPending: detail.isPending,
            isError: detail.isError,
            isNotFound: isDetailNotFound,
            error: detail.error,
            view: detailView,
          }}
          items={items}
          severity={severity}
          uoms={uoms}
          onRetry={() => void detail.refetch()}
          emptyTitle={emptyTitle}
          lotStatuses={lotStatuses}
          remainingText={remaining.value === undefined ? undefined : `${remaining.text}${uomText}`}
          onOpenNonconformance={openNonconformance}
          derivedNonconformances={derivedNonconformances}
          status={statusChip}
        />
      </div>
      {/* 판정 대기면 처분 판정만, 판정이 끝났으면 처분 이력만(#352 사용자 지시). */}
      {selectedId !== null && detail.data !== undefined && !optionContext.isClosed && (
        <div
          className="disposition-side-part disposition-decision-card"
          role="group"
          aria-label={t.panes.decision}
        >
          <div className="disposition-side-head disposition-decision-head">
            <h3 className="pane-subtitle">{t.form.heading}</h3>
            {typeLockLines(decisionOptions).map((line) => (
              <p
                key={line}
                className="iqc-inspection-action-note"
                data-tone="info"
                aria-hidden="true"
              >
                <Icon name="info" size={14} aria-hidden />
                {line}
              </p>
            ))}
          </div>
          <DecisionFormPane
            value={form}
            errors={showErrors ? errors : serverFieldErrors}
            remainingQty={remaining.value}
            lockReason={lock.reason}
            isUncertain={lock.isUncertain}
            onCheckOutcome={checkOutcome}
            dispositionOptions={decisionOptions}
            today={today}
            lots={lotRows}
            inboundLotNo={detailView?.inboundLotNo}
            inspectionRequestNo={detailView?.inspectionRequestNo}
            uomId={uomId}
            uoms={uoms}
            writeError={write.error ? shownWriteError(write.error) : concessionWrite.error}
            isSaving={write.isSaving || concessionWrite.isSaving}
            canCancel={hasDecisionInput(form)}
            onChange={(next) => {
              /* 고친 칸의 서버 오류만 지운다 — 남은 칸의 오류까지 지우면 못 본 채 다시 보낸다. */
              if (next.dispositionTypeCode !== form.dispositionTypeCode)
                write.clearFieldError('dispositionTypeCode');
              if (next.reason !== form.reason) write.clearFieldError('reason');
              if (next.sortLotIds !== form.sortLotIds) write.clearFieldError('lotIds');
              if (next.goodQty !== form.goodQty) write.clearFieldError('goodQty');
              if (next.defectQty !== form.defectQty) write.clearFieldError('defectQty');
              if (next.reason !== form.reason) concessionWrite.clearFieldError('reason');
              if (next.validFrom !== form.validFrom) concessionWrite.clearFieldError('validFrom');
              if (next.validTo !== form.validTo) concessionWrite.clearFieldError('validTo');
              setForm(next);
            }}
            onSave={save}
            onCancel={() => {
              setForm(EMPTY_DECISION_FORM);
              setShowErrors(false);
              /* 지운 값에 대한 서버 판정을 남기지 않는다 — 빈 칸에 붙은 오류는 풀 길이 없다. */
              write.reset();
              concessionWrite.reset();
            }}
            onReload={checkOutcome}
          />
        </div>
      )}
      {/* 처분 이력 — 특채도 판정 한 줄로 남는다. 판정이 끝난 건에만(#352 사용자 지시). */}
      {selectedId !== null && detail.data !== undefined && optionContext.isClosed && (
        <div className="disposition-side-part disposition-history-card">
          <div className="disposition-side-head">
            <h3 className="pane-subtitle">
              {t.panes.decisions}{' '}
              {decisions.isPending ? null : (
                <span className="disposition-count-badge">
                  {t.decisions.count(decisionRows.length)}
                </span>
              )}
            </h3>
          </div>
          <DecisionHistory
            rows={decisionRows}
            uoms={uoms}
            isLoading={decisions.isPending}
            isError={decisions.isError}
          />
        </div>
      )}
      {isConfirmOpen && selectedId !== null && (
        <DecisionConfirmDialog
          rows={confirmRows()}
          isSaving={write.isSaving || concessionWrite.isSaving}
          onConfirm={submit}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </section>
  );
};
