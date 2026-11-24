import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  SearchInput,
  Skeleton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner } from '../../patterns/master';
import { PageNav } from '../../patterns/page-nav';
import {
  PaneListHead,
  PaneSplitter,
  useFitToViewport,
  usePaneSplit,
} from '../../patterns/po-board';
import { PaneHeightSplitter, useSplitOrientation } from '../../patterns/split-orientation';
import {
  EMPTY_FILTERS,
  LIST_PAGE_SIZES,
  readFilters,
  readSelected,
  toSearchParams,
  type ListPageSize,
} from './filters';
import { DiscardDialog } from '../routing/leave-guard';
import type { FlagKey } from './flags';
import {
  addProcess,
  hasNoFlag,
  hasProcess,
  isDirty,
  removeProcess,
  setRow,
  splitRowErrors,
  toggleFlag,
  toReplaceBody,
  type GridDraft,
} from './grid-draft';
import { ActiveChips } from './active-chips';
import { LayoutToggle } from './layout-toggle';
import { LoadErrorBanner } from './load-error-banner';
import {
  codeSelectOptions,
  lookupNote,
  usePlantOptions,
  useProcessOptions,
  useTerminalCodeNames,
} from './lookups';
import { PagedSelectField } from './paged-select-field';
import { ProcessGrid } from './process-grid';
import {
  useProcessesReplace,
  useEquipmentLabel,
  useEquipmentPages,
  useWarehouseLabel,
  useWarehousePages,
  useTerminalDetail,
  useTerminalProcesses,
  useTerminals,
  useNextTerminalCode,
  useTerminalRegistrationCounts,
  useTerminalActivate,
  useTerminalDeactivate,
  useTerminalUpdate,
  useTokenIssue,
} from './queries';
import { SelectField } from './select-field';
import {
  EMPTY_TERMINAL,
  hasTerminalErrors,
  terminalCodePrefix,
  toTerminalDraft,
  toUpdateBody,
  validateTerminal,
  type TerminalDraft,
  type TerminalErrors,
} from './terminal-draft';
import { TerminalCreateWizard } from './terminal-create-wizard';
import { TerminalForm } from './terminal-form';
import { TokenDialog } from './token-dialog';
import {
  formatMoment,
  statusTextOf,
  type SelectOption,
  type TerminalView,
  type TokenView,
} from './types';

const t = messages.terminalProcessMap;

