import { Breadcrumb, Button, Dialog, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { DetailPane } from './detail-pane';
import { FailureFilterBar } from './failure-filter-bar';
import { FailureTable } from './failure-table';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelected,
  toListQuery,
  toSearchParams,
  type FailureFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { equipmentNote, useEquipmentOptions } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  useComplete,
  useFailureDetail,
  useFailureList,
  useHandlingUpdate,
  useStartHandling,
} from './queries';
import { openDowntimeWarning } from './transitions';
import type { BreakdownReportView, SelectOption } from './types';

const t = messages.equipmentFailure;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: BreakdownReportView[] = [];

/** 확인이 필요한 전이 둘. 되돌릴 수 없어 누르기 전에 한 번 묻는다. */
type PendingAction = 'start' | 'complete' | null;

/**
 * W-05-04 컨테이너 — 현장이 보고한 고장을 사무가 받아 처리하고 닫는다.
 *
 * ⭐ **상태를 본문으로 받지 않는다.** 「처리 중으로」와 「완료」가 각각 전용 경로이고 **되돌리는
 * 경로가 없다** — 사건 기록이라 전표와 다르다. 그래서 둘 다 확인 창을 거친다.
 *
 * ⭐ **화면이 두 층으로 갈린다** — 현장이 적은 것(고칠 수 없다)과 사무가 적는 것(고칠 수 있다).
 * 그 갈림을 감추지 않는다: 감추면 사용자가 증상을 고치려다 못 고치는 이유를 알 수 없다.
 *
 * ⛔ **보전 지시를 여기서 발행하지 않는다.** 발행은 선택이고 그 자리는 보전지시 발행 화면이다 —
 * 여기서 또 만들면 같은 일을 두 곳에서 하게 된다. 연결된 지시가 있으면 보이기만 한다.
 *
 * **주소 키의 수명.**
 *
 * | # | 조작 | `page` | `breakdown` |
 * | :-: | --- | --- | --- |
 * | 1 | 조건 변경 · 초기화 | **첫 쪽으로** | **비운다** — 고른 건이 결과에 없을 수 있다 |
 * | 2 | 쪽 이동 | 옮긴 쪽 | **비운다** — 같은 이유다 |
 * | 3 | 줄 고르기 | 그대로 | 고른 건 |
 * | 4 | 저장·전이 | 그대로 | 그대로 — 같은 건을 계속 본다 |
 */
