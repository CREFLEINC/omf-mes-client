import { Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toPageParams,
  toSearchParams,
  URL_KEYS,
  type QueueFilters,
} from './filters';
import { QueueLoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useInspectionQueue } from './queries';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueTable } from './queue-table';

/**
 * W-01-01 IQC 수입검사·판정 — **이 회차는 좌측 검사 대기 큐 하나다.**
 *
 * 화면 스펙 §3 은 좌우 2단이고 우측 2/3 가 진행 중인 1건이다. 그 창(의뢰 상세·측정치·수량
 * 판정·확정)은 다음 회차가 세우며, **미완성 부분을 노출하지 않으려고 라우트도 아직 열지
 * 않는다.** 그래서 여기서 `.two-pane` 을 만들지 않는다 — 빈 칸을 만들어 두면 「고장난 화면」이
 * 되고, 우측이 서는 회차에 그 칸을 함께 만드는 편이 정직하다.
 *
 * **주소가 조건의 정본이다.** 조건·쪽·고른 의뢰가 전부 주소에 산다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 내야 하기 때문이다. 읽고 쓰는 규칙은 `filters.ts` 가 소유한다.
 *
 * ⛔ **「검사 시작」 버튼을 두지 않는다.** 요구서가 시작을 이벤트로 열거하지만 스펙 §3 에
 * 시작 버튼이 없고, 첫 임시 저장이 곧 검사 시작이며 서버가 그때 상태를 옮긴다(omf-mes#170 회신).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.iqcInspection;

export const IqcInspectionScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const queue = useInspectionQueue(toListQuery(filters, page));

  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 조건을 바꾼다. **첫 쪽으로 가고 고른 의뢰가 풀린다** — 결과가 통째로 달라지므로
   * 3쪽을 보다가 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보이고, 고른 의뢰는
   * 새 결과에 없을 수 있다. 두 일을 `toSearchParams` 가 한 자리에서 한다.
   */
  const applyFilters = (next: QueueFilters): void => {
    setSearchParams(toSearchParams(next));
  };

  /** 쪽만 옮긴다 — 조건과 고른 의뢰는 그대로다. */
  const goToPage = (next: number): void => {
    setSearchParams(toPageParams(searchParams, next));
  };

  const select = (inspectionRequestId: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /**
   * 표 자리에 그릴 것. **세 갈래를 가른다** — 부르는 중 · 이 쪽에 없음 · 조건에 맞는 것이 없음.
   *
   * ⭐ 「이 쪽에 없음」과 「조건에 맞는 것이 없음」을 합치지 않는다. 앞은 **쪽이 문제**라
   * 앞쪽으로 가면 풀리고, 뒤는 **조건이 문제**라 조건을 넓혀야 풀린다 — 합치면 사용자가
   * 조건을 넓히다가 결국 못 찾는다.
   */
  const emptyContent = queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : pageView.isBeyondLast ? (
    <p className="field-note">
      {t.pageNav.beyondLast}{' '}
      <Button variant="outlined" size="sm" onClick={() => goToPage(1)}>
        {t.pageNav.toFirstPage}
      </Button>
    </p>
  ) : (
    <p className="field-note">{t.queue.empty}</p>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <section className="pane" aria-label={t.queue.heading}>
        <QueueFilterBar
          appliedFilters={filters}
          onSearch={applyFilters}
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />

        {queue.isError && (
          <QueueLoadErrorBanner
            error={toApiError(queue.error)}
            onRetry={() => void queue.refetch()}
          />
        )}

        <QueueTable rows={rows} selectedId={selectedId} onSelect={select} empty={emptyContent} />

        <PageNav view={pageView} onChange={goToPage} />
      </section>
    </>
  );
};
