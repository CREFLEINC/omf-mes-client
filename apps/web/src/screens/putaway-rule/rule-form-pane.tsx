import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { capacityNoteText, type CapacityNote } from './capacity-note';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import type { RuleFormValues } from './rule-draft';
import type { RuleFormMode } from './rule-validation';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.putawayRule;

export interface RuleFormPaneProps {
  mode: RuleFormMode;
  values: RuleFormValues;
  onChange: (patch: Partial<RuleFormValues>) => void;
  /** 고른 품목의 **이름**. 폼에 내부 번호가 서지 않게 화면이 풀어 넘긴다(`omf-mes#44`). */
  itemLabel: string;
  /** 고른 창고의 이름. 수정에서 잠긴 칸이 값을 보이는 자리다. */
  warehouseLabel: string;
  onOpenItemPicker: () => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  warehouseOptions: SelectOption[];
  warehouseNote?: string;
  warehousePlaceholder?: string;
  /** 위치 선택지. **첫 자리가 빈 값(「창고 전체」)이다** — 그 규칙은 `location-options.ts`가 갖는다. */
  locationChoices: SelectOption[];
  locationNote?: string;
  /** 창고 관리수준이 위치 입력을 잠근 사유. `null`이면 열려 있다(`management-level.ts`). */
  locationDisabledReason: string | null;
  /** 관리수준 값 목록이 아직 정해지지 않았다는 안내. 정해지면 사라진다. */
  locationPendingNote?: string;
  uomOptions: SelectOption[];
  uomNote?: string;
  uomPlaceholder?: string;
  /** 위치 자체 용량과 견준 결과. **경고만 하고 저장을 막지 않는다**(`omf-mes#84`). */
  capacityNote: CapacityNote;
  /** 위치 용량의 단위 이름. 수량만 보이면 크고 작음을 판단할 수 없다. */
  uomLabel: (uomId: number) => string;
  /** 활성 중복을 판정하지 못했다는 안내. **막지 않는다** — 계약이 다시 검사한다. */
  duplicateUnknownNote: string | null;
  /** `null`이면 저장할 수 있다. 값이 있으면 그것이 비활성 사유다(배치 규범 4). */
  saveDisabledReason: string | null;
  isDirty: boolean;
  /**
   * **막을 것 — 전역이다**(공유계약 G-30). 어느 저장이든 나가는 중이면 새 저장을 시작할 수 없다.
   * 두 번째를 내면 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다.
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 대상의 저장인가.** 진행 표시는 자기 저장에만 돈다 —
   * 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 규칙을 「저장 중」이라고 말한다.
   */
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 적치 규칙 **등록·수정 폼**.
 *
 * ## 이 폼이 소유하지 않는 것
 *
 * - **품목·창고(수정)** — 계약의 수정 본문에 두 키가 아예 없다. 「바꾸면 다른 규칙이다」가
 *   계약의 말이며, 잠근 채 그 사실을 문구로 밝힌다.
 * - **사용 여부** — 전용 액션(`:deactivate`·`:activate`)으로만 바뀐다. 입력칸을 두면 저장
 *   본문에 실릴 여지가 생긴다. 그 액션 자체는 다음 회차 몫이다.
 *
 * ## 위치 용량은 보이되 막지 않는다
 *
 * 규칙 용량 옆에 **그 위치가 스스로 가진 용량을 실값으로** 나란히 놓는다 — 숫자 하나로 떠
 * 있으면 그 값이 그 위치에 맞는지 판단할 근거가 화면에 없다. 넘으면 경고하되 **저장은 그대로
 * 된다**(`omf-mes#84` — 어느 쪽이 이기는지 아직 정해지지 않았다).
 *
 * ## 잠금과 진행 표시를 한 축으로 합치지 않는다
 *
 * 막는 것은 **전역**이고 보이는 것은 **대상에만**이다(공유계약 G-30). 한 축으로 합치면
 * 반드시 한쪽이 틀린다 — 남의 저장으로 진행 표시가 돌거나, 내 저장 중에 다른 저장이 시작된다.
 *
 * ## ⚠ 전례와 갈린 자리 — **입력칸까지 잠근다**
 *
 * 전례 `common-code`의 폼들은 나가는 중인 저장에서 **입력칸을 열어 둔다**(「늦게 온 성공이
 * 남의 폼을 덮지 않도록 상위가 대상을 견주므로, 남의 저장을 기다리는 동안 편집을 막을 이유가
 * 없다」). 이 화면은 **일곱 자리를 전부 잠근다.** 베낄 때 되돌리지 않도록 사유를 여기 적는다.
 *
 * 1. **성공 응답이 초안을 다시 세운다**(`screen.tsx`의 `updateWrite.onSuccess`). 열어 두면
 *    저장이 나가는 동안 친 값이 **성공이 도착하는 순간 조용히 덮여 사라진다.** 사용자는
 *    자기가 친 것이 어디로 갔는지 알 방법이 없다 — 이것이 가장 직접적인 사유다.
 * 2. **조항이 그 방향을 직접 요구한다.** G-30은 「막을 것」의 범위를 전역으로 두고 그 안에
 *    **편집**을 명시하며, 다른 대상으로 옮겨도 잠긴 채라고 못 박는다.
 * 3. `common-code`는 **줄이 반복되는 편집 표**라 「A 줄의 저장을 기다리며 B 줄을 친다」가
 *    실제 조작이다. 이 화면은 편집 대상이 한 번에 하나뿐이라 그 조작이 아예 없다.
 * 4. 열어 두어 얻는 것이 없다 — 저장·취소·창 열기가 이미 전역으로 잠기므로 열어 두면
 *    「칠 수는 있는데 저장할 수도 되돌릴 수도 없고, 곧 덮인다」가 된다.
 *
 * ⛔ **되돌리려면 일곱 자리를 함께 본다**(여섯이 아니다) — 위치 칸은
 * `isLocked || locationDisabledReason !== null`이라 `disabled={isLocked}` 문자열 검색에
 * 걸리지 않는다. 일곱 자리 전부에 감지기가 있다(`rule-form-pane.test.tsx`).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RuleFormPane = ({
  mode,
  values,
  onChange,
  itemLabel,
  warehouseLabel,
  onOpenItemPicker,
  fieldErrors,
  banner,
  warehouseOptions,
  warehouseNote,
  warehousePlaceholder,
  locationChoices,
  locationNote,
  locationDisabledReason,
  locationPendingNote,
  uomOptions,
  uomNote,
  uomPlaceholder,
  capacityNote,
  uomLabel,
  duplicateUnknownNote,
  saveDisabledReason,
  isDirty,
  isLocked,
  isSaving,
  onSave,
  onCancel,
}: RuleFormPaneProps) => {
  const itemFieldId = useId();
  const warehouseFieldId = useId();
  const capacityId = useId();
  const priorityId = useId();
  const remarksId = useId();

  const isCreate = mode === 'create';
  const saveLabel = isCreate ? t.actions.submitCreate : messages.common.save;
  const saveLockedReason = isCreate
    ? t.actionReasons.createLockedByOtherSave
    : t.actionReasons.saveLockedByOtherSave;

  /**
   * 저장 자리의 네 상태. **잠금에서 오는 비활성에는 반드시 사유가 붙는다**(배치 규범 4).
   *
   * 순서가 뜻을 정한다 — **내 저장(진행 표시) → 남의 저장(잠금 사유) → 막힌 사유 → 열림**.
   * 내 저장을 앞에 두지 않으면 저장을 누른 순간 「앞선 저장을 기다리는 중」이라는, 자기 자신을
   * 가리키는 사유가 선다.
   */
  const saveAction = (): ReactNode => {
    if (isSaving) {
      return (
        <Button disabled loading>
          {saveLabel}
        </Button>
      );
    }

    if (isLocked)
      return <DisabledAction variant="filled" label={saveLabel} reason={saveLockedReason} />;

    if (saveDisabledReason !== null) {
      return <DisabledAction variant="filled" label={saveLabel} reason={saveDisabledReason} />;
    }

    return <Button onClick={onSave}>{saveLabel}</Button>;
  };

  return (
    <section className="pane" aria-label={t.panes.form}>
      {banner}

      <div className="form-grid">
        {/*
         * 품목은 **찾아서 고른다** — 수천 건일 수 있어 펼침 목록에 담을 수 없고, 번호를
         * 입력받으면 내부 식별자를 사용자에게 내는 것이다(`omf-mes#44`).
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={itemFieldId} label={t.fields.item} required={isCreate} />
          <output id={itemFieldId}>{itemLabel}</output>
          {isCreate && (
            <Button variant="outlined" disabled={isLocked} onClick={onOpenItemPicker}>
              {t.actions.openItemPicker}
            </Button>
          )}
          {fieldErrors.itemId !== undefined && (
            <span className="field-error">{fieldErrors.itemId}</span>
          )}
        </div>

        {/* 창고는 **등록에서만** 고른다. 수정에서는 값 표기로 두고 잠긴 사유를 아래에서 밝힌다. */}
        {isCreate ? (
          <SelectField
            wide
            required
            label={t.fields.warehouse}
            options={warehouseOptions}
            value={values.warehouseId}
            note={warehouseNote}
            error={fieldErrors.warehouseId}
            placeholder={warehousePlaceholder}
            disabled={isLocked}
            onChange={(value) => {
              onChange({ warehouseId: value });
            }}
          />
        ) : (
          <div className="field-cell">
            <FieldLabel htmlFor={warehouseFieldId} label={t.fields.warehouse} />
            <output id={warehouseFieldId}>{warehouseLabel}</output>
          </div>
        )}

        <SelectField
          wide
          label={t.fields.location}
          options={locationChoices}
          value={values.locationId}
          note={locationNote}
          error={fieldErrors.locationId}
          disabled={isLocked || locationDisabledReason !== null}
          disabledReason={locationDisabledReason ?? undefined}
          onChange={(value) => {
            onChange({ locationId: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={capacityId} label={t.fields.capacity} required />
          <TextField
            id={capacityId}
            value={values.capacityQty}
            /* 숫자 자판을 띄우되 형식 판정은 화면이 한다 — 브라우저마다 허용 글자가 다르다. */
            inputMode="decimal"
            error={fieldErrors.capacityQty}
            disabled={isLocked}
            aria-required
            onChange={(event) => {
              onChange({ capacityQty: event.target.value });
            }}
          />
        </div>

        <SelectField
          wide
          required
          label={t.fields.uom}
          options={uomOptions}
          value={values.uomId}
          note={uomNote}
          error={fieldErrors.uomId}
          placeholder={uomPlaceholder}
          disabled={isLocked}
          onChange={(value) => {
            onChange({ uomId: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={priorityId} label={t.fields.priorityNo} required />
          <TextField
            id={priorityId}
            value={values.priorityNo}
            inputMode="numeric"
            error={fieldErrors.priorityNo}
            disabled={isLocked}
            aria-required
            onChange={(event) => {
              onChange({ priorityNo: event.target.value });
            }}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={remarksId} label={t.fields.remarks} />
          <TextField
            id={remarksId}
            value={values.remarks}
            error={fieldErrors.remarks}
            disabled={isLocked}
            onChange={(event) => {
              onChange({ remarks: event.target.value });
            }}
          />
        </div>
      </div>

      {/* 수정에서 잠근 두 칸의 사유. 잠근 채 말하지 않으면 사용자에게 고장으로 읽힌다. */}
      {!isCreate && <p className="field-note">{t.notes.itemFixed}</p>}

      {/* 비운 위치는 **확정된 뜻**이다 — 말하지 않으면 「고르다 만 것」으로 읽힌다. */}
      <p className="field-note">{t.notes.locationEmptyMeansWarehouseWide}</p>
      {locationPendingNote !== undefined && <p className="field-note">{locationPendingNote}</p>}

      {/*
       * 위치 자체 용량 — **실값을 나란히 보인다.** 견줄 값이 없으면 아무 말도 하지 않는다
       * (없는 값으로 경고를 지어내지 않는다).
       */}
      {capacityNote.kind !== 'none' && (
        <p className="field-note">
          {t.notes.locationCapacity(
            String(capacityNote.capacity.capacityQty),
            uomLabel(capacityNote.capacity.capacityUomId),
          )}
        </p>
      )}
      {capacityNoteText(capacityNote) !== undefined && (
        <p className="field-note">{capacityNoteText(capacityNote)}</p>
      )}

      {/* 우선순위 방향은 **데이터에 적혀 있지 않고 계약이 정한 것**이라 화면이 말해야 한다. */}
      <p className="field-note">{t.notes.priorityDirection}</p>

      {duplicateUnknownNote !== null && <p className="field-note">{duplicateUnknownNote}</p>}

      {/*
       * ⛔ **잠긴 이유(`notes.savingLock`)는 여기 서지 않는다** — 화면 수준이 그 자리다.
       *
       * G-30은 사유를 **상시** 보이라고 한다. 이 구획은 대상이 풀리면 통째로 닫히는데
       * (뒤로가기·주소 직접 편집) 잠금은 요청이 끝날 때까지 남는다 — 사유를 여기 두면
       * **폼이 닫힌 채 잠긴 갈래**에서 잠긴 이유가 화면 어디에도 없다. 전환(끄기·켜기)은
       * 초안이 서기 전에도 시작될 수 있어 그 갈래가 흔해진다.
       *
       * 이 구획이 갖는 것은 **컨트롤별 사유**뿐이다(저장·취소) — 그것은 그 버튼 옆에 서야 한다.
       */}

      <div className="form-actions">
        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 뜻이 있다.
         */}
        {isLocked ? (
          <DisabledAction
            label={messages.common.cancel}
            reason={t.actionReasons.cancelLockedByOtherSave}
          />
        ) : (
          <Button variant="outlined" disabled={!isCreate && !isDirty} onClick={onCancel}>
            {messages.common.cancel}
          </Button>
        )}

        {saveAction()}
      </div>
    </section>
  );
};
