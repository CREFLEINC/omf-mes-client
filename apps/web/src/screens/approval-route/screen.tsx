import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { PLACEHOLDER_APPROVAL_TYPE_CODES, toApprovalTypeOptions } from './code-options';
import {
  DEFAULT_FILTERS,
  clearFilter,
  readFilters,
  readPage,
  readSelectedRouteId,
  toSearchParams,
  toSelectionSearchParams,
  type FilterKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeBusinessUnit,
  lookupNote,
  toBusinessUnit,
  toBusinessUnitOptions,
  useBusinessUnitLookup,
} from './lookups';
import { toPageView } from './pagination';
import { useRouteDetail, useRouteList, useRouteSteps } from './queries';
import { RouteFilterBar } from './route-filter-bar';
import { RouteFormPane } from './route-form-pane';
import { RouteListPane } from './route-list-pane';
import { StepPane } from './step-pane';
import { toRouteView, toStepView, type RouteFilters } from './types';

const t = messages.approvalRoute;

/**
 * W-06-15 결재선 정의 컨테이너 — **이 회차는 읽기뿐이다.**
 *
 * ## 단계 전이 표 (계획 결정 3)
 *
 * 화면이 `approvalTypeCode` **값으로는 분기하지 않는다**(값 목록 미확정). 반면
 * `isActive`·`stepCount`·`inProgressCount`로는 분기한다 — 셋은 열린 코드가 아니라 계약이
 * 뜻을 정의한 불리언·정수이고, 계약이 화면에 그 판정을 명시적으로 요구한다.
 *
 * | 단계 | 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `ar`도 `new`도 없다 | 조건 줄 · 목록 · 쪽 | 조회 · 초기화 · 쪽 이동 · 고르기 | `?ty&bu&inactive&q&page` |
 * | **S1** 결재선을 골랐다 | `ar`가 있고 **상세가 200** | 위 + 결재선 내용 + **단계 구획** | 위 + 다시 조회 | `+&ar` |
 * | **S2** 새로 만드는 중 | `new`가 있다 | 위 + (등록 폼은 **뒤 회차**) | 위 | `+&new` |
 * | **S3** 그 결재선이 없다 | 상세가 **404** | 안내 「고른 결재선을 찾을 수 없습니다」 | 주소에서 `ar`를 정리한다 | `ar` 제거 |
 *
 * **S2에 단계 구획이 없다** — 등록 요청에 단계를 실을 수 없고(계약) 단계 치환은 번호를
 * 요구한다. 붙일 대상이 아직 없다. 이 회차에는 등록 폼 자체가 없어 S2가 「고르지 않음」과
 * 같은 화면을 낸다.
 *
 * **S1에서 화면이 모르는 것을 밝힌다.** 「이 결재선이 지금 상신에 실제로 쓰이는가」는 화면이
 * 판정할 수 없다 — 같은 (유형, 사업부)로 사용 중인 결재선이 둘 이상 있을 수 있고 고르는
 * 규칙은 서버가 갖는다. 화면은 자기가 아는 사실(사용 여부·단계 수·진행 중 건수)만 말한다.
 *
 * ## 수명 표 (계획 결정 4)
 *
 * 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다. **쓰기가 붙는 회차는 이 표에 행을
 * 먼저 더한 뒤에 코드를 고친다.** 아래는 이 회차에 실재하는 조작만이며, 폼 초안·단계 초안·
 * 확인 창·저장 실패 배너는 뒤 회차가 열을 더한다.
 *
 * | # | 조작 | 조건 4종 | `page` | `ar` | `new` | 조건 초안 | **404 안내** |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **끈다** | 조회한 값으로 | **비운다** |
 * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 끈다 | 비운다 | 비운다 |
 * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **끈다** | 유지 | **비운다** |
 * | 4 | 결재선 고르기 | 유지 | **유지** | 넣는다 | 끈다 | 유지 | **비운다** |
 * | 5 | **상세가 404** | 유지 | 유지 | **비운다** | 끈다 | 유지 | **세운다** |
 * | 6 | 목록·상세·단계·참조 **응답 도착** | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
 * | 7 | **다시 조회** | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 |
 *
 * **왜 이렇게 정했는가**
 *
 * - 1~3행이 선택을 비우는 이유: 조건·쪽이 바뀌면 보이는 행이 달라진다. 목록에 없는 결재선의
 *   상세가 오른쪽에 남으면 그것이 어디서 왔는지 알 수 없다. 그 규칙은 `toSearchParams`가
 *   **선택 자리를 만들지 않는 것**으로 지켜진다 — 조작마다 따로 비우면 한 자리를 빠뜨린다.
 * - 5행이 클릭 핸들러가 아니라 **조회 결과에 묶인 effect**인 이유: 뒤로가기·주소 직접 편집은
 *   핸들러를 거치지 않는다. 거기서 404가 나면 주소가 정리되지 않는다.
 * - 6행이 이 화면의 초안 소실 자리다: 응답 도착이 조건 초안을 되돌리면 치던 값이 사라진다.
 *   되돌림은 조건 줄이 **값으로** 판정한다(참조가 아니라).
 * - **404 안내는 자기 대상보다 오래 살지 않는다.** 매임을 이름 하나(`listContextKey`)로 세워
 *   조건·쪽이 바뀌거나 다른 결재선을 고르면 함께 사라지게 한다 — 조작마다 지우면 뒤로가기가 샌다.
 */
