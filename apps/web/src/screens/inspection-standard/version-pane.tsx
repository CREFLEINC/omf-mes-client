import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import { resolveVersionStatus } from './plan-version-status';
import type { InspectionPlanVersion } from './types';

const t = messages.inspectionStandard;

export interface VersionPaneProps {
  versions: InspectionPlanVersion[];
  isLoading: boolean;
  /** 기준을 고르기 전에는 조회 자체를 하지 않는다 — 「없다」와 「아직 안 골랐다」는 다른 안내다. */
  isPlanSelected: boolean;
  selectedVersionId: number | null;
  onSelect: (inspectionPlanVersionId: number) => void;
  loadError: ReactNode;
  /** 신규 버전 발행을 막는 사유. null이면 누를 수 있다 */
  newRevisionDisabledReason: string | null;
  /** 첫 버전 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  isPublishing: boolean;
  onNewRevision: () => void;
  onCreateVersion: () => void;
  /** 등록·발행 실패 배너 슬롯 */
  banner: ReactNode;
}

/**
 * 중 페인 — 고른 기준의 버전 목록.
 *
 * **쪽 이동을 두지 않는다.** 계약이 이 목록에 페이지네이션을 두지 않았다(기준당 버전 수가 소수다).
 *
 * 정렬은 서버가 한다 — 계약이 판 번호 내림차순(최신이 위)으로 준다고 정했다.
 * 화면이 다시 정렬하면 순서의 정본이 둘이 된다.
 *
 * **「상태 표시는 임시입니다」 안내를 여기 두지 않는다** — 좁은 페인에서 행마다 되풀이되면
 * 표가 읽히지 않는다. 그 안내는 「버전 정보」 구획의 상태 값 아래에 한 번만 낸다.
 */
export const VersionPane = ({
  versions,
  isLoading,
  isPlanSelected,
  selectedVersionId,
  onSelect,
  loadError,
  newRevisionDisabledReason,
  isCreating,
  isPublishing,
  onNewRevision,
  onCreateVersion,
  banner,
}: VersionPaneProps) => {
  const columns: Column<InspectionPlanVersion>[] = [
    {
      key: 'planVersion',
      header: t.fields.planVersion,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.inspectionPlanVersionId === selectedVersionId ? 'true' : undefined}
          onClick={() => onSelect(row.inspectionPlanVersionId)}
        >
          {t.values.version(row.planVersion)}
        </button>
      ),
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => {
        const status = resolveVersionStatus(row.statusCode);

        return (
          <Chip variant="status" status={status.tone}>
            {status.label}
          </Chip>
        );
      },
    },
  ];

  const hasLoadError = loadError !== null && loadError !== undefined;

  /** 선택 전 → 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (!isPlanSelected) {
      return <EmptyState size="sm" title={t.empty.planNotSelected} />;
    }

    if (hasLoadError) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.versions}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={versions}
        getRowId={(row) => String(row.inspectionPlanVersionId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.versionNoneTitle}
            description={t.empty.versionNoneDescription}
          />
        }
      />
    );
  };

  /*
   * **갈림의 기준은 버전 건수다.** 버전이 하나도 없으면 복사할 원본이 없어 생성 경로를 쓰고,
   * 하나라도 있으면 개정 경로를 쓴다 — 계약이 두 경로를 그렇게 나눴다.
   *
   * 원본 버전의 상태(확정이어야 한다)는 **화면이 판정하지 않는다.** 상태 코드 어휘가
   * 확정되지 않아 화면이 막으면 잘못 막았을 때 사용자가 풀 길이 없다. 서버가 거부하면 사유를 배너로 낸다.
   */
  const hasVersions = versions.length > 0;

  const actionSlot = (): ReactNode => {
    if (!hasVersions) {
      return (
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onCreateVersion}>
            {t.actions.createVersion}
          </Button>
        </div>
      );
    }

    if (newRevisionDisabledReason !== null) {
      return <DisabledAction label={t.actions.newRevision} reason={newRevisionDisabledReason} />;
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
    <section className="pane" aria-label={t.panes.version}>
      {banner}

      {/*
       * **목록을 받기 전에는 액션을 내지 않는다.** 갈림의 기준이 버전 건수라
       * 불러오는 중의 0건을 「버전이 없다」로 읽으면 개정해야 할 자리에서 생성 경로가 열리고,
       * 그 요청은 유일 제약 위반으로 거부된다.
       */}
      {isPlanSelected && !isLoading && !hasLoadError && (
        <div className="filter-bar">{actionSlot()}</div>
      )}

      {listSlot()}
    </section>
  );
};
