import { Button, Chip, EmptyState, Skeleton, Table, Tabs, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { lockedEquipmentId } from './order-draft';
import { SelectField } from './select-field';
import {
  BREAKDOWN_TRIGGER,
  formatMoment,
  INSPECTION_NG_TRIGGER,
  PM_DUE_TRIGGER,
  type BreakdownCandidateView,
  type InspectionCandidateView,
  type SelectOption,
  type TriggerDraft,
} from './types';

const t = messages.maintenanceOrder;

const optional = (value: string | null): string =>
  value === null || value.trim() === '' ? t.list.notAvailable : value;

/** 트리거 하나의 열쇠. 유형과 원천을 함께 써야 서로 다른 원천의 같은 번호가 겹치지 않는다. */
export const triggerKey = (typeCode: string, sourceId: number | null): string =>
  `${typeCode}:${sourceId === null ? 'none' : String(sourceId)}`;

export interface TriggerPickerProps {
  breakdowns: BreakdownCandidateView[];
  inspections: InspectionCandidateView[];
  isLoading: boolean;
  selected: TriggerDraft[];
  equipmentOptions: SelectOption[];
  onToggle: (trigger: TriggerDraft) => void;
  onRemove: (key: string) => void;
}

/**
 * 발행 대상 고르기 — **트리거 원천이 셋이고 성질이 다르다.**
 *
 * | 원천 | 성질 | 고르는 법 |
 * | --- | --- | --- |
 * | 고장 | 저장된 기록 | 목록에서 고른다 |
 * | 점검 불합격 | 저장된 기록 | 목록에서 고른다 |
 * | 주기 도래 | **파생 조건** | 가리킬 행이 없어 **설비를 골라 직접 더한다** |
 *
 * ⭐ **같은 설비끼리만 묶인다.** 하나를 고르면 다른 설비의 줄이 잠기고, 잠긴 이유를 줄마다
 * 말한다 — 잠그기만 하고 이유를 감추면 사용자는 목록이 고장 난 줄 안다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TriggerPicker = ({
  breakdowns,
  inspections,
  isLoading,
  selected,
  equipmentOptions,
  onToggle,
  onRemove,
}: TriggerPickerProps) => {
  const [pmDueEquipment, setPmDueEquipment] = useState('');
  const locked = lockedEquipmentId(selected);

  /** 이 설비를 지금 고를 수 있는가. 아무것도 안 골랐으면 전부 열려 있다. */
  const isLockedFor = (equipmentId: number): boolean => locked !== null && locked !== equipmentId;

  const isSelected = (key: string): boolean => selected.some((trigger) => trigger.key === key);

  const breakdownColumns: Column<BreakdownCandidateView>[] = [
    {
      key: 'pick',
      header: '',
      render: (row) => {
        const key = triggerKey(BREAKDOWN_TRIGGER, row.breakdownId);
        const lockedRow = isLockedFor(row.equipmentId);

        return (
          <Button
            size="sm"
            variant={isSelected(key) ? 'filled' : 'outlined'}
            disabled={lockedRow}
            aria-describedby={lockedRow ? 'trigger-lock-reason' : undefined}
            onClick={() => {
              onToggle({
                key,
                triggerTypeCode: BREAKDOWN_TRIGGER,
                sourceId: row.breakdownId,
                equipmentId: row.equipmentId,
                equipmentCode: row.equipmentCode,
                label: `${t.triggers.breakdownTab} · ${optional(row.breakdownNo)}`,
              });
            }}
          >
            {isSelected(key) ? t.triggers.remove : t.triggers.breakdownTab}
          </Button>
        );
      },
    },
    {
      key: 'breakdown',
      header: t.triggers.breakdownNo,
      render: (row) => (
        <span className="stacked-cell">
          <span>{optional(row.breakdownNo)}</span>
          <span>{optional(row.equipmentCode)}</span>
        </span>
      ),
    },
    { key: 'symptom', header: t.triggers.symptom, render: (row) => row.symptom },
    {
      key: 'reportedAt',
      header: t.triggers.reportedAt,
      render: (row) => formatMoment(row.reportedAt),
    },
  ];

  const inspectionColumns: Column<InspectionCandidateView>[] = [
    {
      key: 'pick',
      header: '',
      render: (row) => {
        const key = triggerKey(INSPECTION_NG_TRIGGER, row.inspectionId);
        const lockedRow = isLockedFor(row.equipmentId);

        return (
          <Button
            size="sm"
            variant={isSelected(key) ? 'filled' : 'outlined'}
            disabled={lockedRow}
            aria-describedby={lockedRow ? 'trigger-lock-reason' : undefined}
            onClick={() => {
              onToggle({
                key,
                triggerTypeCode: INSPECTION_NG_TRIGGER,
                sourceId: row.inspectionId,
                equipmentId: row.equipmentId,
                equipmentCode: row.equipmentCode,
                label: `${t.triggers.inspectionTab} · ${optional(row.inspectionNo)}`,
              });
            }}
          >
            {isSelected(key) ? t.triggers.remove : t.triggers.inspectionTab}
          </Button>
        );
      },
    },
    {
      key: 'inspection',
      header: t.triggers.inspectionNo,
      render: (row) => (
        <span className="stacked-cell">
          <span>{optional(row.inspectionNo)}</span>
          <span>{optional(row.equipmentCode)}</span>
        </span>
      ),
    },
    {
      key: 'inspectedAt',
      header: t.triggers.inspectedAt,
      render: (row) => formatMoment(row.inspectedAt),
    },
    { key: 'inspector', header: t.triggers.inspector, render: (row) => row.inspectorWorkerNo },
  ];

  if (isLoading) return <Skeleton variant="rect" height="14rem" />;

  return (
    <>
      <p className="pane-lead">{t.triggers.sameEquipmentOnly}</p>
      {/*
       * 잠긴 줄들이 함께 가리키는 사유 — 줄마다 문장을 되풀이하지 않는다.
       * ⛔ **실제로 잠겼을 때만 낸다.** 늘 떠 있으면 배경이 되어, 정작 잠긴 순간에 아무도 읽지 않는다.
       */}
      {locked !== null && (
        <p id="trigger-lock-reason" className="pane-lead">
          {t.triggers.lockedOtherEquipment}
        </p>
      )}

      <Tabs
        aria-label={t.panes.triggers}
        items={[
          {
            value: 'breakdown',
            label: t.triggers.breakdownTab,
            content: (
              <Table
                caption={
                  <span className="maintenance-order-table-caption">{t.triggers.breakdownTab}</span>
                }
                columns={breakdownColumns}
                rows={breakdowns}
                getRowId={(row) => String(row.breakdownId)}
                density="compact"
                empty={
                  <EmptyState
                    size="sm"
                    live
                    title={t.triggers.emptyTitle}
                    description={t.triggers.emptyBreakdown}
                  />
                }
              />
            ),
          },
          {
            value: 'inspection',
            label: t.triggers.inspectionTab,
            content: (
              <Table
                caption={
                  <span className="maintenance-order-table-caption">
                    {t.triggers.inspectionTab}
                  </span>
                }
                columns={inspectionColumns}
                rows={inspections}
                getRowId={(row) => String(row.inspectionId)}
                density="compact"
                empty={
                  <EmptyState
                    size="sm"
                    live
                    title={t.triggers.emptyTitle}
                    description={t.triggers.emptyInspection}
                  />
                }
              />
            ),
          },
          {
            value: 'pmDue',
            label: t.triggers.pmDueTab,
            content: (
              <>
                {/* ⛔ 가리킬 기록이 없어 목록이 아니다 — 설비를 골라 직접 더한다. */}
                <p className="pane-lead">{t.triggers.pmDueLead}</p>
                <div className="filter-bar maintenance-order-trigger-filter">
                  <SelectField
                    label={t.triggers.equipment}
                    options={equipmentOptions}
                    value={pmDueEquipment}
                    placeholder={t.form.itemPlaceholder}
                    wide
                    onChange={setPmDueEquipment}
                  />
                  <div className="field-cell field-cell-unlabeled maintenance-order-trigger-actions">
                    <div className="filter-actions">
                      <Button
                        variant="outlined"
                        disabled={pmDueEquipment === '' || isLockedFor(Number(pmDueEquipment))}
                        onClick={() => {
                          const equipmentId = Number(pmDueEquipment);
                          const option = equipmentOptions.find(
                            (entry) => entry.value === pmDueEquipment,
                          );

                          onToggle({
                            key: triggerKey(PM_DUE_TRIGGER, equipmentId),
                            triggerTypeCode: PM_DUE_TRIGGER,
                            /* ⛔ 주기 도래는 가리킬 행이 없다 — 원천 식별자를 비운다. */
                            sourceId: null,
                            equipmentId,
                            equipmentCode: option?.label ?? null,
                            label: `${t.triggers.pmDueAdded} · ${option?.label ?? pmDueEquipment}`,
                          });
                        }}
                      >
                        {t.triggers.addPmDue}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ),
          },
        ]}
      />

      <h3>{t.triggers.selected(selected.length)}</h3>
      {selected.length === 0 ? (
        <p className="pane-lead">{t.triggers.none}</p>
      ) : (
        <ul className="alert-list">
          {selected.map((trigger) => (
            <li key={trigger.key}>
              <span className="notification-card-meta">
                <Chip size="sm">{trigger.label}</Chip>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => {
                    onRemove(trigger.key);
                  }}
                >
                  {t.triggers.remove}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