export const ApprovalRouteScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedRouteId = readSelectedRouteId(searchParams);

  const list = useRouteList(filters, page);
  const detail = useRouteDetail(selectedRouteId);
  const steps = useRouteSteps(selectedRouteId);
  const businessUnits = useBusinessUnitLookup();

  /**
   * 404 안내가 매인 대상. **조건·쪽의 서명**이며, 그것이 바뀌면 안내가 가리킬 것이 없다.
   * 조작마다 따로 지우면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 안내가 살아남는다.
   */
  const listContextKey = toSearchParams(filters, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  /**
   * 아래 404 effect의 **의존성을 하나로 두기 위해** 지금 서명을 참조로 들고 있는다.
   * 의존성에 서명을 넣으면 조건·쪽이 바뀔 때마다 effect가 깨어나 안내를 다시 세운다.
   *
   * **동기화를 렌더가 아니라 effect가 한다.** 렌더 중에 참조를 쓰면 버려진 렌더가 남긴 값을
   * 뒤의 effect가 읽을 여지가 생긴다(React 지침). 이 effect를 404 effect **앞에** 선언해
   * 같은 커밋에서 참조가 먼저 갱신되게 한다 — effect는 선언 순서대로 실행된다.
   */
  const listContextKeyRef = useRef(listContextKey);

  useEffect(() => {
    listContextKeyRef.current = listContextKey;
  }, [listContextKey]);

  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isRouteNotFound =
    detailError !== null && detailError.kind === 'http' && detailError.status === 404;

  /**
   * 상세가 404면 주소에 남은 번호를 정리한다.
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 결재선으로 되돌아가고,
   * 그 자리에서 다시 404가 나 같은 정리가 되풀이된다.
   */
  useEffect(() => {
    if (!isRouteNotFound) return;

    setMissingContextKey(listContextKeyRef.current);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('ar');

        return next;
      },
      { replace: true },
    );
  }, [isRouteNotFound, setSearchParams]);

  const isRouteMissing =
    selectedRouteId === null && missingContextKey !== null && missingContextKey === listContextKey;

  const routes = useMemo(() => (list.data?.items ?? []).map(toRouteView), [list.data]);
  const stepViews = useMemo(() => (steps.data?.items ?? []).map(toStepView), [steps.data]);

  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, routes.length);

  const businessUnitLabelOf = (businessUnitId: number | null): string =>
    describeBusinessUnit(toBusinessUnit(businessUnits, businessUnitId));

  /**
   * 주소를 갈아 끼우는 **유일한 핸들러 경로**. 404 안내를 여기서 함께 거둔다 —
   * 조회·초기화·쪽 이동·고르기가 모두 이 길을 지나므로 조작마다 따로 지울 자리가 없다.
   *
   * 주소가 바깥에서 바뀌는 길(뒤로가기·주소 직접 편집)은 이 길을 지나지 않는다.
   * 그쪽은 `listContextKey` 비교가 맡는다 — 두 길이 각각 다른 것을 덮는다.
   */
  const applySearchParams = (next: URLSearchParams): void => {
    setMissingContextKey(null);
    setSearchParams(next);
  };

  const handleSearch = (next: RouteFilters): void => {
    // 조건·쪽·선택을 **한 patch로** 갱신한다. 나누면 그 사이에 어느 쪽도 아닌 한 프레임이 생긴다.
    applySearchParams(toSearchParams(next, 1));
  };

  const handleRemoveFilter = (key: FilterKey): void => {
    handleSearch(clearFilter(filters, key));
  };

  const handleChangePage = (nextPage: number): void => {
    applySearchParams(toSearchParams(filters, nextPage));
  };

  const handleSelect = (approvalRouteId: number): void => {
    applySearchParams(toSelectionSearchParams(filters, page, approvalRouteId));
  };

  /**
   * 다시 조회 — **목록만 부르지 않는다.**
   *
   * 목록만 다시 부르면 갱신된 목록 값과 낡은 상세·단계가 한 화면에 섞인다.
   * 고르지 않았으면 상세·단계는 부를 대상이 없다 — **읽는 자리에서 판정한다.**
   */
  const handleReload = (): void => {
    void list.refetch();
    businessUnits.refetch();

    if (selectedRouteId !== null) {
      void detail.refetch();
      void steps.refetch();
    }
  };

  const approvalTypeOptions = toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES);

  const detailSlot = () => {
    if (isRouteNotFound || isRouteMissing) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <EmptyState
            size="sm"
            live
            title={t.empty.notFoundTitle}
            description={t.empty.notFoundDescription}
          />
        </section>
      );
    }

    if (selectedRouteId === null) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <EmptyState
            size="sm"
            title={t.empty.noSelectionTitle}
            description={t.empty.noSelectionDescription}
          />
        </section>
      );
    }

    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <LoadErrorBanner
            error={detail.error}
            onRetry={() => {
              void detail.refetch();
            }}
          />
        </section>
      );
    }

    if (detail.data === undefined) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    const route = toRouteView(detail.data);

    return (
      <>
        <RouteFormPane
          route={route}
          businessUnitLabel={businessUnitLabelOf(route.businessUnitId)}
        />
        <StepPane
          steps={stepViews}
          isLoading={steps.isPending}
          loadError={
            steps.isError ? (
              <LoadErrorBanner
                error={steps.error}
                onRetry={() => {
                  void steps.refetch();
                }}
              />
            ) : null
          }
        />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" onClick={handleReload}>
            {t.actions.reload}
          </Button>
        }
      />

      {/*
       * 좌 목록 / 우 스택. `.pane-stack`은 3단 배치 전용이 아니라 일반 격자이며
       * (`display:grid; gap; align-content:start; min-width:0`) 이음매를 담는 쪽이 한 번에
       * 정의한다 — **2단 배치에서 쓰는 첫 사례다.** 문서 갱신은 두 번째 사용처에서 한다.
       */}
      <div className="two-pane">
        <section className="pane" aria-label={t.panes.list}>
          <RouteFilterBar
            appliedFilters={filters}
            approvalTypeOptions={approvalTypeOptions}
            businessUnitOptions={toBusinessUnitOptions(businessUnits.entries)}
            businessUnitNote={lookupNote(businessUnits)}
            businessUnitLabel={(businessUnitId) => businessUnitLabelOf(Number(businessUnitId))}
            onSearch={handleSearch}
            onRemoveFilter={handleRemoveFilter}
            onReset={() => {
              handleSearch(DEFAULT_FILTERS);
            }}
          />
          <RouteListPane
            routes={routes}
            isLoading={list.isPending}
            pageView={pageView}
            onChangePage={handleChangePage}
            selectedRouteId={selectedRouteId}
            onSelect={handleSelect}
            businessUnitLabel={businessUnitLabelOf}
            loadError={
              list.isError ? (
                <LoadErrorBanner
                  error={list.error}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              ) : null
            }
          />
        </section>

        <div className="pane-stack">{detailSlot()}</div>
      </div>
    </>
  );
};
