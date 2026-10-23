import { Breadcrumb, Button, Dialog, EmptyState, Icon, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { PAGE_SIZE } from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import { PageNav } from '../oqc-inspection/page-nav';
import { toPageView } from '../oqc-inspection/pagination';
import { useInspectionQueue } from '../oqc-inspection/queries';
import { useDirectSubmitter } from '../pqc-panel/direct-submitter';
import { PqcPanel } from '../pqc-panel/panel';
import { EMPTY_PQC_FILTERS, PqcFilterBar, type PqcFilters } from './filter-bar';
import { PqcQueueTable } from './queue-table';

const t = messages.pqcInspectionRegister;

/** 이 화면이 무엇인지의 정의 — 조건이 아니다. */
const PQC = 'PQC';
/** 고른 의뢰는 주소에 둔다 — 새로 고쳐도 같은 의뢰가 열린다(IQC #133 과 같은 `ir`). */
const SELECTED_KEY = 'ir';

const toSelectedId = (raw: string | null): number | null => {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value > 0 ? value : null;
};

/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107 · UI/UX #135).
 *
 * 목록 → 상세 한 화면씩(IQC 판정 화면 #133 과 같은 짜임). 상세의 입력은 POP 생산 실적 분할 화면과 **같은 패널**
 * (`pqc-panel`)이 맡는다 — 현장과 사무실이 같은 규칙으로 판정한다. 다른 점은 모양과 저장 길뿐이다(관리웹은 바로 저장).
 *
 * ⚠ 목록 질의·쪽 넘김은 W-04-03(OQC)의 것을 쓴다 — 검사 유형만 다르다.
 */
export const PqcInspectionRegisterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = toSelectedId(searchParams.get(SELECTED_KEY));
  const [pendingOnly, setPendingOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PqcFilters>(EMPTY_PQC_FILTERS);
  const [dirty, setDirty] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const submitter = useDirectSubmitter();

  const queue = useInspectionQueue({
    inspectionTypeCode: PQC,
    pendingOnly,
    ...(filters.itemId === null ? {} : { itemId: filters.itemId }),
    ...(filters.keyword === '' ? {} : { q: filters.keyword }),
    page,
    size: PAGE_SIZE,
  });
  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const select = (inspectionRequestId: number | null): void => {
    setDirty(false);
    setConfirmingLeave(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (inspectionRequestId === null) next.delete(SELECTED_KEY);
      else next.set(SELECTED_KEY, String(inspectionRequestId));
      return next;
    });
  };
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : (
    <EmptyState
      size="sm"
      live
      icon={<Icon name="search_off" size={40} />}
      title={t.queue.empty}
      description={t.queue.emptyHint}
    />
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: t.breadcrumbRoot },
              { label: t.title },
              ...(selectedId === null ? [] : [{ label: t.detail.sectionTitle }]),
            ]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      {selectedId === null ? (
        <section className="pane pqc-web-list" aria-label={t.queue.heading}>
          <PqcFilterBar
            applied={filters}
            pendingOnly={pendingOnly}
            onTogglePendingOnly={(next) => {
              /* 조건이 바뀌면 결과가 통째로 달라진다 — 첫 쪽으로 간다. */
              setPendingOnly(next);
              setPage(1);
            }}
            onSearch={(next) => {
              setFilters(next);
              setPage(1);
            }}
            onReset={() => {
              setFilters(EMPTY_PQC_FILTERS);
              setPage(1);
            }}
          />

          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <PqcQueueTable rows={rows} onSelect={select} empty={emptyContent} />

          {queue.data !== undefined && <PageNav view={pageView} onChange={setPage} />}
        </section>
      ) : (
        <section className="pane pqc-web-detail" aria-label={t.detail.paneLabel}>
          {/* 목록으로 — 저장하지 않은 입력이 있으면 바로 떠나지 않고 한 번 묻는다(#133 과 같다). */}
          <div className="pqc-web-back">
            <Button
              variant="text"
              size="md"
              className="pqc-web-back-button"
              onClick={() => (dirty ? setConfirmingLeave(true) : select(null))}
            >
              {t.detail.backToList}
            </Button>
            {confirmingLeave && (
              <Dialog
                open
                onClose={() => setConfirmingLeave(false)}
                showCloseButton={false}
                title={t.detail.leaveUnsaved}
                footer={
                  <>
                    <Button
                      variant="outlined"
                      className="app-button-neutral"
                      onClick={() => setConfirmingLeave(false)}
                    >
                      {t.detail.keepEditing}
                    </Button>
                    <Button variant="filled" onClick={() => select(null)}>
                      {t.detail.leaveAnyway}
                    </Button>
                  </>
                }
              >
                <p>{t.detail.leaveUnsavedNote}</p>
              </Dialog>
            )}
          </div>

          <PqcPanel
            /* 의뢰마다 새로 세운다 — 앞 의뢰의 입력이 다음 의뢰에 남지 않게. */
            key={selectedId}
            inspectionRequestId={selectedId}
            submitter={submitter}
            workerNo={null}
            requiresWorker={false}
            withKeypad={false}
            variant="web"
            onDirtyChange={onDirtyChange}
          />
        </section>
      )}
    </>
  );
};
