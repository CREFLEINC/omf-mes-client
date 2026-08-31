import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  PageHeader,
  SearchInput,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { EMPTY_FILTERS, readFilters, readSelected, toSearchParams } from './filters';
import type { FlagKey } from './flags';
import {
  addProcess,
  hasProcess,
  isDirty,
  removeProcess,
  setRow,
  toggleFlag,
  toReplaceBody,
  type GridDraft,
} from './grid-draft';
import { LoadErrorBanner } from './load-error-banner';
import { lookupNote, useEquipmentOptions, usePlantOptions, useProcessOptions } from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { ProcessGrid } from './process-grid';
import {
  useProcessesReplace,
  useTerminalCreate,
  useTerminalDeactivate,
  useTerminalDetail,
  useTerminalProcesses,
  useTerminals,
  useTerminalUpdate,
  useTokenIssue,
} from './queries';
import { SelectField } from './select-field';
import {
  EMPTY_TERMINAL,
  hasTerminalErrors,
  toCreateBody,
  toTerminalDraft,
  toUpdateBody,
  validateTerminal,
  type TerminalDraft,
  type TerminalErrors,
} from './terminal-draft';
import { TerminalForm } from './terminal-form';
import { TokenDialog } from './token-dialog';
import type { SelectOption, TerminalView, TokenView } from './types';

const t = messages.terminalProcessMap;

const EMPTY_ROWS: TerminalView[] = [];
const EMPTY_GRID: GridDraft = [];

/** 폼이 무엇을 하고 있는가. 닫힘·등록·수정 셋뿐이다. */
type FormMode = 'closed' | 'create' | 'edit';

/**
 * W-CO-06 컨테이너 — 어느 단말에서 어느 공정의 무엇을 열어 둘 것인가.
 *
 * ⭐ **저장은 단말 단위 한 트랜잭션이다.** 화면이 보내는 것은 「이 단말의 구성 전체」이고,
 * **표에서 뺀 공정은 지워진다.** 공정을 하나씩 저장하는 경로가 없다 — 그래서 그 사실을
 * 표 옆에 적고, 잠금 토큰을 **기능 구성 조회**에서 받아 「내가 본 표 위에 적는다」를 지킨다.
 *
 * ⭐ **8플래그는 보안이 아니라 오조작 방지다.** 보안 경계는 단말 토큰 하나뿐이고, 실제
 * 게이팅은 서버의 거부가 맡는다.
 *
 * ⭐ **0건이 정상인 단말이 있다** — 창고 전용 단말은 공정 행이 없다. 여덟 플래그가 전부
 * 생산 축이기 때문이고, 빈 결과를 오류로 그리지 않는다.
 *
 * ⭐⭐ **등록 토큰을 발급해 그림으로 보이는 것이 이 화면이다.** 기기는 그것을 카메라로 읽고
 * 서버를 따로 부르지 않는다 — 토큰 없이 열리는 경로가 없다. ⚠ 재발급하면 이전 기기가
 * 모두 끊기므로 누르기 전에 말한다.
 *
 * **조회 조건과 고른 단말은 주소가 소유한다** — 새로고침·공유가 같은 화면을 연다.
 */
