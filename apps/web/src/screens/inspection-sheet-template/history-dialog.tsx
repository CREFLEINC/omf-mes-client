import {
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  Icon,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { VersionAuditEvent } from '../inspection-standard/version-history';
import { useUserNames } from './queries';

const t = messages.inspectionSheetTemplate;
/* 표 머리 · 구분 이름은 검사 기준 탭의 변경 이력과 같은 말을 쓴다(#214). */
const h = messages.inspectionStandard.history;

interface HistoryChange {
  label: string;
  before?: string;
  after?: string;
}

interface HistoryRow {
  id: number;
  occurredAt: string;
  performedBy: number | null;
  action: string;
  changes: HistoryChange[];
}

/** 머리 칸 이름 — 서버가 남긴 키(계약 필드 이름)를 편집 화면의 이름표로 푼다. */
const FIELD_LABELS: Record<string, string> = {
  materialText: t.editor.materialText,
  structureText: t.editor.structureText,
  rohsFlag: t.editor.rohsFlag,
  productNameText: t.editor.productNameText,
  powerText: t.editor.powerText,
  motorText: t.editor.motorText,
  remarks: t.editor.remarks,
};

/** 단계 · LOT 칸은 배열 통째로 남는다 — 값 대신 「변경」으로만 적는다. */
const LIST_LABELS: Record<string, string> = {
  steps: t.editor.stepSection,
  lotSources: t.editor.lotSection,
};

const raw = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? t.compare.yes : t.compare.no;
  return String(value);
};

/** 서버가 남긴 전/후 값으로 무슨 일이었는지 가른다 — 이벤트 유형은 생성 · 수정 · 삭제 셋뿐이다. */
const actionOf = (event: VersionAuditEvent): string => {
  const after = event.afterValue ?? {};
  if (event.eventTypeCode === 'DELETE') return h.discarded;
  if (event.eventTypeCode === 'CREATE') return h.created;
  if (after.statusCode === 'CONFIRMED') return h.confirmed;
  if (after.statusCode === 'OBSOLETE') return h.obsoleted;
  return h.updated;
};

export const toTemplateHistoryRow = (event: VersionAuditEvent): HistoryRow => {
  const before = event.beforeValue ?? {};
  const after = event.afterValue ?? {};
  const changes: HistoryChange[] =
    event.eventTypeCode === 'UPDATE' && !('statusCode' in after)
      ? Object.keys(after).map((key) =>
          key in LIST_LABELS
            ? { label: LIST_LABELS[key]! }
            : { label: FIELD_LABELS[key] ?? key, before: raw(before[key]), after: raw(after[key]) },
        )
      : [];
  return {
    id: event.auditEventId,
    occurredAt: event.occurredAt,
    performedBy: event.performedBy,
    action: actionOf(event),
    changes,
  };
};

export interface TemplateHistoryDialogProps {
  events: readonly VersionAuditEvent[] | undefined;
  onClose: () => void;
}

/**
 * 검사표 기준 버전의 변경 이력 창(omf-all-around#214) — 검사 기준 탭의 「변경 이력」 창과 같은 모양:
 * 제목 줄 오른쪽에 조회 기간, 일시 · 처리자 · 구분 · 변경 내용 표, 최신이 위.
 */
export const TemplateHistoryDialog = ({ events, onClose }: TemplateHistoryDialogProps) => {
  const nameOf = useUserNames((events ?? []).map((event) => event.performedBy));
  const rows = [...(events ?? [])]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map(toTemplateHistoryRow);

  const columns: Column<HistoryRow>[] = [
    {
      key: 'occurredAt',
      header: h.occurredAt,
      align: 'center',
      width: '160px',
      render: (row) => formatPlantDateTime(row.occurredAt) ?? '—',
    },
    {
      key: 'performedBy',
      header: h.performedBy,
      align: 'center',
      width: '120px',
      render: (row) =>
        row.performedBy === null
          ? h.system
          : (nameOf(row.performedBy) ?? h.unknownUser(row.performedBy)),
    },
    { key: 'action', header: h.action, align: 'center', width: '120px' },
    {
      key: 'changes',
      header: h.changes,
      align: 'center',
      render: (row): ReactNode =>
        row.changes.length === 0 ? (
          '—'
        ) : (
          <ul className="inspection-standard-history-changes">
            {row.changes.map((change) => (
              <li key={change.label}>
                <span className="inspection-standard-history-label">{change.label}</span>
                {change.after === undefined ? (
                  <span className="inspection-standard-history-note" data-tone="added">
                    {t.editor.historyChanged}
                  </span>
                ) : (
                  <span className="inspection-standard-history-value">
                    {change.before}
                    <Icon name="arrow_forward" size={14} aria-label="→" />
                    <span className="inspection-standard-history-after">{change.after}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={
        <span className="inspection-standard-dialog-title">
          {h.title}
          <Chip variant="status" size="sm" status="idle">
            {h.range}
          </Chip>
        </span>
      }
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {t.editor.close}
        </Button>
      }
    >
      {events === undefined ? (
        <div role="status" aria-label={h.loading}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <div className="inspection-queue-table inspection-standard-table-box inspection-standard-history-rows">
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.id)}
            empty={
              <EmptyState
                size="sm"
                icon={<Icon name="history" size={32} />}
                title={h.none}
                description={h.noneDescription}
              />
            }
          />
        </div>
      )}
    </Dialog>
  );
};
