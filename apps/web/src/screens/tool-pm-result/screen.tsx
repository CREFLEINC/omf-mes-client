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
  Skeleton,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, useOrderOptions, useToolOptions, useUserOptions } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  canClose,
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type DraftErrors,
  type ToolResultDraft,
} from './result-draft';
import { useToolDetail, useToolResultCreate, useToolResults } from './queries';
import { SelectField } from './select-field';
import {
  formatCount,
  formatMoment,
  toToolView,
  type SelectOption,
  type ToolResultView,
} from './types';

const t = messages.toolPmResult;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ToolResultView[] = [];

const isPositiveInteger = (value: string): boolean => /^\d+$/.test(value) && Number(value) > 0;

/**
 * W-05-03 컨테이너 — 툴 예방보전을 하고 누계를 되돌린다.
 *
 * ⭐ **누계 리셋을 서버가 한다.** 화면은 「되돌린다」는 뜻과 되돌린 뒤의 시작값만 보내고,
 * ⛔ **툴 마스터를 직접 고치지 않는다.** 리셋 직전 누계도 **서버가** 얼려 둔다 — 「이번
 * 예방보전까지 얼마나 썼는지」가 수명 분석의 유일한 재료라, 화면이 보내면 서버 값과 갈릴 수 있다.
 *
 * ⭐ **한 칸에 두 갱신이 붙는다.** 사용실적 입력은 **더하기**이고 이 리셋은 **바꾸기**다.
 * 바꾸기에는 저장 충돌 보호를 걸고, 더하기에는 걸지 않는다 — 여러 단말이 동시에 기여하므로
 * 잠그면 현장이 멎는다. 그 더하기 경로는 이 화면에 아예 없다.
 *
 * ⭐ **툴 상세를 부르는 이유가 둘이다** — 사람이 볼 누계와, 저장이 실을 잠금 토큰. 둘이 같은
 * 요청인 것은 우연이 아니다: 되돌리기는 「지금 누계」를 바꾸는 일이라 사람이 본 값과 서버가
 * 바꿀 값이 같아야 한다.
 *
 * **고른 툴은 주소가 소유한다** — 새로고침·공유가 같은 툴을 연다.
 */
