import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { AsnFilterBar } from './asn-filter-bar';
import { AsnLineTable } from './asn-line-table';
import { AsnTable } from './asn-table';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSelectedId,
  toFilterQuery,
  toSearchParams,
  type AsnFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { readPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useAsnLines, useAsnList } from './queries';
import { PLACEHOLDER_ASN_STATUS_CODES, toStatusOptions } from './status-options';
import type { AsnLineView, AsnView, SelectOption } from './types';

const t = messages.inboundSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: AsnView[] = [];
const EMPTY_LINES: AsnLineView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 건의 이름을 풀기 위해서인데, 그 건들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다 — 조회 전용 화면이고 ERP 수신본에는 그런 건이 실제로 온다.
 * 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-09 컨테이너 — **자재창고 도메인의 첫 화면**이다.
 *
 * 조회 전용이라 편집 폼이 없다. 배치는 상하 2단이다 — 위 표(입하 예정) 아래 표(고른 건의 라인).
 * 조회 조건과 고른 건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * 뒤따르는 W-01 화면들이 이 골격을 그대로 복제하므로, **가로지르는 결함 #43·#44·#47을
 * 여기서 재생산하지 않는다** — 재생산하면 도메인 전체로 번진다.
 */
export const InboundScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 표가 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * | # | 조작 | `page` | `sel` | 왜 |
   * | :-: | --- | --- | --- | --- |
   * | 1 | 조건·기간 변경 · 초기화 | **첫 쪽으로** | **비운다** | 결과가 통째로 달라진다. 고른 건이 새 결과에 없을 수 있다 |
   * | 2 | 쪽 이동 | 옮긴 쪽 | **비운다** | 다른 행이 온다 |
   * | 3 | 건 고르기·해제 | **유지한다** | 넣고 뺀다 | 보이는 행이 그대로다. 쪽까지 되돌리면 3쪽에서 한 건 골랐다고 1쪽으로 튄다 |
   * | 4 | 갱신된 결과에 고른 건이 없음 | 유지한다 | **비운다** | 화면에 없는 건의 라인을 아래 표가 그리면 안 된다 |
   *
   * 1·2·3은 `toSearchParams`가 **`sel`을 만들지 않는 것**으로 함께 지켜진다 — 고르는 쪽만 덧붙인다.
   * 4는 아래 정리 effect가 한다. **비우는 자리는 이 넷뿐이고**, 다섯째가 생기면 이 표에 행을 먼저 더한다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「치던 값이 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const period = useMemo<PeriodInput>(() => readPeriod(searchParams), [searchParams]);
  const filters = useMemo<AsnFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  /*
   * 실행 환경의 「오늘」을 한 번만 읽어 넘긴다. 경과 판정 함수 안에서 읽으면
   * 그 함수가 환경에 따라 다른 값을 내어 테스트가 환경을 검사하게 된다.
   */
  const today = new Date();

  /*
   * **조건이 하나도 없어도 조회한다** — 이 경로는 파티션 테이블이 아니라 기간이 필수가 아니다.
   * 조회를 멈추는 것은 보내면 반드시 400이 되는 기간뿐이다(없는 날짜·뒤집힌 기간).
   */
  const periodReason = validatePeriod(period);
  const listQuery =
    periodReason === null
      ? { ...toPeriodQuery(period), ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) }
      : null;

  const list = useAsnList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const items = useItemOptions();
  /* 단위는 아래 표만 쓴다 — 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 는다. */
  const uoms = useUomOptions(selectedId !== null);

  const lines = useAsnLines(selectedId);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 1행) — 3쪽을 보다가 조건을 좁히면
   * 결과가 3쪽에 못 미쳐 사용자에게는 「조건을 좁혔더니 아무것도 없다」로 보인다.
   * `toSearchParams`가 `sel`을 만들지 않으므로 고른 건도 함께 풀린다.
   */
  const applyQuery = (nextPeriod: PeriodInput, nextFilters: AsnFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage));
  };

  /**
   * 고른 건. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있어
   * 상세 경로를 부를 이유가 없다(계획 결정 7).
   */
  const selectedRow = rows.find((row) => row.asnId === selectedId) ?? null;

  /*
   * 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 규칙 3행) — 쪽·조건을 건드리지 않는다.
   */
  const toggleSelect = (asnId: number): void => {
    const next = toSearchParams(period, filters, page);

    if (asnId !== selectedId) next.set('sel', String(asnId));

    setSearchParams(next);
  };

  /*
   * 갱신된 결과에 고른 건이 없으면 `sel`을 주소에서 뗀다(수명 규칙 4행).
   * 남겨 두면 아래 표가 화면에 없는 건을 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `sel`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 건이 사라졌다」로 읽혀 아래 표가 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.asnId === selectedId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('sel');

        return next;
      },
      { replace: true },
    );
  }, [selectedId, list.data, setSearchParams]);

  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );
  const itemReference = toReference(items, filters.item === '' ? null : Number(filters.item));

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다.
   *
   * 나누는 기준은 「그 이름이 어느 구획에서 보이는가」다. 실패 안내와 「다시 시도」는
   * 그 이름이 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있고,
   * **안내 문구가 적은 대상과 다시 부르는 대상이 어긋나지 않는다** — 어긋나면 눌러도
   * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
   *
   * | 참조 | 보이는 자리 | 복구 |
   * | --- | --- | --- |
   * | 공급사 | 위 표의 칸 · 조건 칩 | 위 구획 |
   * | 품목 · 단위 | 아래 표의 칸 | 아래 구획 |
   * | **공장** | **고른 건의 제목줄뿐** | **아래 구획** |
   *
   * 공장이 아래에 있는 이유가 이 표의 요점이다 — 위 표에는 공장 열이 없어(폭 예산상
   * 제목줄로 보냈다) 위 구획에 두면 **보이지도 않는 실패의 복구 버튼**이 된다.
   */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    plants.refetch();
  };

  /** 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const linePane = (): ReactNode => {
    if (selectedId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /*
     * 고른 번호는 있는데 그 행이 아직 없다 — 목록을 기다리는 중이다.
     * 정리 effect가 결과를 보고 판정할 때까지는 「고르지 않았다」로 되돌리지 않는다.
     */
    if (selectedRow === null) {
      return (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (lines.isError) {
      return (
        <LoadErrorBanner
          error={lines.error}
          onRetry={() => {
            void lines.refetch();
          }}
        />
      );
    }

    return (
      <AsnLineTable
        asn={selectedRow}
        supplierName={describeReference(toReference(suppliers, selectedRow.supplierId))}
        today={today}
        rows={lines.data ?? EMPTY_LINES}
        isLoading={lines.isPending}
        /*
         * 공장은 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패 안내와 다시 시도를
         * 소유하므로 실패 여부를 함께 알아야 한다. 공급사는 위 구획이 소유해 이름만 넘긴다.
         */
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <AsnFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          itemOptions={toSelectOptions(items)}
          statusOptions={toStatusOptions(PLACEHOLDER_ASN_STATUS_CODES, rows, filters.status)}
          chipNames={{
            supplier: describeReference(supplierReference),
            item: describeReference(itemReference),
          }}
          supplierNote={lookupNote(suppliers)}
          itemNote={lookupNote(items)}
          onSearch={(nextPeriod, nextFilters) => {
            applyQuery(nextPeriod, nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery({ from: '', to: '' }, EMPTY_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <AsnTable
              rows={rows}
              isLoading={list.isPending && listQuery !== null}
              hasQuery={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              today={today}
              selectedId={selectedId}
              supplierLookup={suppliers}
              onFirstPage={() => {
                applyQuery(period, filters);
              }}
              onToggleSelect={toggleSelect}
              onRetryReferences={retryTopReferences}
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

      <section className="pane" aria-label={t.panes.lines}>
        {linePane()}
      </section>
    </>
  );
};
