import { Button, Chip, type Column, Table } from '@crefle/web-ui';
import type { InspectionSheet, InspectionSheetNg, InspectionSheetStep } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Fragment, useState } from 'react';

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
  busy: boolean;
  /** 4M 변경 종류 코드 → 이름(#63 공통코드). */
  changeTypeLabel: (code: string) => string;
  onSign: (step: InspectionSheetStep) => void;
}

/** 제품 검사표 한 장 — 요약 · 머리 값 · 단계 판정과 서명 · 항목 판정 · NG · 이력. 읽기 전용이다(입력은 POP). */
export const SheetDetail = ({
  sheet,
  canSign,
  busy,
  changeTypeLabel,
  onSign,
}: SheetDetailProps) => {
  const [openSteps, setOpenSteps] = useState<ReadonlySet<string>>(new Set());
  const toggle = (code: string) =>
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  const stepColumns: Column<InspectionSheetStep>[] = [
    {
      key: 'step',
      header: d.stepColumns.step,
      render: (step) => (
        <>
          {masterName(step, step.nameKo)}
          {step.signRequired && (
            <>
              {' '}
              <Chip size="sm">{d.signRequired}</Chip>
            </>
          )}
        </>
      ),
    },
    {
      key: 'judgment',
      header: d.stepColumns.judgment,
      width: '110px',
      render: (step) =>
        `${judgmentOf(step)}${step.result?.sourceCode === 'OQC' ? ` ${d.oqc}` : ''}`,
    },
    {
      key: 'inspector',
      header: d.stepColumns.inspector,
      render: (step) => step.result?.inspectedWorkerName ?? d.none,
    },
    {
      key: 'inspectedAt',
      header: d.stepColumns.inspectedAt,
      width: '150px',
      render: (step) => when(step.result?.inspectedAt ?? null),
    },
    {
      key: 'sign',
      header: d.stepColumns.sign,
      render: (step) =>
        step.result?.signedAt
          ? `${step.result.signedByName ?? ''}, ${when(step.result.signedAt)}`
          : d.none,
    },
    {
      key: 'actions',
      header: d.stepColumns.actions,
      width: '200px',
      render: (step) => {
        const ng = step.items.filter((item) => item.judgmentCode === 'NG').length;
        const name = masterName(step, step.nameKo);
        return (
          <>
            {step.items.length > 0 && (
              <Button
                size="sm"
                variant="text"
                aria-label={d.itemsToggle(name, ng)}
                aria-expanded={openSteps.has(step.stepCode)}
                onClick={() => toggle(step.stepCode)}
              >
                {d.itemsShort(ng)}
              </Button>
            )}
            {canSign && step.result !== null && (
              <Button
                size="sm"
                variant="tonal"
                disabled={busy}
                aria-label={t.actions.signRow(name)}
                onClick={() => onSign(step)}
              >
                {t.actions.sign}
              </Button>
            )}
          </>
        );
      },
    },
  ];

  const ngColumns: Column<InspectionSheetNg>[] = [
    { key: 'no', header: d.ngColumns.no, width: '56px', render: (ng) => ng.sequenceNo },
    {
      key: 'found',
      header: d.ngColumns.found,
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
      render: (ng) =>
        [ng.recheckResultCode, ng.recheckWorkerName, ng.recheckedAt && when(ng.recheckedAt)]
          .filter(Boolean)
          .join(', ') || d.none,
    },
  ];

  return (
    <>
      <h3 className="pane-subtitle">{d.summary}</h3>
      <dl className="inspection-sheet-summary">
        <dt>{d.model}</dt>
        <dd>{`${sheet.itemName} (${sheet.itemCode})`}</dd>
        <dt>{d.lot}</dt>
        <dd>{sheet.lotNo}</dd>
        <dt>{d.workOrder}</dt>
        <dd>{sheet.workOrderNo ?? d.none}</dd>
        <dt>{d.layout}</dt>
        <dd>
          {messages.inspectionSheetTemplate.layouts[sheet.formLayoutCode] ?? sheet.formLayoutCode}
        </dd>
        <dt>{d.writer}</dt>
        <dd>{sheet.writtenWorkerName ?? d.none}</dd>
        <dt>{d.createdAt}</dt>
        <dd>{when(sheet.createdAt)}</dd>
        <dt>{d.approved}</dt>
        <dd>
          {sheet.approvedByName ? `${sheet.approvedByName}, ${when(sheet.approvedAt)}` : d.none}
        </dd>
        <dt>{d.checked}</dt>
        <dd>{sheet.checkedByName ? `${sheet.checkedByName}, ${when(sheet.checkedAt)}` : d.none}</dd>
      </dl>

      <h3 className="pane-subtitle">{d.header}</h3>
      <dl className="inspection-sheet-summary">
        {HEADER_KEYS.filter((key) => sheet.formLayoutCode === 'PP' || !PP_ONLY.has(key)).map(
          (key) => (
            <Fragment key={key}>
              <dt>{d.headerFields[key]}</dt>
              <dd>{sheet[key] ?? d.none}</dd>
            </Fragment>
          ),
        )}
        <dt>RoHS</dt>
        <dd>{d.rohs(sheet.rohsFlag)}</dd>
      </dl>

      <h3 className="pane-subtitle">{d.fourM}</h3>
      <p className="field-note">{d.fourMNote}</p>
      {sheet.fourMChanges.length === 0 ? (
        <p>{d.fourMNone}</p>
      ) : (
        <ul className="inspection-sheet-events">
          {sheet.fourMChanges.map((change) => (
            <li key={change.lotNo}>
              {[
                change.changeTypeCode === undefined ? '' : changeTypeLabel(change.changeTypeCode),
                `${change.itemName} (${change.itemCode})`,
                change.lotNo,
              ]
                .filter((part) => part !== '')
                .join(', ')}
              {change.remarks && `, ${change.remarks}`}
            </li>
          ))}
        </ul>
      )}

      <h3 className="pane-subtitle">{d.steps}</h3>
      <div className="wide-table">
        <Table
          caption={d.stepsCaption}
          density="compact"
          columns={stepColumns}
          rows={sheet.steps}
          getRowId={(step) => step.stepCode}
        />
      </div>
      {sheet.steps
        .filter((step) => openSteps.has(step.stepCode))
        .map((step) => (
          <div className="wide-table" key={step.stepCode}>
            <Table
              caption={d.items(masterName(step, step.nameKo))}
              density="compact"
              columns={[
                {
                  key: 'code',
                  header: d.itemColumns.code,
                  width: '100px',
                  render: (item) => item.checkItemCode,
                },
                {
                  key: 'name',
                  header: d.itemColumns.name,
                  render: (item) => masterName(item, item.nameKo),
                },
                {
                  key: 'method',
                  header: d.itemColumns.method,
                  width: '90px',
                  render: (item) => d.methods[item.methodCode] ?? item.methodCode,
                },
                {
                  key: 'judgment',
                  header: d.itemColumns.judgment,
                  width: '80px',
                  render: (item) => item.judgmentCode ?? d.none,
                },
              ]}
              rows={step.items}
              getRowId={(item) => String(item.inspectionSheetTemplateItemId)}
            />
          </div>
        ))}

      <h3 className="pane-subtitle">{d.ngs}</h3>
      {sheet.ngs.length === 0 ? (
        <p className="field-note">{d.ngsEmpty}</p>
      ) : (
        <div className="wide-table">
          <Table
            caption={d.ngs}
            density="compact"
            columns={ngColumns}
            rows={sheet.ngs}
            getRowId={(ng) => String(ng.sequenceNo)}
          />
        </div>
      )}

      <h3 className="pane-subtitle">{d.events}</h3>
      {sheet.events.length === 0 ? (
        <p className="field-note">{d.eventsEmpty}</p>
      ) : (
        <ul className="inspection-sheet-events">
          {sheet.events.map((event, index) => (
            <li key={`${event.actedAt}-${index}`}>
              {`${when(event.actedAt)}, ${d.eventLabels[event.eventCode] ?? event.eventCode}`}
              {event.stepCode &&
                `, ${sheet.steps.find((s) => s.stepCode === event.stepCode)?.nameKo ?? event.stepCode}`}
              {`, ${event.actedByName ?? d.none}`}
              {event.reason && `, ${event.reason}`}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
