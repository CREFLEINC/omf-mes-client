import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { CalibrationFilterBar } from './calibration-filter-bar';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
  type CalibrationFilters,
} from './filters';
import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type CalibrationDraft,
  type DraftErrors,
} from './form-draft';
import { HistoryForm } from './history-form';
import { HistoryTable } from './history-table';
import { LoadErrorBanner } from './load-error-banner';
import { equipmentNote, useEquipmentOptions } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useCalibrationCreate, useCalibrationList } from './queries';
import { SaveConfirmDialog } from './save-confirm-dialog';
import { byRecentFirst, type CalibrationView, type SelectOption } from './types';

const t = messages.gaugeCalibration;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: CalibrationView[] = [];

/**
 * W-05-10 컨테이너 — 계측기의 검교정·점검·수리·폐기 이력을 한 표에 담고 새 이력을 덧붙인다.
 *
 * ⛔ **수정·삭제 경로가 없다.** 이력은 불변이고, 잘못 적었으면 **새 이력을 덧붙여** 바로잡는다.
 * 그래서 이 화면에는 편집 버튼도 삭제 버튼도 없고, 대신 **저장 전 확인**이 있다 — 되돌릴 수
 * 없는 쓰기에서 값을 하는 것은 사후 수정이 아니라 사전 확인이다.
 *
 * ⭐ **저장이 계측기 마스터를 갱신한다.** 검교정 유형이고 결과가 합격이면 서버가 같은
 * 트랜잭션에서 최근 검교정일과 차기 예정일을 옮겨 놓는다. ⛔ **화면이 설비 마스터를 따로
 * 부르지 않는다** — 이 오퍼레이션만이 그 두 칸을 쓴다.
 *
 * ⭐ **계측기를 가리키는 칸이 설비 식별자다** — 계측기 전용 자원을 두지 않기로 했다.
 *
 * **주소 키의 수명.**
 *
 * | # | 조작 | `page` |
 * | :-: | --- | --- |
 * | 1 | 조건 변경 · 초기화 | **첫 쪽으로** — 결과가 통째로 달라진다 |
 * | 2 | 쪽 이동 | 옮긴 쪽 |
 * | 3 | 이력 저장 | 그대로 — 목록만 다시 받는다 |
 */
export const GaugeCalibrationScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<CalibrationFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const listQuery = useMemo(() => toListQuery(filters, page), [filters, page]);

  const [draft, setDraft] = useState<CalibrationDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isConfirming, setConfirming] = useState(false);

  const list = useCalibrationList(listQuery);
  const equipments = useEquipmentOptions();

  const rows = useMemo(() => byRecentFirst(list.data?.items ?? EMPTY_ROWS), [list.data?.items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const create = useCalibrationCreate(() => {
    /* 저장이 끝나면 폼을 비운다 — 같은 값이 남아 있으면 두 번 눌러 두 줄이 생긴다. */
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setConfirming(false);
  });

  const equipmentOptions: SelectOption[] = equipments.entries.map((entry) => ({
    value: entry.value,
    label: entry.label,
  }));

  const apply = (nextFilters: CalibrationFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /**
   * 저장 버튼 — **바로 보내지 않고 확인 창을 연다.**
   *
   * 검증은 여기서 먼저 한다. 창을 띄운 뒤에 칸 오류를 알리면 사용자는 창을 닫고 폼으로
   * 돌아가야 하는데, 무엇이 틀렸는지는 창이 가리고 있다.
   */
  const requestSave = (): void => {
    const nextErrors = validateDraft(draft);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    setConfirming(true);
  };

  const confirmSave = (): void => {
    create.write(toCreateBody(draft));
  };

  /* 서버가 준 칸 오류를 화면의 칸 오류와 합친다 — 둘을 따로 그리면 같은 칸에 둘이 선다. */
  const mergedErrors: DraftErrors = {
    ...errors,
    ...(create.fieldErrors.equipmentId === undefined
      ? {}
      : { equipment: create.fieldErrors.equipmentId }),
    ...(create.fieldErrors.historyTypeCode === undefined
      ? {}
      : { historyTypeCode: create.fieldErrors.historyTypeCode }),
    ...(create.fieldErrors.performedOn === undefined
      ? {}
      : { performedOn: create.fieldErrors.performedOn }),
    ...(create.fieldErrors.resultCode === undefined
      ? {}
      : { resultCode: create.fieldErrors.resultCode }),
    ...(create.fieldErrors.nextDueOn === undefined
      ? {}
      : { nextDueOn: create.fieldErrors.nextDueOn }),
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
        <CalibrationFilterBar
          appliedFilters={filters}
          equipmentOptions={equipmentOptions}
          equipmentNote={equipmentNote(equipments)}
          onSearch={(next) => {
            apply(next);
          }}
          onReset={() => {
            apply(EMPTY_FILTERS);
          }}
        />
      </section>

      {!list.isError && (
        <section className="pane" aria-label={t.panes.list}>
          <HistoryTable
            rows={rows}
            isLoading={list.isPending}
            isBeyondLast={pageView.isBeyondLast}
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
        </section>
      )}

      <section className="pane" aria-label={t.panes.form}>
        <SaveErrorBanner error={create.error} />
        <HistoryForm
          draft={draft}
          errors={mergedErrors}
          equipmentOptions={equipmentOptions}
          equipmentNote={equipmentNote(equipments)}
          isSaving={create.isSaving}
          onChange={(next) => {
            setDraft(next);
          }}
          onSubmit={requestSave}
          onReset={() => {
            setDraft(EMPTY_DRAFT);
            setErrors({});
            create.reset();
          }}
        />
      </section>

      <SaveConfirmDialog
        open={isConfirming}
        draft={draft}
        equipmentOptions={equipmentOptions}
        isSaving={create.isSaving}
        onConfirm={confirmSave}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </>
  );
};
