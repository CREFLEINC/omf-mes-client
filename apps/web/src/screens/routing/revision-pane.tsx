import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import { resolveRoutingStatus } from './routing-status';
import type { Routing } from './types';

const t = messages.routing;

export interface RevisionPaneProps {
  revisions: Routing[];
  isLoading: boolean;
  /** 품목을 고르기 전에는 조회 자체를 하지 않는다 — 「없다」와 「아직 안 골랐다」는 다른 안내다. */
  isItemSelected: boolean;
  selectedRoutingId: number | null;
  onSelect: (routingId: number) => void;
  loadError: ReactNode;
  /** 신규 Rev 발행을 막는 사유. null이면 누를 수 있다 */
  newRevisionDisabledReason: string | null;
  /** 첫 Rev 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  isPublishing: boolean;
  onNewRevision: () => void;
  onCreateRouting: () => void;
  /** 발행 실패 배너 슬롯 */
  banner: ReactNode;
}

/**
 * 중 페인 — 고른 품목의 Rev 목록.
 *
 * **「기본(default) Rev」 열을 만들지 않는다.** 그 값을 담을 자리가 계약에도 물리 모델에도 없다.
 * 없는 값을 지어내면 사용자가 그것을 자료로 읽는다.
 *
 * 정렬은 서버가 한다 — 계약이 판 번호 내림차순(최신이 위)으로 준다고 정했다.
 * 화면이 다시 정렬하면 순서의 정본이 둘이 된다.
 */
export const RevisionPane = ({
  revisions,
  isLoading,
  isItemSelected,
  selectedRoutingId,
  onSelect,
  loadError,
  newRevisionDisabledReason,
  isCreating,
  isPublishing,
  onNewRevision,
  onCreateRouting,
  banner,
}: RevisionPaneProps) => {
  const columns: Column<Routing>[] = [
    {
      key: 'routingVersion',
      header: t.fields.revision,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.routingId === selectedRoutingId ? 'true' : undefined}
          onClick={() => onSelect(row.routingId)}
        >
          {t.values.revision(row.routingVersion)}
        </button>
      ),
    },
    { key: 'routingCode', header: t.fields.routingCode },
    {
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => {
        const status = resolveRoutingStatus(row.statusCode);

        return (
          <Chip variant="status" status={status.tone}>
            {status.label}
          </Chip>
        );
      },
    },
  ];

  /** 선택 전 → 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (!isItemSelected) {
      return <EmptyState size="sm" title={t.empty.itemNotSelected} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.revisions}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={revisions}
        getRowId={(row) => String(row.routingId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.revisionNoneTitle}
            description={t.empty.revisionNoneDescription}
          />
        }
      />
    );
  };

  /*
   * Rev가 하나도 없으면 발행할 원본 판이 없다 — 첫 판을 만드는 액션으로 바뀐다.
   * 계약도 두 경로를 나눠 두었다(`:new-revision`은 기존 판을 복사한다).
   */
  const hasRevisions = revisions.length > 0;

  const actionSlot = (): ReactNode => {
    if (!hasRevisions) {
      return (
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onCreateRouting}>
            {t.actions.createRouting}
          </Button>
        </div>
      );
    }

    if (newRevisionDisabledReason !== null) {
      return (
        <DisabledAction label={t.actions.newRevision} reason={newRevisionDisabledReason} />
      );
    }

    return (
      <div className="field-cell">
        <Button variant="outlined" disabled={isPublishing} onClick={onNewRevision}>
          {t.actions.newRevision}
        </Button>
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.revision}>
      {banner}

      {isItemSelected && <div className="filter-bar">{actionSlot()}</div>}

      {listSlot()}
    </section>
  );
};