export const ToolPmResultScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const startedId = useId();
  const finishedId = `${startedId}-finished`;
  const noteId = `${startedId}-note`;
  const vendorId = `${startedId}-vendor`;
  const shotId = `${startedId}-shot`;

  const toolParam = searchParams.get('tool') ?? '';
  const moldId = isPositiveInteger(toolParam) ? Number(toolParam) : null;

  /* 쪽도 주소가 소유한다 — 새로고침이 보던 쪽으로 돌아온다. */
  const pageParam = searchParams.get('page') ?? '';
  const page = isPositiveInteger(pageParam) ? Number(pageParam) : 1;

  const [draft, setDraft] = useState<ToolResultDraft>({ ...EMPTY_DRAFT, tool: toolParam });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isConfirming, setConfirming] = useState(false);

  /**
   * 방금 저장한 것이 누계를 되돌렸는가. **상태가 아니라 결과다.**
   *
   * ⭐ 저장에 성공하면 폼이 비므로 **화면만 보고는 저장됐는지 취소됐는지 알 수 없다.**
   * 되돌리기는 되돌릴 수 없는 쓰기라 「했다」를 말하지 않으면 같은 사람이 한 번 더 누른다.
   */
  const [savedReset, setSavedReset] = useState<boolean | null>(null);

  const tools = useToolOptions();
  const users = useUserOptions();
  const orders = useOrderOptions(moldId);
  const detail = useToolDetail(moldId);
  const results = useToolResults(moldId, page);

  const create = useToolResultCreate(moldId, () => {
    setSavedReset(draft.resetCounter);
    setDraft({ ...EMPTY_DRAFT, tool: toolParam });
    setErrors({});
    setConfirming(false);
    /* 되돌린 값을 다시 읽는다 — 상세가 새 누계와 새 잠금 토큰을 함께 준다. */
    void detail.refetch();
  });

  const tool = detail.data === undefined ? null : toToolView(detail.data);
  const rows = results.data?.items ?? EMPTY_ROWS;
  const pageView = results.data === undefined ? null : toPageView(results.data.page, rows.length);

  /*
   * ⭐ **서버가 되말한 필드 오류를 화면이 전부 그린다.** `knownFields` 에 이름을 올리면 그
   * 항목은 배너에서 빠져 인라인으로만 나온다 — 그릴 자리가 없으면 그대로 사라진다. 되돌릴 수
   * 없는 쓰기에서 「왜 거부됐는지」가 사라지면 사람은 같은 값을 다시 보낸다.
   */
  const startedError = errors.startedAt ?? create.fieldErrors.startedAt;
  const finishedError = errors.finishedAt ?? create.fieldErrors.finishedAt;

  const goToPage = (next: number): void => {
    const params = new URLSearchParams(searchParams);

    params.set('page', String(next));
    setSearchParams(params);
  };

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const selectTool = (value: string): void => {
    const params = new URLSearchParams();

    if (value !== '') params.set('tool', value);
    setSearchParams(params);
    setDraft({ ...EMPTY_DRAFT, tool: value });
    setErrors({});
    setSavedReset(null);
    create.reset();
  };

  /* 다시 치기 시작하면 「저장했습니다」를 지운다 — 남겨 두면 아직 안 보낸 값을 보냈다고 말한다. */
  const set = (patch: Partial<ToolResultDraft>): void => {
    setSavedReset(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const requestSave = (): void => {
    const nextErrors = validateDraft(draft);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    /* 되돌리기가 켜졌을 때만 확인을 받는다 — 되돌리기만이 「바꾸기」다. */
    if (draft.resetCounter) {
      setConfirming(true);
      return;
    }

    create.write(toCreateBody(draft, -new Date().getTimezoneOffset()));
  };

  const columns: Column<ToolResultView>[] = [
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
    { key: 'resultNote', header: t.table.resultNote, render: (row) => row.resultNote },
    {
      key: 'reset',
      header: t.table.reset,
      render: (row) =>
        row.resetCounter ? <Chip size="sm">{t.table.reset}</Chip> : t.table.notAvailable,
    },
    {
      key: 'shots',
      header: t.table.shotBefore,
      align: 'end',
      /* 서버가 얼린 값이다 — 화면이 만들지 않는다. 없으면 「—」다. */
      render: (row) =>
        row.shotCountBeforeReset === null
          ? t.table.notAvailable
          : formatCount(row.shotCountBeforeReset),
    },
    {
      key: 'shotAfter',
      header: t.table.shotAfter,
      align: 'end',
      render: (row) =>
        row.shotCountAfterReset === null
          ? t.table.notAvailable
          : formatCount(row.shotCountAfterReset),
    },
    {
      key: 'closed',
      header: t.table.closed,
      render: (row) =>
        row.closed ? <Chip size="sm">{t.table.closed}</Chip> : t.table.notAvailable,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <section className="pane tool-pm-result-pane" aria-label={t.panes.tool}>
        <h2 className="pane-title">{t.panes.tool}</h2>
        <div className="filter-bar tool-pm-result-tool-grid">
          <SelectField
            label={t.tool.select}
            options={toOptions(tools.entries)}
            value={draft.tool}
            note={lookupNote(tools, t.tool.lookupFailed)}
            error={errors.tool ?? create.fieldErrors.targetId}
            placeholder={t.tool.selectPlaceholder}
            wide
            onChange={selectTool}
          />
          {tool !== null && (
            <>
              <div className="field-cell tool-pm-result-fact">
                <span className="field-label">{t.tool.currentShot}</span>
                <span>{formatCount(tool.currentShotCount)}</span>
              </div>
              <div className="field-cell tool-pm-result-fact">
                <span className="field-label">{t.tool.guaranteed}</span>
                <span>
                  {tool.guaranteedShotCount === null
                    ? t.tool.notComputable
                    : formatCount(tool.guaranteedShotCount)}
                </span>
              </div>
            </>
          )}
        </div>
        {/* ⭐ 잠금 토큰이 이 조회에서 온다 — 실패하면 되돌리기를 보낼 수 없다. */}
        {detail.isError && <p className="pane-lead">{t.tool.lockFailed}</p>}
        {moldId !== null && detail.isPending && <p className="pane-lead">{t.tool.loadingLock}</p>}
      </section>

      <section
        className="pane tool-pm-result-pane tool-pm-result-form-pane"
        aria-label={t.panes.form}
      >
        <h2 className="pane-title">{t.panes.form}</h2>
        <SaveErrorBanner error={create.error} />
        {/* 되돌린 저장과 그냥 저장을 가려 말한다 — 되돌리기만이 툴 마스터를 바꾼다. */}
        {savedReset !== null && (
          <AlertBanner
            variant="success"
            onDismiss={() => {
              setSavedReset(null);
            }}
          >
            {savedReset ? t.form.savedWithReset : t.form.saved}
          </AlertBanner>
        )}

        <div className="form-grid tool-pm-result-form-grid">
          <SelectField
            label={t.form.order}
            options={[{ value: '', label: t.form.orderNone }, ...toOptions(orders.entries)]}
            value={draft.order}
            note={t.form.orderNote}
            placeholder={t.form.orderNone}
            wide
            onChange={(value) => {
              /* 오더를 비우면 마감도 함께 끈다 — 닫을 것이 없는데 켜진 채로 남지 않게. */
              set({ order: value, closed: value === '' ? false : draft.closed });
            }}
          />

          <div className="field-cell">
            <FieldLabel htmlFor={startedId} label={t.form.startedAt} />
            <DatePicker
              id={startedId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={startedError !== undefined}
              value={draft.startedAt === '' ? null : draft.startedAt}
              onChange={(value) => {
                set({ startedAt: value ?? '' });
              }}
            />
            {startedError !== undefined && <span className="field-error">{startedError}</span>}
          </div>

          <div className="field-cell">
            <FieldLabel htmlFor={finishedId} label={t.form.finishedAt} />
            <DatePicker
              id={finishedId}
              mode="single"
              clearable
              placeholder={messages.common.selectDate}
              invalid={finishedError !== undefined}
              value={draft.finishedAt === '' ? null : draft.finishedAt}
              onChange={(value) => {
                set({ finishedAt: value ?? '' });
              }}
            />
            <span className="field-note">{t.form.finishedAtNote}</span>
            {finishedError !== undefined && <span className="field-error">{finishedError}</span>}
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

          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={draft.isOutsourced}
              onChange={(event) => {
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
            note={lookupNote(users, t.form.userLookupFailed)}
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

          {/*
           * ⭐ 되돌리기는 「바꾸기」다 — 그 사실과 그래서 걸리는 보호를 칸 옆에 적는다.
           * 사용실적 입력(더하기)에는 그 보호가 없다는 것도 함께 말한다: 같은 누계 칸을 두
           * 경로가 건드리는데 규율이 다르다는 것을 아는 사람만 헷갈리지 않는다.
           */}
          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={draft.resetCounter}
              onChange={(event) => {
                set({ resetCounter: event.target.checked });
              }}
            >
              {t.form.resetCounter}
            </Checkbox>
            <span className="field-note">{t.form.resetNote}</span>
            <span className="field-note">{t.form.resetLockNote}</span>
          </div>

          <div className="field-cell">
            <FieldLabel htmlFor={shotId} label={t.form.shotAfterReset} />
            <TextField
              id={shotId}
              value={draft.shotAfterReset}
              inputMode="numeric"
              disabled={!draft.resetCounter}
              error={errors.shotAfterReset ?? create.fieldErrors.shotCountAfterReset}
              helperText={t.form.shotAfterResetNote}
              onChange={(event) => {
                set({ shotAfterReset: event.target.value });
              }}
            />
            <span className="field-note">{t.form.beforeResetNote}</span>
          </div>

          {/* ⭐ 마감은 오더가 있을 때만 뜻이 있다 — 없으면 잠그고 사유를 낸다. */}
          <div className="field-cell field-cell-unlabeled check-group">
            <Checkbox
              checked={draft.closed}
              disabled={!canClose(draft)}
              onChange={(event) => {
                set({ closed: event.target.checked });
              }}
            >
              {t.form.closed}
            </Checkbox>
            {!canClose(draft) && <span className="field-note">{t.form.closedNoOrder}</span>}
          </div>
        </div>

        {/* ⚠ 값 목록이 없어 부위를 적을 수 없다. 감추지 않고 사유를 낸다. */}
        <h3>{t.form.parts}</h3>
        <p className="pane-lead">{t.form.partsLocked}</p>
        <p className="pane-lead">{t.form.partsMechanism}</p>

        <div className="form-actions">
          <Button
            variant="outlined"
            disabled={create.isSaving}
            onClick={() => {
              setDraft({ ...EMPTY_DRAFT, tool: toolParam });
              setErrors({});
              setSavedReset(null);
              create.reset();
            }}
          >
            {t.form.reset}
          </Button>
          {/* 저장하는 동안 무엇을 하고 있는지 말한다 — 늦으면 사람은 한 번 더 누른다. */}
          {create.isSaving && <p className="field-note form-actions-secondary">{t.form.saving}</p>}
          <Button
            onClick={requestSave}
            /* 잠금 토큰이 아직 없으면 보내도 막힌다 — 누르기 전에 잠근다. */
            disabled={create.isSaving || moldId === null || detail.isPending || detail.isError}
          >
            {t.form.submit}
          </Button>
        </div>
      </section>

      <section className="pane tool-pm-result-pane" aria-label={t.panes.list}>
        <h2 className="pane-title">{t.panes.list}</h2>
        {moldId === null ? (
          <EmptyState size="sm" title={t.table.selectToolTitle} description={t.table.selectTool} />
        ) : results.isError ? (
          <LoadErrorBanner
            error={results.error}
            onRetry={() => {
              void results.refetch();
            }}
          />
        ) : results.isPending ? (
          <Skeleton variant="rect" height="10rem" />
        ) : (
          <div className="wide-table tool-pm-result-table">
            <Table
              caption={<span className="tool-pm-result-table-caption">{t.panes.list}</span>}
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.maintenanceResultId)}
              density="compact"
              empty={
                <EmptyState size="sm" live title={t.table.emptyTitle} description={t.table.empty} />
              }
            />
          </div>
        )}
        {/* 되돌린 이력은 여러 해 쌓인다 — 첫 쪽만 그리고 「이게 전부」로 보이게 두지 않는다. */}
        {pageView !== null && <PageNav view={pageView} onChange={goToPage} />}
      </section>

      {/*
       * ⭐ 되돌리기만 확인을 받는다. 되돌리기는 「바꾸기」라 되돌린 뒤에는 앞의 누계를 화면이
       * 되살릴 수 없다 — 서버가 얼려 둔 값으로만 되짚을 수 있다.
       */}
      <Dialog
        open={isConfirming}
        onClose={() => {
          setConfirming(false);
        }}
        title={t.confirm.title}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setConfirming(false);
              }}
              disabled={create.isSaving}
            >
              {t.confirm.cancel}
            </Button>
            <Button
              onClick={() => {
                create.write(toCreateBody(draft, -new Date().getTimezoneOffset()));
              }}
              disabled={create.isSaving}
            >
              {t.confirm.submit}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">{t.confirm.lead}</p>
        <p className="dialog-lead">
          <strong>
            {t.confirm.summary(
              tool === null ? t.table.notAvailable : formatCount(tool.currentShotCount),
              formatCount(Number(draft.shotAfterReset.trim() === '' ? '0' : draft.shotAfterReset)),
            )}
          </strong>
        </p>
      </Dialog>
    </>
  );
};
