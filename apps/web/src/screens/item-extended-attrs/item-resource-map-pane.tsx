import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import type { ItemResourceMap } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.itemResourceMap;
const shared = messages.itemExtendedAttrs;

export interface ItemResourceMapPaneProps {
  /** 서버 순서 그대로(기본 → 우선순위) — 추천·자동 배정이 읽는 순서와 같아야 한다 */
  rows: ItemResourceMap[];
  isLoading: boolean;
  plantOptions: SelectOption[];
  /** 고른 공장. 없으면 표를 만들지 않는다 */
  plantId: string;
  onChangePlant: (plantId: string) => void;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 줄 작업(기본 지정·사용 중지·다시 사용) 실패 배너 슬롯 */
  banner: ReactNode;
  /** 줄 작업이 나가 있는 줄. 같은 줄을 두 번 누르지 못하게 한다 */
  pendingRowId: number | null;
  onAdd: () => void;
  onEdit: (row: ItemResourceMap) => void;
  onSetDefault: (row: ItemResourceMap) => void;
  onToggleActive: (row: ItemResourceMap) => void;
}

const codeName = (code: string | null, name: string | null): string | null =>
  code === null ? null : `${code} · ${name ?? ''}`;

const processLabel = (row: ItemResourceMap): string =>
  codeName(row.processCode, row.processName) ?? t.values.allProcesses;

const equipmentLabel = (row: ItemResourceMap): string =>
  codeName(row.equipmentCode, row.equipmentName) ?? shared.values.empty;

const moldLabel = (row: ItemResourceMap): string =>
  codeName(row.moldCode, row.moldName) ?? shared.values.empty;

/** 줄 작업의 접근 이름. 같은 공정에 여러 줄이 있어 설비·금형까지 붙여야 서로 구분된다. */
export const resourceMapRowName = (row: ItemResourceMap): string =>
  [processLabel(row), row.equipmentCode, row.moldCode]
    .filter((part): part is string => part !== null)
    .join(' / ');

/**
 * 부속 정보 하위 탭④ — 설비·금형 매핑.
 *
 * **줄마다 바로 저장한다.** 다른 세 하위 탭처럼 표 아래 저장·취소가 없다 — 계약이 전체 치환이
 * 아니라 줄 단위 `POST`·`PUT`이다.
 *
 * 삭제가 없다. 계약에 삭제 경로가 없고, 사용 중지한 줄도 유일 제약에 들어 같은 조합을 다시
 * 쓰려면 「다시 사용」으로 되살린다.
 */
export const ItemResourceMapPane = ({
  rows,
  isLoading,
  plantOptions,
  plantId,
  onChangePlant,
  optionsNotice,
  loadError,
  banner,
  pendingRowId,
  onAdd,
  onEdit,
  onSetDefault,
  onToggleActive,
}: ItemResourceMapPaneProps) => {
  const columns: Column<ItemResourceMap>[] = [
    {
      key: 'isDefault',
      header: t.fields.isDefault,
      width: '64px',
      render: (row) => (row.isDefault ? t.values.isDefault : ''),
    },
    { key: 'process', header: t.fields.process, render: processLabel },
    { key: 'equipment', header: t.fields.equipment, render: equipmentLabel },
    { key: 'mold', header: t.fields.mold, render: moldLabel },
    {
      key: 'priorityNo',
      header: t.fields.priorityNo,
      width: '88px',
      align: 'end',
      render: (row) => String(row.priorityNo),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      width: '88px',
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
    {
      key: 'remarks',
      header: t.fields.remarks,
      render: (row) => row.remarks ?? shared.values.empty,
    },
    {
      key: 'actions',
      header: t.fields.actions,
      width: '240px',
      render: (row) => {
        const name = resourceMapRowName(row);
        const isPending = pendingRowId === row.itemResourceMapId;

        return (
          <>
            <IconButton
              icon="edit"
              size="sm"
              aria-label={t.actions.editRow(name)}
              onClick={() => onEdit(row)}
            />
            {/* 사용 중지한 줄은 기본이 될 수 없다 — 서버가 기본 자리를 사용 중인 줄로만 센다. */}
            {row.isActive && !row.isDefault && (
              <Button
                size="sm"
                variant="text"
                disabled={isPending}
                aria-label={t.actions.setDefaultRow(name)}
                onClick={() => onSetDefault(row)}
              >
                {t.actions.setDefault}
              </Button>
            )}
            <Button
              size="sm"
              variant="text"
              disabled={isPending}
              aria-label={
                row.isActive ? t.actions.deactivateRow(name) : t.actions.reactivateRow(name)
              }
              onClick={() => onToggleActive(row)}
            >
              {row.isActive ? t.actions.deactivate : t.actions.reactivate}
            </Button>
          </>
        );
      },
    },
  ];

  /** 조회 실패 → 공장 미선택 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (plantId === '') return <EmptyState size="sm" title={t.empty.noPlant} />;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.itemResourceMapId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noneTitle}
              description={t.empty.noneDescription}
            />
          }
        />
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.paneTitle}>
      {banner}
      {optionsNotice}

      <div className="filter-bar">
        <SelectField
          label={t.fields.plant}
          options={plantOptions}
          value={plantId}
          onChange={onChangePlant}
        />
        <div className="field-cell field-cell-unlabeled">
          <Button variant="outlined" disabled={plantId === ''} onClick={onAdd}>
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}
    </section>
  );
};
