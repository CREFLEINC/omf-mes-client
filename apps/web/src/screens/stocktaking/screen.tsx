import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { PLACEHOLDER_STOCKTAKING_CODES, toCodeOptionSets } from './code-options';
import { CountFilterBar } from './count-filter-bar';
import { CountTable } from './count-table';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedCountId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type CountFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useWarehouseLookup,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { isCountNotFound, useInventoryCountDetail, useInventoryCounts } from './queries';
import { SummaryPane } from './summary-pane';
import type { CountView, SelectOption } from './types';

const t = messages.stocktaking;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: CountView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 창고를 대상으로 한 과거 실사의 이름을 풀기 위해서인데, 그 실사들을 **조건으로
 * 찾으려면** 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-04 컨테이너 — **단계가 있는 전표 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 실사 목록 / 아래: 고른 실사의 제목줄과 요약 4칸.
 * 조회 조건과 고른 실사·위치는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 PR은 읽기까지다.** 개시(PR ②) · 결과 등록(PR ③) · 마감(PR ④)이 이 컨테이너에 차례로
 * 붙는다. 그때까지 **라우트·사이드바에 등록하지 않는다**(정책 §5.2 — 접근 불가능한 경계):
 * 실사를 개시할 수도 마감할 수도 없는 「재고실사」 화면을 노출하면 미완성 기능을 사용자에게
 * 내보이는 것이다.
 *
 * ---
 *
 * **단계 전이 표**(계획 결정 2 — 이 화면의 중심 결정).
 *
 * **화면이 단계를 `statusCode` 값으로 판정하지 않는다.** 값 목록이 확정되지 않았고
 * (`omf-mes#64`) 공유계약 G-2가 값 분기를 금지한다. 계약도 그렇게 적었다 —
 * 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로 분기하지 않는다」.
 * 그래서 단계는 **화면이 스스로 아는 것**으로만 가른다.
 *
 * | 단계 | 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 | PR |
 * | :-: | --- | --- | --- | --- | :-: |
 * | **S0** 고르기 전 | `ct`가 없다 | 조건 줄 · 실사 목록 · 쪽 이동 (+개시 구획) | 조회 · 초기화 · 쪽 이동 · 실사 고르기 (+개시) | `?wh&from&to&ty&st&prog&page` | ① (+②) |
 * | **S1** 실사를 골랐다 | `ct`가 있고 **상세가 200** | 위 + 제목줄 · **요약 4칸** (+위치 선택칸 · 마감 · 이력) | 위 + 다시 조회 (+위치 고르기 · 마감) | `+&ct` | ① (+③④) |
 * | **S2** 위치를 골랐다 | `ct`·`loc`가 있고 라인이 도착했다 | 위 + 라인 표 | 위 + 실물·사유 입력 · 저장 | `+&loc` | ③ |
 * | **S3** 이번 세션에서 마감했다 | **이 화면의 마감 성공 결과** | 위 + 마감 결과 | **조회만** | `ct` 유지 | ④ |
 * | **S4** 그 실사가 없다 | **상세가 404** | 안내 「고른 실사를 찾을 수 없습니다」 | 다시 고르기 | `ct`·`loc` 제거 | ① |
 *
 * **화면이 모르는 것을 밝힌다.** 세션 밖에서 **이미 마감된 실사**를 골라도 화면은 S1로 보인다.
 * 저장·마감을 시도하면 서버가 400 STATE_LOCKED로 되돌리고 `SaveErrorBanner`가 서버가 준 사유와
 * 함께 낸다. 화면이 상태 값을 읽어 미리 막는 것보다 이 편이 옳다 — 값 목록이 확정되면 그때
 * 막아도 늦지 않고, 지금 막으면 **값이 정해질 때 조용히 틀린다.**
 *
 * **S1의 근거를 목록 소속이 아니라 상세 200으로 두는 이유**: `ct`는 경로 조각이라 목록과
 * 무관하게 상세를 부를 수 있다. 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 실사를 고른
 * 상태가 지워진다** — 특히 개시 직후(PR ②)에 새 실사가 지금 조건에 안 걸리면 방금 만든 것이
 * 즉시 사라진다.
 */
