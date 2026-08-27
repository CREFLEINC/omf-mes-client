import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  EMPTY_DECISION_FORM,
  hasDecisionInput,
  remainingNotice,
  toDecisionCreateBody,
  validateDecisionForm,
  type DecisionCreateBody,
  type DecisionFormValue,
} from './decision-form';
import { DecisionFormPane } from './decision-form-pane';
import { toDecisionLock } from './decision-lock';
import { DetailSlot } from './detail-slot';
import {
  DISPOSITION_TYPE_CODES,
  NONCONFORMANCE_STATUS_CODES,
  SEVERITY_CODES,
  scopeWarning,
  toCodeOptions,
} from './disposition-codes';
import { FilterBar } from './filter-bar';
import {
  readPage,
  readPendingFilters,
  readSelectedNonconformanceId,
  toAppliedSearchParams,
  toPendingListQuery,
  withSelectedNonconformance,
  type PendingFilters,
} from './filters';
import { LoadErrorBanner } from './load-error';
import { useItemLookup, useUomLookup } from './lookups';
import { NonconformanceList } from './nonconformance-list';
import { toPageView } from './pagination';
import { defaultPeriod } from './period';
import {
  dispositionKeys,
  nonconformanceDetailPath,
  useDispositionDecisions,
  useNonconformanceDetail,
  usePendingNonconformances,
} from './queries';
import { toRemainingQty } from './remaining-qty';
import {
  decisionUomIdOf,
  toDecisionRow,
  toDetailView,
  toNonconformanceRow,
  type Nonconformance,
} from './types';

const EMPTY_NONCONFORMANCES: Nonconformance[] = [];

export interface DispositionDecisionScreenProps {
  dispositionTypeCodes?: readonly string[];
  severityCodes?: readonly string[];
  statusCodes?: readonly string[];
  /** 기본 기간을 정하는 기준 날. 감지기가 실행하는 날에 결과가 좌우되지 않게 밖에서 받는다. */
  today?: Date;
  /** UTC 기준 분. 기본은 브라우저의 시간대다. */
  offsetMinutes?: number;
}

