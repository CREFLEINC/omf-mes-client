import { Breadcrumb, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { readFilters, readPage, toSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { PlanListPane } from './plan-list-pane';
import { useInspectionPlanList } from './queries';
import type { PlanFilters } from './types';

const t = messages.inspectionStandard;

/**
 * W-06-02 컨테이너 — 기준 목록 → 버전 목록 → 기준·버전·항목을 3단으로 놓는다.
 *
 * **배치는 W-06-01(Routing)과 같은 3단이다.** 착수 이슈가 「버전 마스터 형 골격을 그대로
 * 재사용」을 지시했고, 접힘 기준점(1280px·720px)의 근거는 그 화면이 이미 도출해 `.three-pane`에
 * 담아 두었다 — 열 구성이 같으므로 근거를 다시 도출할 이유가 없고 `app.css`를 고치지 않는다.
 *
 * 우 칸이 2구획이 아니라 **3구획**인 이유는 자료 구조가 3계층(기준 → 버전 → 검사 항목)이고
 * 계층마다 자기 상세 조회·자기 잠금 토큰·자기 저장 실패가 있기 때문이다. 두 구획에 접으면
 * 어느 배너가 어느 저장의 실패인지 사용자가 가릴 수 없다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?q=&type=&inactive=1&page=&plan=&ver=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 */
export const InspectionStandardScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<PlanFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const selectedPlanId = Number(searchParams.get('plan') ?? '') || null;

  const planList = useInspectionPlanList(filters, page);
  const plans = planList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(planList.data?.page ?? { page, size: 0, total: 0 }, plans.length);

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `plan`·`ver`가 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: PlanFilters) => {
    setSearchParams(toSearchParams(next, 1));
  };

  const changePage = (nextPage: number) => {
    setSearchParams(toSearchParams(filters, nextPage));
  };

  /** 기준을 바꾸면 버전 선택을 지운다 — 다른 기준의 버전을 가리키면 안 된다. */
  const selectPlan = (inspectionPlanId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('plan', String(inspectionPlanId));
    next.delete('ver');
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="three-pane">
        <PlanListPane
          plans={plans}
          isLoading={planList.isPending}
          appliedFilters={filters}
          onApplyFilters={applyFilters}
          pageView={pageView}
          onChangePage={changePage}
          selectedPlanId={selectedPlanId}
          onSelect={selectPlan}
          loadError={
            planList.isError ? (
              <LoadErrorBanner error={planList.error} onRetry={() => void planList.refetch()} />
            ) : null
          }
        />

        <section className="pane" aria-label={t.panes.version}>
          <EmptyState size="sm" title={t.empty.planNotSelected} />
        </section>

        <div className="pane-stack">
          <section className="pane" aria-label={t.panes.planForm}>
            <EmptyState size="sm" title={t.empty.planNotSelected} />
          </section>
        </div>
      </div>
    </>
  );
};