export const StocktakingScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표**(계획 결정 3).
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **표는 화면 전체(PR ①~④)의 것이고, ★ 열이 이 PR에 실물로 있는 상태다.**
   * 나머지 열(초안 둘·결과 구획·열린 창·마감 플래그)은 뒤 PR에서 생기며, 그때 이 표에
   * 행을 더하지 않아도 되도록 지금 함께 적어 둔다. **열아홉째 조작이 생기면 행을 먼저 더하고,
   * 열이 생겨도 마찬가지다** — 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다.
   *
   * | # | 조작 | 조건 6종★ | `page`★ | `ct`★ | `loc`★ | **404 안내★** | 개시 초안 | 라인 초안 | 결과 구획 | 열린 창 | 마감 플래그 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | **비운다** |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 비운다 | **비운다** | 유지 | 비운다 | 비운다 | **닫는다** | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | 비운다 |
   * | 4 | 실사 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | **비운다** |
   * | 5 | 위치 고르기·해제 | 유지 | 유지 | 유지 | 넣고 뺀다 | 유지 | 유지 | **비운다** | 비운다 | **닫는다** | 유지 |
   * | 6 | **상세가 404** | 유지 | 유지 | **비운다** | **비운다** | **세운다** | 유지 | 비운다 | 비운다 | **닫는다** | 비운다 |
   * | 7 | 개시 초안 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** | 유지 | 유지 |
   * | 8 | 라인 초안 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** | 유지 | 유지 |
   * | 9 | 목록·상세·라인·참조 응답 도착 | 유지 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | 유지 |
   * | 10 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 |
   * | 11 | **개시 성공** | 유지 | 유지 | **새 실사로** | **비운다** | 비운다 | **비운다** | 비운다 | **채운다** | 닫혀 있다 | 비운다 |
   * | 12 | 개시 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 비운다 | 닫혀 있다 | 유지 |
   * | 13 | **위치 저장 성공** | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **비운다** | **채운다** | 닫혀 있다 | 유지 |
   * | 14 | 위치 저장 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 비운다 | 닫혀 있다 | 유지 |
   * | 15 | **마감 성공** | 유지 | 유지 | **유지** | **비운다** | 유지 | 유지 | **비운다** | **채운다** | 닫혀 있다 | **세운다** |
   * | 16 | 마감 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 비운다 | 닫혀 있다 | 유지 |
   * | 17 | 취소(초안 파기) | 유지 | 유지 | 유지 | 유지 | 유지 | **비운다** | **비운다** | 비운다 | **닫는다** | 유지 |
   * | 18 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 |
   *
   * **왜 이렇게 정했는가**(이 PR에 실물이 있는 것만)
   *
   * - **1~3행이 `ct`·`loc`를 비우는 이유**: 조건·쪽이 바뀌면 고른 실사가 새 결과에 없을 수
   *   있다. 규칙의 실물은 `toSearchParams`가 **`ct`·`loc`를 만들지 않는 것**이다 — 세 조작이
   *   전부 그 함수로 주소를 다시 짓는다(계획 결정 3의 구현 규칙 1).
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6행이 클릭 핸들러가 아닌 이유**: 뒤로가기·앞으로가기·주소 직접 편집은 핸들러를 거치지
   *   않고 `ct`만 바꾼다 — 핸들러에 두면 그 경로가 통째로 샌다. **고른 실사와 상세 응답에 묶인
   *   effect 한 곳**이 한다.
   * - **6행의 「404 안내」가 열인 이유**: 주소에서 `ct`를 지우고 나면 화면은 「고른 것이 없다」와
   *   구분할 수 없게 된다 — 무엇이 왜 사라졌는지 말할 근거가 이 상태뿐이다. 계획의 표에는
   *   없던 열이라 **여기에 더해 규칙이 닿게 한다.**
   * - **10행이 목록만이 아니라 상세도 함께 부르는 이유**: W-01-07의 Major 지적 그대로다 —
   *   목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다.** 요약 4칸이 낡은
   *   채로 마감 버튼의 활성 여부를 정하면 그 판단 자체가 낡는다(PR ④).
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<CountFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedCountId = readSelectedCountId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 진행 중인 실사가 보여야 무엇을 고를 수
   * 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다(계획 결정 3).
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useInventoryCounts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const warehouses = useWarehouseLookup();

  /*
   * **고른 실사의 상세.** 이 응답이 단계 판정의 근거다(단계 전이 표) — 목록에 그 실사가
   * 있는지로 판정하지 않는다.
   */
  const detail = useInventoryCountDetail(selectedCountId);
  const isDetailNotFound = detail.isError && isCountNotFound(detail.error);

  /**
   * 방금 고른 실사가 **없었다**는 사실(수명 표 6행의 「404 안내」 열).
   *
   * 주소에서 `ct`를 지우고 나면 화면은 그 사정을 말할 근거를 잃는다 — 「아직 고르지 않았다」와
   * 글자가 같아지므로 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  const [hasNotFoundNotice, setNotFoundNotice] = useState(false);

  /*
   * **상세가 404면 고른 실사를 주소에서 정리한다**(수명 표 6행).
   *
   * **클릭 핸들러가 아니라 고른 식별자와 상세 응답에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `ct`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다 — 늘리면 뒤로 눌렀을 때 없는 실사를
   * 가리키는 주소로 되돌아가 같은 정리가 되풀이된다.
   */
  useEffect(() => {
    if (selectedCountId === null) return;
    if (!isDetailNotFound) return;

    setNotFoundNotice(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.count);
        next.delete(SELECTION_KEYS.location);

        return next;
      },
      { replace: true },
    );
  }, [selectedCountId, isDetailNotFound, setSearchParams]);

  /*
   * 다시 고르면 앞의 안내를 거둔다 — 남으면 새로 고른 실사의 요약 옆에 「찾을 수 없습니다」가
   * 함께 서 있게 된다. **고른 식별자가 생기는 순간에만** 반응한다.
   */
  useEffect(() => {
    if (selectedCountId !== null) setNotFoundNotice(false);
  }, [selectedCountId]);

  /**
   * 조작을 실제로 수행한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면
   * 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `ct`·`loc`를 만들지 않으므로 조건·쪽이 바뀌면 고른 실사와 위치가
   * 함께 풀린다(수명 표 1~3행).
   */
  const applyQuery = (nextFilters: CountFilters, nextPage = 1): void => {
    setNotFoundNotice(false);
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행) — 쪽을 그대로 둔다. */
  const toggleSelectCount = (inventoryCountId: number): void => {
    const next = toSearchParams(filters, page);

    if (inventoryCountId !== selectedCountId) {
      next.set(SELECTION_KEYS.count, String(inventoryCountId));
    }

    setNotFoundNotice(false);
    setSearchParams(next);
  };

  /**
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 10행).
   *
   * 목록만 다시 부르면 요약 4칸이 낡은 채로 남아 **갱신된 값과 갱신되지 않은 값이 한 화면에
   * 섞인다**(W-01-07의 Major 지적). 요약은 마감 가능 여부를 정하는 값이라(PR ④) 낡으면
   * 그 판단 자체가 낡는다.
   *
   * **고른 실사가 없으면 상세를 부르지 않는다.** 설치본의 `Query.fetch`는 `enabled`를 보지
   * 않아 `refetch()`가 비활성 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서
   * 요청이 나가지 않지만 그것은 **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * 조건·쪽·선택은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    void list.refetch();

    if (selectedCountId !== null) void detail.refetch();
  };

  const codeOptions = toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES);

  const warehouseReference = toReference(
    warehouses,
    filters.warehouse === '' ? null : Number(filters.warehouse),
  );

  /**
   * 아래 구획. **넷 중 하나만 낸다** — 사용자가 할 조치가 서로 다르다.
   *
   * 404를 맨 앞에 둔다: 그 갈래는 `ct`를 지우고 나면 「아직 고르지 않았다」와 구분되지 않으므로,
   * 지우기 전(상세가 404인 렌더)과 지운 뒤(안내 상태)가 **같은 화면**을 내야 한다.
   */
  const detailPane = (): ReactNode => {
    if (hasNotFoundNotice || isDetailNotFound) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.notFoundTitle}
          description={t.empty.notFoundDescription}
        />
      );
    }

    if (selectedCountId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /* 404가 아닌 실패는 다시 시도로 풀릴 수 있다 — 배너와 복구 경로를 함께 낸다. */
    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }

    if (detail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <SummaryPane
        count={detail.data.count}
        summary={detail.data.summary}
        /*
         * 참조를 **이름으로 풀어 넘긴다** — 제목줄 부품 안에 번호를 문자열로 만드는 자리를
         * 두지 않으면 그 값이 화면으로 샐 경로도 없다(#44).
         */
        warehouseName={describeReference(toReference(warehouses, detail.data.count.warehouseId))}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" size="sm" onClick={refreshAll}>
            {t.actions.refresh}
          </Button>
        }
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
        <CountFilterBar
          appliedFilters={filters}
          warehouseOptions={toSelectOptions(warehouses)}
          countTypeOptions={codeOptions.countType}
          statusOptions={codeOptions.status}
          chipNames={{ warehouse: describeReference(warehouseReference) }}
          warehouseNote={lookupNote(warehouses)}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: ChipFilterKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <CountTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedCountId={selectedCountId}
              warehouseLookup={warehouses}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectCount}
              onRetryReferences={() => {
                warehouses.refetch();
              }}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      <section className="pane" aria-label={t.panes.detail}>
        {detailPane()}
      </section>
    </>
  );
};
