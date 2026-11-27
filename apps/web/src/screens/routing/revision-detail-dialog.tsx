import { Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { InfoCodeName, InfoFacts } from '../../patterns/info-facts';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { toOperationDrafts } from './operation-order';
import { OperationsPane } from './operations-pane';
import { useRoutingOperations } from './queries';
import { resolveRoutingStatus } from './routing-status';
import type { Routing } from './types';

const t = messages.routing;

const noop = () => undefined;

export interface RevisionDetailDialogProps {
  revision: Routing;
  itemCode: string;
  itemName: string;
  processLabel: (processId: string) => string;
  renderLoadError: (error: unknown, onRetry: () => void) => ReactNode;
  onClose: () => void;
}

/**
 * Rev 상세 보기(사용자 지시 · omf-all-around#231) — Rev 이력 표의 「상세 보기」가 연다.
 * 설정 탭으로 넘어가지 않고 그 Rev 의 정보와 공정 구성을 창 안에서 보기만 한다. 고칠 것이 없어 「닫기」 하나.
 * 공정 표는 설정 탭과 같은 표를 읽기 전용으로 그린다.
 */
export const RevisionDetailDialog = ({
  revision,
  itemCode,
  itemName,
  processLabel,
  renderLoadError,
  onClose,
}: RevisionDetailDialogProps) => {
  const operations = useRoutingOperations(revision.routingId);
  const drafts = operations.data === undefined ? [] : toOperationDrafts(operations.data.items);
  const status = resolveRoutingStatus(revision.statusCode);

  return (
    <Dialog
      open
      size="lg"
      /* 공정 표가 6칸이라 창을 화면 폭에 맞춰 넓힌다 — 좁으면 표준 C/T · 수율이 밀려 안 보였다(#231). */
      className="routing-history-dialog"
      showCloseButton={false}
      title={t.values.detailTitle(t.values.revision(revision.routingVersion))}
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.close}
        </Button>
      }
    >
      <div className="routing-detail-dialog">
        {/* 정보 표시 팝업 — 첫 줄 품목 · Routing 코드(크게), 둘째 줄 상태 · 확정 일시(시안 2026-11-27 · #360). */}
        <InfoFacts
          rows={[
            [
              {
                label: t.fields.item,
                value: <InfoCodeName code={itemCode} name={itemName} />,
                title: `${itemCode} ${itemName}`,
                isKey: true,
              },
              { label: t.fields.routingCode, value: revision.routingCode, isKey: true },
            ],
            [
              {
                label: t.fields.status,
                value: (
                  <Chip variant="status" size="sm" status={status.tone}>
                    {status.label}
                  </Chip>
                ),
              },
              {
                label: t.fields.confirmedAt,
                value: formatPlantDateTime(revision.confirmedAt) ?? t.values.empty,
              },
            ],
          ]}
        />

        <OperationsPane
          title={
            <>
              {t.card.operationsTitle}
              <span className="routing-card-count">{t.card.operationsCount(drafts.length)}</span>
            </>
          }
          drafts={drafts}
          processLabel={processLabel}
          isLoading={operations.isPending}
          isRevisionSelected
          loadError={
            operations.isError
              ? renderLoadError(operations.error, () => void operations.refetch())
              : null
          }
          optionsNotice={null}
          isEditable={false}
          lockReason={t.actionReasons.operationsLocked}
          isDirty={false}
          isSaving={false}
          saveBlockedReason={null}
          removeBlockedReason={() => null}
          dependenciesBlockedReason={null}
          showSaveActions={false}
          showTools={false}
          banner={null}
          onAdd={noop}
          onEdit={noop}
          onRemove={noop}
          onReorder={noop}
          onSave={noop}
          onCancel={noop}
          onOpenDependencies={noop}
        />
      </div>
    </Dialog>
  );
};
