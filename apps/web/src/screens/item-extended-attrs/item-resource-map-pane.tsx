import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import type { ItemResourceMap } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.itemResourceMap;
const shared = messages.itemExtendedAttrs;

export interface ItemResourceMapPaneProps {
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
  /**
   * 줄 작업·수정을 모두 닫는다. 줄 작업이 나가 있거나 목록을 다시 받는 동안에는 표의 `versionNo`가
   * 곧 낡으므로, 그 판으로 `If-Match`를 만들면 남이 아니라 내가 낸 충돌이 된다.
   */
  rowActionsLocked: boolean;
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
 * 부속 정보 하위 탭 — 설비·금형 매핑.
 *
 * **줄마다 바로 저장한다.** 다른 부속 하위 탭처럼 표 아래 저장·취소가 없다 — 계약이 전체 치환이
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
  rowActionsLocked,
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
      /* 기호만 두면 보조기술이 「별」로 읽는다 — 뜻은 숨김 글로 낸다. */
      render: (row) =>
        row.isDefault ? (
          <>
            <span aria-hidden="true">{t.values.isDefault}</span>
            <span className="work-order-assignment-visually-hidden">{t.fields.isDefault}</span>
          </>
        ) : (
          ''
        ),
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

        return (
          <>
            <IconButton
              icon="edit"
              size="sm"
              disabled={rowActionsLocked}
              aria-label={t.actions.editRow(name)}
              onClick={() => onEdit(row)}
            />
            {/* 사용 중지한 줄은 기본이 될 수 없다 — 서버가 기본 자리를 사용 중인 줄로만 센다. */}
            {row.isActive && !row.isDefault && (
              <Button
                size="sm"
                variant="text"
                disabled={rowActionsLocked}
                aria-label={t.actions.setDefaultRow(name)}
                onClick={() => onSetDefault(row)}
              >
                {t.actions.setDefault}
              </Button>
            )}
            <Button
              size="sm"
              variant="text"
              disabled={rowActionsLocked}
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

  const hasLoadError = loadError !== null && loadError !== undefined;

  /** 조회 실패 → 공장 미선택 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (hasLoadError) return loadError;

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
          empty={<EmptyState size="sm" live title={t.empty.noneTitle} />}
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
          {/* 목록이 없으면 중복 판정의 근거가 없다 — 받는 중이거나 받지 못했으면 열지 않는다. */}
          <Button
            variant="outlined"
            disabled={plantId === '' || isLoading || hasLoadError}
            onClick={onAdd}
          >
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}
    </section>
  );
};
