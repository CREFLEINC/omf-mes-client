import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { DataScopeDraft } from './data-scope-draft';
import { dataScopeBlockMessage, dataScopeBlockReason } from './data-scope-validation';
import { DisabledAction } from './disabled-action';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.usersRoles;

export interface DataScopeFormDialogProps {
  /** 편집 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  draft: DataScopeDraft;
  /** 새 줄인가. 창 제목만 가른다 */
  isNew: boolean;
  /** 중복 판정에 쓰는 나머지 줄. 자기 자신은 초안 키로 걸러진다 */
  otherDrafts: readonly DataScopeDraft[];
  businessUnitOptions: SelectOption[];
  plantOptions: SelectOption[];
  onClose: () => void;
  /** 표에만 반영한다 — **서버 요청이 나가지 않는다** */
  onConfirm: (draft: DataScopeDraft) => void;
}

/**
 * 접근범위 한 줄을 고치는 창.
 *
 * **확인은 저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 최종 목록이 한 번에 나간다 —
 * 밝히지 않으면 사용자가 창을 닫는 순간 저장된 줄 안다.
 *
 * **만들 수 없는 줄은 확인을 비활성 + 사유로 막는다**(배치 규범 4). 두 축이 모두 비었거나
 * 이미 있는 범위와 겹치는 줄은 애초에 만들 수 있는 값이 아니라, 눌러 본 뒤에 알려 줄 일이 아니다.
 * **목 서버가 둘 다 강제하지 않으므로** 화면이 막지 않으면 실서버에 붙기 전까지 드러나지 않는다.
 *
 * 두 선택칸 모두 빈 값을 앞에 둔다 — 여기서 비우는 것은 「고르지 않음」이 아니라
 * **그 축 전체를 고른 것**이다(공유계약 A-7).
 */
export const DataScopeFormDialog = ({
  draft,
  isNew,
  otherDrafts,
  businessUnitOptions,
  plantOptions,
  onClose,
  onConfirm,
}: DataScopeFormDialogProps) => {
  const [values, setValues] = useState<DataScopeDraft>(draft);

  const blockReason = dataScopeBlockReason(values, otherDrafts);

  const change = (patch: Partial<DataScopeDraft>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={isNew ? t.scope.dialog.addTitle : t.scope.dialog.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>

          {blockReason === null ? (
            <Button
              onClick={() => {
                onConfirm(values);
              }}
            >
              {t.scope.actions.confirm}
            </Button>
          ) : (
            <DisabledAction
              variant="filled"
              label={t.scope.actions.confirm}
              reason={dataScopeBlockMessage(blockReason)}
            />
          )}
        </>
      }
    >
      {/* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다. */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.scope.dialog.notSavedNotice}</AlertBanner>
      </div>

      <div className="form-grid">
        {/* 규범 3-2 — 「SYN-BU-01 · 합성 사업부 A」는 트리거 폭에 갇혀 잘린다. */}
        <SelectField
          label={t.scope.fields.businessUnit}
          wide
          options={[{ value: '', label: t.scope.values.all }, ...businessUnitOptions]}
          value={values.businessUnitId}
          onChange={(value) => {
            change({ businessUnitId: value });
          }}
        />

        <SelectField
          label={t.scope.fields.plant}
          wide
          options={[{ value: '', label: t.scope.values.all }, ...plantOptions]}
          value={values.plantId}
          onChange={(value) => {
            change({ plantId: value });
          }}
        />
      </div>
    </Dialog>
  );
};