export const DispositionDecisionScreen = ({
  dispositionTypeCodes = DISPOSITION_TYPE_CODES,
  severityCodes = SEVERITY_CODES,
  statusCodes = NONCONFORMANCE_STATUS_CODES,
  today,
  offsetMinutes,
}: DispositionDecisionScreenProps = {}) => {
  const t = messages.dispositionDecision;
  const [searchParams, setSearchParams] = useSearchParams();
  const baseDate = useMemo(() => today ?? new Date(), [today]);
  const zone = useMemo(
    () => offsetMinutes ?? -baseDate.getTimezoneOffset(),
    [baseDate, offsetMinutes],
  );

  const filters = useMemo(
    () => readPendingFilters(searchParams, baseDate, severityCodes, statusCodes),
    [baseDate, searchParams, severityCodes, statusCodes],
  );
  const page = readPage(searchParams);
  const selectedId = readSelectedNonconformanceId(searchParams);
  /*
   * 기간이 막히면 `null`이고 조회가 열리지 않는다.
   *
   * ⚠ **이 화면에서는 그 갈래에 닿지 않는다** — `readPendingFilters`가 쓸 수 없는 기간을 최근
   * 한 달로 되돌리기 때문이다(L-3). 그래서 「막혔을 때」를 위한 방어 분기를 여기 두지 않는다 —
   * 닿지 않는 분기는 감지기가 물 수 없고, 물지 못하는 코드는 조용히 썩는다.
   * 갈래 자체는 조회 조건 쪽이 타입으로 들고 있어, 되돌리기를 없애면 컴파일이 먼저 잡는다.
   */
  const query = useMemo(() => toPendingListQuery(filters, page, zone), [filters, page, zone]);

  const list = usePendingNonconformances(query);
  const detail = useNonconformanceDetail(selectedId);
  const decisions = useDispositionDecisions(selectedId);
  const items = useItemLookup();
  const uoms = useUomLookup();

  const rows = useMemo(
    () => (list.data?.items ?? EMPTY_NONCONFORMANCES).map(toNonconformanceRow),
    [list.data],
  );
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const remaining = toRemainingQty(detail.data?.lots, decisions.data?.items);
  const uomId = decisionUomIdOf(detail.data?.lots);
  const decisionRows = useMemo(
    () => (decisions.data?.items ?? []).map(toDecisionRow),
    [decisions.data],
  );

  const [form, setForm] = useState<DecisionFormValue>(EMPTY_DECISION_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const { client } = useApiClient();
  const toast = useToast();

  const write = useMasterWrite<DecisionCreateBody, unknown>({
    request: (variables, headers) => {
      if (selectedId === null) throw new Error('부적합을 고르기 전에는 저장하지 않습니다.');

      return client.POST('/quality/nonconformances/{nonconformanceId}/disposition-decisions', {
        params: {
          path: { nonconformanceId: selectedId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'],
          },
        },
        body: variables,
      });
    },
    /* ⭐ 토큰은 부적합 «상세»가 내린다 — 저장 경로가 아니다(공유계약 B-1). */
    etagPath: selectedId === null ? null : nonconformanceDetailPath(selectedId),
    /* ⚠ 참조 이름 조회는 뿌리 키가 갈려 있어 여기 걸리지 않는다 — 판정으로 바뀌지 않는 값이다. */
    invalidateKeys: [dispositionKeys.all],
    knownFields: ['dispositionTypeCode', 'decisionQty', 'uomId', 'reason'],
    /* 되돌릴 수 없는 쓰기다 — 취소 API가 없고 LOT 상태 전이를 함께 부른다(공유계약 B-8). */
    keyLifetime: 'until-applied',
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.form.success });
      setForm(EMPTY_DECISION_FORM);
      setShowErrors(false);
    },
  });

  useEffect(() => {
    setForm(EMPTY_DECISION_FORM);
    setShowErrors(false);
  }, [selectedId]);

  /* 서버가 되돌린 필드 오류가 화면 검증을 덮는다 — 계약이 정본이다. */
  const errors = { ...validateDecisionForm(form), ...write.fieldErrors };
  const lock = toDecisionLock({
    selectedId,
    isSaving: write.isSaving,
    writeError: write.error,
    detailError,
    uomId,
    dispositionTypeCodes,
  });

  const apply = (next: PendingFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };

  const save = (): void => {
    setShowErrors(true);
    /*
     * 잠긴 동안에는 저장 버튼이 눌리지 않으므로 여기서 잠금을 다시 보지 않는다 —
     * 닿지 않는 분기는 감지기가 물 수 없다. 단위 좁히기만 남는다(타입이 요구한다).
     */
    if (uomId === undefined) return;

    /* 검증을 통과하지 못하면 본문이 만들어지지 않는다 — 그 자체가 마지막 문이다. */
    const body = toDecisionCreateBody(form, uomId);
    if (body === undefined) return;

    write.write(body);
  };

  /**
   * 적용 여부를 모르는 저장에서 빠져나가는 길.
   * 서버 상태를 다시 읽고 오류 표시를 지운다 — **멱등 키는 버리지 않는다**(훅이 그렇게 둔다).
   */
  const checkOutcome = (): void => {
    void detail.refetch();
    void decisions.refetch();
    write.reset();
  };

  const codeNotice = scopeWarning(severityCodes, statusCodes);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <div className="three-pane">
        <section className="pane" aria-label={t.panes.list}>
          <FilterBar
            applied={filters}
            severityOptions={toCodeOptions(severityCodes)}
            statusOptions={toCodeOptions(statusCodes)}
            items={items}
            onApply={(next) => apply(next)}
            onReset={() =>
              apply({ ...defaultPeriod(baseDate), itemId: '', severityCode: '', statusCode: '' })
            }
          />
          {codeNotice !== undefined && (
            <div className="banner-slot">
              <AlertBanner variant="info">{codeNotice}</AlertBanner>
            </div>
          )}
          <NonconformanceList
            rows={rows}
            items={items}
            isLoading={list.isPending}
            error={
              list.isError ? (
                <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
              ) : null
            }
            page={pageView}
            selectedId={selectedId}
            onSelect={(id) =>
              setSearchParams((current) =>
                withSelectedNonconformance(current, selectedId === id ? null : id),
              )
            }
            onChangePage={(nextPage) => apply(filters, nextPage)}
          />
        </section>
        <section className="pane" aria-label={t.panes.detail}>
          <DetailSlot
            selectedId={selectedId}
            detail={{
              isPending: detail.isPending,
              isError: detail.isError,
              isNotFound: isDetailNotFound,
              error: detail.error,
              view: detail.data === undefined ? null : toDetailView(detail.data),
            }}
            decisions={{
              rows: decisionRows,
              isLoading: decisions.isPending,
              isError: decisions.isError,
            }}
            remaining={remaining}
            items={items}
            uoms={uoms}
            onRetry={() => void detail.refetch()}
          />
        </section>
        <section className="pane" aria-label={t.panes.decision}>
          <DecisionFormPane
            value={form}
            errors={showErrors ? errors : write.fieldErrors}
            qtyNotice={remainingNotice(form, remaining)}
            lockReason={lock.reason}
            isUncertain={lock.isUncertain}
            onCheckOutcome={checkOutcome}
            dispositionOptions={toCodeOptions(dispositionTypeCodes)}
            uomId={uomId}
            uoms={uoms}
            writeError={write.error}
            isSaving={write.isSaving}
            canCancel={hasDecisionInput(form)}
            onChange={(next) => {
              /* 고친 칸의 서버 오류만 지운다 — 남은 칸의 오류까지 지우면 못 본 채 다시 보낸다. */
              if (next.dispositionTypeCode !== form.dispositionTypeCode)
                write.clearFieldError('dispositionTypeCode');
              if (next.qty !== form.qty) write.clearFieldError('decisionQty');
              if (next.reason !== form.reason) write.clearFieldError('reason');
              setForm(next);
            }}
            onSave={save}
            onCancel={() => {
              setForm(EMPTY_DECISION_FORM);
              setShowErrors(false);
            }}
            onReload={checkOutcome}
          />
        </section>
      </div>
    </>
  );
};
