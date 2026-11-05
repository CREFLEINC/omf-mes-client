import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { DisabledAction } from './disabled-action';
import { resolveRoutingStatus } from './routing-status';
import type { Routing } from './types';
import { centerColumns } from './table-align';

const t = messages.routing;

export interface RevisionPaneProps {
  revisions: Routing[];
  isLoading: boolean;
  /** 품목을 고르기 전에는 조회 자체를 하지 않는다 — 「없다」와 「아직 안 골랐다」는 다른 안내다. */
  isItemSelected: boolean;
  /** 설정 탭에서 보고 있는 Rev — 그 줄을 고른 줄로 칠한다. */
  selectedRoutingId: number | null;
  /** 「상세 보기」 — 그 Rev 를 상세 창으로 연다(설정 탭으로 넘어가지 않는다 · #231). */
  onViewDetail: (row: Routing) => void;
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
  /** 발행 · 첫 등록 단추를 이 칸에 둘지. 상세 카드는 「설정」 탭 머리에 둔다(#231) — 같은 단추를 두 번 세우지 않는다. */
  showActions?: boolean;
  /**
   * 기본 Rev 고르기(#231). 주면 표 위에 「기본 Rev」 칸을 세운다 — 확정 개정만 고를 수 있다.
   * 작성중 · 폐기는 생산에 쓰지 못해 기본으로 두지 않는다(서버는 상태를 가리지 않는다).
   */
  onSetDefault?: (row: Routing) => void;
}

export interface RevisionActionsProps {
  hasRevisions: boolean;
  newRevisionDisabledReason: string | null;
  isCreating: boolean;
  isPublishing: boolean;
  onNewRevision: () => void;
  onCreateRouting: () => void;
}

/*
 * Rev가 하나도 없으면 발행할 원본 판이 없다 — 첫 판을 만드는 액션으로 바뀐다.
 * 계약도 두 경로를 나눠 두었다(`:new-revision`은 기존 판을 복사한다).
 */
export const RevisionActions = ({
  hasRevisions,
  newRevisionDisabledReason,
  isCreating,
  isPublishing,
  onNewRevision,
  onCreateRouting,
}: RevisionActionsProps) => {
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
      <DisabledAction label={t.actions.newRevision} reason={newRevisionDisabledReason} quiet />
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

/**
 * 중 페인 — 고른 품목의 Rev 목록.
 *
 * 개정 이력을 보는 칸 — 기본 지정 표시 · 요약은 두지 않는다(사용자 지시 · #231).
 *
 * 정렬은 서버가 한다 — 계약이 판 번호 내림차순(최신이 위)으로 준다고 정했다.
 * 화면이 다시 정렬하면 순서의 정본이 둘이 된다.
 */
export const RevisionPane = ({
  revisions,
  isLoading,
  isItemSelected,
  selectedRoutingId,
  onViewDetail,
  loadError,
  newRevisionDisabledReason,
  isCreating,
  isPublishing,
  onNewRevision,
  onCreateRouting,
  banner,
  showActions = true,
  onSetDefault,
}: RevisionPaneProps) => {
  const defaultSelectId = useId();
  const columns: Column<Routing>[] = [
    {
      key: 'routingVersion',
      header: t.fields.revision,
      width: '96px',
      render: (row) => t.values.revision(row.routingVersion),
    },
    { key: 'routingCode', header: t.fields.routingCode },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '96px',
      render: (row) => {
        const status = resolveRoutingStatus(row.statusCode);

        /* 상태 라벨 — 검사 기준 버전 목록과 같은 칩(사용자 지시 · #231). */
        return (
          <Chip variant="status" size="sm" status={status.tone}>
            {status.label}
          </Chip>
        );
      },
    },
    /* 확정 일시(#231) — 작성중이거나 기록이 생기기 전에 확정된 개정은 「—」. 공장 시각으로 보인다. */
    {
      key: 'confirmedAt',
      header: t.fields.confirmedAt,
      width: '160px',
      render: (row) => formatPlantDateTime(row.confirmedAt) ?? t.values.empty,
    },
    /*
     * 상세 보기(사용자 지시 · #231) — 줄 클릭 대신 이 단추로만 연다. 누르면 그 Rev 의 정보를 창으로 보인다(조회만).
     * 설정 탭에서 보고 있는 Rev 의 줄은 바탕 · 왼쪽 강조선으로 칠한다 — 이 단추의 현재 위치 표식이 그 자리다.
     */
    {
      key: 'detail',
      header: t.fields.detail,
      width: '120px',
      render: (row) => (
        <Button
          variant="outlined"
          size="sm"
          className="routing-revision-open"
          aria-label={t.actions.viewDetailLabel(t.values.revision(row.routingVersion))}
          aria-current={row.routingId === selectedRoutingId ? 'true' : undefined}
          onClick={() => onViewDetail(row)}
        >
          {t.actions.viewDetail}
        </Button>
      ),
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다(표 공통 · #231). */
  const ordered = useColumnOrder('omf-mes:routing:revision-columns:order', centerColumns(columns));
  const resizable = useColumnWidths('omf-mes:routing:revision-columns', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

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
      /* 줄 클릭은 두지 않는다 — 「상세 보기」 단추 하나로 연다(사용자 지시 · #231). */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box wide-table routing-revision-rows"
        style={resizable.style}
      >
        <Table
          density="compact"
          columns={fit.columns}
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
      </div>
    );
  };

  const hasRevisions = revisions.length > 0;
  const confirmedRevisions = revisions.filter(
    (row) => resolveRoutingStatus(row.statusCode).status === 'confirmed',
  );
  const defaultRevision = revisions.find((row) => row.isDefault === true) ?? null;

  return (
    <section className="pane routing-revision-pane" aria-label={t.panes.revision}>
      {banner}

      {isItemSelected && showActions && (
        <div className="filter-bar">
          <RevisionActions
            hasRevisions={hasRevisions}
            newRevisionDisabledReason={newRevisionDisabledReason}
            isCreating={isCreating}
            isPublishing={isPublishing}
            onNewRevision={onNewRevision}
            onCreateRouting={onCreateRouting}
          />
        </div>
      )}

      {/*
       * 기본 Rev 고르기(사용자 지시 · #231) — 목록을 받은 뒤 늘 보인다. 확정 개정이 없으면 고를 것이 없어
       * 「확정된 Rev 없음」으로 잠근다(작성중 · 폐기는 기본으로 두지 않는다).
       */}
      {onSetDefault !== undefined &&
        isItemSelected &&
        !isLoading &&
        (loadError === null || loadError === undefined) &&
        hasRevisions && (
          /* 「기본 Rev  [Rev 2 ▾]」 한 줄 — 라벨은 위가 아니라 왼쪽(사용자 지시 · #231). */
          <div className="routing-default-line">
            <label className="field-label" htmlFor={defaultSelectId}>
              {t.values.defaultSelect}
            </label>
            <Select
              id={defaultSelectId}
              options={confirmedRevisions.map((row) => ({
                value: String(row.routingId),
                label: t.values.revision(row.routingVersion),
              }))}
              value={defaultRevision === null ? null : String(defaultRevision.routingId)}
              placeholder={
                confirmedRevisions.length === 0 ? t.values.defaultNoConfirmed : t.values.defaultNone
              }
              disabled={confirmedRevisions.length === 0}
              onChange={(value) => {
                const row = confirmedRevisions.find((entry) => String(entry.routingId) === value);
                if (row !== undefined && row.isDefault !== true) onSetDefault(row);
              }}
            />
          </div>
        )}

      {listSlot()}
    </section>
  );
};
