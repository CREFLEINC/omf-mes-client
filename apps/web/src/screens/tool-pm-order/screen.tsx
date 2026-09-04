import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, usePlantOptions, useUserOptions } from './lookups';
import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type DraftErrors,
  type ToolOrderDraft,
} from './order-draft';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useBulkOrderCreate, useMoldList, type MoldListQuery } from './queries';
import { SelectField } from './select-field';
import {
  dueAxisLabel,
  formatCount,
  formatRatio,
  isOverLimit,
  toProgressValue,
  type MoldView,
  type SelectOption,
} from './types';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
  type ToolFilters,
} from './filters';

const t = messages.toolPmOrder;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: MoldView[] = [];

/** 값이 없는 칸. ⛔ 0으로 채우지 않는다 — 「0이었다」와 「낼 수 없다」는 다른 사실이다. */
const notComputable = (value: number | null, format: (value: number) => string): string =>
  value === null ? t.table.notComputable : format(value);

/**
 * W-05-02 컨테이너 — 예방보전이 도래한 툴을 보고 오더를 낸다.
 *
 * ⭐ **도래 판정을 서버가 한다.** 화면은 날짜도 초과율도 계산하지 않고 서버가 준 값과 「왜
 * 도래했는가」를 그대로 옮긴다 — 계산하면 서버 값과 갈리고, 갈린 순간 어느 쪽이 맞는지
 * 화면에서 확인할 수단이 없다.
 *
 * ⭐ **한 오더 = 한 툴이다.** 여럿을 고르면 오더가 여럿 만들어지고 **일부만 성공할 수 있다** —
 * 계약이 경로를 하나로 둔 이유가 그것이다. 그래서 결과를 툴마다 말하고, 실패한 툴은 고른 채로
 * 남긴다.
 *
 * ⛔ **값이 없으면 0으로 채우지 않는다.** 적정타수가 없으면 초과율·사용 가능이 「산출 불가」이고,
 * 기준일·주기가 없으면 다음 예정일이 「기준 없음」이다.
 */