export const TerminalProcessMapScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const selectedId = readSelected(searchParams);

  const [search, setSearch] = useState(filters.q);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [terminalDraft, setTerminalDraft] = useState<TerminalDraft>(EMPTY_TERMINAL);
  const [terminalErrors, setTerminalErrors] = useState<TerminalErrors>({});
  const [grid, setGrid] = useState<GridDraft>(EMPTY_GRID);
  const [gridNotice, setGridNotice] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState('');
  const [token, setToken] = useState<TokenView | null>(null);
  const [isDeactivating, setDeactivating] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const plants = usePlantOptions();
  const equipments = useEquipmentOptions();
  const processes = useProcessOptions();

  const terminals = useTerminals(filters);
  const detail = useTerminalDetail(selectedId);
  const processRows = useTerminalProcesses(selectedId);

  const original = processRows.data ?? EMPTY_GRID;

  /*
   * 서버가 준 구성이 새로 오면 편집 상태를 그것으로 되돌린다.
   *
   * ⭐ **참조가 아니라 「어느 단말의 어느 조회 결과인가」로 판정한다** — 참조로 보면 다시
   * 그릴 때마다 사람이 고치던 표가 사라지고, 값으로 보면 저장 뒤 되돌아온 같은 표를
   * 반영하지 못한다.
   */
  useEffect(() => {
    setGrid(original);
    setGridNotice(null);
    setAddTarget('');
  }, [original]);

  const create = useTerminalCreate((created) => {
    setFormMode('closed');
    setSavedNotice(t.terminal.saved);
    selectTerminal(created.terminalId);
  });

  const update = useTerminalUpdate(selectedId, () => {
    setFormMode('closed');
    setSavedNotice(t.terminal.saved);
  });

  const deactivate = useTerminalDeactivate(selectedId, () => {
    setDeactivating(false);
    setSavedNotice(t.terminal.deactivated);
  });

  const replace = useProcessesReplace(selectedId, () => {
    setSavedNotice(t.grid.saved);
    /* 저장한 구성을 다시 읽는다 — 새 잠금 토큰이 그 조회에 실려 온다. */
    void processRows.refetch();
  });

  const issueToken = useTokenIssue(selectedId, (issued) => {
    setToken(issued);
  });

  const rows = terminals.data?.items ?? EMPTY_ROWS;
  const pageView =
    terminals.data === undefined ? null : toPageView(terminals.data.page, rows.length);
  const selected = detail.data ?? null;

  const apply = (next: Partial<typeof filters>, keepSelection: boolean): void => {
    /* 조건이 바뀌면 첫 쪽으로 돌아간다 — 3쪽을 보던 채로 조건만 좁히면 빈 쪽이 나온다. */
    const merged = { ...filters, ...next, page: next.page ?? 1 };

    setSearchParams(toSearchParams(merged, keepSelection ? selectedId : null));
  };

  const selectTerminal = (terminalId: number | null): void => {
    setSearchParams(toSearchParams(filters, terminalId));
    setFormMode('closed');
    setSavedNotice(null);
    create.reset();
    update.reset();
    replace.reset();
    issueToken.reset();
  };

  const openCreate = (): void => {
    setTerminalDraft(EMPTY_TERMINAL);
    setTerminalErrors({});
    setFormMode('create');
    setSavedNotice(null);
    create.reset();
    update.reset();
  };

  const openEdit = (): void => {
    if (selected === null) return;

    setTerminalDraft(toTerminalDraft(selected));
    setTerminalErrors({});
    setFormMode('edit');
    setSavedNotice(null);
    create.reset();
    update.reset();
  };

  const submitTerminal = (): void => {
    const isNew = formMode === 'create';
    const errors = validateTerminal(terminalDraft, isNew);

    setTerminalErrors(errors);

    if (hasTerminalErrors(errors)) return;

    if (isNew) create.write(toCreateBody(terminalDraft));
    else update.write(toUpdateBody(terminalDraft));
  };

  const addRow = (value: string): void => {
    setAddTarget('');
    if (value === '') return;

    const processId = Number(value);
    const entry = processes.entries.find((item) => item.value === value);

    if (hasProcess(grid, processId)) {
      setGridNotice(t.grid.duplicate);
      return;
    }

    setGridNotice(null);
    setGrid(addProcess(grid, processId, entry?.label ?? value));
  };

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  const listColumns: Column<TerminalView>[] = [
    {
      key: 'code',
      header: t.list.code,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            selectTerminal(row.terminalId);
          }}
        >
          {row.terminalCode}
        </Button>
      ),
    },
    { key: 'type', header: t.list.type, render: (row) => row.terminalTypeCode },
    { key: 'status', header: t.list.status, render: (row) => row.statusCode },
    {
      key: 'equipment',
      header: t.list.equipment,
      render: (row) => row.equipmentLabel ?? t.list.notAvailable,
    },
    {
      key: 'active',
      header: t.list.active,
      render: (row) => (
        <Chip size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.list.active : t.list.inactive}
        </Chip>
      ),
    },
  ];

  /* 잠금 토큰이 아직 없으면 구성을 보내도 막힌다 — 누르기 전에 잠근다. */
  const canSaveGrid =
    selectedId !== null && !processRows.isPending && !processRows.isError && !replace.isSaving;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={<Button onClick={openCreate}>{t.terminal.create}</Button>}
      />

      {savedNotice !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            onDismiss={() => {
              setSavedNotice(null);
            }}
          >
            {savedNotice}
          </AlertBanner>
        </div>
      )}

      <div className="two-pane">
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
                  apply({ q: search }, true);
                }}
              />
            </div>
            <div className="field-cell field-cell-unlabeled check-group">
              <Checkbox
                checked={filters.includeInactive}
                onChange={(event) => {
                  apply({ includeInactive: event.target.checked }, true);
                }}
              >
                {t.filters.includeInactive}
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

          {terminals.isError ? (
            <LoadErrorBanner
              error={terminals.error}
              onRetry={() => {
                void terminals.refetch();
              }}
            />
          ) : terminals.isPending ? (
            <Skeleton variant="rect" height="12rem" />
          ) : (
            <div className="wide-table">
              <Table
                columns={listColumns}
                rows={rows}
                getRowId={(row) => String(row.terminalId)}
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
                apply({ page }, true);
              }}
            />
          )}
        </section>

        <div className="pane-stack">
          <section className="pane" aria-label={t.panes.terminal}>
            <h2>{formMode === 'create' ? t.terminal.create : t.panes.terminal}</h2>

            {formMode === 'closed' ? (
              selected === null ? (
                <EmptyState
                  size="sm"
                  title={t.grid.selectTerminalTitle}
                  description={t.grid.selectTerminal}
                />
              ) : (
                <>
                  <SaveErrorBanner error={deactivate.error} />
                  <dl className="token-meta">
                    <dt>{t.terminal.code}</dt>
                    <dd>{selected.terminalCode}</dd>
                    <dt>{t.terminal.type}</dt>
                    <dd>{selected.terminalTypeCode}</dd>
                    <dt>{t.terminal.status}</dt>
                    <dd>{selected.statusCode}</dd>
                    <dt>{t.terminal.equipment}</dt>
                    <dd>{selected.equipmentLabel ?? t.terminal.equipmentNone}</dd>
                  </dl>
                  <SaveErrorBanner error={issueToken.error} />
                  {/* ⚠ 누르기 전에 말한다 — 누른 뒤에는 이미 이전 기기가 끊겨 있다. */}
                  <AlertBanner variant="warning">{t.token.reissueWarning}</AlertBanner>
                  <div className="form-actions">
                    <Button
                      variant="outlined"
                      disabled={!selected.isActive || deactivate.isSaving}
                      onClick={() => {
                        setDeactivating(true);
                      }}
                    >
                      {t.terminal.deactivate}
                    </Button>
                    <Button variant="outlined" onClick={openEdit}>
                      {t.terminal.edit}
                    </Button>
                    <Button
                      disabled={issueToken.isSaving}
                      onClick={() => {
                        issueToken.write({});
                      }}
                    >
                      {t.token.issue}
                    </Button>
                  </div>
                </>
              )
            ) : (
              <TerminalForm
                draft={terminalDraft}
                errors={terminalErrors}
                isNew={formMode === 'create'}
                isSaving={create.isSaving || update.isSaving}
                saveError={formMode === 'create' ? create.error : update.error}
                fieldErrors={formMode === 'create' ? create.fieldErrors : update.fieldErrors}
                plants={plants}
                equipments={equipments}
                onChange={(patch) => {
                  setTerminalDraft((prev) => ({ ...prev, ...patch }));
                }}
                onSubmit={submitTerminal}
                onCancel={() => {
                  setFormMode('closed');
                }}
              />
            )}
          </section>
        </div>
      </div>

      {/*
       * ⭐ **기능 구성은 두 단 밖에서 전체 너비를 쓴다.** 공정 한 줄에 여덟 칸이 서는 표라
       * 좁은 단에 넣으면 열 이름이 두 줄로 접히고 체크 상자가 서로 붙는다 — 오조작을 막으려고
       * 만든 화면이 오조작을 부르게 된다.
       */}
      <section className="pane" aria-label={t.panes.grid}>
        <h2>{t.panes.grid}</h2>
        {/* ⭐ 여기서 여는 것이 무엇인지 먼저 말한다 — 보안 경계로 오해하면 잘못 잠근다. */}
        <p className="pane-lead">{t.grid.purpose}</p>
        {/* ⭐ 빠진 공정이 지워진다는 사실을 저장 버튼이 아니라 표 옆에 둔다. */}
        <p className="pane-lead">{t.grid.replaceNote}</p>

        {selectedId === null ? (
          <EmptyState
            size="sm"
            title={t.grid.selectTerminalTitle}
            description={t.grid.selectTerminal}
          />
        ) : processRows.isError ? (
          <LoadErrorBanner
            error={processRows.error}
            onRetry={() => {
              void processRows.refetch();
            }}
          />
        ) : processRows.isPending ? (
          <Skeleton variant="rect" height="10rem" />
        ) : (
          <>
            <SaveErrorBanner error={replace.error} />

            <div className="filter-bar">
              <SelectField
                label={t.grid.add}
                options={toOptions(processes.entries)}
                value={addTarget}
                note={lookupNote(processes, t.grid.processLookupFailed)}
                error={gridNotice ?? undefined}
                placeholder={t.grid.addPlaceholder}
                wide
                onChange={addRow}
              />
            </div>

            {grid.length === 0 ? (
              /* ⭐ 0건이 정상인 단말이 있다 — 오류처럼 그리지 않는다. */
              <EmptyState size="sm" title={t.grid.emptyTitle} description={t.grid.empty} />
            ) : (
              <ProcessGrid
                rows={grid}
                disabled={replace.isSaving}
                onToggle={(processId, key: FlagKey) => {
                  setGrid(toggleFlag(grid, processId, key));
                }}
                onToggleRow={(processId, open) => {
                  setGrid(setRow(grid, processId, open));
                }}
                onRemove={(processId) => {
                  setGrid(removeProcess(grid, processId));
                }}
              />
            )}

            <div className="form-actions">
              {replace.isSaving && (
                <p className="field-note form-actions-secondary">{t.grid.saving}</p>
              )}
              <Button
                variant="outlined"
                disabled={replace.isSaving || !isDirty(grid, original)}
                onClick={() => {
                  setGrid(original);
                  setGridNotice(null);
                }}
              >
                {t.grid.reset}
              </Button>
              <Button
                disabled={!canSaveGrid || !isDirty(grid, original)}
                onClick={() => {
                  replace.write(toReplaceBody(grid));
                }}
              >
                {t.grid.save}
              </Button>
            </div>
          </>
        )}
      </section>

      <TokenDialog
        token={token}
        terminalCode={selected?.terminalCode ?? ''}
        onClose={() => {
          setToken(null);
        }}
      />

      <Dialog
        open={isDeactivating}
        onClose={() => {
          setDeactivating(false);
        }}
        title={t.terminal.deactivateTitle}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              disabled={deactivate.isSaving}
              onClick={() => {
                setDeactivating(false);
              }}
            >
              {t.terminal.cancel}
            </Button>
            <Button
              disabled={deactivate.isSaving}
              onClick={() => {
                deactivate.write({});
              }}
            >
              {t.terminal.deactivateConfirm}
            </Button>
          </>
        }
      >
        <p className="dialog-lead">{t.terminal.deactivateLead}</p>
      </Dialog>
    </>
  );
};
