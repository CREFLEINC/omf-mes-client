import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { stageOf } from './codes';
import { FilterBar } from './filter-bar';
import {
  EMPTY_FILTERS,
  hasSelection,
  readFilters,
  readPage,
  readSelection,
  toAppliedSearchParams,
  toListQuery,
  withSelection,
  type Selection,
  type TargetFilters,
} from './filters';
import { LoadErrorBanner } from './load-error';
import { toFollowUpStates, toRegisterLock, toRequestLock } from './lock';
import {
  useDefectWarehouseOptions,
  useDepartmentOptions,
  useSeverityOptions,
  useUomLookup,
} from './lookups';
import {
  descriptionWarning,
  EMPTY_NONCONFORMANCE_FORM,
  hasNonconformanceInput,
  toNonconformanceCreateBody,
  validateNonconformanceForm,
  type NonconformanceFormValue,
} from './nonconformance-form';
import { toPageView } from './pagination';
import { toProgressSteps } from './progress';
import { ProgressStepper } from './progress-stepper';
import {
  nonconformanceDetailPath,
  requestKeys,
  useDecisions,
  useNonconformanceDetail,
  useTargetList,
} from './queries';
import { RegisterPane } from './register-pane';
import {
  defaultRequestForm,
  hasRequestInput,
  toDispositionRequestBody,
  validateRequestForm,
  type RequestFormValue,
} from './request-form';
import { RequestPane } from './request-pane';
import { ResultPane } from './result-pane';
import { TargetHeader } from './target-header';
import { TargetList } from './target-list';
import {
  formatQty,
  toCandidateRow,
  toDecisionRow,
  toNonconformanceRow,
  type DispositionRequest,
  type Nonconformance,
  type NonconformanceCreate,
  type TargetRow,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 등록 쓰기 변수 — **대상 LOT을 함께 싣는다.** 멱등 키의 지문이 여기서 나오므로 본문만 두면 다른
 * LOT에 같은 내용을 등록할 때 같은 키가 나간다(공유계약 C-1).
 */
interface RegisterVariables {
  lotId: number;
  body: NonconformanceCreate;
}

interface RequestVariables {
  nonconformanceId: number;
  body: DispositionRequest;
}

const selectionKeyOf = (selection: Selection): string =>
  `${String(selection.lotId)}:${String(selection.nonconformanceId)}`;

/**
 * 목록 줄에 상세를 겹친다 — 등록 직후 목록이 아직 낡았을 때 상세가 이미 아는 부적합 번호·상태를
 * 화면이 먼저 따른다. 후보 줄의 입고 정보(반품 전표·거래처)는 상세에 없으므로 줄 쪽을 남긴다.
 */
const overlayDetail = (
  row: TargetRow | null,
  detail: Nonconformance | undefined,
): TargetRow | null => {
  if (detail === undefined) return row;
  const fromDetail = toNonconformanceRow(detail);
  if (row === null) return fromDetail;

  return {
    ...row,
    nonconformanceId: detail.nonconformanceId,
    nonconformanceNo: detail.nonconformanceNo,
    stage: stageOf(detail.statusCode),
    stageCodeText: detail.statusCode,
    quantity: row.quantity ?? fromDetail.quantity,
    qtyText: row.quantity === null ? fromDetail.qtyText : row.qtyText,
  };
};

export const DispositionRequestScreen = () => {
  const t = messages.dispositionRequest;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selection = useMemo(() => readSelection(searchParams), [searchParams]);
  const listQuery = useMemo(() => toListQuery(filters, page), [filters, page]);

  const list = useTargetList(listQuery);
  const detail = useNonconformanceDetail(selection.nonconformanceId);
  const decisions = useDecisions(selection.nonconformanceId);
  const uoms = useUomLookup();
  const severity = useSeverityOptions();
  const warehouses = useDefectWarehouseOptions();
  const departments = useDepartmentOptions();

  const rows = useMemo<TargetRow[]>(() => {
    if (list.data === undefined) return [];
    return list.data.source === 'candidates'
      ? list.data.data.items.map(toCandidateRow)
      : list.data.data.items.map(toNonconformanceRow);
  }, [list.data]);
  const pageView = toPageView(list.data?.data.page ?? { page, size: 0, total: 0 }, rows.length);

  /* 고른 줄 — 부적합이 있으면 그 번호로, 없으면 LOT으로 찾는다. 목록에 없어도 상세가 있으면 상세로 선다. */
  const matchedRow = useMemo(() => {
    if (!hasSelection(selection)) return null;
    return (
      rows.find(
        (row) =>
          (selection.nonconformanceId !== null &&
            row.nonconformanceId === selection.nonconformanceId) ||
          (selection.nonconformanceId === null &&
            selection.lotId !== null &&
            row.lotId === selection.lotId),
      ) ?? null
    );
  }, [rows, selection]);
  const activeRow = useMemo(
    () => overlayDetail(matchedRow, detail.data),
    [matchedRow, detail.data],
  );
  const activeRowKey = matchedRow?.key ?? null;

  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const decisionRows = useMemo(
    () => (decisions.data?.items ?? []).map(toDecisionRow),
    [decisions.data],
  );

  const [registerForm, setRegisterForm] =
    useState<NonconformanceFormValue>(EMPTY_NONCONFORMANCE_FORM);
  const [requestForm, setRequestForm] = useState<RequestFormValue>(defaultRequestForm(null));
  const [showRegisterErrors, setShowRegisterErrors] = useState(false);
  const [showRequestErrors, setShowRequestErrors] = useState(false);
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

  /* 선택이 바뀌면 두 폼을 비운다 — 다른 대상의 입력이 따라오지 않게. 의뢰 수량은 대상 전량이 기본이다. */
  const selectionKey = selectionKeyOf(selection);
  const activeQuantity = activeRow?.quantity ?? null;
  useEffect(() => {
    setRegisterForm(EMPTY_NONCONFORMANCE_FORM);
    setShowRegisterErrors(false);
    setShowRequestErrors(false);
  }, [selectionKey]);
  useEffect(() => {
    setRequestForm(defaultRequestForm(activeQuantity));
  }, [selectionKey, activeQuantity]);

  /** ① 부적합 등록 — 신규라 낙관적 잠금이 없다. 등록은 되돌릴 수 없어 키를 적용될 때까지 지킨다. */
  const register = useMasterWrite<RegisterVariables, Nonconformance>({
    request: (variables, headers) =>
      client.POST('/quality/nonconformances', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: variables.body,
      }),
    etagPath: null,
    invalidateKeys: [requestKeys.all],
    knownFields: ['severityCode', 'description', 'responsibleDepartmentId', 'lots'],
    keyLifetime: 'until-applied',
    onSuccess: (created) => {
      toast.show({ variant: 'success', description: t.register.success });
      setRegisterForm(EMPTY_NONCONFORMANCE_FORM);
      setShowRegisterErrors(false);
      /*
       * ⭐ 주소에 부적합 번호를 심는다 — 그래야 상세가 서고(잠금 토큰이 여기서 온다) ②가 열린다.
       * 목록이 다시 오기 전에도 화면은 「등록됐다」를 안다.
       */
      setSearchParams((current) =>
        withSelection(current, {
          lotId: activeRow?.lotId ?? null,
          nonconformanceId: created.nonconformanceId,
        }),
      );
    },
  });

  /**
   * ② 판정 의뢰 — 토큰은 부적합 «상세»가 내린다(공유계약 B-1). 상태 전이라 되돌릴 수 없고, 서버가
   * 거절한 409는 구조화 코드로 되말한다(`message` 원문은 표시하지 않는다 · 공유계약 A-9 ⓑ).
   */
  const request = useMasterWrite<RequestVariables, Nonconformance>({
    request: async (variables, headers) => {
      const result = await client.POST(
        '/quality/nonconformances/{nonconformanceId}:request-disposition',
        {
          params: {
            path: { nonconformanceId: variables.nonconformanceId },
            header: {
              'Idempotency-Key': headers['Idempotency-Key'],
              'If-Match': requireIfMatch(headers),
            },
          },
          body: variables.body,
        },
      );

      if (result.response.status !== 409 || !isRecord(result.error)) return result;

      const raw = result.error as Record<string, unknown>;
      if (raw.code === 'INVALID_STATE') {
        return { ...result, error: { ...raw, message: t.request.conflict.invalidState } };
      }
      if (raw.code === 'REQUESTED_QTY_EXCEEDED' || raw.code === 'DISPOSITION_QTY_EXCEEDED') {
        return { ...result, error: { ...raw, message: t.request.conflict.qtyExceeded } };
      }

      return result;
    },
    etagPath:
      selection.nonconformanceId === null
        ? null
        : nonconformanceDetailPath(selection.nonconformanceId),
    invalidateKeys: [requestKeys.all],
    knownFields: ['requestedQty', 'uomId', 'remarks'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.request.success });
      setShowRequestErrors(false);
    },
  });

  const registerErrors = { ...validateNonconformanceForm(registerForm), ...register.fieldErrors };
  const requestErrors = {
    ...validateRequestForm(requestForm, activeQuantity),
    ...request.fieldErrors,
  };
  const registerLock = toRegisterLock({
    row: activeRow,
    severityReady: severity.options.length > 0,
    isSaving: register.isSaving,
    writeError: register.error,
  });
  const requestLock = toRequestLock({
    row: activeRow,
    detail: {
      isPending: detail.isPending && selection.nonconformanceId !== null,
      isError: detail.isError,
    },
    isSaving: request.isSaving,
    writeError: request.error,
  });
  const uomLabel = activeRow === null ? '' : lookupDisplayLabel(uoms, activeRow.uomId);

  const apply = (next: TargetFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };

  const select = (row: TargetRow): void => {
    const same = row.key === activeRowKey;
    setSearchParams((current) =>
      withSelection(
        current,
        same
          ? { lotId: null, nonconformanceId: null }
          : { lotId: row.lotId, nonconformanceId: row.nonconformanceId },
      ),
    );
  };

  const saveRegister = (): void => {
    setShowRegisterErrors(true);
    if (activeRow === null || activeRow.lotId === null) return;
    const body = toNonconformanceCreateBody(registerForm, activeRow);
    if (body === undefined) return;
    register.write({ lotId: activeRow.lotId, body });
  };

  const saveRequest = (): void => {
    setShowRequestErrors(true);
    if (activeRow === null || activeRow.nonconformanceId === null) return;
    const body = toDispositionRequestBody(requestForm, activeQuantity, activeRow.uomId);
    if (body === undefined) return;
    request.write({ nonconformanceId: activeRow.nonconformanceId, body });
  };

  /**
   * 적용 여부를 모르는 저장에서 빠져나가는 길 — 서버 상태를 다시 읽고 오류 표시를 지운다.
   * **멱등 키는 버리지 않는다**(훅이 그렇게 둔다).
   */
  const checkOutcome = (): void => {
    void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    register.reset();
    request.reset();
  };

  const steps = toProgressSteps(activeRow?.stage ?? null, activeRow !== null);
  const followUp = toFollowUpStates(decisionRows);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      {/* 이 화면이 «하지 않는 것»을 상단에 상시 적는다 — 판정 버튼을 찾다가 못 찾게 하지 않는다(§5-1). */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.scopeNotice}</AlertBanner>
      </div>
      <div className="disposition-request-workspace">
        <section
          className="pane disposition-request-pane disposition-request-list-pane"
          aria-label={t.panes.list}
        >
          <h2 className="pane-title">{t.panes.list}</h2>
          <FilterBar
            applied={filters}
            warehouses={warehouses}
            onApply={(next) => apply(next)}
            onReset={() => apply(EMPTY_FILTERS)}
          />
          <TargetList
            rows={rows}
            isLoading={list.isPending}
            error={
              list.isError ? (
                <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
              ) : null
            }
            page={pageView}
            selectedKey={activeRowKey}
            onSelect={select}
            onChangePage={(nextPage) => apply(filters, nextPage)}
          />
        </section>
        <div className="pane-stack disposition-request-side">
          <section className="pane disposition-request-pane" aria-label={t.panes.target}>
            <h2 className="pane-title">{t.panes.target}</h2>
            <TargetHeader
              row={activeRow}
              detail={{
                isPending: detail.isPending && selection.nonconformanceId !== null,
                isError: detail.isError,
                isNotFound: isDetailNotFound,
                error: detail.error,
                view: detail.data ?? null,
              }}
              uoms={uoms}
              onRetry={() => void detail.refetch()}
            />
            <ProgressStepper steps={steps} />
          </section>
          <section className="pane disposition-request-pane" aria-label={t.panes.register}>
            <h2 className="pane-title">{t.panes.register}</h2>
            <RegisterPane
              value={registerForm}
              errors={showRegisterErrors ? registerErrors : register.fieldErrors}
              warning={descriptionWarning(registerForm)}
              severity={severity}
              departments={departments}
              qtyNote={
                activeRow === null ||
                activeRow.quantity === null ||
                activeRow.nonconformanceId !== null
                  ? undefined
                  : t.register.qtyNote(formatQty(activeRow.quantity), uomLabel)
              }
              lock={registerLock}
              onCheckOutcome={checkOutcome}
              writeError={register.error}
              isSaving={register.isSaving}
              canCancel={hasNonconformanceInput(registerForm)}
              onChange={(next) => {
                if (next.severityCode !== registerForm.severityCode)
                  register.clearFieldError('severityCode');
                if (next.description !== registerForm.description)
                  register.clearFieldError('description');
                setRegisterForm(next);
              }}
              onSave={saveRegister}
              onCancel={() => {
                setRegisterForm(EMPTY_NONCONFORMANCE_FORM);
                setShowRegisterErrors(false);
                register.reset();
              }}
              onReload={checkOutcome}
            />
          </section>
          <section className="pane disposition-request-pane" aria-label={t.panes.request}>
            <h2 className="pane-title">{t.panes.request}</h2>
            <RequestPane
              value={requestForm}
              errors={showRequestErrors ? requestErrors : request.fieldErrors}
              maxQtyText={formatQty(activeQuantity)}
              uomLabel={uomLabel}
              lock={requestLock}
              onCheckOutcome={checkOutcome}
              writeError={request.error}
              isSaving={request.isSaving}
              canCancel={hasRequestInput(requestForm, activeQuantity)}
              onChange={(next) => {
                if (next.qty !== requestForm.qty) request.clearFieldError('requestedQty');
                setRequestForm(next);
              }}
              onSave={saveRequest}
              onCancel={() => {
                setRequestForm(defaultRequestForm(activeQuantity));
                setShowRequestErrors(false);
                request.reset();
              }}
              onReload={checkOutcome}
            />
          </section>
          <section className="pane disposition-request-pane" aria-label={t.panes.result}>
            <h2 className="pane-title">{t.panes.result}</h2>
            <ResultPane
              nonconformanceId={activeRow?.nonconformanceId ?? null}
              stage={activeRow?.stage ?? null}
              decisions={{
                rows: decisionRows,
                isLoading: decisions.isPending && selection.nonconformanceId !== null,
                isError: decisions.isError,
                error: decisions.error,
              }}
              followUp={followUp}
              uoms={uoms}
              onRetry={() => void decisions.refetch()}
            />
          </section>
        </div>
      </div>
    </>
  );
};
