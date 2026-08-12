import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeApprover } from './lookups';
import type { StepView } from './types';

const t = messages.approvalRoute;

/**
 * 우 칸 단계 표의 열 폭.
 *
 * **흡수 열은 승인자 하나뿐이다** — 「이름 · 부서」와 경고 문구를 담는다.
 * 단계 편집이 붙는 회차에 삭제 열과 디자인 시스템의 순서 이동 열이 더해지므로,
 * 지금부터 지정 폭 합을 우 칸 예산(약 560px) 아래로 눌러 둔다.
 */
export const STEP_COLUMN_WIDTH = {
  stepNo: '64px',
  approverStatus: '96px',
} as const;

export interface StepPaneProps {
  steps: StepView[];
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다. */
  loadError: ReactNode;
}

/**
 * 고른 결재선의 결재 단계 — **이 회차에는 읽기 전용이다.**
 *
 * **조회가 하나도 붙지 않는다.** 계약이 단계 응답에 승인자의 표시 이름과 부서, 사용 여부를
 * 함께 실어 보내기 때문이다 — 「화면이 사용자 목록을 다시 부르지 않게 한다」가 계약의 의도다.
 *
 * **정렬을 켜지 않고 묶음도 두지 않는다.** 행 순서가 곧 자료이며, 단계 편집이 붙는 회차에
 * 디자인 시스템의 순서 이동 열을 쓰는데 그것은 정렬이 켜지면 잠기고 묶음을 주면 아예 사라진다.
 *
 * **상시 안내 세 줄을 늘 낸다.** 승인자 부재 · 소급하지 않음 · 반려 후 재상신은 결재선을 보는
 * 내내 참인 사실이라, 성공 알림에 붙이면 알림과 함께 사라져 정작 읽어야 할 사람이 못 읽는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const StepPane = ({ steps, isLoading, loadError }: StepPaneProps) => {
  const columns: Column<StepView>[] = [
    {
      key: 'stepNo',
      header: t.fields.stepNo,
      width: STEP_COLUMN_WIDTH.stepNo,
      align: 'end',
      render: (step) => String(step.stepNo),
    },
    {
      key: 'approver',
      header: t.fields.approver,
      render: (step) => (
        <>
          <span>{describeApprover(step)}</span>
          {/* 색에만 기대지 않는다 — 사유가 글자로 함께 서야 한다. */}
          {!step.approverIsActive && (
            <span className="field-error">{t.notes.approverInactiveWarning}</span>
          )}
        </>
      ),
    },
    {
      key: 'approverStatus',
      header: t.fields.approverStatus,
      width: STEP_COLUMN_WIDTH.approverStatus,
      render: (step) =>
        step.approverIsActive ? t.values.approverActive : t.values.approverInactive,
    },
  ];

  const stepsSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.steps}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={steps}
        getRowId={(step) => String(step.approvalRouteStepId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.noStepsTitle}
            description={t.empty.noStepsDescription}
          />
        }
      />
    );
  };

  return (
    <section className="pane" aria-label={t.panes.steps}>
      {stepsSlot()}

      <p className="field-note">{t.notes.stepGuideApproverAbsent}</p>
      <p className="field-note">{t.notes.stepGuideNotRetroactive}</p>
      <p className="field-note">{t.notes.stepGuideRejectResubmit}</p>
    </section>
  );
};
