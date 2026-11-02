import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  Icon,
  PageHeader,
  TextArea,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components, InspectionSheet } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState } from 'react';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { ItemSelect } from '../../patterns/item-select';
import { ManagedTable } from '../../patterns/managed-table';
import { SaveErrorBanner } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { usePageHub } from '../../patterns/page-hub';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { PAGE_SIZES, PageNav, type PageSize } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { useSheet } from '../pop-inspection-sheet/queries';
import {
  type Decision,
  type InspectionSheetListQuery,
  PAGE_SIZE,
  useDecision,
  useScanFilter,
  useSheetCounts,
  useSheetList,
  useWorkOrderFilter,
} from './queries';
import { useFourMChangeTypeLabel } from '../four-m-inputs/panel';
import { downloadSheetXlsx } from './export';
import { type DetailTab, SheetDetail } from './sheet-detail';

type InspectionSheetSummary = components['schemas']['InspectionSheetSummary'];

const t = messages.inspectionSheet;
const hubText = messages.common.inspectionHub;

/** 한 줄 말줄임 칸 — 전체 값은 `title` 로 보인다. */
const Ellipsis = ({ text, title, muted }: { text: string; title?: string; muted?: boolean }) => (
  <span
    className={
      muted ? 'inspection-sheet-ellipsis inspection-sheet-muted' : 'inspection-sheet-ellipsis'
    }
    title={title ?? text}
  >
    {text}
  </span>
);
const SIGN_PERMISSION = 'W-03-14';

/** `YYYY-MM-DD`(브라우저 로컬 = 현장) → 그날 0시의 UTC ISO. 「까지」는 다음 날 0시 미만으로 보낸다. */
const dayStart = (day: string, plusDays = 0): string | undefined => {
  if (day === '') return undefined;
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + plusDays);
  return date.toISOString();
};

interface Filter {
  /** LOT · 시리얼 스캔 칸 하나(사용자 지시 2026-11-02) — 무엇으로 거를지는 `useScanFilter` 가 정한다. */
  scan: string;
  /** 상세 조건(펼치기) — 모델(품목 번호 · 이름)과 작업지시 번호(사용자 지시 2026-11-02 · #217). */
  itemId: string;
  /** 양식(OP향 · PP향) — 비면 전체(사용자 지시 2026-11-02). */
  formLayoutCode: '' | 'OP' | 'PP';
  workOrderNo: string;
  status: '' | InspectionSheet['statusCode'];
  from: string;
  to: string;
  page: number;
  size: PageSize;
}

const EMPTY_FILTER: Filter = {
  scan: '',
  itemId: '',
  formLayoutCode: '',
  workOrderNo: '',
  status: '',
  from: '',
  to: '',
  page: 1,
  size: PAGE_SIZE,
};

const toQuery = (
  filter: Filter,
  scan: Pick<InspectionSheetListQuery, 'lotNo' | 'serialNo' | 'workOrderId'>,
): InspectionSheetListQuery => ({
  ...scan,
  ...(filter.itemId === '' ? {} : { itemId: Number(filter.itemId) }),
  ...(filter.formLayoutCode === '' ? {} : { formLayoutCode: filter.formLayoutCode }),
  ...(filter.status === '' ? {} : { statusCode: filter.status }),
  ...(filter.from === '' ? {} : { createdFrom: dayStart(filter.from) }),
  ...(filter.to === '' ? {} : { createdTo: dayStart(filter.to, 1) }),
  page: filter.page,
  size: filter.size,
});

/** 스캔 칸(LOT · 시리얼)과 작업지시 번호를 서버 조건으로 — 둘 다 정해지기 전은 `null`(조회를 미룬다). */
const useListFilter = (
  filter: Filter,
): Pick<InspectionSheetListQuery, 'lotNo' | 'serialNo' | 'workOrderId'> | null => {
  const scan = useScanFilter(filter.scan);
  const workOrder = useWorkOrderFilter(filter.workOrderNo);
  return scan === null || workOrder === null ? null : { ...scan, ...workOrder };
};

