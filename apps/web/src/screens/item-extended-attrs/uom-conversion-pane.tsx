import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  IconButton,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import { lookupLabel } from './options';
import type { LookupEntry } from './types';
import type { UomConversionDraft } from './uom-conversion-draft';
import { duplicateDraftIds } from './uom-conversion-validation';

const t = messages.itemExtendedAttrs.uomConversion;
const shared = messages.itemExtendedAttrs;

export interface UomConversionPaneProps {
  drafts: UomConversionDraft[];
  isLoading: boolean;
  /** 단위 번호 → 이름. 번호를 화면에 그대로 내지 않는다 */
  uomEntries: LookupEntry[];
  isUomLoading: boolean;
  isUomError?: boolean;
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

const toLookupId = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * 부속 정보 하위 탭② — 단위 환산.
 *
 * **저장은 전체 치환이다.** 창의 확인은 표에만 반영되고 서버로는 「저장」에서 최종 목록이
 * 한 번에 나간다.
 *
 * **사업부 매핑과 다른 점이 하나다** — 이 자원에는 유일 제약이 있다
 * (`uq_item_uom_conversion`). 서버가 준 목록에 이미 겹친 줄이 있을 수 있으므로,
 * 저장을 눌러야 알게 하지 않고 미리 밝히고 저장을 막는다.
 *
 * **환산 비율을 표기만 바꾸지 않는다** — 반올림하거나 자릿수를 맞추면
 * 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된 것처럼 보인다.
 */
export const UomConversionPane = ({
  drafts,
  isLoading,
  uomEntries,
  isUomLoading,
  isUomError,
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
}: UomConversionPaneProps) => {
  const duplicates = duplicateDraftIds(drafts);

  const uomLabel = (value: string): string =>
    lookupLabel(uomEntries, toLookupId(value), isUomLoading, isUomError);

  const periodLabel = (draft: UomConversionDraft): string =>
    t.values.period(orEmptyMark(draft.effectiveFrom), orEmptyMark(draft.effectiveTo));

  /** 줄 액션의 이름. 같은 짝이 여럿일 수 있어 유효 시작까지 붙여야 서로 구분된다. */
  const rowName = (draft: UomConversionDraft): string =>
    `${uomLabel(draft.fromUomId)} → ${uomLabel(draft.toUomId)} ${orEmptyMark(draft.effectiveFrom)}`;

  /*
   * 지정 폭의 합은 **656px**(120+120+120+200+96)이라 `.wide-table`의 최소 폭(58rem = 928px)
   * 안에 들어간다 — 남는 폭은 지정 폭이 있는 열들이 나눠 갖는다.
   */
  const columns: Column<UomConversionDraft>[] = [
    {
      key: 'fromUomId',
      header: t.fields.fromUom,
      width: '120px',
      render: (row) => uomLabel(row.fromUomId),
    },
    {
      key: 'toUomId',
      header: t.fields.toUom,
      width: '120px',
      render: (row) => uomLabel(row.toUomId),
    },
    {
      key: 'conversionRate',
      header: t.fields.conversionRate,
      width: '120px',
      align: 'end',
      /* 사용자가 친 표기를 그대로 낸다 — 자릿수를 맞추면 값이 바뀐 것처럼 보인다. */
      render: (row) => orEmptyMark(row.conversionRate),
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
            aria-label={t.actions.editRow(rowName(row))}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.actions.removeRow(rowName(row))}
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

      {/*
       * 서버가 준 목록에 이미 겹친 줄이 있을 수 있다(옛 자료) — 그대로 보내면 서버가 거부한다.
       * 저장을 눌러야 알게 하지 않고 미리 밝힌다.
       */}
      {duplicates.size > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.validation.duplicateInList}</AlertBanner>
        </div>
      )}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" onClick={onAdd}>
            {t.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/*
         * 「고친 것이 없어서」 닫힌 저장은 상태이지 사유가 아니다.
         * **도메인 사유로 막힌 것만** 사유를 붙인다 — 모든 비활성에 문구를 붙이면 사유가 묻힌다.
         */}
        {duplicates.size > 0 ? (
          <DisabledAction
            label={messages.common.save}
            reason={t.actionReasons.saveBlockedByDuplicate}
          />
        ) : (
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        )}
      </div>
    </section>
  );
};
