import { Button, Chip, type ChipStatus, type Column, Dialog, Icon, Tabs } from '@crefle/web-ui';
import type { InspectionSheet, InspectionSheetNg, InspectionSheetStep } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';

import { ManagedTable } from '../../patterns/managed-table';
import { masterName } from '../../patterns/master-name';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.inspectionSheet;
const d = t.detail;

const when = (iso: string | null): string =>
  iso === null ? d.none : (formatPlantDateTime(iso) ?? d.none);
const judgmentOf = (step: InspectionSheetStep): string => {
  if (step.result === null) return d.notRecorded;
  const { firstJudgmentCode: first, finalJudgmentCode: last } = step.result;
  return first === last ? first : `${first} → ${last}`;
};

/** 판정 라벨 색 — OK 초록 · NG 빨강 · 없으면 회색. */
const judgmentStatus = (code: string | null | undefined): ChipStatus =>
  code === 'OK' ? 'success' : code === 'NG' ? 'error' : 'idle';

const HEADER_KEYS = [
  'modelText',
  'specText',
  'destinationText',
  'pcbLotNo',
  'sdLotNo',
  'stapleLotNo',
  'fwProductionVersion',
  'fwQualityVersion',
  'materialText',
  'structureText',
  'productNameText',
  'powerText',
  'motorText',
  'tempPackNote',
  'overallResultCode',
] as const;
const PP_ONLY = new Set(['productNameText', 'powerText', 'motorText']);

export interface SheetDetailProps {
  sheet: InspectionSheet;
  /** 서명 권한(W-03-14)이 있고 작성중이면 단계 서명 단추가 보인다. */
  canSign: boolean;
  /** 서명 권한(W-03-14) 자체가 있나 — 없으면 공정별 검사 · 진행 현황 제목 옆에 안내를 단다(사용자 지시 2026-11-02). */
  hasSignPermission: boolean;
  busy: boolean;
  /** 4M 변경 종류 코드 → 이름(#63 공통코드). */
  changeTypeLabel: (code: string) => string;
  onSign: (step: InspectionSheetStep) => void;
  /** 고른 탭을 알린다 — 꼬리 단추(엑셀 · 승인 · 확인)는 기본 정보 탭에서만(사용자 지시 2026-11-02). */
  onTabChange?: (tab: DetailTab) => void;
}

export type DetailTab = 'basic' | 'items' | 'ngs' | 'events';

/** 서명 권한(W-03-14)을 역할에 주는 화면 — 시스템 관리 › 사용자·역할·권한. */
const PERMISSION_SETTINGS_PATH = '/system/users-roles';

