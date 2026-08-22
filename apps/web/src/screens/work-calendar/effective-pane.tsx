import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  levelLabel,
  resolutionSummary,
  stepNote,
  type WorkCalendarEffectiveResponse,
  type WorkCalendarResolutionStep,
} from './effective-resolution';
import { SelectField } from './select-field';
import type { TargetOption } from './queries';

const t = messages.workCalendar.effective;

export interface EffectivePaneProps {
  equipmentId: string;
  onChangeEquipment: (equipmentId: string) => void;
  options: TargetOption[];
  /** 서버가 준 해석 결과. 아직 고르지 않았으면 `null` */
  effective: WorkCalendarEffectiveResponse | null;
  isLoading: boolean;
  loadError: ReactNode;
}

/**
 * 이 설비가 결국 어느 캘린더를 따르는가와 그렇게 정해진 경로.
 *
 * ⭐ **화면이 계산하지 않는다**(스펙 §6). 설계 규칙은 「가장 가까운 것이 이긴다」인데,
 * 규칙만으로는 결과가 보이지 않아 **서버가 결과와 훑은 경로를 함께 내리고 화면은 그린다.**
 * 화면이 규칙을 다시 구현하면 서버와 다른 답을 낼 수 있고, 그때 어느 쪽이 맞는지 알 수 없다.
 */
export const EffectivePane = ({
  equipmentId,
  onChangeEquipment,
  options,
  effective,
  isLoading,
  loadError,
}: EffectivePaneProps) => {
  const columns: Column<WorkCalendarResolutionStep>[] = [
    {
      key: 'levelCode',
      header: t.pathTitle,
      width: '160px',
      render: (row) => levelLabel(row.levelCode),
    },
    { key: 'targetName', header: t.equipment },
    {
      key: 'hasApplication',
      header: '',
      width: '140px',
      render: stepNote,
    },
  ];

  const resultSlot = (): ReactNode => {
    if (equipmentId === '') {
      return <EmptyState size="sm" live title={t.title} description={t.pickEquipment} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading || effective === null) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <p>{resolutionSummary(effective, levelLabel)}</p>
        <span className="field-note">{t.pathNote}</span>
        <Table
          density="compact"
          columns={columns}
          rows={[...effective.steps]}
          getRowId={(step) => `${step.levelCode}-${String(step.targetId)}`}
        />
      </>
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      <div className="filter-bar">
        <div className="field-cell field-cell-unlabeled">
          <strong>{t.title}</strong>
        </div>
        <SelectField
          label={t.equipment}
          options={options}
          value={equipmentId}
          onChange={onChangeEquipment}
          placeholder={t.equipmentPlaceholder}
        />
      </div>

      {resultSlot()}
    </section>
  );
};
