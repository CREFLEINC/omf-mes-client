import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  Dialog,
  EmptyState,
  Icon,
  Skeleton,
  Tabs,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  FilterMoreButton,
  HiddenFilterChips,
  type HiddenFilterChip,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { InfoTip } from '../../patterns/info-tip';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { ManagedTable } from '../../patterns/managed-table';
import { SaveErrorBanner } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import { AckPanel } from './ack-panel';
import {
  isClosable,
  isEditable,
  isPublishable,
  needsWorkOrder,
  scopeLabel,
  statusLabel,
  statusTone,
  SCOPE_CODES,
  isSupportedScope,
} from './codes';
import {
  EMPTY_FILTERS,
  periodError,
  readFilters,
  readSelected,
  readSize,
  STATUS_TABS,
  statusTabOf,
  toSearchParams,
  withStatusTab,
  type StatusTab,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { useWorkOrderOptions } from './lookups';
import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  toDraft,
  validateDraft,
  type DraftErrors,
  type NoticeDraft,
} from './notice-draft';
import { NoticeForm } from './notice-form';
import {
  useAcknowledge,
  useAcknowledgements,
  useNoticeClose,
  useNoticeCreate,
  useNoticeDetail,
  useNoticePublish,
  useNotices,
  useNoticeUpdate,
  useUnacknowledgedByMe,
} from './queries';
import { SelectField } from './select-field';
import { formatMoment, formatPeriod, type NoticeView, type SelectOption } from './types';

/** 상세의 게시 기간 — 종료일이 없으면 「…부터 (종료일 없음)」(#361 시안). */
const detailPeriod = (view: NoticeView): string =>
  view.endDate === null
    ? messages.notice.detail.periodOpen(view.startDate)
    : formatPeriod(view.startDate, view.endDate, messages.notice.detail.noEndDate);

const t = messages.notice;

const EMPTY_ROWS: NoticeView[] = [];

type FormMode = 'closed' | 'create' | 'edit';
type Confirming = 'none' | 'publish' | 'close';

/**
 * W-CO-04 컨테이너 — 알릴 것을 쓰고, 게시하고, 누가 확인했는지 본다.
 *
 * ⛔⛔ **게시된 공지의 본문을 고치는 화면을 만들지 않는다.** 고치면 이미 확인한 사람이 다른
 * 것을 본 것이 되고, 확인 이력이 무엇에 대한 확인인지 알 수 없어진다 — 서버도 409 로 막지만
 * 화면이 먼저 잠근다. 사람이 본문을 다 고친 뒤에 거부당하면 그 글이 어디에도 남지 않는다.
 *
 * ⭐ **상태는 서버가 파생한다** — 게시 여부와 오늘 날짜로 정해진다. 상태를 직접 쓰는 액션을
 * 만들지 않고, 「내려버리기」도 상태를 바꾸는 것이 아니라 **종료일을 오늘로 당기는 것**이다.
 * 지우지 않는 이유는 확인 이력이 남아야 하기 때문이다.
 *
 * ⭐ **확인 대상 인원을 셀 수 없는 범위가 있다** — 작업지시에는 사람을 배정하는 자리가 없다.
 * ⛔ 그때 0을 그리지 않는다: 「셀 수 없음」과 「아무도 안 봤음」이 같아 보이면 관리자가 독촉할
 * 대상을 잘못 고른다.
 *
 * **조회 조건과 고른 공지는 주소가 소유한다** — 새로고침·공유가 같은 화면을 연다.
 *
 * **보이는 조건은 셋이다**(C-6) — 제목 · 상태 · 게시 기간(시작 · 끝을 하나로 센다). 대상 범위와
 * 체크칸 둘은 「조건 더보기」에 접고, 걸려 있으면 칩으로 알린다. 「게시 중만」은 기본이 켜짐이라
 * 처음부터 칩이 보인다 — 끝난 공지가 왜 안 보이는지가 접혀서도 드러난다.
 * 「조건 지우기」는 처음 값과 다른 것이 있을 때만 보인다.
 */