/** 테두리 카드 한 칸 — 제목 아래 가는 줄(사용자 시안 2026-11-02 · 표식은 뺐다 · #217). */
const Card = ({
  title,
  showTitle = true,
  note,
  action,
  className,
  children,
}: {
  title: string;
  /** 탭 이름이 이미 말하면 제목 줄을 두지 않는다(이름은 화면 읽기용으로만 남는다). */
  showTitle?: boolean;
  /** 제목 오른쪽 안내 한 줄(정보 안내 줄 모양). */
  note?: string;
  /** 안내 옆 단추(권한 설정 등). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section
    className={['result-detail-card inspection-sheet-card', className].filter(Boolean).join(' ')}
    aria-label={title}
  >
    {showTitle && (
      <div className="result-detail-section-head inspection-sheet-card-head">
        <h3>{title}</h3>
        {note !== undefined && (
          <p className="iqc-inspection-action-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {note}
          </p>
        )}
        {action}
      </div>
    )}
    {children}
  </section>
);

/** 이름 위 · 값 아래 칸 상자 — 검사 조회·판정 기본 정보 상자와 같은 모양(사용자 지시 2026-11-02 · #217). */
const FactsBox = ({
  facts,
  even = false,
}: {
  facts: readonly (readonly [string, string])[];
  /** 칸 폭을 고르게(열 맞춤) — 짧은 값이 많은 제품 정보. 없으면 값 길이만큼. */
  even?: boolean;
}) => (
  <dl className={even ? 'inspection-sheet-grid is-even' : 'inspection-sheet-grid'}>
    {facts.map(([label, value]) => (
      <div key={label}>
        <dt className="field-label">{label}</dt>
        {/* 칸이 상자보다 길면 말줄임 — 전체 값은 title 로. */}
        <dd title={value}>{value}</dd>
      </div>
    ))}
  </dl>
);

/** 이름 왼쪽 · 값 오른쪽 줄 목록(기본 정보 · 진행 현황 카드). */
const LabelRows = ({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) => (
  <dl className="inspection-sheet-rows">
    {rows.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * 제품 검사표 한 장 — 탭 넷: 기본 정보(요약 · 머리 값 · 단계별 검사 · 변경품) / 검사 항목 / NG·수리·재검 기록 / 서명·승인 이력
 * (사용자 시안 2026-11-02 · #217). 단계 줄의 「항목」은 검사 항목 탭으로 옮긴다. 읽기 전용이다(입력은 POP).
 */
export const SheetDetail = ({
  sheet,
  canSign,
  hasSignPermission,
  busy,
  changeTypeLabel,
  onSign,
  onTabChange,
}: SheetDetailProps) => {
  const [tab, setTab] = useState<DetailTab>('basic');
  const navigate = useNavigate();
  /* 「상세 보기」로 연 공정 — 코드로 들고 있어 검사표가 새로 와도 최신 값을 그린다. */
  const [detailStep, setDetailStep] = useState<string | null>(null);
  /* 서명 확인 창을 연 공정. */
  const [signStep, setSignStep] = useState<string | null>(null);
  const signingStep = sheet.steps.find((step) => step.stepCode === signStep) ?? null;
  const openedStep = sheet.steps.find((step) => step.stepCode === detailStep) ?? null;
  const itemCount = sheet.steps.reduce((sum, step) => sum + step.items.length, 0);
  /* 권한이 없으면 서명 · 승인 · 확인 단추를 두지 않고 그 까닭을 제목 옆에 적는다(사용자 지시 2026-11-02 · #217). */
  const permissionNote = hasSignPermission ? undefined : t.actions.noPermission;
  /* 권한이 없으면 안내 옆에 [권한 설정] — 사용자·역할·권한 화면으로 간다(사용자 지시 2026-11-02 · #217). */
  const permissionAction = hasSignPermission ? undefined : (
    <Button size="sm" variant="outlined" onClick={() => void navigate(PERMISSION_SETTINGS_PATH)}>
      {t.actions.permissionSettings}
    </Button>
  );
  /* 탭 셋 모두 내역이 없어도 표 머리를 두고 빈 줄에 안내를 쓴다(투입 자재 변경 내역과 같다 · 사용자 지시 2026-11-02). */
  const emptyRow = (text: string) => <p className="field-note">{text}</p>;

  const stepColumns: Column<InspectionSheetStep>[] = [
    {
      key: 'step',
      header: d.stepColumns.step,
      align: 'center',
      render: (step) => masterName(step, step.nameKo),
    },
    /* 서명 필요 여부는 칸으로 따로(공정 이름 옆 표식 대신 · 사용자 지시 2026-11-02). */
    {
      key: 'signRequired',
      header: d.stepColumns.signRequired,
      align: 'center',
      width: '120px',
      /* 라벨(표식) 모양 — 필요는 주황, 불필요는 회색(사용자 지시 2026-11-02). */
      render: (step) => (
        <Chip variant="status" size="sm" status={step.signRequired ? 'warning' : 'idle'}>
          {step.signRequired ? d.signRequiredYes : d.signRequiredNo}
        </Chip>
      ),
    },
    {
      key: 'judgment',
      header: d.stepColumns.judgment,
      align: 'center',
      width: '110px',
      /* 라벨 모양 — 최종 판정 OK 초록 · NG 빨강 · 검사 대기 회색(사용자 지시 2026-11-02). */
      render: (step) => (
        <Chip variant="status" size="sm" status={judgmentStatus(step.result?.finalJudgmentCode)}>
          {`${judgmentOf(step)}${step.result?.sourceCode === 'OQC' ? ` ${d.oqc}` : ''}`}
        </Chip>
      ),
    },
    {
      key: 'inspector',
      header: d.stepColumns.inspector,
      align: 'center',
      render: (step) => step.result?.inspectedWorkerName ?? d.none,
    },
    {
      key: 'inspectedAt',
      header: d.stepColumns.inspectedAt,
      align: 'center',
      width: '150px',
      render: (step) => when(step.result?.inspectedAt ?? null),
    },
    {
      key: 'sign',
      header: d.stepColumns.sign,
      align: 'center',
      render: (step) =>
        step.result?.signedAt
          ? `${step.result.signedByName ?? ''}, ${when(step.result.signedAt)}`
          : d.none,
    },
    {
      key: 'actions',
      header: d.stepColumns.actions,
      align: 'center',
      width: '200px',
      render: (step) => {
        const name = masterName(step, step.nameKo);
        return (
          /* 「상세」(테두리) · 「서명하기」(빨간 채움) — 두 단추 사이를 띄운다(사용자 시안 2026-11-02 · #217). */
          <div className="inspection-sheet-row-actions">
            {/* 그 공정만 팝업으로 — 판정 · 검사자 · 서명과 항목 판정(사용자 지시 2026-11-02 · #217). */}
            <Button
              size="sm"
              variant="outlined"
              aria-label={d.stepDetail.open(name)}
              onClick={() => setDetailStep(step.stepCode)}
            >
              {d.stepDetail.button}
            </Button>
            {/*
             * 서명은 「서명 필요」 공정 중 판정이 있고 아직 서명 안 된 곳에만 — 누르면 한 번 더 묻는다(사용자 지시 2026-11-02).
             */}
            {canSign && step.signRequired && step.result !== null && !step.result.signedAt && (
              <Button
                size="sm"
                disabled={busy}
                aria-label={t.actions.signRow(name)}
                onClick={() => setSignStep(step.stepCode)}
              >
                {t.actions.sign}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  type FourMChange = InspectionSheet['fourMChanges'][number];
  const fourMColumns: Column<FourMChange>[] = [
    {
      key: 'changeType',
      header: d.fourMColumns.changeType,
      align: 'center',
      width: '120px',
      render: (change) =>
        change.changeTypeCode === undefined ? d.none : changeTypeLabel(change.changeTypeCode),
    },
    {
      key: 'item',
      header: d.fourMColumns.item,
      align: 'center',
      render: (change) => `${change.itemName} (${change.itemCode})`,
    },
    {
      key: 'lot',
      header: d.fourMColumns.lot,
      align: 'center',
      render: (change) => change.lotNo,
    },
    {
      key: 'remarks',
      header: d.fourMColumns.remarks,
      align: 'center',
      render: (change) => change.remarks ?? d.none,
    },
  ];

  const ngColumns: Column<InspectionSheetNg>[] = [
    {
      key: 'no',
      header: d.ngColumns.no,
      align: 'center',
      width: '56px',
      render: (ng) => ng.sequenceNo,
    },
    {
      key: 'found',
      header: d.ngColumns.found,
      align: 'center',
      render: (ng) =>
        [
          ng.foundDepartmentCode &&
            messages.popInspectionSheet.ng.departments[ng.foundDepartmentCode],
          ng.foundStepCode && sheet.steps.find((s) => s.stepCode === ng.foundStepCode)?.nameKo,
          ng.checkItemCode,
        ]
          .filter(Boolean)
          .join(', ') || d.none,
    },
    {
      key: 'content',
      header: d.ngColumns.content,
      align: 'center',
      render: (ng) => (
        <>
          {ng.ngContent}
          {ng.ngTypeCode &&
            ` (${messages.popInspectionSheet.ng.types[ng.ngTypeCode] ?? ng.ngTypeCode})`}
          {ng.investigationText && <div className="field-note">{ng.investigationText}</div>}
        </>
      ),
    },
    {
      key: 'repair',
      header: d.ngColumns.repair,
      align: 'center',
      render: (ng) =>
        [
          ng.repairDepartmentCode &&
            messages.popInspectionSheet.ng.departments[ng.repairDepartmentCode],
          ng.repairWorkerName,
          ng.repairedAt && when(ng.repairedAt),
        ]
          .filter(Boolean)
          .join(', ') || d.none,
    },
    {
      key: 'recheck',
      header: d.ngColumns.recheck,
      align: 'center',
      render: (ng) =>
        [ng.recheckResultCode, ng.recheckWorkerName, ng.recheckedAt && when(ng.recheckedAt)]
          .filter(Boolean)
          .join(', ') || d.none,
    },
  ];

  const recorded = sheet.steps.filter((step) => step.result !== null).length;
  const inspected = recorded === sheet.steps.length;
  const ngSteps = sheet.steps.filter((step) => step.result?.firstJudgmentCode === 'NG').length;
  const o = d.overview;

  const basic = (
    <>
      {/* 기본 정보 | 진행 현황 두 카드 나란히(좁으면 위아래) — 사용자 시안 2026-11-02 · #217. */}
      <div className="inspection-sheet-overview">
        <Card title={o.basic} className="inspection-sheet-basic">
          {/* 제품 정보와 같은 상자 — 이름 위 · 값 아래, 칸 사이 세로선(사용자 지시 2026-11-02 · #217). */}
          <FactsBox
            facts={[
              [d.serialNo, sheet.serialNo],
              [d.model, `${sheet.itemName} (${sheet.itemCode})`],
              [d.lot, sheet.lotNo],
              [d.workOrder, sheet.workOrderNo ?? d.none],
              [
                d.layout,
                messages.inspectionSheetTemplate.layouts[sheet.formLayoutCode] ??
                  sheet.formLayoutCode,
              ],
              [d.writer, sheet.writtenWorkerName ?? d.none],
              [d.createdAt, when(sheet.createdAt)],
              [
                d.approved,
                sheet.approvedByName
                  ? `${sheet.approvedByName}, ${when(sheet.approvedAt)}`
                  : d.none,
              ],
              [
                d.checked,
                sheet.checkedByName ? `${sheet.checkedByName}, ${when(sheet.checkedAt)}` : d.none,
              ],
            ]}
          />
        </Card>
        <Card
          title={o.progress}
          note={permissionNote}
          action={permissionAction}
          className="inspection-sheet-progress-card"
        >
          <LabelRows
            rows={[
              [
                o.inspection,
                <strong key="value">{`${String(recorded)} / ${String(sheet.steps.length)}`}</strong>,
              ],
            ]}
          />
          <div
            className="inspection-sheet-progress-bar"
            role="progressbar"
            aria-label={o.inspection}
            aria-valuemin={0}
            aria-valuemax={sheet.steps.length}
            aria-valuenow={recorded}
          >
            <span
              style={{
                width: `${String(sheet.steps.length === 0 ? 0 : (recorded / sheet.steps.length) * 100)}%`,
              }}
            />
          </div>
          <LabelRows rows={[[o.ngSteps, String(ngSteps)]]} />
          {/* 공정 검사가 남았으면 승인 조건, 다 됐으면 확정 조건을 알린다 — 완료면 두지 않는다. */}
          {sheet.statusCode !== 'COMPLETED' && (
            <p className="iqc-inspection-action-note" data-tone="info">
              <Icon name="info" size={14} aria-hidden />
              {inspected ? d.finalizeNote : o.waitInspection}
            </p>
          )}
        </Card>
      </div>

      <Card title={d.header}>
        <FactsBox
          even
          facts={[
            ...HEADER_KEYS.filter((key) => sheet.formLayoutCode === 'PP' || !PP_ONLY.has(key)).map(
              (key): readonly [string, string] => [
                d.headerFields[key] ?? key,
                sheet[key] ?? d.none,
              ],
            ),
            ['RoHS', d.rohs(sheet.rohsFlag)],
          ]}
        />
      </Card>

      <Card title={d.steps} note={permissionNote} action={permissionAction}>
        <ManagedTable
          storageKey="omf-mes:inspection-sheet:columns:steps"
          caption={d.stepsCaption}
          columns={stepColumns}
          rows={sheet.steps}
          getRowId={(step) => step.stepCode}
          empty={emptyRow(d.none)}
        />
      </Card>

      <Card title={d.fourM}>
        {/* 표 — 없으면 「투입된 변경 자재가 없습니다.」를 표 줄에(사용자 지시 2026-11-02 · #217). */}
        {sheet.fourMChanges.length > 0 && <p className="field-note">{d.fourMNote}</p>}
        <ManagedTable
          storageKey="omf-mes:inspection-sheet:columns:four-m"
          caption={d.fourM}
          columns={fourMColumns}
          rows={sheet.fourMChanges}
          getRowId={(change) => change.lotNo}
          empty={<p className="field-note">{d.fourMNone}</p>}
        />
      </Card>
    </>
  );

  /* 항목 순서(기준의 순번)를 맨 앞 칸에 — 순서대로 늘어놓는다(사용자 지시 2026-11-02). */
  const byOrder = (items: InspectionSheetStep['items']) =>
    [...items].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const itemColumns: Column<InspectionSheetStep['items'][number]>[] = [
    {
      key: 'sequenceNo',
      header: d.itemColumns.sequenceNo,
      align: 'center',
      width: '64px',
      render: (item) => item.sequenceNo,
    },
    {
      key: 'code',
      header: d.itemColumns.code,
      align: 'center',
      width: '100px',
      render: (item) => item.checkItemCode,
    },
    {
      key: 'name',
      header: d.itemColumns.name,
      align: 'center',
      render: (item) => masterName(item, item.nameKo),
    },
    {
      key: 'method',
      header: d.itemColumns.method,
      align: 'center',
      width: '90px',
      render: (item) => d.methods[item.methodCode] ?? item.methodCode,
    },
    {
      key: 'judgment',
      header: d.itemColumns.judgment,
      align: 'center',
      width: '80px',
      render: (item) =>
        item.judgmentCode === null || item.judgmentCode === undefined ? (
          d.none
        ) : (
          <Chip variant="status" size="sm" status={judgmentStatus(item.judgmentCode)}>
            {item.judgmentCode}
          </Chip>
        ),
    },
  ];

  type SheetEvent = InspectionSheet['events'][number];
  const eventColumns: Column<SheetEvent>[] = [
    {
      key: 'actedAt',
      header: d.eventColumns.actedAt,
      align: 'center',
      width: '160px',
      render: (event) => when(event.actedAt),
    },
    {
      key: 'event',
      header: d.eventColumns.event,
      align: 'center',
      render: (event) => d.eventLabels[event.eventCode] ?? event.eventCode,
    },
    {
      key: 'step',
      header: d.eventColumns.step,
      align: 'center',
      render: (event) =>
        event.stepCode
          ? (sheet.steps.find((s) => s.stepCode === event.stepCode)?.nameKo ?? event.stepCode)
          : d.none,
    },
    {
      key: 'actor',
      header: d.eventColumns.actor,
      align: 'center',
      render: (event) => event.actedByName ?? d.none,
    },
    {
      key: 'reason',
      header: d.eventColumns.reason,
      align: 'center',
      render: (event) => event.reason ?? d.none,
    },
  ];

  const items =
    sheet.steps.length === 0 ? (
      <Card title={d.tabs.items(0)}>
        <ManagedTable
          storageKey="omf-mes:inspection-sheet:columns:items"
          caption={d.tabs.items(0)}
          columns={itemColumns}
          rows={[]}
          getRowId={(item) => String(item.inspectionSheetTemplateItemId)}
          empty={emptyRow(d.itemsEmpty)}
        />
      </Card>
    ) : (
      sheet.steps.map((step) => (
        <Card key={step.stepCode} title={masterName(step, step.nameKo)}>
          <ManagedTable
            storageKey="omf-mes:inspection-sheet:columns:items"
            caption={d.items(masterName(step, step.nameKo))}
            columns={itemColumns}
            rows={byOrder(step.items)}
            getRowId={(item) => String(item.inspectionSheetTemplateItemId)}
            empty={emptyRow(d.itemsEmpty)}
          />
        </Card>
      ))
    );

  const ngs = (
    /* 탭 이름(「불량·조치 이력」)이 말하므로 카드 제목은 두지 않는다(사용자 지시 2026-11-02). */
    <Card title={d.ngs} showTitle={false}>
      <ManagedTable
        storageKey="omf-mes:inspection-sheet:columns:ngs"
        caption={d.ngs}
        columns={ngColumns}
        rows={sheet.ngs}
        getRowId={(ng) => String(ng.sequenceNo)}
        empty={emptyRow(d.ngsEmpty)}
      />
    </Card>
  );

  const events = (
    <Card title={d.events} showTitle={false}>
      <ManagedTable
        storageKey="omf-mes:inspection-sheet:columns:events"
        caption={d.events}
        columns={eventColumns}
        rows={sheet.events}
        getRowId={(event) => `${event.actedAt}-${event.eventCode}-${event.stepCode ?? ''}`}
        empty={emptyRow(d.eventsEmpty)}
      />
    </Card>
  );

  return (
    <>
      <Tabs
        aria-label={d.tabsLabel}
        value={tab}
        onChange={(value) => {
          setTab(value as DetailTab);
          onTabChange?.(value as DetailTab);
        }}
        items={[
          { value: 'basic', label: d.tabs.basic, content: basic },
          { value: 'items', label: d.tabs.items(itemCount), content: items },
          { value: 'ngs', label: d.tabs.ngs(sheet.ngs.length), content: ngs },
          { value: 'events', label: d.tabs.events(sheet.events.length), content: events },
        ]}
      />
      {signingStep !== null && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          title={t.signDialog.title}
          onClose={() => setSignStep(null)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setSignStep(null)}>
                {d.close}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  onSign(signingStep);
                  setSignStep(null);
                }}
              >
                {t.signDialog.ok}
              </Button>
            </>
          }
        >
          <p>{t.signDialog.body(masterName(signingStep, signingStep.nameKo))}</p>
        </Dialog>
      )}
      {openedStep !== null && (
        <Dialog
          open
          size="lg"
          /* 오른쪽 위 닫기(X)는 두지 않는다 — 꼬리 [닫기] 하나(사용자 지시 2026-11-02 · 검사 결과 상세와 같다). */
          showCloseButton={false}
          onClose={() => setDetailStep(null)}
          title={d.stepDetail.title(masterName(openedStep, openedStep.nameKo))}
          footer={
            <Button variant="outlined" onClick={() => setDetailStep(null)}>
              {d.close}
            </Button>
          }
        >
          <FactsBox
            facts={[
              [
                d.stepColumns.signRequired,
                openedStep.signRequired ? d.signRequiredYes : d.signRequiredNo,
              ],
              [d.stepColumns.judgment, judgmentOf(openedStep)],
              [d.stepColumns.inspector, openedStep.result?.inspectedWorkerName ?? d.none],
              [d.stepColumns.inspectedAt, when(openedStep.result?.inspectedAt ?? null)],
              [
                d.stepColumns.sign,
                openedStep.result?.signedAt
                  ? `${openedStep.result.signedByName ?? ''}, ${when(openedStep.result.signedAt)}`
                  : d.none,
              ],
            ]}
          />
          <section className="inspection-sheet-card inspection-sheet-step-items">
            <ManagedTable
              storageKey="omf-mes:inspection-sheet:columns:items"
              caption={d.items(masterName(openedStep, openedStep.nameKo))}
              columns={itemColumns}
              rows={byOrder(openedStep.items)}
              getRowId={(item) => String(item.inspectionSheetTemplateItemId)}
              empty={emptyRow(d.itemsEmpty)}
            />
          </section>
        </Dialog>
      )}
    </>
  );
};