export const EquipmentFailureScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FailureFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelected(searchParams);
  const listQuery = useMemo(() => toListQuery(filters, page), [filters, page]);

  const [causeCode, setCauseCode] = useState('');
  const [handlingNote, setHandlingNote] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);

  const list = useFailureList(listQuery);
  const detail = useFailureDetail(selectedId);
  const equipments = useEquipmentOptions();

  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const detailView = detail.data ?? null;

  /*
   * 서버가 준 처리 내용을 편집 상태에 싣는다. **고른 건이 바뀔 때만** 싣는다 — 매번 실으면
   * 사용자가 적던 글이 재조회마다 서버 값으로 되돌아간다.
   */
  useEffect(() => {
    setCauseCode(detailView?.handling.causeCode ?? '');
    setHandlingNote(detailView?.handling.handlingNote ?? '');
  }, [detailView?.breakdownId]);

  const apply = (
    nextFilters: FailureFilters,
    nextPage = 1,
    nextSelected: number | null = null,
  ): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage, nextSelected));
  };

  const closePending = (): void => {
    setPending(null);
  };

  const update = useHandlingUpdate(selectedId, () => {
    void detail.refetch();
  });
  const startHandling = useStartHandling(selectedId, () => {
    closePending();
    void detail.refetch();
  });
  const complete = useComplete(selectedId, () => {
    closePending();
    void detail.refetch();
  });

  const equipmentOptions: SelectOption[] = equipments.entries.map((entry) => ({
    value: entry.value,
    label: entry.label,
  }));

  /* 셋 중 어느 것이든 나가는 중이면 나머지도 잠근다 — 같은 건에 두 쓰기가 겹치면 안 된다. */
  const isSaving = update.isSaving || startHandling.isSaving || complete.isSaving;
  const writeError = update.error ?? startHandling.error ?? complete.error;
  const fieldErrors = { ...update.fieldErrors, ...complete.fieldErrors };

  /**
   * 한 쓰기를 시작하기 전에 **다른 쓰기의 오류를 지운다.**
   *
   * 훅은 자기 오류만 지우므로, 저장이 실패해 남은 칸 오류가 완료를 누른 뒤에도 그대로 서 있다 —
   * 사용자는 방금 누른 완료가 그 이유로 막힌 줄 안다.
   */
  const clearOtherErrors = (keep: 'update' | 'start' | 'complete'): void => {
    if (keep !== 'update') update.reset();
    if (keep !== 'start') startHandling.reset();
    if (keep !== 'complete') complete.reset();
  };

  const confirmPending = (): void => {
    if (pending === 'start') {
      clearOtherErrors('start');
      startHandling.write(undefined);
      return;
    }

    if (pending === 'complete') {
      clearOtherErrors('complete');
      /* 완료 본문은 둘 다 필수다 — 버튼이 이미 그것을 확인했으므로 여기서는 값만 옮긴다. */
      complete.write({ causeCode, handlingNote });
    }
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.filters}>
        <FailureFilterBar
          appliedFilters={filters}
          equipmentOptions={equipmentOptions}
          equipmentNote={equipmentNote(equipments)}
          onSearch={(next) => {
            apply(next);
          }}
          onReset={() => {
            apply(DEFAULT_FILTERS);
          }}
        />
      </section>

      <div className="two-pane">
        <section className="pane" aria-label={t.panes.list}>
          {!list.isError && (
            <>
              <FailureTable
                rows={rows}
                selectedId={selectedId}
                isLoading={list.isPending}
                isBeyondLast={pageView.isBeyondLast}
                onSelect={(breakdownId) => {
                  apply(filters, page, breakdownId);
                }}
                onFirstPage={() => {
                  apply(filters);
                }}
              />
              {!list.isPending && !pageView.isBeyondLast && (
                <PageNav
                  view={pageView}
                  onChange={(nextPage) => {
                    apply(filters, nextPage);
                  }}
                />
              )}
            </>
          )}
        </section>

        <section className="pane" aria-label={t.panes.detail}>
          {detail.isError ? (
            <LoadErrorBanner
              error={detail.error}
              onRetry={() => {
                void detail.refetch();
              }}
            />
          ) : (
            <>
              <SaveErrorBanner error={writeError} />
              <DetailPane
                detail={detailView}
                isLoading={detail.isPending && selectedId !== null}
                causeCode={causeCode}
                handlingNote={handlingNote}
                fieldErrors={fieldErrors}
                isSaving={isSaving}
                onChangeCause={setCauseCode}
                onChangeNote={setHandlingNote}
                onSave={() => {
                  clearOtherErrors('update');
                  /* 빈 값은 「지운다」가 아니라 「아직 안 적었다」다 — `null`로 보낸다. */
                  update.write({
                    causeCode: causeCode === '' ? null : causeCode,
                    handlingNote: handlingNote.trim() === '' ? null : handlingNote,
                  });
                }}
                onStartHandling={() => {
                  setPending('start');
                }}
                onComplete={() => {
                  setPending('complete');
                }}
              />
            </>
          )}
        </section>
      </div>

      {/*
       * ⭐ 되돌릴 수 없는 전이 둘의 확인 창. **바깥을 눌러 닫히게 두지 않는다** — 실수로 닫히면
       * 다시 확인해야 하고, 그 사이 무엇을 누른 것인지 사용자가 헷갈린다.
       */}
      <Dialog
        open={pending !== null}
        onClose={closePending}
        title={
          pending === 'complete'
            ? t.actions.completeConfirmTitle
            : t.actions.startHandlingConfirmTitle
        }
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={closePending} disabled={isSaving}>
              {t.actions.cancel}
            </Button>
            <Button onClick={confirmPending} disabled={isSaving}>
              {t.actions.confirm}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">
          {pending === 'complete' ? t.actions.completeConfirm : t.actions.startHandlingConfirm}
        </p>
        {/* 완료 직전에 한 번 더 알린다 — 완료해도 비가동은 닫히지 않는다. */}
        {pending === 'complete' && openDowntimeWarning(detailView) !== null && (
          <p className="dialog-lead">{openDowntimeWarning(detailView)}</p>
        )}
      </Dialog>
    </>
  );
};
