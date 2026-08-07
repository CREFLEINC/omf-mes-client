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
import type { ExternalCodeDraft } from './external-code-draft';
import { duplicateDraftIds } from './external-code-validation';
import { lookupLabel } from './options';
import type { LookupEntry } from './types';

const t = messages.itemExtendedAttrs.externalCode;
const shared = messages.itemExtendedAttrs;

export interface ExternalCodePaneProps {
  drafts: ExternalCodeDraft[];
  isLoading: boolean;
  /** 거래처 번호 → 이름. 번호를 화면에 그대로 내지 않는다 */
  partnerEntries: LookupEntry[];
  isPartnerLoading: boolean;
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

/**
 * 부속 정보 하위 탭③ — 외부 코드.
 *
 * **저장은 전체 치환이다.** 창의 확인은 표에만 반영되고 서버로는 「저장」에서 최종 목록이
 * 한 번에 나간다.
 *
 * **유효기간 열이 없다.** 계약의 이 표에 기간 컬럼 자체가 없다 —
 * 셋을 한 부품으로 묶지 않은 이유가 여기서 드러난다(결정 6).
 *
 * **중복 판정이 `COALESCE`로 접힌다**(A-7). 거래처를 비운 두 줄은 서버에게 같은 짝이라
 * 저장을 눌러야 알게 하지 않고 미리 밝히고 막는다.
 */
export const ExternalCodePane = ({
  drafts,
  isLoading,
  partnerEntries,
  isPartnerLoading,
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
}: ExternalCodePaneProps) => {
  const duplicates = duplicateDraftIds(drafts);

  /** 비운 거래처는 「(전체)」다 — 빈 칸으로 두면 화면이 빠뜨린 것으로 읽힌다. */
  const partnerLabel = (value: string): string =>
    value === ''
      ? t.values.allPartners
      : lookupLabel(partnerEntries, Number(value), isPartnerLoading);

  /** 줄 액션의 이름. 유일 제약의 두 값을 붙여야 줄끼리 구분된다. */
  const rowName = (draft: ExternalCodeDraft): string =>
    `${orEmptyMark(draft.externalSystemCode)} ${partnerLabel(draft.partnerId)}`;

  /*
   * 지정 폭의 합은 **456px**(160+200+96)이라 `.wide-table`의 최소 폭(58rem = 928px)
   * 안에 들어간다 — 「거래처」만 폭을 지정하지 않고 남는 폭을 흡수한다.
   * 값이 「코드 · 이름」이라 가장 길고, 접혀도 읽히는 칸이다.
   */
  const columns: Column<ExternalCodeDraft>[] = [
    {
      key: 'externalSystemCode',
      header: t.fields.externalSystem,
      width: '160px',
      render: (row) => orEmptyMark(row.externalSystemCode),
    },
    {
      key: 'partnerId',
      header: t.fields.partner,
      render: (row) => partnerLabel(row.partnerId),
    },
    {
      key: 'externalItemCode',
      header: t.fields.externalItemCode,
      width: '200px',
      render: (row) => orEmptyMark(row.externalItemCode),
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

      {/* 서버가 준 목록에 이미 겹친 줄이 있을 수 있다(옛 자료) — 저장을 눌러야 알게 하지 않는다. */}
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

        {/* 도메인 사유로 막힌 것만 사유를 붙인다 — 「고친 것이 없어서」는 상태이지 사유가 아니다. */}
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
