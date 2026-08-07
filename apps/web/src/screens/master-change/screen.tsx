import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { ChangeDetailDialog } from './change-detail-dialog';
import { EventFilterBar } from './event-filter-bar';
import { EventTable } from './event-table';
import {
  PLACEHOLDER_EVENT_TYPE_CODES,
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
  type EventFilters,
} from './filters';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { defaultPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useAuditEventList, useFilterOptions } from './queries';

const t = messages.masterChange;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 이 화면은 쓰기가 없어 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
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
 * W-06-11 컨테이너 — 이 저장소의 **첫 읽기 전용 조회 형 화면**이다.
 *
 * 읽는 것이 주 동작이고 편집 폼이 없어 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 */
export const MasterChangeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const newRevisionReasonId = useId();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 창이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * | # | 조작 | `page` | `sel` | 왜 |
   * | :-: | --- | --- | --- | --- |
   * | 1 | 조건·기간 변경 · 초기화 | **첫 쪽으로** | **비운다** | 결과가 통째로 달라진다. 3쪽을 보다 조건을 좁히면 빈 쪽이 되고, 열린 창의 건은 새 결과에 없을 수 있다 |
   * | 2 | 쪽 이동 | 옮긴 쪽 | **비운다** | 다른 행이 온다. 열린 창의 건은 그 쪽에 없다 |
   * | 3 | 창 열기·닫기 | **유지한다** | 여닫는다 | 보이는 행이 그대로다. 쪽까지 되돌리면 3쪽에서 창을 한 번 열었다고 1쪽으로 튄다 |
   * | 4 | 갱신된 결과에 고른 건이 없음 | 유지한다 | **비운다** | 화면에 없는 건을 창이 가리키면 안 된다 |
   *
   * 1·2·3은 `toSearchParams`가 **`sel`을 만들지 않는 것**으로 함께 지켜진다 — 여는 쪽만 덧붙인다.
   * 4는 아래 정리 effect가 한다. **비우는 자리는 이 넷뿐이고**, 다섯째가 생기면 이 표에 행을 먼저 더한다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다.
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「치던 날짜가 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const period = useMemo<PeriodInput>(
    () => ({ from: searchParams.get('from') ?? '', to: searchParams.get('to') ?? '' }),
    [searchParams],
  );
  const filters = useMemo<EventFilters>(() => readFilters(searchParams), [searchParams]);
  const hasPeriodParams = searchParams.has('from') || searchParams.has('to');
  const page = readPage(searchParams);
  /**
   * 변경 내용 창을 연 이력 번호. **주소에 둔다** — 새로고침·공유가 같은 창을 열어야 한다.
   * 요청에는 실리지 않는다. 창의 자료는 목록 응답에 이미 들어 있다.
   */
  const selectedId = Number(searchParams.get('sel') ?? '') || null;

  /*
   * 빈 화면으로 시작하지 않는다 — 매번 날짜를 고르는 비용이 크다.
   * 주소에 기간이 아예 없을 때만 채운다. 비운 채로 들어온 주소(`?from=&to=`)는 사용자의 뜻이므로
   * 덮지 않고 「기간을 고르고 조회하세요」로 안내한다.
   * replace로 바꿔 뒤로가기가 빈 주소로 되돌아가지 않게 한다.
   */
  useEffect(() => {
    if (hasPeriodParams) return;

    const seeded = defaultPeriod(new Date());

    /*
     * **기간만 채운다.** 주소를 통째로 갈아 끼우면 공유받은 주소의 조건·쪽이 조용히 사라져
     * 받은 사람과 보낸 사람이 서로 다른 결과를 본다.
     */
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('from', seeded.from);
        next.set('to', seeded.to);

        return next;
      },
      { replace: true },
    );
  }, [hasPeriodParams, setSearchParams]);

  /*
   * 실행 환경의 시간대를 한 번만 읽어 넘긴다. 변환 함수 안에서 읽으면
   * 그 함수가 환경에 따라 다른 값을 내어 테스트가 환경을 검사하게 된다.
   */
  const offsetMinutes = -new Date().getTimezoneOffset();

  const periodReason = validatePeriod(period);
  const periodQuery = periodReason === null ? toPeriodQuery(period, offsetMinutes) : null;
  const listQuery =
    periodQuery === null
      ? null
      : { ...periodQuery, ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useAuditEventList(listQuery);
  const rows = list.data?.items ?? [];
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * 선택지는 **같은 기간에 다른 조건 없이** 조회한 결과에서 만든다.
   * 좁아진 목록에서 뽑으면 대상 종류를 고른 순간 선택지가 그 값 하나로 줄어 되돌릴 수 없다.
   *
   * 조건이 하나도 걸리지 않은 첫 쪽에서는 **목록 조회가 곧 그 「조건 없는 조회」**다.
   * 그럴 때 따로 부르면 같은 경로로 똑같은 요청이 한 번 더 나간다.
   */
  const needsOptionQuery = hasAnyFilter(filters) || page > 1;
  const options = useFilterOptions(needsOptionQuery ? periodQuery : null);
  const optionRows = needsOptionQuery ? options.rows : rows;

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 1행) — 3쪽을 보다가 조건을 좁히면
   * 결과가 3쪽에 못 미쳐 사용자에게는 「조건을 좁혔더니 아무것도 없다」로 보인다.
   * `toSearchParams`가 `sel`을 만들지 않으므로 열려 있던 창도 함께 닫힌다.
   */
  const applyQuery = (nextPeriod: PeriodInput, nextFilters: EventFilters, nextPage = 1) => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage));
  };

  /**
   * 창이 가리키는 건. **목록 응답에서 찾는다** — 계약에 상세 조회 경로가 없고,
   * 전후 값이 목록 응답에 이미 들어 있어 창을 열 때 요청이 나갈 이유가 없다.
   */
  const selectedRow = rows.find((row) => row.auditEventId === selectedId) ?? null;

  /*
   * 창을 열고 닫는 것은 **보이는 행을 바꾸지 않는다**(수명 규칙 3행) — 쪽·조건을 건드리지 않는다.
   * 닫기를 `applyQuery`로 처리하면 3쪽에서 창을 한 번 열었다는 이유로 1쪽으로 튄다.
   */
  const openDiff = (id: number) => {
    const next = toSearchParams(period, filters, page);
    next.set('sel', String(id));
    setSearchParams(next);
  };

  const closeDiff = () => {
    setSearchParams(toSearchParams(period, filters, page));
  };

  /*
   * 갱신된 결과에 고른 건이 없으면 `sel`을 주소에서 뗀다(수명 규칙 4행).
   * 남겨 두면 창이 화면에 없는 건을 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `sel`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 건이 사라졌다」로 읽혀 창이 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다 — 뒤로 눌렀는데 같은 자리로
   * 돌아오는 것처럼 보이면 안 된다.
   */
  useEffect(() => {
    if (selectedId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.auditEventId === selectedId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('sel');

        return next;
      },
      { replace: true },
    );
  }, [selectedId, list.data, setSearchParams]);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        /*
         * 배치 규범 4 — 개정 발행은 여기서 할 수 없지만 **버튼을 감추지 않는다.**
         * 감추면 개정 발행이 어디서 이루어지는지 화면에서 알 방법이 없어진다.
         *
         * `outlined`인 이유는 비활성일 때도 테두리가 남아 버튼으로 읽히기 때문이다 —
         * `text`는 라벨로 읽힌다. 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해
         * `aria-describedby`로 잇는다. 비활성 컨트롤은 포커스를 받지 못해
         * 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
         *
         * **이동 수단을 붙이지 않는다.** 대상 식별자가 어느 표를 가리키는지 데이터로
         * 판정되지 않아 어디로 보낼지 화면이 알 수 없다.
         */
        actions={
          <div className="field-cell">
            <Button variant="outlined" disabled aria-describedby={newRevisionReasonId}>
              {t.actions.newRevision}
            </Button>
            <span id={newRevisionReasonId} className="field-note">
              {t.reasons.newRevisionElsewhere}
            </span>
          </div>
        }
      />

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      <section className="pane" aria-label={t.title}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <EventFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          targetTypeOptions={toCodeOptions(
            PLACEHOLDER_TARGET_TYPE_CODES,
            optionRows,
            (row) => row.targetTypeCode,
            filters.targetType,
          )}
          eventTypeOptions={toCodeOptions(
            PLACEHOLDER_EVENT_TYPE_CODES,
            optionRows,
            (row) => row.eventTypeCode,
            filters.eventType,
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

        {/*
         * 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「기록이 없습니다」로 보이면 안 된다.
         * 권한 없음(403)도 같은 갈래다. 계약이 「진입 차단 + 배너」로 정했다.
         */}
        {!list.isError && (
          <>
            <EventTable
              rows={rows}
              isLoading={listQuery !== null && list.isPending}
              hasPeriod={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              onFirstPage={() => {
                applyQuery(period, filters);
              }}
              onOpenDiff={openDiff}
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

      {/* 열 때만 마운트된다 — 부품이 `row`가 null이면 아무것도 렌더하지 않는다. */}
      <ChangeDetailDialog row={selectedRow} onClose={closeDiff} />
    </>
  );
};
