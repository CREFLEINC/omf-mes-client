import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { BuMapDraft } from './bu-map-draft';
import { lookupLabel } from './options';
import type { LookupEntry } from './types';

const t = messages.itemExtendedAttrs.buMap;
const shared = messages.itemExtendedAttrs;

export interface BuMapPaneProps {
  drafts: BuMapDraft[];
  isLoading: boolean;
  /** 사업부 번호 → 이름. 번호를 화면에 그대로 내지 않는다 */
  businessUnitEntries: LookupEntry[];
  isBusinessUnitLoading: boolean;
  /** 대상 품목 번호 → 이름. 행마다 상세를 부른 결과다(결정 12) */
  itemNameEntries: LookupEntry[];
  isItemNameLoading: boolean;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onAdd: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? shared.values.empty : value);

/** 초안의 문자열 번호를 조회 키(숫자)로. 비어 있으면 아직 고르지 않은 것이다. */
const toLookupId = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * 부속 정보 하위 탭① — 사업부 매핑.
 *
 * **저장은 전체 치환이다.** 창의 확인은 표에만 반영되고 서버로는 「저장」에서 최종 목록이
 * 한 번에 나간다 — 계약이 행 단위 추가·삭제 경로를 두지 않았다.
 *
 * **쪽 이동을 두지 않는다** — 계약의 이 목록에 쪽 나눔이 없다(`items`만 온다).
 *
 * **순서 이동을 두지 않는다** — 이 표에 순서 컬럼이 없다. 화면이 순서를 만들면
 * 새로고침에 사라진다(결정 6).
 *
 * **중복 경고를 내지 않는다** — 계약이 이 표에 유일 제약을 적지 않았다(결정 7).
 * 같은 짝이 문제가 되면 서버 400이 배너로 온다.
 */
export const BuMapPane = ({
  drafts,
  isLoading,
  businessUnitEntries,
  isBusinessUnitLoading,
  itemNameEntries,
  isItemNameLoading,
  optionsNotice,
  loadError,
  banner,
  isDirty,
  isSaving,
  onAdd,
  onEdit,
  onRemove,
  onSave,
  onCancel,
}: BuMapPaneProps) => {
  const businessUnitLabel = (value: string): string =>
    lookupLabel(businessUnitEntries, toLookupId(value), isBusinessUnitLoading);

  const itemLabel = (value: string): string =>
    lookupLabel(itemNameEntries, toLookupId(value), isItemNameLoading);

  const periodLabel = (draft: BuMapDraft): string =>
    t.values.period(orEmptyMark(draft.effectiveFrom), orEmptyMark(draft.effectiveTo));

  /*
   * 지정 폭의 합은 **576px**(140+140+200+96)이라 `.wide-table`의 최소 폭(58rem = 928px)
   * 안에 들어간다 — 「대상 품목」만 폭을 지정하지 않고 남는 폭을 흡수한다.
   * 값이 「코드 · 이름」이라 가장 길고, 접혀도 읽히는 칸이다.
   */
  const columns: Column<BuMapDraft>[] = [
    {
      key: 'fromBusinessUnitId',
      header: t.fields.fromBusinessUnit,
      width: '140px',
      render: (row) => businessUnitLabel(row.fromBusinessUnitId),
    },
    {
      key: 'toBusinessUnitId',
      header: t.fields.toBusinessUnit,
      width: '140px',
      render: (row) => businessUnitLabel(row.toBusinessUnitId),
    },
    {
      key: 'toItemId',
      header: t.fields.toItem,
      render: (row) => itemLabel(row.toItemId),
    },
    {
      key: 'validPeriod',
      header: t.fields.validPeriod,
      width: '200px',
      render: (row) => periodLabel(row),
    },
    {
      key: 'edit',
      header: t.fields.edit,
      width: '96px',
      render: (row) => (
        <>
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.actions.editRow(itemLabel(row.toItemId))}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.actions.removeRow(itemLabel(row.toItemId))}
            onClick={() => onRemove(row.draftId)}
          />
        </>
      ),
    },
  ];

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

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
          rows={drafts}
          getRowId={(row) => row.draftId}
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
        <div className="field-cell">
          <Button variant="outlined" onClick={onAdd}>
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}

      <div className="form-actions">
        {/* 「취소」는 서버가 준 목록으로 되돌리는 것이라 고친 것이 있을 때만 의미가 있다. */}
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </section>
  );
};
