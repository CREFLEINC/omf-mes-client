import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  PLACEHOLDER_DIRECTION_CODES,
  PLACEHOLDER_INTERFACE_CODES,
  PLACEHOLDER_STATUS_CODES,
  PLACEHOLDER_TARGET_TYPE_CODES,
  toCodeOptions,
} from './filter-options';
import {
  EMPTY_FILTERS,
  hasAnyFilter,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type MessageFilters,
} from './filters';
import { MessageFilterBar } from './message-filter-bar';
import { MessageTable } from './message-table';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { defaultPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useFilterOptions, useMessageList } from './queries';

const t = messages.integrationSync;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 다른 화면 슬라이스에도 같은 함수가 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      // 서버가 빈 message를 주는 일이 실제로 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/** 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매를 붙인다. */
const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * W-06-10 컨테이너 — 이 저장소의 **첫 조회 형 화면**이다.
 *
 * 목록을 읽는 것이 주 동작이라 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 */
export const IntegrationSyncScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const period: PeriodInput = {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  };
  const hasPeriodParams = searchParams.has('from') || searchParams.has('to');
  const filters = readFilters(searchParams);
  const page = readPage(searchParams);

  /*
   * 빈 화면으로 시작하지 않는다 — 매번 날짜를 고르는 비용이 크다.
   * 주소에 기간이 아예 없을 때만 채운다. 비운 채로 들어온 주소(`?from=&to=`)는 사용자의 뜻이므로
   * 덮지 않고 「기간을 고르고 조회하세요」로 안내한다.
   * replace로 바꿔 뒤로가기가 빈 주소로 되돌아가지 않게 한다.
   */
  useEffect(() => {
    if (hasPeriodParams) return;

    const seeded = defaultPeriod(new Date());
    setSearchParams(new URLSearchParams({ from: seeded.from, to: seeded.to }), { replace: true });
  }, [hasPeriodParams, setSearchParams]);

  /*
   * 실행 환경의 시간대를 한 번만 읽어 넘긴다. 변환 함수 안에서 읽으면
   * 그 함수가 환경에 따라 다른 값을 내어 테스트가 환경을 검사하게 된다.
   */
  const offsetMinutes = -new Date().getTimezoneOffset();
  const now = new Date();

  const periodReason = validatePeriod(period);
  const periodQuery = periodReason === null ? toPeriodQuery(period, offsetMinutes) : null;
  const listQuery =
    periodQuery === null
      ? null
      : { ...periodQuery, ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useMessageList(listQuery);
  const rows = list.data?.items ?? [];
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * 선택지는 **같은 기간에 다른 조건 없이** 조회한 결과에서 만든다.
   * 목록이 좁아진 결과에서 뽑으면 상태를 고른 순간 선택지가 그 값 하나로 줄어 되돌릴 수 없다.
   *
   * 조건이 하나도 걸리지 않은 첫 쪽에서는 **목록 조회가 곧 그 「조건 없는 조회」**다.
   * 그럴 때 따로 부르면 같은 경로로 똑같은 요청이 한 번 더 나간다.
   */
  const needsOptionQuery = hasAnyFilter(filters) || page > 1;
  const options = useFilterOptions(needsOptionQuery ? periodQuery : null);
  const optionRows = needsOptionQuery ? options.rows : rows;

  /**
   * 조건을 주소에 반영한다. **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다** —
   * 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐 사용자에게는
   * 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (nextPeriod: PeriodInput, nextFilters: MessageFilters, nextPage = 1) => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage));
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      <section className="pane" aria-label={t.title}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <MessageFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          statusOptions={toCodeOptions(
            PLACEHOLDER_STATUS_CODES,
            optionRows,
            (row) => row.statusCode,
            filters.status,
          )}
          interfaceOptions={toCodeOptions(
            PLACEHOLDER_INTERFACE_CODES,
            optionRows,
            (row) => row.interfaceCode,
            filters.iface,
          )}
          directionOptions={toCodeOptions(
            PLACEHOLDER_DIRECTION_CODES,
            optionRows,
            (row) => row.directionCode,
            filters.direction,
          )}
          targetTypeOptions={toCodeOptions(
            PLACEHOLDER_TARGET_TYPE_CODES,
            optionRows,
            (row) => row.targetTypeCode,
            filters.targetType,
          )}
          onSearch={(nextPeriod, nextFilters) => {
            applyQuery(nextPeriod, nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery(defaultPeriod(new Date()), EMPTY_FILTERS);
          }}
        />

        {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「기록이 없습니다」로 보이면 안 된다. */}
        {!list.isError && (
          <>
            <MessageTable
              rows={rows}
              isLoading={listQuery !== null && list.isPending}
              hasPeriod={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              onFirstPage={() => {
                applyQuery(period, filters);
              }}
              now={now}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(period, filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );
};
