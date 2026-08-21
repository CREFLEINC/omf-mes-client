import { Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
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
import { EMPTY_QUANTITY_DRAFT, toSendableNumber, type QuantityDraft } from './quantity-draft';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { MeasurementGrid } from './measurement-grid';
import { toMeasurementRows } from './measurement-rows';
import {
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useInspectionQueue,
  useInspectionRoundLock,
  useInspectionRounds,
  useMeasurements,
  useSaveDraft,
} from './queries';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueTable } from './queue-table';
import { RequestDetailPane } from './request-detail-pane';
import { ResultFormPane } from './result-form-pane';
import { latestRound } from './types';

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
  const detail = useInspectionRequestDetail(selectedId);
  const rounds = useInspectionRounds(selectedId);

  const round = latestRound(rounds.data ?? []);

  /**
   * 고칠 회차. **확정된 회차는 고치지 않는다** — 정정이 아니라 재검사로 새 회차를 쌓는다(§5-3).
   * 그래서 확정본이면 `null` 이 되고 저장은 「새로 만들기」로 간다.
   */
  const editingResultId =
    round !== null && round.statusCode !== '확정' ? round.inspectionResultId : null;

  /*
   * ⭐ 잠금 토큰을 얻으려고 회차 한 건을 따로 부른다 — 목록 200 에는 `ETag` 가 없고, 토큰
   * 보관소가 응답이 온 URL 경로를 열쇠로 쓴다. 고칠 회차가 있을 때만 부른다.
   */
  useInspectionRoundLock(editingResultId);

  /** 마지막 저장이 성공했는가. 눌렀는데 아무 일도 없어 보이지 않게 한 줄로 알린다. */
  const [isSaved, setIsSaved] = useState(false);

  const save = useSaveDraft(selectedId, editingResultId, () => {
    setIsSaved(true);
  });

  /**
   * 초안이 바뀌면 「저장했습니다」를 지운다.
   *
   * ⭐ **표시가 언제 거짓이 되는지**를 값이 바뀌는 자리에서 함께 정한다. 지우지 않으면
   * 저장한 뒤 수량을 더 고쳐도 화면이 저장됐다고 말하고, 검사자가 그 문구를 보고 자리를
   * 뜨면 **고친 값이 사라진다.** 이 화면이 남기는 것은 품질 판정 자료다.
   */
  const changeDraft = (next: QuantityDraft): void => {
    setIsSaved(false);
    setDraft(next);
  };

  /**
   * 수량 초안. **고른 의뢰가 바뀌면 그 회차의 값으로 되돌아간다.**
   *
   * 되돌림을 참조가 아니라 **값**으로 판정한다 — 조회 응답이 다시 그려질 때마다 참조가
   * 달라지므로, 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   *
   * 회차가 없으면 빈 초안이다. ⛔ 0을 미리 채우지 않는다 — 채우면 「검사자가 0으로 판정했다」와
   * 「아직 아무것도 넣지 않았다」가 화면에서 같아 보인다.
   *
   * ⭐ **고른 의뢰(`selectedId`)가 의존성에 든다.** 회차 값만 보면 **회차가 없는 의뢰끼리
   * 옮길 때** 네 값이 모두 그대로여서(`null`·0·0·0) effect 가 깨어나지 않고, 앞 의뢰에 친
   * 수량이 다음 의뢰 화면에 남는다. 저장이 붙는 순간 **다른 LOT 에 앞 의뢰의 수량을 저장**하는
   * 길이 된다 — 값이 그럴듯해서 아무도 눈치채지 못한다.
   */
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };

  useEffect(() => {
    setIsSaved(false);
    setDraft(
      roundId === null
        ? EMPTY_QUANTITY_DRAFT
        : {
            accepted: String(acceptedQty),
            rejected: String(rejectedQty),
            held: String(heldQty),
          },
    );
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty]);

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
   * 표 자리에 그릴 것. **네 갈래를 가른다** — 실패 · 부르는 중 · 이 쪽에 없음 · 조건에 맞는 것 없음.
   *
   * ⭐ **실패를 「결과 없음」으로 접지 않는다.** 접으면 요청이 실패했을 뿐인데 표가 「조건을
   * 넓혀 보세요」라고 말하고, 사용자는 조건을 넓히다가 결국 못 찾는다 — 실제로 할 일은 다시
   * 시도하거나 담당자에게 알리는 것이고 그것은 배너가 말한다.
   *
   * ⭐ 「이 쪽에 없음」과 「조건에 맞는 것이 없음」도 합치지 않는다. 앞은 **쪽이 문제**라
   * 앞쪽으로 가면 풀리고, 뒤는 **조건이 문제**라 조건을 넓혀야 풀린다.
   */
  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
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

  const inspectedQty = round?.inspectedQty ?? detail.data?.targetQty ?? 0;

  /*
   * ⚠ **검사 시점에 고정된 기준 버전으로 부른다** — 의뢰가 준 버전을 그대로 쓰고 「최신
   * 기준」을 찾지 않는다. 최신을 부르면 검사자가 재지 않은 항목이 그리드에 나타난다.
   */
  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  const measurements = useMeasurements(round?.inspectionResultId ?? null);

  const measurementRows = toMeasurementRows(itemSpecs.data ?? [], measurements.data ?? []);

  /**
   * 저장이 보낼 값을 만든다.
   *
   * 수량은 `toSendableNumber` 를 거친다 — 화면이 재는 자와 보내는 자가 같아야 한다.
   *
   * ⛔ **검사자·단말을 보내지 않는다** — 계약에서 사라졌다(omf-mes#173).
   *
   * 고른 의뢰를 **인자로 받는다** — 이 자리에 도달했으면 null 이 아니라는 사실이 타입이
   * 아니라 렌더 조건에 있어서, 단언으로 메우면 그 조건이 바뀔 때 조용히 어긋난다.
   */
  const saveDraft = (inspectionRequestId: number, inspected: number, uomId: number): void => {
    setIsSaved(false);
    save.write({
      inspectionRequestId,
      inspectedQty: inspected,
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /* 검사한 시각은 지금이다. 순수 함수가 아니라 이 자리에서 읽는다. */
      inspectedAt: new Date().toISOString(),
    });
  };

  /**
   * 우측 창. **네 갈래다** — 고르지 않음 · 부르는 중 · 실패 · 상세.
   *
   * ⛔ 실패를 「고르지 않음」으로 접지 않는다. 접으면 고른 것이 사라진 것처럼 보여
   * 사용자가 다시 고르는데, 다시 골라도 같은 실패가 온다.
   */
  const detailContent =
    selectedId === null ? (
      <p className="field-note">{t.detail.nothingSelected}</p>
    ) : detail.isError ? (
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    ) : detail.data === undefined ? (
      <p className="field-note">{t.detail.loading}</p>
    ) : (
      <>
        <RequestDetailPane detail={detail.data} />
        {rounds.isPending ? (
          <p className="field-note">{t.result.loading}</p>
        ) : (
          <ResultFormPane
            round={round}
            inspectedQty={inspectedQty}
            draft={draft}
            onChange={changeDraft}
            onSave={() => {
              saveDraft(selectedId, inspectedQty, detail.data.uomId);
            }}
            isSaving={save.isSaving || rounds.isFetching}
            isSaved={isSaved}
            fieldErrors={save.fieldErrors}
            saveError={save.error}
            onReload={() => void rounds.refetch()}
          />
        )}

        <MeasurementGrid rows={measurementRows} isLoading={itemSpecs.isPending} />
      </>
    );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="two-pane">
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

          {/*
           * ⛔ **셀 것이 없으면 그리지 않는다.** 조회가 끝나기 전이나 실패했을 때는 총계를
           * 모르는데, 그리면 대신 넘긴 0이 「전체 0건」이라는 **사실 주장**이 되어 화면에 선다.
           */}
          {queue.data !== undefined && <PageNav view={pageView} onChange={goToPage} />}
        </section>

        <section className="pane" aria-label={t.detail.heading}>
          {detailContent}
        </section>
      </div>
    </>
  );
};
