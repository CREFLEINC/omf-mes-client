import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  Dialog,
  EmptyState,
  PageHeader,
  SearchInput,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { AckPanel } from './ack-panel';
import {
  isClosable,
  isEditable,
  isPublishable,
  needsWorkOrder,
  scopeLabel,
  statusLabel,
  STATUS_CODES,
  SCOPE_CODES,
  isSupportedScope,
} from './codes';
import { EMPTY_FILTERS, periodError, readFilters, readSelected, toSearchParams } from './filters';
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
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  useAcknowledge,
  useAcknowledgements,
  useDismiss,
  useNoticeClose,
  useNoticeCreate,
  useNoticeDetail,
  useNoticePublish,
  useNotices,
  useNoticeUpdate,
} from './queries';
import { SelectField } from './select-field';
import { formatMoment, formatPeriod, type NoticeView, type SelectOption } from './types';

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
 */
export const NoticeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const selectedId = readSelected(searchParams);
  const invalidPeriod = periodError(filters);

  const [search, setSearch] = useState(filters.q);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirming, setConfirming] = useState<Confirming>('none');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const workOrders = useWorkOrderOptions();
  const notices = useNotices(filters);
  const detail = useNoticeDetail(selectedId);
  const selected = detail.data ?? null;

  const acks = useAcknowledgements(
    selectedId,
    selected !== null && selected.acknowledgeRequired,
    pendingOnly,
  );

  const create = useNoticeCreate((created) => {
    setFormMode('closed');
    setNotice(t.form.saved);
    selectNotice(created.noticeId);
  });

  const update = useNoticeUpdate(selectedId, () => {
    setFormMode('closed');
    setNotice(t.form.saved);
  });

  const publish = useNoticePublish(selectedId, () => {
    setConfirming('none');
    setNotice(t.detail.published);
  });

  const close = useNoticeClose(selectedId, () => {
    setConfirming('none');
    setNotice(t.detail.closed);
  });

  const acknowledge = useAcknowledge(selectedId, () => {
    setNotice(t.detail.acknowledged);
    void acks.refetch();
  });

  const dismiss = useDismiss(selectedId, () => {
    setNotice(t.detail.dismissed);
  });

  const rows = notices.data?.items ?? EMPTY_ROWS;
  const pageView = notices.data === undefined ? null : toPageView(notices.data.page, rows.length);

  const apply = (next: Partial<typeof filters>): void => {
    setSearchParams(toSearchParams({ ...filters, ...next, page: next.page ?? 1 }, selectedId));
  };

  const selectNotice = (noticeId: number | null): void => {
    setSearchParams(toSearchParams(filters, noticeId));
    setFormMode('closed');
    setNotice(null);
    setPendingOnly(false);
    create.reset();
    update.reset();
    publish.reset();
    close.reset();
    acknowledge.reset();
    dismiss.reset();
  };

  const openCreate = (): void => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setFormMode('create');
    setNotice(null);
    create.reset();
    update.reset();
  };

  const openEdit = (): void => {
    if (selected === null) return;

    setDraft(toDraft(selected));
    setErrors({});
    setFormMode('edit');
    setNotice(null);
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

  const statusOptions: SelectOption[] = STATUS_CODES.map((code) => ({
    value: code,
    label: statusLabel(code),
  }));

  const scopeFilterOptions: SelectOption[] = SCOPE_CODES.filter(isSupportedScope).map((code) => ({
    value: code,
    label: scopeLabel(code),
  }));

  const columns: Column<NoticeView>[] = [
    {
      key: 'title',
      header: t.list.title,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            selectNotice(row.noticeId);
          }}
        >
          {row.title}
        </Button>
      ),
    },
    {
      key: 'status',
      header: t.list.status,
      render: (row) => <Chip size="sm">{statusLabel(row.statusCode)}</Chip>,
    },
    {
      key: 'scope',
      header: t.list.scope,
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
      render: (row) => formatPeriod(row.startDate, row.endDate, t.detail.noEndDate),
    },
    {
      key: 'ack',
      header: t.list.ack,
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

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={<Button onClick={openCreate}>{t.form.create}</Button>}
      />

      {notice !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            onDismiss={() => {
              setNotice(null);
            }}
          >
            {notice}
          </AlertBanner>
        </div>
      )}

      <section className="pane" aria-label={t.panes.list}>
        <h2>{t.panes.list}</h2>
        <div className="filter-bar">
          <div className="field-cell">
            <span className="field-label">{t.filters.search}</span>
            <SearchInput
              value={search}
              placeholder={t.filters.searchPlaceholder}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              onSearch={() => {
                apply({ q: search });
              }}
            />
          </div>

          <SelectField
            label={t.filters.status}
            options={statusOptions}
            value={filters.statusCode}
            placeholder={t.filters.statusAll}
            note={t.status.derived}
            onChange={(value) => {
              apply({ statusCode: value });
            }}
          />

          <SelectField
            label={t.filters.scope}
            options={scopeFilterOptions}
            value={filters.scopeCode}
            placeholder={t.filters.scopeAll}
            onChange={(value) => {
              apply({ scopeCode: value });
            }}
          />

          <div className="field-cell">
            <span className="field-label">{t.filters.from}</span>
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

          <div className="field-cell">
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
            {invalidPeriod !== undefined && <span className="field-error">{invalidPeriod}</span>}
          </div>

          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={filters.activeOnly}
              onChange={(event) => {
                apply({ activeOnly: event.target.checked });
              }}
            >
              {t.filters.activeOnly}
            </Checkbox>
            <Checkbox
              checked={filters.unacknowledgedByMe}
              onChange={(event) => {
                apply({ unacknowledgedByMe: event.target.checked });
              }}
            >
              {t.filters.unacknowledgedByMe}
            </Checkbox>
          </div>

          <div className="form-actions">
            <Button
              variant="outlined"
              onClick={() => {
                setSearch('');
                setSearchParams(toSearchParams(EMPTY_FILTERS, selectedId));
              }}
            >
              {t.filters.clear}
            </Button>
          </div>
        </div>
        {/* ⭐ 시작일이 아니라 겹침으로 거른다는 사실을 기간 칸 아래에 적는다. */}
        <p className="pane-lead">{t.filters.periodNote}</p>

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
          <div className="wide-table">
            <Table
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.noticeId)}
              density="compact"
              empty={
                <EmptyState size="sm" live title={t.list.emptyTitle} description={t.list.empty} />
              }
            />
          </div>
        )}
        {pageView !== null && (
          <PageNav
            view={pageView}
            onChange={(page) => {
              apply({ page });
            }}
          />
        )}
      </section>

      <section className="pane" aria-label={t.panes.detail}>
        <h2>{formMode === 'create' ? t.form.create : t.panes.detail}</h2>

        {formMode !== 'closed' ? (
          <NoticeForm
            draft={draft}
            errors={errors}
            isSaving={create.isSaving || update.isSaving}
            saveError={formMode === 'create' ? create.error : update.error}
            fieldErrors={formMode === 'create' ? create.fieldErrors : update.fieldErrors}
            workOrders={workOrders}
            onChange={(patch) => {
              setDraft((prev) => ({ ...prev, ...patch }));
            }}
            onSubmit={submit}
            onCancel={() => {
              setFormMode('closed');
            }}
          />
        ) : selectedId === null ? (
          <EmptyState size="sm" title={t.list.selectTitle} description={t.list.select} />
        ) : detail.isError ? (
          <LoadErrorBanner
            error={detail.error}
            onRetry={() => {
              void detail.refetch();
            }}
          />
        ) : detail.isPending || selected === null ? (
          <Skeleton variant="rect" height="10rem" />
        ) : (
          <>
            <SaveErrorBanner error={publish.error ?? close.error} />
            <SaveErrorBanner error={acknowledge.error ?? dismiss.error} />

            <dl className="token-meta">
              <dt>{t.list.status}</dt>
              <dd>{statusLabel(selected.statusCode)}</dd>
              <dt>{t.detail.period}</dt>
              <dd>{formatPeriod(selected.startDate, selected.endDate, t.detail.noEndDate)}</dd>
              <dt>{t.list.scope}</dt>
              <dd>
                {scopeLabel(selected.scopeCode)}
                {needsWorkOrder(selected.scopeCode) && selected.targetWorkOrderNo !== null
                  ? ` · ${selected.targetWorkOrderNo}`
                  : ''}
              </dd>
              <dt>{t.detail.publishedAt}</dt>
              <dd>
                {selected.publishedAt === null
                  ? t.list.notAvailable
                  : formatMoment(selected.publishedAt)}
              </dd>
            </dl>

            <p className="notice-body">{selected.body}</p>

            {/* ⛔⛔ 게시 뒤에는 본문을 고칠 수 없다 — 잠근 이유를 잠근 자리에 적는다. */}
            {!editable && <p className="pane-lead">{t.detail.lockedAfterPublish}</p>}

            <div className="form-actions">
              <Button
                variant="outlined"
                disabled={acknowledge.isSaving}
                onClick={() => {
                  acknowledge.write({});
                }}
              >
                {t.detail.acknowledge}
              </Button>
              <Button
                variant="outlined"
                /* ⚠ 확인을 요구한 공지는 그냥 닫을 수 없다 — 서버가 거부한다. */
                disabled={selected.acknowledgeRequired || dismiss.isSaving}
                onClick={() => {
                  dismiss.write({});
                }}
              >
                {t.detail.dismiss}
              </Button>
              <Button variant="outlined" disabled={!editable} onClick={openEdit}>
                {t.form.edit}
              </Button>
              <Button
                variant="outlined"
                disabled={!isClosable(selected.statusCode) || close.isSaving}
                onClick={() => {
                  setConfirming('close');
                }}
              >
                {t.detail.close}
              </Button>
              <Button
                disabled={!isPublishable(selected.statusCode) || publish.isSaving}
                onClick={() => {
                  setConfirming('publish');
                }}
              >
                {t.detail.publish}
              </Button>
            </div>
            {selected.acknowledgeRequired && <p className="field-note">{t.detail.dismissLocked}</p>}
          </>
        )}
      </section>

      {selected !== null && formMode === 'closed' && (
        <section className="pane" aria-label={t.panes.ack}>
          <h2>{t.ack.title}</h2>
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