const EMPTY_ROWS: TerminalView[] = [];
/** 공정별 기능 구성을 쓰는 단말 유형 — 작업장 단말만 공정에서 일한다. */
const POP_TYPE = 'POP';
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
 * ⭐⭐ 등록 토큰은 QR 또는 복사로 기기에 전달한다. 기기가 명부 수신 뒤 서버에 등록을
 * 확인한 상태를 별도 표시한다. 재발급은 이전 토큰 세대를 끊는다.
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
  /* 저장 · 중지 결과는 오른쪽 아래 알림으로(사용자 지시 2026-11-20 · #333). */
  const toast = useToast();
  const notify = (description: string): void => {
    toast.show({ variant: 'success', description });
  };
  /** 저장하지 않은 기능 구성이 있을 때 미뤄 둔 이동(사용자 역할 권한 관리와 같다 · #333). */
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  /* 사용자 역할 권한 관리와 같은 배치 — 위 조회 묶음 · 아래 목록 | 상세(좌우 · 상하 배치, 폭 · 높이 끌기, 목록 접기). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:terminal-process-map:split', 0.45);
  const layout = useSplitOrientation('omf-mes:terminal-process-map:split-orientation');
  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: messages.common.inspectionHub.listCollapse,
    expandLabel: messages.common.inspectionHub.listExpand,
  };
  /** 서버 오류의 `items[i]` 를 공정으로 되짚을 «보낸» 순서 */
  const sentProcessIds = useRef<number[]>([]);
  /** 서버가 짚은 뒤 사람이 고친 줄 — 고친 줄에 옛 오류를 남기지 않는다 */
  const [editedSinceSave, setEditedSinceSave] = useState<ReadonlySet<number>>(new Set());

  const plants = usePlantOptions();
  const processes = useProcessOptions();
  const codeNames = useTerminalCodeNames();

  /*
   * 단말 유형을 고르면 단말 코드를 `유형-일련번호` 로 채운다 — 고칠 수 있다(사용자 지시 2026-11-20 · #333).
   * 칸이 비었거나 앞서 채운 값 그대로일 때만 바꾼다 — 사용자가 고친 코드는 덮지 않는다.
   * 유형을 고르기 전에는 코드 칸이 잠겨 있다 — 위에서 채운 코드가 유형을 고를 때 바뀌지 않게 칸을 맨 끝에 둔다.
   */
  const [autoCode, setAutoCode] = useState<string | null>(null);
  const codeSuggestion = useNextTerminalCode(
    formMode === 'create' ? terminalCodePrefix(terminalDraft.terminalTypeCode) : '',
  );
  if (
    formMode === 'create' &&
    codeSuggestion !== null &&
    codeSuggestion !== autoCode &&
    (terminalDraft.terminalCode === '' || terminalDraft.terminalCode === autoCode)
  ) {
    setAutoCode(codeSuggestion);
    setTerminalDraft({ ...terminalDraft, terminalCode: codeSuggestion });
    setTerminalErrors(({ terminalCode: _filled, ...rest }) => rest);
  }

  const terminals = useTerminals(filters);
  const registrationCounts = useTerminalRegistrationCounts(filters);
  const fetchEquipments = useEquipmentPages();
  const equipmentFilterLabel = useEquipmentLabel(filters.equipment);
  const fetchWarehouses = useWarehousePages();
  const warehouseFilterLabel = useWarehouseLabel(filters.warehouse);
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

  /** 단말 추가 창을 열 때마다 새로 — 지난 등록의 단계 · 표 · 오류를 들고 오지 않는다. */
  const [wizardKey, setWizardKey] = useState(0);

  const update = useTerminalUpdate(selectedId, () => {
    setFormMode('closed');
    notify(t.terminal.saved);
  });

  /*
   * 사용 중지 · 재개 — 운영 상태(가동 · 중지)와 다른 축이다. 끄면 그 기기의 토큰이 막히고 다시 켜면 풀린다
   * (계약 Terminal.statusCode 설명 · 사용자 결정 2026-11-24). 수정 창 본문 맨 아래에 둔다.
   */
  const [isDeactivating, setDeactivating] = useState(false);
  const activate = useTerminalActivate(selectedId, () => {
    setFormMode('closed');
    notify(t.terminal.activated);
  });
  const deactivate = useTerminalDeactivate(selectedId, () => {
    setDeactivating(false);
    notify(t.terminal.deactivated);
  });

  const replace = useProcessesReplace(selectedId, () => {
    notify(t.grid.saved);
    /* 저장한 구성을 다시 읽는다 — 새 잠금 토큰이 그 조회에 실려 온다. */
    void processRows.refetch();
  });

  const issueToken = useTokenIssue(selectedId, (issued) => {
    setToken(issued);
  });

  const rows = terminals.data?.items ?? EMPTY_ROWS;
  const selected = detail.data ?? null;

  const apply = (next: Partial<typeof filters>, keepSelection: boolean): void => {
    /* 조건이 바뀌면 첫 쪽으로 돌아간다 — 3쪽을 보던 채로 조건만 좁히면 빈 쪽이 나온다. */
    const merged = { ...filters, ...next, page: next.page ?? 1 };

    setSearchParams(toSearchParams(merged, keepSelection ? selectedId : null));
  };

  const resetGrid = (): void => {
    setGrid(original);
    setGridNotice(null);
    replace.reset();
  };

  /*
   * 저장하지 않은 기능 구성이 있으면 단말 · 조건 · 쪽을 바꾸기 전에 묻는다(사용자 역할 권한 관리와 같다 · #333).
   * 다른 단말로 옮기면 그 구성은 조용히 사라진다 — 고르던 단말이 목록에서 빠지는 조건 변경도 같다.
   */
  const leaveSafely = (action: () => void): void => {
    if (selectedId !== null && isDirty(grid, original)) {
      setPendingLeave(() => action);
      return;
    }

    action();
  };

  const selectTerminal = (terminalId: number | null): void => {
    setSearchParams(toSearchParams(filters, terminalId));
    setFormMode('closed');
    update.reset();
    replace.reset();
    issueToken.reset();
  };

  const openCreate = (): void => {
    setTerminalDraft(EMPTY_TERMINAL);
    setAutoCode(null);
    setTerminalErrors({});
    setFormMode('create');
    setWizardKey((key) => key + 1);
    update.reset();
  };

  const openEdit = (): void => {
    if (selected === null) return;

    setTerminalDraft(toTerminalDraft(selected));
    setTerminalErrors({});
    setFormMode('edit');
    update.reset();
  };

  /** 칸을 검사해 오류를 건다 — 넘어가도 되면 `true`. */
  const checkTerminal = (): boolean => {
    const errors = validateTerminal(terminalDraft, formMode === 'create');

    setTerminalErrors(errors);

    return !hasTerminalErrors(errors);
  };

  const submitEdit = (): void => {
    if (checkTerminal()) update.write(toUpdateBody(terminalDraft));
  };

  const changeDraft = (patch: Partial<TerminalDraft>): void => {
    setTerminalDraft((prev) => ({ ...prev, ...patch }));
    /* 고친 칸의 「비었다」 오류는 바로 지운다 — 다 채웠는데 빨간 문구가 남지 않게(#333). */
    setTerminalErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !(key in patch))),
    );
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

  /*
   * 운영 상태 — 등록을 확인하기 전에는 가동으로 보이지 않게 한다(statusTextOf).
   * 미등록은 「등록 상태」 열이 이미 말하므로 여기서는 같은 말을 되풀이하지 않고 비워 둔다.
   */
  const operatingStatusOf = (terminal: TerminalView): string => {
    const text = statusTextOf(terminal, {
      unregistered: t.list.notAvailable,
      unknown: t.list.registrationUnknown,
    });

    return terminal.registrationStatusCode === 'REGISTERED' ? codeNames.status(text) : text;
  };

  const registrationText = (terminal: TerminalView): string =>
    terminal.registrationStatusCode === 'REGISTERED'
      ? t.list.registrationComplete
      : terminal.registrationStatusCode === 'UNREGISTERED'
        ? t.list.registrationPending
        : t.list.registrationUnknown;

  const registrationChip = (terminal: TerminalView) => (
    <Chip size="sm" status={terminal.registrationStatusCode === 'REGISTERED' ? 'success' : 'idle'}>
      {registrationText(terminal)}
    </Chip>
  );

  const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
    entries.map((entry) => ({ value: entry.value, label: entry.label }));

  /*
   * 고른 줄을 다시 누르면 선택이 풀린다(사용자 역할 권한 관리 목록과 같다 · #333).
   * 저장하지 않은 기능 구성이 있으면 먼저 묻는다 — 다른 단말로 옮기면 그 구성이 사라진다.
   */
  const pickTerminal = (terminalId: number): void => {
    leaveSafely(() => {
      selectTerminal(terminalId === selectedId ? null : terminalId);
    });
  };

  const baseColumns: Column<TerminalView>[] = [
    {
      key: 'code',
      header: t.list.code,
      width: '172px',
      /* 링크처럼 보이지 않는다 — 줄 아무 곳이나 눌러 고른다. 이 단추는 키보드·화면 낭독기의 자리다. */
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.terminalId === selectedId ? 'true' : undefined}
          onClick={() => {
            pickTerminal(row.terminalId);
          }}
        >
          {row.terminalCode}
        </button>
      ),
    },
    {
      key: 'type',
      align: 'center',
      header: t.list.type,
      width: '96px',
      render: (row) => codeNames.type(row.terminalTypeCode),
    },
    {
      key: 'active',
      align: 'center',
      header: t.list.activeHeader,
      width: '96px',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.list.active : t.list.inactive}
        </Chip>
      ),
    },
    {
      key: 'registration',
      align: 'center',
      header: t.list.registration,
      width: '96px',
      render: (row) => registrationChip(row),
    },
    {
      key: 'equipment',
      header: t.list.equipment,
      width: '240px',
      render: (row) => row.equipmentLabel ?? t.list.notAvailable,
    },
    {
      key: 'warehouse',
      header: t.list.warehouse,
      width: '288px',
      /* 창고를 정하지 않았으면 유형과 관계없이 설치 설비 칸처럼 「—」(사용자 지시 2026-11-24). */
      render: (row) => row.warehouseName ?? t.list.notAvailable,
    },
  ];
  /*
   * 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(사용자 역할 권한 관리 목록과 같다).
   * 글자 열(코드 · 설비 · 창고)은 왼쪽 정렬에 넓게, 라벨 열은 라벨 폭만(사용자 지시 2026-11-24).
   * 폭은 지금 자료(MOBILE-002-WH31 · 설비 이름 · 베트남어 창고 이름)가 잘리지 않는 만큼 — 목록 구획이 좁으면 표가 가로로 구른다.
   * 폭 기본값을 바꾸며 저장 열쇠를 v2 로 — 예전에 끌어 둔 폭이 새 기본값을 덮지 않게.
   */
  const ordered = useColumnOrder('omf-mes:terminal-process-map:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:terminal-process-map:columns:v2', ordered);
  const fit = useFitColumns(resizable.columns);

  const serverRowErrors = splitRowErrors(replace.error, sentProcessIds.current);
  const noFlagIds = grid.filter(hasNoFlag).map((row) => row.processId);
  const rowErrors = new Map(
    [...serverRowErrors.rows].filter(([processId]) => !editedSinceSave.has(processId)),
  );
  for (const processId of noFlagIds) rowErrors.set(processId, t.grid.noFlag);
  const markEdited = (processId: number): void => {
    setEditedSinceSave((current) => new Set(current).add(processId));
  };

  /* 잠금 토큰이 아직 없으면 구성을 보내도 막힌다 — 누르기 전에 잠근다. */
  const canSaveGrid =
    selectedId !== null &&
    !processRows.isPending &&
    !processRows.isError &&
    !replace.isSaving &&
    noFlagIds.length === 0;

  const isGridDirty = selectedId !== null && isDirty(grid, original);
  /* 이미 표에 있는 공정은 고를 거리에서 뺀다(사용자 지시 2026-11-20 · #333). */
  const addableProcesses = processes.entries.filter(
    (entry) => !grid.some((row) => String(row.processId) === entry.value),
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (terminals.isError) {
      return (
        <LoadErrorBanner
          error={terminals.error}
          onRetry={() => {
            void terminals.refetch();
          }}
        />
      );
    }

    if (terminals.isPending) return <Skeleton variant="rect" height="12rem" />;

    return (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 단추로 넘긴다. */
      <div
        ref={fit.ref}
        className="users-roles-list inspection-queue-table terminal-map-list"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.users-roles-row-pick')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.terminalId)}
          empty={<EmptyState size="sm" live title={t.list.emptyTitle} description={t.list.empty} />}
        />
      </div>
    );
  };

  /** 오른쪽 한 카드 — 단말 정보 위, 공정별 기능 구성 아래(사용자 결정 2026-11-20 · #333). */
  const renderSettings = (): ReactNode => {
    if (selectedId === null) {
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="tablet_android" size={20} />
            </span>
          }
          title={
            terminals.data !== undefined && rows.length === 0
              ? t.grid.noTerminalTitle
              : t.grid.selectTerminalTitle
          }
          description={t.grid.selectTerminal}
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

    if (selected === null) return <Skeleton variant="rect" height="12rem" />;

    return (
      <>
        <section className="terminal-map-settings-block" aria-label={t.panes.terminal}>
          {/* 제목 줄 오른쪽 위에 단말 조작 단추(사용자 지시 2026-11-20 · #333). */}
          <div className="terminal-map-settings-head">
            <h3 className="terminal-map-settings-title">{t.panes.terminal}</h3>
            <div className="terminal-map-info-actions">
              {/* 사용 중지 · 재개는 [단말 수정] 창 본문 맨 아래에(사용자 지시 2026-11-24). */}
              <Button
                variant="outlined"
                leadingIcon={<Icon name="edit" size={18} aria-hidden />}
                onClick={openEdit}
              >
                {t.terminal.edit}
              </Button>
              <Button
                leadingIcon={<Icon name="key" size={18} aria-hidden />}
                disabled={issueToken.isSaving}
                onClick={() => {
                  issueToken.write({});
                }}
              >
                {t.token.issue}
              </Button>
            </div>
          </div>
          <SaveErrorBanner error={issueToken.error} />
          <SaveErrorBanner error={deactivate.error} />
          <SaveErrorBanner error={activate.error} />
          {/*
           * 단말 정보 표 — 항목 | 값 | 항목 | 값 네 칸(사용자 지시 2026-11-24). 한 줄에 짝 하나씩:
           * 코드 · 유형 / 운영 상태 · 등록 상태 / 등록 일시 · 설치 설비 / 창고(이름이 길어 한 줄을 다 쓴다).
           */}
          <table className="terminal-map-info-table">
            <tbody>
              <tr>
                <th scope="row">{t.terminal.code}</th>
                <td className="terminal-map-info-key">{selected.terminalCode}</td>
                <th scope="row">{t.terminal.type}</th>
                <td>{codeNames.type(selected.terminalTypeCode)}</td>
              </tr>
              <tr>
                <th scope="row">{t.terminal.status}</th>
                <td>{operatingStatusOf(selected)}</td>
                <th scope="row">{t.terminal.registration}</th>
                {/* 표 안에서는 라벨 없이 글자로 — 다른 칸과 같게(사용자 지시 2026-11-24). */}
                <td>{registrationText(selected)}</td>
              </tr>
              <tr>
                {/* 등록 상태와 등록 일시를 나눈다(사용자 지시 2026-11-20 · #333). */}
                <th scope="row">{t.terminal.registeredAt}</th>
                <td>
                  {selected.registrationConfirmedAt === null
                    ? t.list.notAvailable
                    : formatMoment(selected.registrationConfirmedAt)}
                </td>
                <th scope="row">{t.terminal.equipment}</th>
                <td>{selected.equipmentLabel ?? t.terminal.unassigned}</td>
              </tr>
              <tr>
                <th scope="row">{t.terminal.warehouse}</th>
                <td colSpan={3}>{selected.warehouseName ?? t.list.notAvailable}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/*
         * 공정별 기능 구성은 POP 단말만 — 창고에서 쓰는 단말(PDA 등)은 공정이 뜻이 없다(사용자 지시 2026-11-24).
         */}
        {selected.terminalTypeCode === POP_TYPE && (
          <>
            <section className="terminal-map-settings-block" aria-label={t.panes.grid}>
              {/* 제목 옆 안내는 두지 않는다 — 제목과 [공정 추가]가 목적과 첫 행동을 말한다(사용자 지시 2026-11-20 · #333). */}
              <div className="terminal-map-settings-head terminal-map-grid-head">
                <h3 className="terminal-map-settings-title">{t.panes.grid}</h3>
                {/* 공정 추가는 같은 줄 오른쪽 끝, 칸 이름은 선택칸 왼쪽(사용자 지시 2026-11-20 · #333). */}
                {!processRows.isError &&
                  !processRows.isPending &&
                  (addableProcesses.length === 0 && !processes.isLoading && !processes.isError ? (
                    /* 다 추가했으면 빈 선택칸 대신 안내 라벨(사용자 지시 2026-11-20 · #333). */
                    <p
                      className="iqc-inspection-action-note terminal-map-add-done"
                      data-tone="info"
                    >
                      <Icon name="info" size={16} aria-hidden />
                      {t.grid.nothingToAdd}
                    </p>
                  ) : (
                    <SelectField
                      label={t.grid.add}
                      /* 이미 표에 있는 공정은 고를 거리에서 뺀다(사용자 지시 2026-11-20 · #333). */
                      options={toOptions(addableProcesses)}
                      value={addTarget}
                      note={lookupNote(processes, t.grid.processLookupFailed)}
                      error={gridNotice ?? undefined}
                      placeholder={t.grid.addPlaceholder}
                      className="terminal-map-add-field"
                      onChange={addRow}
                    />
                  ))}
              </div>

              {processRows.isError ? (
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
                  <SaveErrorBanner error={serverRowErrors.rest} />
                  {processes.isError ? (
                    <LoadErrorBanner error={processes.error} onRetry={processes.refetch} />
                  ) : null}

                  {/*
                   * 공정이 없어도 표 머리는 그대로 두고 표 안에 빈 상태를 낸다 — 목록 표와 같은 모양(사용자 지시 2026-11-20 · #333).
                   * ⭐ 0건이 정상인 단말이 있다 — 오류처럼 그리지 않는다.
                   */}
                  <div className="terminal-map-grid-table">
                    <ProcessGrid
                      rows={grid}
                      rowErrors={rowErrors}
                      disabled={replace.isSaving}
                      onToggle={(processId, key: FlagKey) => {
                        markEdited(processId);
                        setGrid(toggleFlag(grid, processId, key));
                      }}
                      onToggleRow={(processId, open) => {
                        markEdited(processId);
                        setGrid(setRow(grid, processId, open));
                      }}
                      onRemove={(processId) => {
                        setGrid(removeProcess(grid, processId));
                      }}
                      empty={
                        /* 오른쪽 「단말을 선택해 주세요」와 같은 아이콘 원 + 한 줄(사용자 지시 2026-11-20 · #333). */
                        <EmptyState
                          size="sm"
                          className="terminal-map-grid-empty"
                          icon={
                            <span className="inspection-standard-empty-icon">
                              <Icon name="checklist" size={20} />
                            </span>
                          }
                          title={t.grid.emptyTitle}
                        />
                      }
                    />
                  </div>
                </>
              )}
            </section>

            <div className="form-actions terminal-map-settings-footer">
              {replace.isSaving && (
                <p className="field-note form-actions-secondary">{t.grid.saving}</p>
              )}
              <Button
                variant="outlined"
                disabled={replace.isSaving || !isGridDirty}
                onClick={resetGrid}
              >
                {t.grid.reset}
              </Button>
              <Button
                disabled={!canSaveGrid || !isGridDirty}
                onClick={() => {
                  sentProcessIds.current = grid.map((row) => row.processId);
                  setEditedSinceSave(new Set());
                  replace.write(toReplaceBody(grid));
                }}
              >
                {t.grid.save}
              </Button>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <>
      {/*
       * 사용자 역할 권한 관리와 같은 틀(omf-all-around#333) — 위 조회 묶음, 아래 목록 | 고른 단말의 한 카드.
       * 머리글(경로 · 화면 이름)은 두지 않는다 — 사이드바가 위치를 말한다.
       */}
      {/* 위 줄 오른쪽 — 등록 · 미등록 라벨과 좌우 · 상하 배치 단추(사용자 지시 2026-11-20 · #333). */}
      <div className="terminal-map-top-actions">
        <ActiveChips
          counts={registrationCounts}
          active={filters.registration}
          onChange={(registration) => {
            leaveSafely(() => {
              apply({ registration }, true);
            });
          }}
        />
        <LayoutToggle orientation={layout.orientation} onChange={layout.change} />
      </div>

      <div className="users-roles-workspace">
        {/* 조건 칸 바탕은 품목 · BOM 조회 묶음과 같은 공용 규칙(filter-field-surface · 사용자 지시 2026-11-24). */}
        <section
          ref={aboveRef}
          className="pane users-roles-search filter-field-surface"
          aria-label={t.panes.search}
        >
          <div className="filter-bar users-roles-filter-row">
            {/* 단말 유형 · 설치 설비 · 창고 · 단말 코드 검색 순(사용자 지시 2026-11-20 · #333). 고르는 즉시 적용한다. */}
            <SelectField
              label={t.filters.type}
              options={[
                { value: '', label: t.filters.all },
                ...codeSelectOptions(codeNames.typeLookup, filters.type),
              ]}
              value={filters.type}
              placeholder={t.filters.all}
              className="terminal-map-filter-field"
              onChange={(type) => {
                leaveSafely(() => {
                  apply({ type }, true);
                });
              }}
            />
            <div className="terminal-map-filter-field">
              <PagedSelectField
                label={t.filters.equipment}
                emptyLabel={t.filters.all}
                value={filters.equipment}
                valueLabel={equipmentFilterLabel}
                queryKey={['terminal-process-map', 'equipment-filter']}
                fetchPage={fetchEquipments}
                onChange={(equipment) => {
                  leaveSafely(() => {
                    apply({ equipment }, true);
                  });
                }}
              />
            </div>
            <div className="terminal-map-filter-field">
              <PagedSelectField
                label={t.filters.warehouse}
                emptyLabel={t.filters.all}
                value={filters.warehouse}
                valueLabel={warehouseFilterLabel}
                queryKey={['terminal-process-map', 'warehouse-filter']}
                fetchPage={fetchWarehouses}
                onChange={(warehouse) => {
                  leaveSafely(() => {
                    apply({ warehouse }, true);
                  });
                }}
              />
            </div>
            <SearchInput
              containerClassName="users-roles-search-input terminal-map-search-input"
              label={t.filters.search}
              value={search}
              placeholder={t.filters.searchPlaceholder}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              onSearch={(value) => {
                leaveSafely(() => {
                  apply({ q: value }, true);
                });
              }}
              clearLabel={messages.common.clear}
            />
            {/* 해제 축이라 누르는 즉시 적용한다. */}
            <div className="field-cell field-cell-unlabeled">
              <Checkbox
                checked={filters.includeInactive}
                onChange={(event) => {
                  const includeInactive = event.target.checked;
                  leaveSafely(() => {
                    apply({ includeInactive }, true);
                  });
                }}
              >
                {t.filters.includeInactive}
              </Checkbox>
            </div>
            {/* 조회와 초기화는 짝이라 함께 둔다. 초기화는 늘 보인다(사용자 지시 2026-11-20 · #333). */}
            <div className="filter-actions field-cell-unlabeled">
              <Button
                onClick={() => {
                  leaveSafely(() => {
                    apply({ q: search }, true);
                  });
                }}
              >
                {t.filters.apply}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  leaveSafely(() => {
                    setSearch('');
                    setSearchParams(
                      toSearchParams({ ...EMPTY_FILTERS, size: filters.size }, selectedId),
                    );
                  });
                }}
              >
                {t.filters.clear}
              </Button>
            </div>
            <Button
              className="users-roles-add-user"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={openCreate}
            >
              {t.terminal.create}
            </Button>
          </div>
        </section>

        <div
          ref={splitRef}
          className={`po-board-split inspection-split users-roles-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
          style={{ ...split.style, ...layout.style }}
          data-left-collapsed={split.collapsed ? 'true' : undefined}
        >
          <section className="pane users-roles-list-pane" aria-label={t.panes.list}>
            <PaneListHead
              title={t.panes.list}
              collapse={{ ...listCollapse, count: terminals.data?.page.total }}
            />
            <div className="users-roles-list-body">{listSlot()}</div>
            {terminals.data !== undefined && (
              <PageNav<ListPageSize>
                meta={terminals.data.page}
                sizes={LIST_PAGE_SIZES}
                buttonSize="md"
                onChangePage={(page) => {
                  leaveSafely(() => {
                    apply({ page }, true);
                  });
                }}
                onChangeSize={(size) => {
                  leaveSafely(() => {
                    apply({ size }, true);
                  });
                }}
              />
            )}
          </section>

          <PaneSplitter
            label={messages.common.inspectionHub.splitter}
            ratio={split.ratio}
            onChange={split.commit}
            collapse={{ ...listCollapse, count: terminals.data?.page.total }}
          />
          {layout.orientation === 'column' && (
            <PaneHeightSplitter
              label={messages.common.inspectionHub.heightSplitter}
              height={layout.listHeight}
              onChange={layout.changeListHeight}
              collapse={listCollapse}
            />
          )}

          <section
            className="pane users-roles-settings terminal-map-settings"
            aria-label={t.panes.settings}
          >
            {renderSettings()}
          </section>
        </div>
      </div>

      {/*
       * 단말 추가는 단계 창(단말 정보 → 공정 기능(POP만) → 기기 연결 · 사용자 결정 2026-11-24).
       * 닫히면 이 창에서 만든 단말을 고른다 — 오른쪽에서 이어 고칠 수 있다.
       */}
      <TerminalCreateWizard
        key={wizardKey}
        open={formMode === 'create'}
        draft={terminalDraft}
        errors={terminalErrors}
        codeIsAuto={autoCode !== null && terminalDraft.terminalCode === autoCode}
        plants={plants}
        processes={processes}
        codeNames={codeNames}
        onChange={changeDraft}
        validate={checkTerminal}
        onClose={(createdId, finished) => {
          setFormMode('closed');
          if (createdId === null) return;
          /* 다 마쳤으면 창이 이미 알렸다 — 알림은 한 자리에 하나. */
          if (!finished) notify(t.terminal.registered);
          selectTerminal(createdId);
        }}
      />

      {/* 단말 수정은 팝업 하나(사용자 · 역할 수정과 같다 · #333). 고르던 단말과 기능 구성은 그대로 남는다. */}
      <Dialog
        open={formMode === 'edit'}
        size="lg"
        title={t.terminal.edit}
        className="terminal-map-form-dialog"
        closeOnBackdropClick={false}
        /* 닫기는 [취소] 하나(사용자 지시 2026-11-20 · #333). */
        showCloseButton={false}
        onClose={() => {
          setFormMode('closed');
        }}
        footer={
          <>
            {update.isSaving && (
              <p className="field-note form-actions-secondary">{t.terminal.saving}</p>
            )}
            <Button
              variant="outlined"
              disabled={update.isSaving}
              onClick={() => {
                setFormMode('closed');
              }}
            >
              {t.terminal.cancel}
            </Button>
            <Button disabled={update.isSaving} onClick={submitEdit}>
              {t.terminal.save}
            </Button>
          </>
        }
      >
        <TerminalForm
          draft={terminalDraft}
          errors={terminalErrors}
          isNew={false}
          saveError={update.error}
          fieldErrors={update.fieldErrors}
          plants={plants}
          codeNames={codeNames}
          onChange={changeDraft}
        />
        {/* 사용 중지 · 재개 — 칸들과 구분선으로 가른 본문 맨 아래(사용자 지시 2026-11-24). */}
        {selected !== null && (
          <div className="terminal-map-edit-danger">
            {selected.isActive ? (
              <Button
                variant="outlined"
                leadingIcon={<Icon name="block" size={18} aria-hidden />}
                disabled={update.isSaving || deactivate.isSaving}
                onClick={() => {
                  setFormMode('closed');
                  setDeactivating(true);
                }}
              >
                {t.terminal.deactivateAction}
              </Button>
            ) : (
              <Button
                variant="outlined"
                leadingIcon={<Icon name="restart_alt" size={18} aria-hidden />}
                loading={activate.isSaving}
                disabled={update.isSaving || activate.isSaving}
                onClick={() => {
                  activate.write({});
                }}
              >
                {t.terminal.activate}
              </Button>
            )}
          </div>
        )}
      </Dialog>

      <TokenDialog
        token={token}
        terminalCode={selected?.terminalCode ?? ''}
        onClose={() => {
          setToken(null);
        }}
      />

      {/* 사용 중지 확인 — 사용자 · 역할 사용 중지 창과 같은 모양(대상 · 질문 · 경고 · #333). */}
      <Dialog
        open={isDeactivating}
        size="md"
        onClose={() => {
          setDeactivating(false);
        }}
        title={t.terminal.deactivateTitle}
        closeOnBackdropClick={false}
        showCloseButton={false}
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
              loading={deactivate.isSaving}
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
        <div className="users-roles-worker-dialog">
          {selected !== null && (
            <div className="users-roles-worker-block">
              <span className="users-roles-worker-block-caption">
                {t.terminal.deactivateCaption}
              </span>
              <strong>{selected.terminalCode}</strong>
              <span>{t.terminal.deactivateMeta(codeNames.type(selected.terminalTypeCode))}</span>
            </div>
          )}
          <p>{t.terminal.deactivateQuestion}</p>
          <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
            <Icon name="warning" size={16} aria-hidden />
            {t.terminal.deactivateLead}
          </p>
        </div>
      </Dialog>

      {/* 저장하지 않은 기능 구성 — 다른 화면과 같은 나가기 확인 창(시안 문구 · 사용자 지시 2026-11-20 · #333). */}
      {pendingLeave !== null && (
        <DiscardDialog
          title={t.discard.title}
          body={t.discard.body}
          showCloseButton={false}
          onStay={() => {
            setPendingLeave(null);
          }}
          onLeave={() => {
            const action = pendingLeave;
            setPendingLeave(null);
            resetGrid();
            action();
          }}
        />
      )}
    </>
  );
};