export const ToolPmOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const plannedId = useId();
  const baseId = `${plannedId}-base`;
  const noteId = `${plannedId}-note`;

  const filters = useMemo<ToolFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const listQuery = useMemo<MoldListQuery>(() => toListQuery(filters, page), [filters, page]);

  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState<ToolOrderDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});

  const molds = useMoldList(listQuery);
  const plants = usePlantOptions();
  const users = useUserOptions();

  const rows = molds.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(molds.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const create = useBulkOrderCreate();

  /* 결과가 있으면 성공한 툴을 선택에서 빼고 실패한 것만 남긴다. */
  const failedIds = create.outcomes
    .filter((outcome) => outcome.kind === 'error')
    .map((outcome) => outcome.moldId);
  const succeededCount = create.outcomes.filter((outcome) => outcome.kind === 'ok').length;

  const effectiveSelection = create.outcomes.length === 0 ? selected : failedIds;

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const apply = (nextFilters: ToolFilters, nextPage = 1): void => {
    setSelected([]);
    create.reset();
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  const submit = (): void => {
    const nextErrors = validateDraft(draft, effectiveSelection.length);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    const bodies = effectiveSelection
      .map((moldId) => rows.find((row) => row.moldId === moldId))
      .filter((mold): mold is MoldView => mold !== undefined)
      .map((mold) => ({ moldId: mold.moldId, body: toCreateBody(draft, mold) }));

    setSelected(effectiveSelection);
    create.create(bodies);
  };

  const columns: Column<MoldView>[] = [
    {
      key: 'pick',
      header: '',
      render: (row) => (
        <Checkbox
          checked={effectiveSelection.includes(row.moldId)}
          aria-label={row.moldCode}
          onChange={(event) => {
            create.reset();
            setSelected((current) =>
              event.target.checked
                ? [...new Set([...current, row.moldId])]
                : current.filter((id) => id !== row.moldId),
            );
          }}
        />
      ),
    },
    {
      key: 'mold',
      header: t.table.mold,
      render: (row) => (
        <span className="stacked-cell">
          <span>{row.moldCode}</span>
          <span>{row.moldName}</span>
        </span>
      ),
    },
    {
      key: 'shotUsage',
      header: t.table.shotUsage,
      /*
       * ⭐ 초과율은 100을 넘을 수 있다. 막대는 100에서 멈추고 **넘었다는 사실은 글자와 색이**
       * 말한다 — 막대만 길게 두면 다른 줄과 견줄 수 없고, 색만 두면 색을 못 보는 사람에게
       * 아무것도 전해지지 않는다.
       */
      render: (row) => (
        <span className="stacked-cell">
          <span className={isOverLimit(row.shotUsageRatio) ? 'figure-alert' : undefined}>
            {row.shotUsageRatio === null
              ? t.table.notComputable
              : `${formatRatio(row.shotUsageRatio)}%${isOverLimit(row.shotUsageRatio) ? ` ${t.table.overLimit}` : ''}`}
          </span>
          {row.shotUsageRatio !== null && (
            <Progress
              value={toProgressValue(row.shotUsageRatio)}
              max={100}
              size="sm"
              tone={isOverLimit(row.shotUsageRatio) ? 'error' : 'primary'}
            />
          )}
        </span>
      ),
    },
    {
      key: 'currentShot',
      header: t.table.currentShot,
      align: 'end',
      render: (row) => formatCount(row.currentShotCount),
    },
    {
      /*
       * ⛔ 누계와 적정타수를 한 칸에 쌓지 않는다 — 머리글이 하나뿐이라 **아래 수가 무엇인지
       * 이름이 없다.** 브라우저 확인에서 두 수가 이름 없이 겹쳐 보였다.
       */
      key: 'guaranteed',
      header: t.table.guaranteed,
      align: 'end',
      render: (row) => notComputable(row.guaranteedShotCount, formatCount),
    },
    {
      key: 'available',
      header: t.table.available,
      align: 'end',
      render: (row) => notComputable(row.availableShotCount, formatCount),
    },
    {
      key: 'nextPm',
      header: t.table.nextPm,
      /* ⛔ 기준일이나 주기가 없으면 「기준 없음」이다 — 빈 칸으로 두면 자료가 빠진 것으로 읽힌다. */
      render: (row) => row.nextPmDate ?? t.table.noBaseline,
    },
    {
      key: 'dueAxis',
      header: t.table.dueAxis,
      render: (row) => <Chip size="sm">{dueAxisLabel(row)}</Chip>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {molds.isError && (
        <LoadErrorBanner
          error={molds.error}
          onRetry={() => {
            void molds.refetch();
          }}
        />
      )}

      <section className="pane tool-pm-order-pane" aria-label={t.panes.filters}>
        <h2 className="pane-title">{t.panes.filters}</h2>
        <div className="filter-bar tool-pm-order-filter">
          <SelectField
            label={t.filters.plant}
            options={[{ value: '', label: t.filters.all }, ...toOptions(plants.entries)]}
            value={filters.plant}
            note={lookupNote(plants, t.filters.plantLookupFailed)}
            placeholder={t.filters.all}
            wide
            onChange={(value) => {
              apply({ ...filters, plant: value });
            }}
          />

          <SelectField
            label={t.filters.sort}
            options={[
              { value: 'SHOT_USAGE_DESC', label: t.filters.sortShotUsage },
              { value: 'NEXT_PM_ASC', label: t.filters.sortNextPm },
              { value: 'CODE', label: t.filters.sortCode },
            ]}
            value={filters.sort}
            wide
            onChange={(value) => {
              apply({ ...filters, sort: value as ToolFilters['sort'] });
            }}
          />

          <div className="field-cell field-cell-unlabeled check-group tool-pm-order-filter-options">
            <Checkbox
              checked={filters.dueOnly}
              onChange={(event) => {
                apply({ ...filters, dueOnly: event.target.checked });
              }}
            >
              {t.filters.dueOnly}
            </Checkbox>
            <Checkbox
              checked={filters.withoutOpenOrder}
              onChange={(event) => {
                apply({ ...filters, withoutOpenOrder: event.target.checked });
              }}
            >
              {t.filters.withoutOpenOrder}
            </Checkbox>
            <Checkbox
              checked={filters.guaranteedMissing}
              onChange={(event) => {
                apply({ ...filters, guaranteedMissing: event.target.checked });
              }}
            >
              {t.filters.guaranteedMissing}
            </Checkbox>
          </div>

          <div className="field-cell field-cell-unlabeled tool-pm-order-filter-actions">
            <div className="filter-actions">
              <Button
                variant="outlined"
                onClick={() => {
                  apply(DEFAULT_FILTERS);
                }}
              >
                {t.filters.reset}
              </Button>
            </div>
          </div>
        </div>
        <p className="pane-lead">{t.filters.defaultNote}</p>
      </section>

      {!molds.isError && (
        <section className="pane tool-pm-order-pane" aria-label={t.panes.list}>
          <h2 className="pane-title">{t.panes.list}</h2>
          {molds.isPending ? (
            <Skeleton variant="rect" height="14rem" />
          ) : pageView.isBeyondLast ? (
            <EmptyState
              size="sm"
              live
              title={t.table.beyondLastTitle}
              description={t.table.beyondLast}
              action={
                <Button
                  variant="outlined"
                  onClick={() => {
                    apply(filters);
                  }}
                >
                  {t.table.firstPage}
                </Button>
              }
            />
          ) : (
            <>
              <div className="wide-table tool-pm-order-table">
                <Table
                  caption={<span className="tool-pm-order-table-caption">{t.panes.list}</span>}
                  columns={columns}
                  rows={rows}
                  getRowId={(row) => String(row.moldId)}
                  density="compact"
                  empty={
                    <EmptyState
                      size="sm"
                      live
                      title={t.table.emptyTitle}
                      description={t.table.empty}
                    />
                  }
                />
              </div>
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  apply(filters, nextPage);
                }}
              />
            </>
          )}
        </section>
      )}

      <section
        className="pane tool-pm-order-pane tool-pm-order-form-pane"
        aria-label={t.panes.form}
      >
        <h2 className="pane-title">{t.panes.form}</h2>
        <p className="pane-lead">{t.form.selected(effectiveSelection.length)}</p>
        {/* ⭐ 한 오더 = 한 툴 — 몇 건이 만들어지는지 미리 말한다. */}
        <p className="pane-lead">{t.form.oneOrderPerTool(effectiveSelection.length)}</p>

        {create.outcomes.length > 0 && (
          <div className="banner-slot">
            <AlertBanner
              variant={failedIds.length === 0 ? 'success' : 'warning'}
              title={`${t.result.succeeded(succeededCount)} ${failedIds.length === 0 ? '' : t.result.failed(failedIds.length)}`}
            >
              {failedIds.length === 0 ? null : t.result.failedKept}
            </AlertBanner>
          </div>
        )}

        <div className="form-grid tool-pm-order-form-grid">
          <div className="field-cell">
            <FieldLabel htmlFor={plannedId} label={t.form.plannedDate} />
            <DatePicker
              id={plannedId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={errors.plannedDate !== undefined}
              value={draft.plannedDate === '' ? null : draft.plannedDate}
              onChange={(value) => {
                setDraft((prev) => ({ ...prev, plannedDate: value ?? '' }));
              }}
            />
            {errors.plannedDate !== undefined && (
              <span className="field-error">{errors.plannedDate}</span>
            )}
          </div>

          <SelectField
            label={t.form.assignee}
            options={toOptions(users.entries)}
            value={draft.assignee}
            note={lookupNote(users, t.form.userLookupFailed)}
            error={errors.assignee}
            placeholder={t.form.selectPlaceholder}
            wide
            onChange={(value) => {
              setDraft((prev) => ({ ...prev, assignee: value }));
            }}
          />

          <div className="field-cell">
            <FieldLabel htmlFor={baseId} label={t.form.baseDate} />
            <DatePicker
              id={baseId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={errors.baseDate !== undefined}
              value={draft.baseDate === '' ? null : draft.baseDate}
              onChange={(value) => {
                setDraft((prev) => ({ ...prev, baseDate: value ?? '' }));
              }}
            />
            <span className="field-note">{t.form.baseDateNote}</span>
          </div>

          <div className="field-cell form-grid-full">
            <FieldLabel htmlFor={noteId} label={t.form.orderNote} />
            <TextField
              id={noteId}
              value={draft.orderNote}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, orderNote: event.target.value }));
              }}
            />
          </div>
        </div>

        <h3>{t.form.items}</h3>
        {/* ⭐ 툴은 항목 마스터가 없어 이름을 직접 적는다. */}
        <p className="pane-lead">{t.form.itemsFreeInput}</p>

        {draft.items.map((item, index) => (
          <div key={item.key} className="filter-bar tool-pm-order-item-row">
            <div className="field-cell">
              <FieldLabel
                htmlFor={`${item.key}-name`}
                label={`${t.form.itemName} ${String(index + 1)}`}
              />
              <TextField
                id={`${item.key}-name`}
                value={item.name}
                onChange={(event) => {
                  const next = event.target.value;

                  setDraft((prev) => ({
                    ...prev,
                    items: prev.items.map((row) =>
                      row.key === item.key ? { ...row, name: next } : row,
                    ),
                  }));
                }}
              />
            </div>
            <div className="field-cell field-cell-unlabeled tool-pm-order-item-actions">
              <div className="filter-actions">
                <Button
                  variant="text"
                  onClick={() => {
                    setDraft((prev) => ({
                      ...prev,
                      items: prev.items.filter((row) => row.key !== item.key),
                    }));
                  }}
                >
                  {t.form.removeItem}
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div className="form-actions form-actions-secondary">
          <Button
            variant="outlined"
            onClick={() => {
              setDraft((prev) => ({
                ...prev,
                items: [...prev.items, { key: crypto.randomUUID(), name: '' }],
              }));
            }}
          >
            {t.form.addItem}
          </Button>
        </div>
        {errors.items !== undefined && <p className="pane-lead">{errors.items}</p>}

        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={create.isSaving}
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setErrors({});
              create.reset();
            }}
          >
            {t.form.reset}
          </Button>
          <Button onClick={submit} disabled={create.isSaving}>
            {create.outcomes.length > 0 && failedIds.length > 0
              ? t.result.retryFailed
              : t.form.submit}
          </Button>
        </div>
        {errors.selection !== undefined && <p className="pane-lead">{errors.selection}</p>}
      </section>
    </>
  );
};