/** 모델 칸 맨 앞 — 거르지 않음. */
const ALL_MODELS = [{ value: '', label: t.list.statusAll }];

/**
 * 승인 · 확인이 막히는 까닭 — 서버(`inspection-sheet-sign.service` assertDecidable)와 같은 조건: 서명이 필요한 공정은 모두
 * 서명돼 있어야 하고, 판정이 들어간 공정은 최종 판정이 모두 OK 여야 한다. 막히지 않으면 `null`(사용자 지시 2026-11-02).
 */
const decideBlockOf = (sheet: InspectionSheet): string | null => {
  const unsigned = sheet.steps.filter((step) => step.signRequired && !step.result?.signedAt);
  if (unsigned.length > 0)
    return t.actions.blockedUnsigned(unsigned.map((s) => s.nameKo).join(', '));
  const ng = sheet.steps.filter(
    (step) => step.result !== null && step.result.finalJudgmentCode !== 'OK',
  );
  if (ng.length > 0) return t.actions.blockedNg(ng.map((s) => s.nameKo).join(', '));
  return null;
};

type CancelKind = 'all' | 'approve' | 'check';

/** 상태 칩 차례 — 「전체」 다음 작성중 · 완료. */
const CHIP_STATUSES = [undefined, 'IN_PROGRESS', 'COMPLETED'] as const;

/** 상태 표식 색 — 완료 초록, 작성중 주황(검사 실적의 판정 표식과 같은 모양 · #217). */
const StatusChip = ({ status }: { status: InspectionSheet['statusCode'] }) => (
  <Chip variant="status" size="sm" status={status === 'COMPLETED' ? 'success' : 'warning'}>
    {t.statuses[status] ?? status}
  </Chip>
);

/**
 * 검사표 진행 — ① 공정 검사(입력한 단계/전체) → ② 승인, 끝에 완료 · 미완료(사용자 시안 2026-11-02 · #217).
 * 승인 단계는 승인과 확인이 모두 되면(검사표 완료) 끝난다.
 */
