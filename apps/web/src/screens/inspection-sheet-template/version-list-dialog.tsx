import { Button, type Column, Dialog, Icon, Table } from '@crefle/web-ui';
import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { TemplateStatusChip } from './template-editor';

const t = messages.inspectionSheetTemplate;

export interface TemplateVersionListDialogProps {
  /** 같은 품목의 모든 버전 */
  versions: readonly InspectionSheetTemplate[];
  selectedId: number;
  /** 작성중 버전이 있으면 그 버전 번호 — 바닥 줄 안내(검사 기준 탭과 같다) */
  draftVersion: number | null;
  onSelect: (inspectionSheetTemplateId: number) => void;
  onClose: () => void;
}

/**
 * 검사표 기준 버전 목록 — 검사 기준 탭의 「버전 목록」 창과 같은 모양(사용자 지시 · #208).
 * 줄을 누르면 그 버전을 열고 창을 닫는다.
 */
export const TemplateVersionListDialog = ({
  versions,
  selectedId,
  draftVersion,
  onSelect,
  onClose,
}: TemplateVersionListDialogProps) => {
  const rows = [...versions].sort((left, right) => right.templateVersion - left.templateVersion);
  const columns: Column<InspectionSheetTemplate>[] = [
    {
      key: 'version',
      header: t.columns.version,
      align: 'center',
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open"
          aria-current={row.inspectionSheetTemplateId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.inspectionSheetTemplateId)}
        >
          {t.editor.versionChip(row.templateVersion)}
        </button>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'center',
      render: (row) => <TemplateStatusChip size="sm" statusCode={row.statusCode} />,
    },
    {
      key: 'confirmedAt',
      header: t.columns.confirmedAt,
      align: 'center',
      render: (row) =>
        row.confirmedAt === null ? '' : (formatPlantDateTime(row.confirmedAt) ?? ''),
    },
  ];

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.versionBar.openList}
      onClose={onClose}
    >
      <div className="inspection-standard-version-dialog">
        {/* 줄 아무 곳이나 눌러도 고른다 — 눌린 줄의 버전 단추로 넘긴다. */}
        <div
          className="inspection-queue-table inspection-standard-plan-rows"
          onClick={(event) => {
            const target = event.target as Element;
            if (target.closest('button, a, input, select, textarea') !== null) return;
            target
              .closest('tbody tr')
              ?.querySelector<HTMLButtonElement>('.inspection-standard-plan-open')
              ?.click();
          }}
        >
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.inspectionSheetTemplateId)}
          />
        </div>
        <div className="inspection-standard-dialog-close">
          {draftVersion !== null && (
            <p className="inspection-standard-notice-label">
              <Icon name="info" size={18} aria-hidden />
              {t.versionBar.draftNotice(draftVersion)}
            </p>
          )}
          <Button variant="outlined" onClick={onClose}>
            {messages.common.close}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
