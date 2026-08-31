import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  DatePicker,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';
import {
  lookupNote,
  useEquipmentOptions,
  useGoodsIssueOptions,
  useOrderOptions,
  useSparePartOptions,
  useUserOptions,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useResultCreate, useResultList, type ResultListQuery } from './queries';
import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type DraftErrors,
  type PartDraft,
  type ResultDraft,
} from './result-draft';
import { SelectField } from './select-field';
import { formatMoment, type ResultView, type SelectOption } from './types';

const t = messages.maintenanceResult;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ResultView[] = [];

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

const optional = (value: string | null): string =>
  value === null || value.trim() === '' ? t.table.notAvailable : value;

/**
 * W-05-06 컨테이너 — 보전을 어떻게 했고 무엇을 썼는지 적는다.
 *
 * ⛔ **이 화면은 물건을 움직이지도 상태를 바꾸지도 않는다.**
 *
 * | 하지 않는 일 | 왜 |
 * | --- | --- |
 * | 예비품 출고 만들기 | 물류의 일이다. 여기서는 만들어진 건을 **가리키기만** 한다 |
 * | 재고 깎기 | 같은 이유다. 출고가 재고를 움직인다 |
 * | 설비 상태 바꾸기 | 「지금 쓸 수 있는가」는 **열린 보전 건이 없다**로 판정되며 자산 상태와 다른 축이다 |
 * | 누계 리셋 | 툴 예방보전 실적(W-05-03)의 몫이다. 그쪽만 낙관적 잠금이 필요하다 |
 *
 * ⭐ **지시 없이도 실적이 성립한다** — 현장에서 이미 조치한 건이 있다.
 *
 * ⚠ **항목·부위별 결과를 적지 못한다.** 그 값 목록이 아직 없어(공통코드 마스터가 정한다) 지어낼
 * 수 없다. 감추지 않고 사유를 낸다.
 */