export const NoticeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const more = useFilterMore();
  const filters = readFilters(searchParams);
  const selectedId = readSelected(searchParams);
  const size = readSize(searchParams);
  const invalidPeriod = periodError(filters);

  const [search, setSearch] = useState(filters.q);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirming, setConfirming] = useState<Confirming>('none');
  const [pendingOnly, setPendingOnly] = useState(false);
  /** 방금 무엇을 했는지 한 줄로 말한다. 저장하면 폼이 닫혀 화면만으로는 알 수 없다. */
  const [flash, setFlash] = useState<string | null>(null);

  const workOrders = useWorkOrderOptions();
  const notices = useNotices(filters, size);
  const detail = useNoticeDetail(selectedId);
  const selected = detail.data ?? null;

  const acks = useAcknowledgements(
    selectedId,
    selected !== null && selected.acknowledgeRequired,
    pendingOnly,
  );

  const create = useNoticeCreate((created) => {
    /* 새 공지로 옮겨 간 뒤에 안내를 띄운다 — 옮기기(`selectNotice`)가 안내를 지우므로 순서가 바뀌면 안내가 안 뜬다. */
    selectNotice(created.noticeId);
    setFlash(t.form.saved);
  });

  const update = useNoticeUpdate(selectedId, () => {
    setFormMode('closed');
    setFlash(t.form.saved);
  });

  const publish = useNoticePublish(selectedId, () => {
    setConfirming('none');
    setFlash(t.detail.published);
  });

  const close = useNoticeClose(selectedId, () => {
    setConfirming('none');
    setFlash(t.detail.closed);
  });

  /*
   * 목록에서 고르면 확인한 것으로 친다(#361 — 「확인했습니다」 · 「확인 없이 닫기」 단추 대신).
   * ⛔ 아직 확인하지 않은 게시 중 공지일 때만, 고른 공지마다 한 번만 보낸다 — 다시 보내면 서버가
   * 확인 일시를 덮어써 확인 현황의 시각이 「마지막으로 연 때」가 된다.
   */
  const acknowledge = useAcknowledge(selectedId, () => {
    void acks.refetch();
  });
  const unacknowledged = useUnacknowledgedByMe(selected);
  const acknowledgedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (selected === null || unacknowledged.data !== true) return;
    if (acknowledgedIdRef.current === selected.noticeId) return;

    acknowledgedIdRef.current = selected.noticeId;
    acknowledge.write({});
  }, [selected, unacknowledged.data, acknowledge]);

  const rows = notices.data?.items ?? EMPTY_ROWS;

  const apply = (next: Partial<typeof filters>): void => {
    setSearchParams(
      toSearchParams({ ...filters, ...next, page: next.page ?? 1 }, selectedId, size),
    );
  };

  const selectNotice = (noticeId: number | null): void => {
    setSearchParams(toSearchParams(filters, noticeId, size));
    setFormMode('closed');
    setFlash(null);
    setPendingOnly(false);
    create.reset();
    update.reset();
    publish.reset();
    close.reset();
    acknowledge.reset();
  };

  const openCreate = (): void => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setFormMode('create');
    setFlash(null);
    create.reset();
    update.reset();
  };

  const openEdit = (): void => {
    if (selected === null) return;

    setDraft(toDraft(selected));
    setErrors({});
    setFormMode('edit');
    setFlash(null);
    create.reset();
    update.reset();
  };

  const submit = (): void => {
    const next = validateDraft(draft);

    setErrors(next);
    if (hasErrors(next)) return;

    const body = toCreateBody(draft);

    if (formMode === 'create') create.write(body);
    else update.write(body);
  };

  const scopeFilterOptions: SelectOption[] = SCOPE_CODES.filter(isSupportedScope).map((code) => ({
    value: code,
    label: scopeLabel(code),
  }));

  /*
   * 접힌 칸(대상 범위 · 체크칸 둘)에 걸린 조건만 칩으로 — 보이는 칸의 값은 칩으로 겹쳐 적지 않는다.
   * 조건은 바꾸는 즉시 나가므로 × 도 곧바로 다시 조회한다.
   */
  const hiddenChips: HiddenFilterChip<'scopeCode' | 'unacknowledgedByMe'>[] = [
    ...(filters.scopeCode === ''
      ? []
      : [
          {
            key: 'scopeCode' as const,
            label: t.filters.chipScope(scopeLabel(filters.scopeCode)),
            removeLabel: messages.common.filterMore.remove(t.filters.scope),
          },
        ]),
    ...(filters.unacknowledgedByMe
      ? [{ key: 'unacknowledgedByMe' as const, label: t.filters.unacknowledgedByMe }]
      : []),
  ];

  /*
   * 쪽은 조건이 아니다 — 견줄 때 첫 쪽으로 맞춘다. 제목 칸은 조회 전에도 편집 중인 값으로 본다.
   * 상태는 목록 위 탭이 맡아 조회 상자의 [초기화] 대상이 아니다(#361).
   */
  const statusTab = statusTabOf(filters);
  const baseFilters = { ...EMPTY_FILTERS, ...withStatusTab(statusTab) };
  const isFilterChanged = hasChangedFilters(
    baseFilters,
    { ...filters, q: search, page: 1 },
    { ...filters, page: 1 },
  );

  /** 조회 — 같은 조건이면 다시 부른다(품질 화면과 같게 · #361). */
  const searchNow = (): void => {
    if (search === filters.q && filters.page === 1) void notices.refetch();
    apply({ q: search });
  };

  const resetFilters = (): void => {
    setSearch('');
    setSearchParams(toSearchParams(baseFilters, selectedId, size));
  };

  const columns: Column<NoticeView>[] = [
    {
      key: 'title',
      header: t.list.title,
      width: '280px',
      /* 제목은 글자만 — 줄 아무 곳이나 눌러 고른다(#361). */
      render: (row) => row.title,
    },
    {
      key: 'status',
      header: t.list.status,
      width: '110px',
      align: 'center',
      render: (row) => (
        <Chip variant="status" size="sm" status={statusTone(row.statusCode)}>
          {statusLabel(row.statusCode)}
        </Chip>
      ),
    },
    {
      key: 'scope',
      header: t.list.scope,
      width: '140px',
      /*
       * ⭐ 작업지시 번호는 **범위가 작업지시일 때만** 뜻이 있다. 범위를 바꾸며 만든 공지에
       * 옛 번호가 남아 있을 수 있는데, 그것을 전사 공지 옆에 그리면 대상이 좁아 보인다.
       */
      render: (row) => (
        <span className="stacked-cell">
          <span>{scopeLabel(row.scopeCode)}</span>
          <span>
            {needsWorkOrder(row.scopeCode)
              ? (row.targetWorkOrderNo ?? t.list.notAvailable)
              : t.list.notAvailable}
          </span>
        </span>
      ),
    },
    {
      key: 'period',
      header: t.list.period,
      width: '220px',
      render: (row) => formatPeriod(row.startDate, row.endDate, t.detail.noEndDate),
    },
    {
      key: 'ack',
      header: t.list.ack,
      width: '120px',
      align: 'end',
      /* ⛔ 분모를 셀 수 없으면 분자만 낸다 — 0으로 채우면 「아무도 안 봤음」과 같아 보인다. */
      render: (row) => {
        if (!row.acknowledgeRequired) return t.list.ackNotRequired;

        return row.targetCount === null
          ? t.list.ackDoneOnly(row.acknowledgedCount)
          : t.list.ackOf(row.acknowledgedCount, row.targetCount);
      },
    },
  ];

  const editable = selected !== null && isEditable(selected.statusCode);

  /** 목록 위 상태 탭 — 고르면 바로 조회한다(품질 화면의 선택칸 · 체크칸처럼 · #361). */
  const statusTabItems = STATUS_TABS.map((value: StatusTab) => ({
    value,
    label: value === 'ALL' ? t.filters.statusTabAll : statusLabel(value),
    content: null,
  }));

  const listContent = (
    <>
      {notices.isError ? (
        <LoadErrorBanner
          error={notices.error}
          onRetry={() => {
            void notices.refetch();
          }}
        />
      ) : notices.isPending ? (
        <Skeleton variant="rect" height="12rem" />
      ) : (
        <ManagedTable
          storageKey="omf-mes:notice:columns"
          className="notice-table"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.noticeId)}
          caption={t.panes.list}
          scrollX
          /* 줄 아무 곳이나 눌러 고른다 · 고른 줄을 한 번 더 누르면 고르기를 푼다(사용자 지시 2026-11-24 · #361). */
          onRowClick={(row) => {
            selectNotice(row.noticeId === selectedId ? null : row.noticeId);
          }}
          empty={<EmptyState size="sm" live title={t.list.emptyTitle} description={t.list.empty} />}
        />
      )}
      {/* 0건이면 쪽 이동 줄을 내지 않는다 — 넘길 쪽이 없다(#361). */}
      {notices.data !== undefined && notices.data.page.total > 0 && (
        <PageNav
          meta={notices.data.page}
          onChangePage={(page) => {
            apply({ page });
          }}
          onChangeSize={(nextSize) => {
            setSearchParams(toSearchParams({ ...filters, page: 1 }, selectedId, nextSize));
          }}
        />
      )}
    </>
  );

  /** 상세 상자 — 시안(#361): 제목 「공지 상세」 + 상태 라벨, 정보 · 본문, 아래 줄에 안내와 단추. */
  const detailContent = (): ReactNode => {
    if (selectedId === null) {
      return (
        <EmptyState
          size="sm"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="layers" size={20} />
            </span>
          }
          title={t.list.selectTitle}
          description={t.list.select}
        />
      );
    }

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

    if (detail.isPending || selected === null) return <Skeleton variant="rect" height="10rem" />;

    return (
      <>
        <div className="notice-detail-head">
          <h2 className="pane-title">{t.panes.detail}</h2>
          <Chip variant="status" size="sm" status={statusTone(selected.statusCode)}>
            {statusLabel(selected.statusCode)}
          </Chip>
        </div>

        <SaveErrorBanner error={publish.error ?? close.error} />
        <SaveErrorBanner error={acknowledge.error} />

        <dl className="token-meta notice-detail-facts">
          <dt>{t.list.scope}</dt>
          <dd>
            {scopeLabel(selected.scopeCode)}
            {needsWorkOrder(selected.scopeCode) && selected.targetWorkOrderNo !== null
              ? ` · ${selected.targetWorkOrderNo}`
              : ''}
          </dd>
          <dt>{t.detail.period}</dt>
          <dd>{detailPeriod(selected)}</dd>
          <dt>{t.detail.publishedAt}</dt>
          <dd>
            {selected.publishedAt === null
              ? t.list.notAvailable
              : formatMoment(selected.publishedAt)}
          </dd>
        </dl>

        <p className="notice-body">{selected.body}</p>

        <div className="notice-detail-footer">
          {/* ⛔⛔ 게시 뒤에는 본문을 고칠 수 없다 — 잠근 이유를 잠근 자리에 적는다. */}
          <p className="field-note">{editable ? '' : t.detail.lockedAfterPublish}</p>
          <div className="form-actions">
            <Button
              variant="tonal"
              onClick={() => {
                selectNotice(null);
              }}
            >
              {messages.common.close}
            </Button>
            {editable && (
              <Button variant="outlined" onClick={openEdit}>
                {t.form.edit}
              </Button>
            )}
            {isClosable(selected.statusCode) && (
              <Button
                variant="outlined"
                disabled={close.isSaving}
                onClick={() => {
                  setConfirming('close');
                }}
              >
                {t.detail.close}
              </Button>
            )}
            {isPublishable(selected.statusCode) && (
              <Button
                disabled={publish.isSaving}
                onClick={() => {
                  setConfirming('publish');
                }}
              >
                {t.detail.publish}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  };

  const isSaving = create.isSaving || update.isSaving;

  return (
    <>
      {/* 화면 제목 줄은 두지 않는다 — 조회 조건 · 목록 · 상세 통일 배치(검사 조회·판정과 같다 · #350). */}
      <ListDetailWorkspace
        storageKey="omf-mes:notice"
        filter={{
          label: messages.common.paneList.filter,
          content: (
            <>
              <div className="filter-bar notice-filter">
                {/* 품질 화면(검사 조회·판정)과 같은 입력칸 — 돋보기 없이 흐린 문구로 안내한다(#361). */}
                <TextField
                  label={t.filters.search}
                  value={search}
                  placeholder={t.filters.searchPlaceholder}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      searchNow();
                    }
                  }}
                />

                <div className="field-cell notice-filter-period">
                  {/* ⭐ 시작일이 아니라 겹침으로 거른다 — 기간 칸 라벨 옆 ⓘ 로(관리웹 정리 시안 A). */}
                  <span className="info-label">
                    <span className="field-label">{t.filters.from}</span>
                    <InfoTip text={t.filters.periodNote} />
                  </span>
                  <DatePicker
                    mode="single"
                    clearable
                    placeholder={messages.common.selectDate}
                    value={filters.overlapFrom === '' ? null : filters.overlapFrom}
                    onChange={(value) => {
                      apply({ overlapFrom: value ?? '' });
                    }}
                  />
                </div>

                <div className="field-cell notice-filter-period">
                  <span className="field-label">{t.filters.to}</span>
                  <DatePicker
                    mode="single"
                    clearable
                    placeholder={messages.common.selectDate}
                    invalid={invalidPeriod !== undefined}
                    value={filters.overlapTo === '' ? null : filters.overlapTo}
                    onChange={(value) => {
                      apply({ overlapTo: value ?? '' });
                    }}
                  />
                  {invalidPeriod !== undefined && (
                    <span className="field-error">{invalidPeriod}</span>
                  )}
                </div>

                {/* [조회] → [초기화(조건을 바꿨을 때만)] → [조건 더보기] | [새 공지 쓰기] — 품질 화면과 같은 차례. */}
                <div className="field-cell field-cell-unlabeled notice-filter-actions">
                  <div className="filter-actions">
                    <Button onClick={searchNow}>{messages.common.search}</Button>
                    {isFilterChanged && (
                      <Button variant="outlined" onClick={resetFilters}>
                        {messages.common.reset}
                      </Button>
                    )}
                    <FilterMoreButton
                      open={more.isOpen}
                      controlsId={more.id}
                      onToggle={more.toggle}
                    />
                    <span className="inspection-standard-filter-divider" aria-hidden />
                    <Button onClick={openCreate}>{t.form.create}</Button>
                  </div>
                </div>
              </div>

              {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
              <div id={more.id} hidden={!more.isOpen}>
                <div className="filter-bar notice-filter">
                  <SelectField
                    label={t.filters.scope}
                    options={scopeFilterOptions}
                    value={filters.scopeCode}
                    placeholder={t.filters.scopeAll}
                    onChange={(value) => {
                      apply({ scopeCode: value });
                    }}
                  />

                  <div className="field-cell field-cell-unlabeled check-group check-group-row notice-filter-options">
                    <Checkbox
                      checked={filters.unacknowledgedByMe}
                      onChange={(event) => {
                        apply({ unacknowledgedByMe: event.target.checked });
                      }}
                    >
                      {t.filters.unacknowledgedByMe}
                    </Checkbox>
                  </div>
                </div>
              </div>

              <HiddenFilterChips
                open={more.isOpen}
                chips={hiddenChips}
                onRemove={(key) => {
                  if (key === 'scopeCode') apply({ scopeCode: '' });
                  else apply({ unacknowledgedByMe: false });
                }}
              />
            </>
          ),
        }}
        list={{
          label: t.panes.list,
          title: t.panes.list,
          count: notices.data?.page.total,
          content: (
            <>
              {/* 상태 탭 — 「게시 중만」 체크 · 상태 선택칸 대신 목록 위에서 고른다(#361). 기본은 종전처럼 「게시 중」. */}
              <Tabs
                aria-label={t.filters.status}
                items={statusTabItems}
                value={statusTab}
                onChange={(next) => {
                  const tab = STATUS_TABS.find((value) => value === next);
                  if (tab !== undefined) apply(withStatusTab(tab));
                }}
              />
              {listContent}
            </>
          ),
        }}
        detail={{
          label: t.panes.detail,
          bare: true,
          content: (
            <>
              {/*
               * 저장 · 게시 · 마감 안내 — 상세 상자 위에 둔다(통일 배치 밖에 두면 안내가 뜨고 질 때 목록 | 상세 높이가
               * 창 바닥과 어긋난다 · #350 리뷰).
               */}
              {flash !== null && (
                <div className="banner-slot">
                  <AlertBanner
                    variant="success"
                    onDismiss={() => {
                      setFlash(null);
                    }}
                    dismissLabel={messages.common.close}
                  >
                    {flash}
                  </AlertBanner>
                </div>
              )}
              <section className="pane notice-pane notice-detail">{detailContent()}</section>

              {selected !== null && (
                <section className="pane notice-pane" aria-label={t.panes.ack}>
                  <h2 className="pane-title info-label">
                    {t.ack.title}
                    {/* 사번으로 보이는 행의 뜻은 제목 옆 ⓘ 로 — 확인을 받는 공지에서만 목록이 있다(관리웹 정리 시안 A). */}
                    {selected.acknowledgeRequired && <InfoTip text={t.ack.workerNote} />}
                  </h2>
                  <AckPanel
                    required={selected.acknowledgeRequired}
                    pendingOnly={pendingOnly}
                    isPending={acks.isPending}
                    isError={acks.isError}
                    error={acks.error}
                    data={acks.data}
                    hasDenominator={selected.targetCount !== null}
                    onPendingOnlyChange={setPendingOnly}
                    onRetry={() => {
                      void acks.refetch();
                    }}
                  />
                </section>
              )}
            </>
          ),
        }}
      />

      {/* 새 공지 쓰기 · 공지 고치기 — 상세 자리 대신 팝업으로(#361). */}
      <Dialog
        open={formMode !== 'closed'}
        onClose={() => {
          if (!isSaving) setFormMode('closed');
        }}
        size="lg"
        title={formMode === 'edit' ? t.form.edit : t.form.create}
        closeOnBackdropClick={false}
        showCloseButton={false}
        footer={
          <>
            {isSaving && <p className="field-note form-actions-secondary">{t.form.saving}</p>}
            <Button
              variant="outlined"
              disabled={isSaving}
              onClick={() => {
                setFormMode('closed');
              }}
            >
              {t.form.cancel}
            </Button>
            <Button disabled={isSaving} onClick={submit}>
              {t.form.save}
            </Button>
          </>
        }
      >
        <NoticeForm
          draft={draft}
          errors={errors}
          saveError={formMode === 'create' ? create.error : update.error}
          fieldErrors={formMode === 'create' ? create.fieldErrors : update.fieldErrors}
          workOrders={workOrders}
          onChange={(patch) => {
            setDraft((prev) => ({ ...prev, ...patch }));
          }}
        />
      </Dialog>

      <Dialog
        open={confirming !== 'none'}
        onClose={() => {
          setConfirming('none');
        }}
        title={confirming === 'close' ? t.detail.closeTitle : t.detail.publishTitle}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              disabled={publish.isSaving || close.isSaving}
              onClick={() => {
                setConfirming('none');
              }}
            >
              {t.detail.cancel}
            </Button>
            <Button
              disabled={publish.isSaving || close.isSaving}
              onClick={() => {
                if (confirming === 'close') close.write({});
                else publish.write({});
              }}
            >
              {t.detail.confirm}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">
          {confirming === 'close' ? t.detail.closeLead : t.detail.publishLead}
        </p>
      </Dialog>
    </>
  );
};