const SheetProgress = ({ sheet }: { sheet: InspectionSheet }) => {
  const p = t.detail.progress;
  const recorded = sheet.steps.filter((step) => step.result !== null).length;
  const completed = sheet.statusCode === 'COMPLETED';
  /*
   * 승인 · 확인이 하나라도 됐으면 승인 단계로 넘어간 것이다 — 서버는 서명이 필요 없는 공정이 비어 있어도 승인을 받으므로
   * 공정 검사 수만 보면 승인했는데도 1단계에 머물렀다(사용자 지시 2026-11-02).
   */
  const deciding = sheet.approvedBy !== null || sheet.checkedBy !== null;
  const inspected = recorded === sheet.steps.length || deciding || completed;
  const steps = [
    {
      label: p.inspection(recorded, sheet.steps.length),
      state: inspected ? 'complete' : 'current',
    },
    { label: p.approval, state: completed ? 'complete' : inspected ? 'current' : 'pending' },
    /* ③ 완료 — 승인 · 확인이 모두 되면 칠한다(끝의 「미완료/완료」 글을 단계로 바꿨다 · 사용자 지시 2026-11-02). */
    { label: p.done, state: completed ? 'complete' : 'pending' },
  ] as const;
  /* 번호 동그라미 + 이름을 한 줄로, 단계 사이 「—」(시안 모양 — 공용 Stepper 는 이름이 동그라미 아래로 내려간다). */
  return (
    <div className="inspection-sheet-progress">
      <ol aria-label={p.label}>
        {steps.map((step, index) => (
          <li key={index} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className="inspection-sheet-progress-step" data-state={step.state}>
              <span className="inspection-sheet-progress-no" aria-hidden>
                {index + 1}
              </span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/**
 * 상태 칩 「전체 N · 작성중 N · 완료 N」 — 조회 조건의 「상태」 선택을 대신한다(검사 실적의 판정 칩과 같은 자리 · 모양 · #217).
 * 누르면 그 상태로 바로 거르고, 「전체」는 거르기를 푼다. 건수는 지금 조건에서 상태만 바꿔 센다.
 */
const StatusChips = ({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (status: Filter['status']) => void;
}) => {
  const target = useHubActionsTarget();
  const scan = useListFilter(filter);
  const counts = useSheetCounts(toQuery(filter, scan ?? {}), CHIP_STATUSES, scan !== null);
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.list.statuses}>
      {CHIP_STATUSES.map((status, index) => {
        const value = status ?? '';
        const label = status === undefined ? t.list.statusAll : (t.statuses[status] ?? status);
        const count = counts[index];
        const isActive = filter.status === value;
        return (
          <Chip
            key={value}
            variant="filter"
            size="sm"
            selected={isActive}
            aria-pressed={isActive}
            onSelectedChange={() => onChange(value)}
          >
            {count === undefined ? label : hubText.count(label, count)}
          </Chip>
        );
      })}
    </div>
  );

  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};

/**
 * 제품 검사표 조회(관리웹 · 품질 관리 · W-03-13 · omf-all-around#89). POP 에서 입력한 시리얼별 검사표를 LOT·시리얼로
 * 찾아 본다(후속 공정·품질 부서 조회). 서명 권한(W-03-14)이 있는 관리자는 단계 서명·승인·확인·승인 취소를 한다.
 */
/** OA 공장 전용(omf-all-around#89) — 계정 범위에 OA 공장이 없으면 안내만 보이고 조회를 보내지 않는다. */
export const InspectionSheetScreen = () => (
  <OaOnlyGate title={t.title} breadcrumbRoot={t.breadcrumbRoot}>
    <InspectionSheetScreenBody />
  </OaOnlyGate>
);

const InspectionSheetScreenBody = () => {
  const toast = useToast();
  const { session } = useSession();
  const hub = usePageHub();
  /* 목록 · 상세 배치 — 검사 조회·판정과 같은 좌우 · 상하 고름과 폭/높이 막대(사용자 지시 · omf-all-around#217). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:inspection-sheet:split', 0.45);
  const layout = useSplitOrientation('omf-mes:inspection-sheet:split-orientation');
  const ids = {
    scan: useId(),
    detail: useId(),
    model: useId(),
    layout: useId(),
    reason: useId(),
  };
  const [draft, setDraft] = useState<Filter>(EMPTY_FILTER);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [openId, setOpenId] = useState<number | null>(null);
  /* 고른 줄을 다시 누르면 고르기를 푼다(상세 닫기 · 사용자 지시 2026-11-02 · #217). */
  const toggleOpen = (id: number) => {
    setDetailTab('basic');
    setOpenId((current) => (current === id ? null : id));
  };
  /* 상세의 고른 탭 — 꼬리 단추(엑셀 · 승인 · 확인)는 기본 정보 탭에서만 보인다(사용자 지시 2026-11-02). */
  const [detailTab, setDetailTab] = useState<DetailTab>('basic');
  const [reopening, setReopening] = useState(false);
  /* 승인 · 확인 확정 창(사용자 지시 2026-11-02). */
  const [confirming, setConfirming] = useState<'approve' | 'check' | null>(null);
  const cancelKindRef = useRef<CancelKind>('all');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const lastDecision = useRef<Decision | null>(null);
  const changeTypeLabel = useFourMChangeTypeLabel();

  const scan = useListFilter(filter);
  const list = useSheetList(toQuery(filter, scan ?? {}), scan !== null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const periodReversed = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  /* 선택 칸(양식 · 모델)은 고르는 즉시 조회 — 조회 단추를 누른 것과 같다(사용자 지시 2026-11-02). */
  const applyNow = (patch: Partial<Filter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    // 기간이 거꾸로면 조회하지 않는다(조회 단추와 같다).
    if (next.from !== '' && next.to !== '' && next.from > next.to) return;
    setFilter((prev) => ({ ...next, page: 1, size: prev.size }));
  };
  const sheet = useSheet(openId);
  const canSign = session?.permissions?.includes(SIGN_PERMISSION) ?? false;
  const decision = useDecision(openId, (next) => {
    const done = lastDecision.current;
    setReopening(false);
    const message =
      done?.kind === 'sign'
        ? t.actions.signed(
            next.steps.find((s) => s.stepCode === done.stepCode)?.nameKo ?? done.stepCode,
          )
        : done?.kind === 'reopen'
          ? t.actions.reopened(t.actions.reopen[cancelKindRef.current])
          : next.statusCode === 'COMPLETED'
            ? t.actions.completed
            : done?.kind === 'approve'
              ? t.actions.approved
              : t.actions.checked;
    toast.show({ variant: 'success', description: message });
  });
  const decide = (next: Decision) => {
    lastDecision.current = next;
    decision.write(next);
  };

  const rows = list.data?.items ?? [];
  const data = sheet.data ?? null;
  const completed = data?.statusCode === 'COMPLETED';
  /* 취소 갈래 — 승인 · 확인이 모두면 일괄, 하나면 그것(서버는 둘을 함께 비운다 · 사용자 지시 2026-11-02). */
  const cancelKind: CancelKind =
    data?.approvedBy != null && data.checkedBy != null
      ? 'all'
      : data?.approvedBy != null
        ? 'approve'
        : 'check';
  const decideBlock = data === null ? null : decideBlockOf(data);
  const openCancel = () => {
    /* 알림 문구는 취소를 연 때의 갈래로 — 저장 뒤 다시 받은 검사표로 세면 늘 「확인 취소」가 된다. */
    cancelKindRef.current = cancelKind;
    setReason('');
    setReasonError('');
    decision.reset();
    setReopening(true);
  };

  const columns: Column<InspectionSheetSummary>[] = [
    /* 시리얼 번호 · 모델 · 생산 LOT · 작업지시를 칸마다 따로(사용자 지시 2026-11-02 · #217). */
    {
      key: 'serial',
      header: t.columns.serialNo,
      align: 'center',
      width: '170px',
      /* 줄 아무 곳이나 눌러 상세를 연다(「보기」 단추 없음 · 사용자 2026-11-02). 시리얼은 키보드로도 여는 글자 단추. */
      render: (row) => (
        <button
          type="button"
          className="inspection-sheet-open"
          aria-label={t.list.openRow(row.serialNo)}
          aria-current={row.inspectionSheetId === openId ? 'true' : undefined}
          onClick={() => toggleOpen(row.inspectionSheetId)}
        >
          <Ellipsis text={row.serialNo} />
        </button>
      ),
    },
    {
      key: 'model',
      header: t.columns.model,
      align: 'center',
      width: '200px',
      render: (row) => <Ellipsis text={`${row.itemName} (${row.itemCode})`} />,
    },
    {
      key: 'lot',
      header: t.columns.lotNo,
      align: 'center',
      width: '260px',
      render: (row) => <Ellipsis text={row.lotNo} />,
    },
    {
      key: 'workOrder',
      header: t.columns.workOrder,
      align: 'center',
      width: '160px',
      render: (row) => <Ellipsis text={row.workOrderNo ?? '—'} />,
    },
    {
      key: 'progress',
      header: t.columns.progress,
      width: '100px',
      align: 'center',
      render: (row) => `${row.recordedStepCount}/${row.stepCount}`,
    },
    {
      key: 'ng',
      header: t.columns.ng,
      width: '100px',
      align: 'center',
      render: (row) => row.ngStepCount,
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'center',
      width: '80px',
      /* 승인·확인자는 칸을 따로 두지 않고 title 로 — 1024 폭 창에서 열 하나를 아낀다(상세에는 그대로 보인다). */
      render: (row) => (
        <span
          title={`${t.columns.approval}: ${[row.approvedByName, row.checkedByName].map((name) => name ?? '—').join(', ')}`}
        >
          <StatusChip status={row.statusCode} />
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t.columns.createdAt,
      align: 'center',
      width: '120px',
      /* 월-일 시:분 — 연도는 title 에. */
      render: (row) => {
        const full = formatPlantDateTime(row.createdAt) ?? '';
        return <Ellipsis text={full.slice(5)} title={full} />;
      },
    },
  ];

  return (
    <>
      {/* 상태 칩 — 배치 단추 왼쪽(검사 실적의 판정 칩과 같은 자리 · #217). */}
      <StatusChips
        filter={filter}
        onChange={(status) => {
          setDraft((prev) => ({ ...prev, status }));
          setFilter((prev) => ({ ...prev, status, page: 1 }));
        }}
      />
      {/* 좌우 · 상하 배치 단추 — 탭 묶음 안이면 탭 줄 오른쪽(검사 조회·판정과 같다), 밖이면 머리 오른쪽(#217). */}
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(omf-all-around#210 · #217). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          actions={
            <SplitOrientationToggle
              orientation={layout.orientation}
              onChange={layout.change}
              inline
            />
          }
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}

      {/* 검색 묶음 — 검사 조회·판정처럼 표와 다른 카드에 둔다(#217). */}
      <section ref={aboveRef} className="pane inspection-sheet-search" aria-label={t.list.search}>
        {/* 검사 실적 조회 줄과 같은 짜임 — 시작일 · 종료일 · 시리얼 · LOT(스캔 칸 모양), 오른쪽 끝에 [조회] [초기화](#217). */}
        <form
          className="filter-bar inspection-results-filter"
          onSubmit={(event) => {
            event.preventDefault();
            if (periodReversed) return;
            setFilter({ ...draft, page: 1 });
          }}
        >
          <div className="inspection-results-filter-row">
            <TextField
              type="date"
              label={t.list.from}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
            <TextField
              type="date"
              label={t.list.to}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
            {/* 양식 — 종료일 바로 오른쪽(OP향 · PP향 제품검사표 · 사용자 지시 2026-11-02). */}
            <div className="field-cell inspection-sheet-layout">
              <label className="field-label" htmlFor={ids.layout}>
                {t.list.layout}
              </label>
              <Select
                id={ids.layout}
                value={draft.formLayoutCode}
                options={[
                  { value: '', label: t.list.statusAll },
                  ...(['OP', 'PP'] as const).map((code) => ({
                    value: code,
                    label: messages.inspectionSheetTemplate.layouts[code] ?? code,
                  })),
                ]}
                /* 고르면 바로 조회한다 — 지금 적힌 다른 조건과 함께(사용자 지시 2026-11-02). */
                onChange={(value) =>
                  applyNow({ formLayoutCode: value as Filter['formLayoutCode'] })
                }
              />
            </div>
            {/* LOT · 시리얼 스캔 칸 하나 — LOT 번호로 먼저 찾고 없으면 시리얼로 찾는다(사용자 지시 2026-11-02 · #217). */}
            <TextField
              id={ids.scan}
              containerClassName="inspection-sheet-scan"
              label={t.list.scan}
              placeholder={t.list.scanPlaceholder}
              value={draft.scan}
              onChange={(e) => setDraft({ ...draft, scan: e.target.value })}
            />
            {/* 조회 → 초기화 → 상세 보기 차례(검사 실적 조회 줄과 같다 · 사용자 지시 2026-11-02). */}
            <div className="form-actions inspection-results-filter-actions">
              {/* ui-check-ignore: C-4 막히는 까닭은 조회 줄 아래 안내 */}
              <Button type="submit" disabled={periodReversed}>
                {t.list.search}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setDraft(EMPTY_FILTER);
                  setFilter((prev) => ({ ...EMPTY_FILTER, size: prev.size }));
                }}
              >
                {t.list.reset}
              </Button>
              <Button
                variant="text"
                size="sm"
                aria-expanded={isDetailOpen}
                aria-controls={ids.detail}
                onClick={() => setIsDetailOpen((open) => !open)}
              >
                {isDetailOpen ? t.list.detailClose : t.list.detailOpen}
              </Button>
            </div>
          </div>
          {/* 아랫줄 — 모델 · 작업지시. `hidden` 은 감싸는 상자에 둔다. */}
          <div id={ids.detail} className="inspection-results-filter-detail" hidden={!isDetailOpen}>
            {/*
             * 모델 — 칸을 누르면 바로 검색창이 펼쳐져 칸 안에서 찾아 고른다(팝업 없음 · #226 공용 칸 · 담당자 지시 2026-11-02).
             * 넘기는 값(품목 번호)과 조회 시점(조회 단추)은 그대로다.
             */}
            <div className="field-cell inspection-sheet-model">
              <label className="field-label" htmlFor={ids.model}>
                {t.list.model}
              </label>
              <ItemSelect
                id={ids.model}
                includeInactive
                leadingOptions={ALL_MODELS}
                placeholder={t.list.modelPlaceholder}
                value={draft.itemId === '' ? null : draft.itemId}
                onChange={(itemId) => applyNow({ itemId: itemId ?? '' })}
              />
            </div>
            <TextField
              containerClassName="inspection-sheet-work-order"
              label={t.list.workOrder}
              placeholder={t.list.workOrderPlaceholder}
              value={draft.workOrderNo}
              onChange={(e) => setDraft({ ...draft, workOrderNo: e.target.value })}
            />
          </div>
          {/* 기간이 거꾸로면 조회를 막고 까닭을 보인다(검사 실적 조회 줄과 같다 · 실검증 2026-11-02). */}
          {periodReversed && (
            <p className="iqc-inspection-action-note" data-tone="info" role="status">
              <Icon name="info" size={14} aria-hidden />
              {t.list.periodReversed}
            </p>
          )}
        </form>
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-sheet-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section className="pane inspection-sheet-list-pane" aria-label={t.list.heading}>
          {list.isError && (
            <AlertBanner variant="error">
              {t.list.loadFailed}{' '}
              <Button size="sm" variant="text" onClick={() => void list.refetch()}>
                {t.list.retry}
              </Button>
            </AlertBanner>
          )}
          {/* 열 폭 · 순서를 바꾸는 표 — 검사 실적 목록과 같다(브라우저에 남는다 · 사용자 지시 #217). */}
          <ManagedTable
            storageKey="omf-mes:inspection-sheet:columns:list"
            className="inspection-sheet-list"
            caption={t.list.caption}
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.inspectionSheetId)}
            scrollX={layout.orientation === 'row'}
            isBusy={list.isFetching}
            onRowClick={(row) => toggleOpen(row.inspectionSheetId)}
            empty={
              <EmptyState size="sm" live title={list.isPending ? t.list.loading : t.list.empty} />
            }
          />
          {/* 표 아래 쪽 이동 줄 — 총 건수 · 쪽 크기 · 처음/이전/n·N/다음/마지막(검사 실적과 같은 공용 부품 · #217). */}
          {list.data !== undefined && (
            <PageNav
              meta={{
                page: list.data.page.page,
                size: PAGE_SIZES.find((size) => size === list.data.page.size) ?? filter.size,
                total: list.data.page.total,
              }}
              onChangePage={(page) => setFilter((prev) => ({ ...prev, page }))}
              onChangeSize={(size) => setFilter((prev) => ({ ...prev, size, page: 1 }))}
              controlSize="sm"
              buttonSize="md"
            />
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <section
          className="pane inspection-sheet-detail-pane"
          aria-label={
            openId === null
              ? t.list.pickTitle
              : data === null
                ? t.detail.loading
                : t.detail.heading(data.serialNo)
          }
        >
          {/* 고른 검사표가 없어도 상세 자리에 안내가 선다(검사 조회·판정과 같다). */}
          {openId === null && (
            <EmptyState size="sm" title={t.list.pickTitle} description={t.list.pickHint} />
          )}
          {sheet.isError && <AlertBanner variant="error">{t.detail.loadFailed}</AlertBanner>}
          {openId !== null && sheet.isPending && <p className="field-note">{t.detail.loading}</p>}
          {data !== null && (
            <>
              {/* 머리 — 「제품 검사표 상세」 + 상태 표식(시리얼은 기본 정보 상자에 · 사용자 지시 2026-11-02). 오른쪽 진행(공정 검사 n/N → 승인) · 사용자 시안 2026-11-02. */}
              <div className="inspection-sheet-detail-head">
                <div>
                  <h2 className="pane-title inspection-sheet-detail-title">
                    {t.detail.title}
                    <StatusChip status={data.statusCode} />
                  </h2>
                </div>
                <SheetProgress sheet={data} />
              </div>
              <SaveErrorBanner
                error={decision.error}
                onReload={() => {
                  decision.reset();
                  void sheet.refetch();
                }}
              />
              <SheetDetail
                key={data.inspectionSheetId}
                sheet={data}
                changeTypeLabel={changeTypeLabel}
                canSign={canSign && !completed}
                hasSignPermission={canSign}
                busy={decision.isSaving}
                onSign={(step) => decide({ kind: 'sign', stepCode: step.stepCode })}
                onTabChange={setDetailTab}
              />
              {/* 꼬리 — 왼쪽 엑셀 다운로드, 오른쪽 승인 · 확인(사용자 시안 2026-11-02). 기본 정보 탭에서만(사용자 지시 2026-11-02). */}
              {detailTab === 'basic' && (
                <div className="form-actions inspection-sheet-detail-actions">
                  <div className="inspection-sheet-detail-actions-start">
                    {/* 고객 양식(B-05-101) 엑셀 내려받기(사용자 지시 2026-11-02 · #217). */}
                    <Button
                      variant="outlined"
                      leadingIcon={<Icon name="download" size={18} aria-hidden />}
                      onClick={() => {
                        downloadSheetXlsx(data).catch(() =>
                          toast.show({ variant: 'error', description: t.excel.failed }),
                        );
                      }}
                    >
                      {t.excel.button}
                    </Button>
                  </div>
                  {/* 상세는 목록 줄을 다시 눌러 닫는다 — [닫기] 단추는 두지 않는다(사용자 지시 2026-11-02). */}
                  <div className="inspection-sheet-detail-actions-end">
                    {/* 승인 · 확인이 막히는 까닭 — 단추 왼쪽 안내 한 줄(사용자 지시 2026-11-02). */}
                    {canSign && !completed && decideBlock !== null && (
                      <p className="iqc-inspection-action-note" data-tone="info" role="status">
                        <Icon name="info" size={14} aria-hidden />
                        {decideBlock}
                      </p>
                    )}
                    {/*
                     * 승인 자리 · 확인 자리는 고정 — 하기 전엔 승인 / 확인, 한 뒤엔 같은 자리 · 같은 모양의 승인 취소 / 확인 취소
                     * (승인은 테두리, 확인은 빨간 채움 · 사용자 지시 2026-11-02). 둘 다 했으면(완료) 승인 자리에 일괄 취소 하나다 —
                     * 서버 취소는 승인 · 확인을 함께 비운다.
                     */}
                    {canSign &&
                      (data.approvedBy === null ? (
                        !completed && (
                          <Button
                            variant="outlined"
                            // ui-check-ignore: C-4 막히는 까닭은 바로 왼쪽 안내 줄 · 보내는 동안에도 잠긴다
                            disabled={decision.isSaving || decideBlock !== null}
                            onClick={() => setConfirming('approve')}
                          >
                            {t.actions.approve}
                          </Button>
                        )
                      ) : (
                        <Button
                          variant="outlined"
                          disabled={decision.isSaving}
                          onClick={openCancel}
                        >
                          {t.actions.reopen[cancelKind]}
                        </Button>
                      ))}
                    {canSign &&
                      (data.checkedBy === null
                        ? !completed && (
                            <Button
                              // ui-check-ignore: C-4 막히는 까닭은 바로 왼쪽 안내 줄 · 보내는 동안에도 잠긴다
                              disabled={decision.isSaving || decideBlock !== null}
                              onClick={() => setConfirming('check')}
                            >
                              {t.actions.check}
                            </Button>
                          )
                        : data.approvedBy === null && (
                            <Button disabled={decision.isSaving} onClick={openCancel}>
                              {t.actions.reopen.check}
                            </Button>
                          ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {confirming !== null && data !== null && (
        <Dialog
          open
          showCloseButton={false}
          onClose={() => setConfirming(null)}
          title={t.confirmDialog.title[confirming]}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConfirming(null)}>
                {t.reopenDialog.close}
              </Button>
              <Button
                disabled={decision.isSaving}
                onClick={() => {
                  decide({ kind: confirming });
                  setConfirming(null);
                }}
              >
                {t.confirmDialog.ok[confirming]}
              </Button>
            </>
          }
        >
          {/* 묻는 말 한 줄 + 아래 흐린 작은 글로 남는 기록(사용자 시안 2026-11-02). */}
          <p className="inspection-sheet-confirm-body">{t.confirmDialog.body[confirming]}</p>
          <p className="field-note">{t.confirmDialog.note[confirming]}</p>
          {/* 남은 쪽까지 되면 완료 — 고칠 수 없게 된다는 것을 미리 알린다. */}
          {(confirming === 'approve' ? data.checkedBy : data.approvedBy) !== null && (
            <p className="iqc-inspection-action-note" data-tone="info">
              <Icon name="info" size={14} aria-hidden />
              {t.confirmDialog.completes}
            </p>
          )}
        </Dialog>
      )}

      {reopening && data !== null && (
        <Dialog
          open
          showCloseButton={false}
          onClose={() => setReopening(false)}
          title={t.actions.reopen[cancelKind]}
          footer={
            <>
              <Button variant="outlined" onClick={() => setReopening(false)}>
                {t.reopenDialog.close}
              </Button>
              <Button
                disabled={decision.isSaving}
                loading={decision.isSaving}
                onClick={() => {
                  if (reason.trim() === '') {
                    setReasonError(t.reopenDialog.required);
                    return;
                  }
                  decide({ kind: 'reopen', reason: reason.trim() });
                }}
              >
                {t.actions.reopen[cancelKind]}
              </Button>
            </>
          }
        >
          <p>{t.reopenDialog.body[cancelKind]}</p>
          {/* 필수 칸 — 이름 옆 빨간 *(공용 `.required-mark`). */}
          <label className="field-label" htmlFor={ids.reason}>
            {t.reopenDialog.reason}
            <span aria-hidden="true" className="required-mark">
              {' *'}
            </span>
          </label>
          <TextArea
            id={ids.reason}
            aria-label={t.reopenDialog.reason}
            placeholder={t.reopenDialog.placeholder}
            value={reason}
            maxLength={500}
            rows={3}
            required
            fullWidth
            error={reasonError || decision.fieldErrors.reason || undefined}
            onChange={(event) => setReason(event.target.value)}
          />
        </Dialog>
      )}
    </>
  );
};