export const MaintenanceResultScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const startedId = useId();
  const finishedId = `${startedId}-finished`;
  const noteId = `${startedId}-note`;
  const vendorId = `${startedId}-vendor`;

  const orderFilter = searchParams.get('order') ?? '';
  const page = isPositiveInteger(searchParams.get('page') ?? '')
    ? Number(searchParams.get('page'))
    : 1;

  const listQuery = useMemo<ResultListQuery>(
    () => ({
      ...(isPositiveInteger(orderFilter) ? { maintenanceOrderId: Number(orderFilter) } : {}),
      ...(page > 1 ? { page } : {}),
    }),
    [orderFilter, page],
  );

  const [draft, setDraft] = useState<ResultDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [partToAdd, setPartToAdd] = useState('');

  const list = useResultList(listQuery);
  const equipments = useEquipmentOptions();
  const users = useUserOptions();
  const spareParts = useSparePartOptions();
  const goodsIssues = useGoodsIssueOptions();
  const orders = useOrderOptions();

  const create = useResultCreate(() => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
  });

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const set = (patch: Partial<ResultDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const setPart = (key: string, patch: Partial<PartDraft>): void => {
    setDraft((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => (part.key === key ? { ...part, ...patch } : part)),
    }));
  };

  const submit = (): void => {
    const nextErrors = validateDraft(draft);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    /*
     * ⚠ 시간대 오프셋을 브라우저에서 읽는다. 화면이 날짜만 받고 시각은 그 날의 시작으로 두므로,
     * 보는 사람의 시간대에서 그 날이 시작하는 순간을 보내는 것이 맞다.
     */
    create.write(toCreateBody(draft, -new Date().getTimezoneOffset()));
  };

  const listColumns: Column<ResultView>[] = [
    {
      key: 'period',
      header: t.table.startedAt,
      render: (row) => (
        <span className="stacked-cell">
          <span>{formatMoment(row.startedAt)}</span>
          <span>{row.finishedAt === null ? t.table.ongoing : formatMoment(row.finishedAt)}</span>
        </span>
      ),
    },
    { key: 'resultNote', header: t.form.resultNote, render: (row) => row.resultNote },
    {
      key: 'performer',
      header: t.table.performer,
      /*
       * ⛔ **내부 번호를 그대로 그리지 않는다.** 수행자는 계정 식별자라 그 수를 보여 주면
       * 사용자가 사번으로 읽고 담당자에게 그 수를 말한다 — 목록에서 이름으로 푼다.
       * 못 풀면 「—」다: 지어낸 이름보다 없음이 낫다.
       */
      render: (row) => {
        if (row.isOutsourced) return optional(row.outsourceVendorName);
        if (row.performedByUserId === null) return t.table.notAvailable;

        return optional(
          users.entries.find((entry) => entry.value === String(row.performedByUserId))?.label ??
            null,
        );
      },
    },
    {
      key: 'closed',
      header: t.table.closed,
      render: (row) =>
        row.closed ? <Chip size="sm">{t.table.closed}</Chip> : t.table.notAvailable,
    },
    {
      key: 'parts',
      header: t.table.parts,
      align: 'end',
      render: (row) => t.table.partCount(row.parts.length),
    },
  ];

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

      <section className="pane" aria-label={t.panes.form}>
        {/* ⛔ 이 화면이 하지 않는 일을 먼저 말한다 — 하리라 믿고 기다리는 것을 막는다. */}
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.form.scopeLead} />
        </div>
        <SaveErrorBanner error={create.error} />

        <div className="form-grid">
          <SelectField
            label={t.form.target}
            options={toOptions(equipments.entries)}
            value={draft.target}
            note={lookupNote(equipments, t.form.target)}
            error={errors.target ?? create.fieldErrors.targetId}
            placeholder={t.form.selectPlaceholder}
            wide
            onChange={(value) => {
              set({ target: value });
            }}
          />

          <SelectField
            label={t.form.order}
            options={[{ value: '', label: t.form.orderNone }, ...toOptions(orders.entries)]}
            value={draft.order}
            note={lookupNote(orders, t.form.order) ?? t.form.orderNote}
            placeholder={t.form.orderNone}
            wide
            onChange={(value) => {
              set({ order: value });
            }}
          />

          <div className="field-cell">
            <FieldLabel htmlFor={startedId} label={t.form.startedAt} />
            <DatePicker
              id={startedId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={errors.startedAt !== undefined}
              value={draft.startedAt === '' ? null : draft.startedAt}
              onChange={(value) => {
                set({ startedAt: value ?? '' });
              }}
            />
            {errors.startedAt !== undefined && (
              <span className="field-error">{errors.startedAt}</span>
            )}
          </div>

          <div className="field-cell">
            <FieldLabel htmlFor={finishedId} label={t.form.finishedAt} />
            <DatePicker
              id={finishedId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={errors.finishedAt !== undefined}
              value={draft.finishedAt === '' ? null : draft.finishedAt}
              onChange={(value) => {
                set({ finishedAt: value ?? '' });
              }}
            />
            <span className="field-note">{t.form.finishedAtNote}</span>
            {errors.finishedAt !== undefined && (
              <span className="field-error">{errors.finishedAt}</span>
            )}
          </div>

          <div className="field-cell form-grid-full">
            <FieldLabel htmlFor={noteId} label={t.form.resultNote} />
            <TextField
              id={noteId}
              value={draft.resultNote}
              error={errors.resultNote ?? create.fieldErrors.resultNote}
              onChange={(event) => {
                set({ resultNote: event.target.value });
              }}
            />
          </div>

          {/*
           * ⭐ 짝 제약 — 외주면 수행자를 비우고 업체를 채운다. 화면이 막지 않으면 둘 다 채운
           * 실적이 남고, 「누가 했는가」를 셀 때 같은 건이 양쪽에 잡힌다.
           */}
          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={draft.isOutsourced}
              onChange={(event) => {
                /* 외주로 바꾸면 수행자를 함께 비운다 — 남겨 두면 짝 제약이 깨진 채 남는다. */
                set({
                  isOutsourced: event.target.checked,
                  performer: event.target.checked ? '' : draft.performer,
                  vendorName: event.target.checked ? draft.vendorName : '',
                });
              }}
            >
              {t.form.outsourced}
            </Checkbox>
          </div>

          <SelectField
            label={t.form.performer}
            options={toOptions(users.entries)}
            value={draft.performer}
            note={lookupNote(users, t.form.performer)}
            error={errors.performer ?? create.fieldErrors.performedByUserId}
            placeholder={t.form.selectPlaceholder}
            disabled={draft.isOutsourced}
            wide
            onChange={(value) => {
              set({ performer: value });
            }}
          />

          <div className="field-cell">
            <FieldLabel htmlFor={vendorId} label={t.form.vendorName} />
            <TextField
              id={vendorId}
              value={draft.vendorName}
              disabled={!draft.isOutsourced}
              error={errors.vendorName ?? create.fieldErrors.outsourceVendorName}
              helperText={t.form.vendorNote}
              onChange={(event) => {
                set({ vendorName: event.target.value });
              }}
            />
          </div>

          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={draft.closed}
              onChange={(event) => {
                set({ closed: event.target.checked });
              }}
            >
              {t.form.closed}
            </Checkbox>
            <span className="field-note">{t.form.closedNote}</span>
          </div>
        </div>

        {/* ⚠ 값 목록이 없어 항목·부위별 결과를 적을 수 없다. 감추지 않고 사유를 낸다. */}
        <p className="pane-lead">{t.form.linesLocked}</p>

        <h3>{t.form.parts}</h3>
        <p className="pane-lead">{t.form.partsLead}</p>
        <p className="pane-lead">{t.form.partsNoLot}</p>
        <p className="pane-lead">{t.form.partsMasterNote}</p>

        <div className="filter-bar">
          <SelectField
            label={t.form.part}
            options={toOptions(spareParts.entries).filter(
              (option) => !draft.parts.some((part) => part.sparePartId === option.value),
            )}
            value={partToAdd}
            note={lookupNote(spareParts, t.form.part)}
            placeholder={t.form.selectPlaceholder}
            wide
            onChange={setPartToAdd}
          />
          <div className="filter-actions">
            <Button
              variant="outlined"
              disabled={partToAdd === ''}
              onClick={() => {
                const option = spareParts.entries.find((entry) => entry.value === partToAdd);

                setDraft((prev) => ({
                  ...prev,
                  parts: [
                    ...prev.parts,
                    {
                      key: partToAdd,
                      sparePartId: partToAdd,
                      /* 고를 때 마스터에서 푼 이름을 얼려 둔다 — 계약이 필수로 두었다. */
                      partName: option?.label ?? partToAdd,
                      usedQty: '',
                      goodsIssueId: '',
                    },
                  ],
                }));
                setPartToAdd('');
              }}
            >
              {t.form.addPart}
            </Button>
          </div>
        </div>

        {draft.parts.map((part) => (
          <div key={part.key} className="filter-bar">
            <div className="field-cell">
              <span className="field-label">{t.form.part}</span>
              <span>{part.partName}</span>
            </div>
            <div className="field-cell">
              <FieldLabel htmlFor={`${part.key}-qty`} label={t.form.usedQty} />
              <TextField
                id={`${part.key}-qty`}
                value={part.usedQty}
                inputMode="decimal"
                onChange={(event) => {
                  setPart(part.key, { usedQty: event.target.value });
                }}
              />
            </div>
            <SelectField
              label={t.form.goodsIssue}
              options={[
                { value: '', label: t.form.goodsIssueNone },
                ...toOptions(goodsIssues.entries),
              ]}
              value={part.goodsIssueId}
              note={lookupNote(goodsIssues, t.form.goodsIssue)}
              placeholder={t.form.goodsIssueNone}
              wide
              onChange={(value) => {
                setPart(part.key, { goodsIssueId: value });
              }}
            />
            <div className="filter-actions">
              <Button
                variant="text"
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    parts: prev.parts.filter((item) => item.key !== part.key),
                  }));
                }}
              >
                {t.form.removePart}
              </Button>
            </div>
          </div>
        ))}
        {errors.parts !== undefined && <p className="pane-lead">{errors.parts}</p>}

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
            {t.form.submit}
          </Button>
        </div>
      </section>

      <section className="pane" aria-label={t.panes.list}>
        <h2>{t.panes.list}</h2>
        {list.isPending ? (
          <Skeleton variant="rect" height="10rem" />
        ) : (
          !list.isError && (
            <>
              <div className="wide-table">
                <Table
                  columns={listColumns}
                  rows={rows}
                  getRowId={(row) => String(row.maintenanceResultId)}
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
                  const params = new URLSearchParams();

                  if (orderFilter !== '') params.set('order', orderFilter);
                  if (nextPage > 1) params.set('page', String(nextPage));
                  setSearchParams(params);
                }}
              />
            </>
          )
        )}
      </section>
    </>
  );
};
