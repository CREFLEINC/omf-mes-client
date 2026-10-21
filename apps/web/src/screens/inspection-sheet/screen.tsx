import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  Dialog,
  EmptyState,
  PageHeader,
  Select,
  Table,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type {
  InspectionSheet,
  InspectionSheetListQuery,
  InspectionSheetSummary,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SaveErrorBanner } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { useSession } from '../../patterns/session';
import { PageNav } from '../oqc-inspection/page-nav';
import { toPageView } from '../oqc-inspection/pagination';
import { useSheet } from '../pop-inspection-sheet/queries';
import { type Decision, useDecision, useSheetList } from './queries';
import type { PrintLang } from './print-layout';
import { useFourMChangeTypeLabel } from '../four-m-inputs/panel';
import { SheetDetail } from './sheet-detail';
import { SheetPrint } from './sheet-print';

const t = messages.inspectionSheet;

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
  serialNo: string;
  lotNo: string;
  status: '' | InspectionSheet['statusCode'];
  from: string;
  to: string;
  page: number;
}

const EMPTY_FILTER: Filter = { serialNo: '', lotNo: '', status: '', from: '', to: '', page: 1 };

const toQuery = (filter: Filter): InspectionSheetListQuery => ({
  ...(filter.serialNo.trim() === '' ? {} : { serialNo: filter.serialNo.trim() }),
  ...(filter.lotNo.trim() === '' ? {} : { lotNo: filter.lotNo.trim() }),
  ...(filter.status === '' ? {} : { statusCode: filter.status }),
  ...(filter.from === '' ? {} : { createdFrom: dayStart(filter.from) }),
  ...(filter.to === '' ? {} : { createdTo: dayStart(filter.to, 1) }),
  page: filter.page,
});

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
  const ids = {
    serial: useId(),
    lot: useId(),
    status: useId(),
    from: useId(),
    to: useId(),
    reason: useId(),
  };
  const [draft, setDraft] = useState<Filter>(EMPTY_FILTER);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [openId, setOpenId] = useState<number | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const lastDecision = useRef<Decision | null>(null);
  const changeTypeLabel = useFourMChangeTypeLabel();
  const [printLang, setPrintLang] = useState<PrintLang>('ko');
  const [printing, setPrinting] = useState(false);

  const list = useSheetList(toQuery(filter));
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
          ? t.actions.reopened
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

  /* 출력할 장을 그린 뒤 인쇄 창을 연다 — 창이 닫히면(print 가 돌아오면) 걷는다. */
  // 인쇄 창의 「PDF로 저장」 기본 파일 이름이 문서 제목이다 — 시리얼·언어가 드러나게 잠깐 바꾼다.
  const printTitle =
    sheet.data === undefined ? null : t.print.fileName(sheet.data.serialNo, printLang);
  useEffect(() => {
    if (!printing) return;
    const previous = document.title;
    if (printTitle !== null) document.title = printTitle;
    window.print();
    document.title = previous;
    setPrinting(false);
  }, [printing, printTitle]);

  const rows = list.data?.items ?? [];
  const data = sheet.data ?? null;
  const completed = data?.statusCode === 'COMPLETED';

  const columns: Column<InspectionSheetSummary>[] = [
    /* 두 값을 한 칸에 위아래로 — 1024 폭 창(표 약 690px)에서 시리얼·LOT 이 잘리지 않게 열을 줄였다. */
    {
      key: 'serial',
      header: t.columns.serialModel,
      width: '170px',
      render: (row) => (
        <>
          <Ellipsis text={row.serialNo} />
          <Ellipsis text={`${row.itemCode} · ${row.itemName}`} muted />
        </>
      ),
    },
    {
      key: 'lot',
      header: t.columns.lotWorkOrder,
      render: (row) => (
        <>
          <Ellipsis text={row.lotNo} />
          <Ellipsis text={row.workOrderNo ?? ''} muted />
        </>
      ),
    },
    {
      key: 'progress',
      header: t.columns.progress,
      width: '56px',
      align: 'end',
      render: (row) => `${row.recordedStepCount}/${row.stepCount}`,
    },
    {
      key: 'ng',
      header: t.columns.ng,
      width: '40px',
      align: 'end',
      render: (row) => row.ngStepCount,
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '68px',
      /* 승인·확인자는 칸을 따로 두지 않고 title 로 — 1024 폭 창에서 열 하나를 아낀다(상세에는 그대로 보인다). */
      render: (row) => (
        <Ellipsis
          text={t.statuses[row.statusCode] ?? row.statusCode}
          title={`${t.columns.approval}: ${[row.approvedByName, row.checkedByName].map((name) => name ?? '—').join(' · ')}`}
        />
      ),
    },
    {
      key: 'createdAt',
      header: t.columns.createdAt,
      width: '100px',
      /* 월-일 시:분 — 연도는 title 에. */
      render: (row) => {
        const full = formatPlantDateTime(row.createdAt) ?? '';
        return <Ellipsis text={full.slice(5)} title={full} />;
      },
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: '60px',
      render: (row) => (
        <Button
          size="sm"
          variant="text"
          aria-label={t.list.openRow(row.serialNo)}
          onClick={() => setOpenId(row.inspectionSheetId)}
        >
          {t.list.open}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <p className="field-note">{t.rule}</p>

      <section className="pane" aria-label={t.list.heading}>
        <h2 className="pane-title">{t.list.heading}</h2>
        {list.isError && (
          <AlertBanner variant="error">
            {t.list.loadFailed}{' '}
            <Button size="sm" variant="text" onClick={() => void list.refetch()}>
              {t.list.retry}
            </Button>
          </AlertBanner>
        )}
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ ...draft, page: 1 });
          }}
        >
          <div className="field-cell">
            <label className="field-label" htmlFor={ids.serial}>
              {t.list.serialNo}
            </label>
            <TextField
              id={ids.serial}
              value={draft.serialNo}
              onChange={(e) => setDraft({ ...draft, serialNo: e.target.value })}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={ids.lot}>
              {t.list.lotNo}
            </label>
            <TextField
              id={ids.lot}
              value={draft.lotNo}
              onChange={(e) => setDraft({ ...draft, lotNo: e.target.value })}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={ids.status}>
              {t.list.status}
            </label>
            <Select
              id={ids.status}
              options={[
                { value: '', label: t.list.statusAll },
                { value: 'IN_PROGRESS', label: t.statuses.IN_PROGRESS ?? '' },
                { value: 'COMPLETED', label: t.statuses.COMPLETED ?? '' },
              ]}
              value={draft.status}
              onChange={(value) => setDraft({ ...draft, status: value as Filter['status'] })}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={ids.from}>
              {t.list.from}
            </label>
            <TextField
              id={ids.from}
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={ids.to}>
              {t.list.to}
            </label>
            <TextField
              id={ids.to}
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
          <div className="field-cell field-cell-unlabeled">
            <Button type="submit" variant="outlined">
              {t.list.search}
            </Button>
          </div>
        </form>
        <div className="wide-table inspection-sheet-list">
          <Table
            caption={t.list.caption}
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.inspectionSheetId)}
            empty={
              <EmptyState size="sm" live title={list.isPending ? t.list.loading : t.list.empty} />
            }
          />
        </div>
        {list.data !== undefined && (
          <PageNav
            view={toPageView(list.data.page, rows.length)}
            onChange={(page) => setFilter((prev) => ({ ...prev, page }))}
          />
        )}
      </section>

      {openId !== null && (
        <section
          className="pane"
          aria-label={data === null ? t.detail.loading : t.detail.heading(data.serialNo)}
        >
          {sheet.isError && <AlertBanner variant="error">{t.detail.loadFailed}</AlertBanner>}
          {sheet.isPending && <p className="field-note">{t.detail.loading}</p>}
          {data !== null && (
            <>
              <h2 className="pane-title">
                {`${t.detail.heading(data.serialNo)} · ${t.statuses[data.statusCode] ?? data.statusCode}`}
              </h2>
              {!canSign && <p className="field-note">{t.actions.noPermission}</p>}
              <SaveErrorBanner
                error={decision.error}
                onReload={() => {
                  decision.reset();
                  void sheet.refetch();
                }}
              />
              <SheetDetail
                sheet={data}
                changeTypeLabel={changeTypeLabel}
                canSign={canSign && !completed}
                busy={decision.isSaving}
                onSign={(step) => decide({ kind: 'sign', stepCode: step.stepCode })}
              />
              <div className="form-actions">
                <Button variant="outlined" onClick={() => setOpenId(null)}>
                  {t.detail.close}
                </Button>
                <div className="inspection-sheet-print-lang" role="group" aria-label={t.print.lang}>
                  <span className="field-label">{t.print.lang}</span>
                  {(['ko', 'vi'] as const).map((code) => (
                    <Button
                      key={code}
                      variant={printLang === code ? 'tonal' : 'outlined'}
                      aria-pressed={printLang === code}
                      onClick={() => setPrintLang(code)}
                    >
                      {t.print.languages[code] ?? code}
                    </Button>
                  ))}
                </div>
                <Button variant="outlined" onClick={() => setPrinting(true)}>
                  {t.print.button}
                </Button>
                {canSign && !completed && data.approvedBy === null && (
                  <Button disabled={decision.isSaving} onClick={() => decide({ kind: 'approve' })}>
                    {t.actions.approve}
                  </Button>
                )}
                {canSign && !completed && data.checkedBy === null && (
                  <Button
                    variant="tonal"
                    disabled={decision.isSaving}
                    onClick={() => decide({ kind: 'check' })}
                  >
                    {t.actions.check}
                  </Button>
                )}
                {canSign && (data.approvedBy !== null || data.checkedBy !== null) && (
                  <Button
                    variant="outlined"
                    disabled={decision.isSaving}
                    onClick={() => {
                      setReason('');
                      setReasonError('');
                      decision.reset();
                      setReopening(true);
                    }}
                  >
                    {t.actions.reopen}
                  </Button>
                )}
              </div>
              <p className="field-note">{t.print.pdfHint}</p>
            </>
          )}
        </section>
      )}

      {printing &&
        data !== null &&
        createPortal(
          <div className="sheet-print-root">
            <SheetPrint sheet={data} lang={printLang} changeTypeLabel={changeTypeLabel} />
          </div>,
          document.body,
        )}

      {reopening && data !== null && (
        <Dialog
          open
          onClose={() => setReopening(false)}
          title={t.reopenDialog.title}
          footer={
            <>
              <Button variant="outlined" onClick={() => setReopening(false)}>
                {messages.common.cancel}
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
                {t.reopenDialog.ok}
              </Button>
            </>
          }
        >
          <p>{t.reopenDialog.body}</p>
          <TextField
            id={ids.reason}
            label={t.reopenDialog.reason}
            value={reason}
            maxLength={500}
            aria-required
            error={reasonError || decision.fieldErrors.reason || undefined}
            onChange={(event) => setReason(event.target.value)}
          />
        </Dialog>
      )}
    </>
  );
};
