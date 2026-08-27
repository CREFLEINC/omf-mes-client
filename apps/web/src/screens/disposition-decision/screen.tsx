import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { DetailSlot } from './detail-slot';
import {
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
  useDispositionDecisions,
  useNonconformanceDetail,
  usePendingNonconformances,
} from './queries';
import { toRemainingQty } from './remaining-qty';
import { toDecisionRow, toDetailView, toNonconformanceRow, type Nonconformance } from './types';

const EMPTY_NONCONFORMANCES: Nonconformance[] = [];

/**
 * ⚠ **판정 칸(③)은 아직 붙지 않았다.** 되돌릴 수 없는 쓰기라, 배선을 그 쓰기를 지키는
 * 감지기와 **함께** 다음 슬라이스에 둔다 — 코드만 먼저 들어가면 그 경로에서 뮤테이션 확인이
 * 성립하지 않는다. 이 슬라이스는 조회·선택까지다. 라우트도 아직 등록하지 않았다.
 */
export interface DispositionDecisionScreenProps {
  severityCodes?: readonly string[];
  statusCodes?: readonly string[];
  /** 기본 기간을 정하는 기준 날. 감지기가 실행하는 날에 결과가 좌우되지 않게 밖에서 받는다. */
  today?: Date;
  /** UTC 기준 분. 기본은 브라우저의 시간대다. */
  offsetMinutes?: number;
}

export const DispositionDecisionScreen = ({
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
  const decisionRows = useMemo(
    () => (decisions.data?.items ?? []).map(toDecisionRow),
    [decisions.data],
  );

  const apply = (next: PendingFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };

  const codeNotice = scopeWarning(severityCodes, statusCodes);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <div className="two-pane">
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
      </div>
    </>
  );
};
