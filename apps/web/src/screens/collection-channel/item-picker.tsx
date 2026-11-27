import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import type { CodeOption } from './options';
import { SelectField } from './select-field';
import type { InspectionItemSpec, InspectionPlan, InspectionPlanVersion } from './types';
import { judgeUnit, type UnitMatch } from './unit-match';

const t = messages.collectionChannel;

/** 한 칸이 알아야 하는 것 — 고를 값과 그 목록의 형편. */
export interface PickerSlot<TItem> {
  items: TItem[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
}

export interface ItemPickerProps {
  /** 지금 이어 둔 검사 항목. `null` 이면 미매핑이고 그때 값은 버려진다 */
  inspectionItemId: number | null;
  onChangeItem: (inspectionItemId: number | null) => void;
  inspectionPlanId: number | null;
  onChangePlan: (inspectionPlanId: number | null) => void;
  inspectionPlanVersionId: number | null;
  onChangeVersion: (inspectionPlanVersionId: number | null) => void;
  plans: PickerSlot<InspectionPlan>;
  versions: PickerSlot<InspectionPlanVersion>;
  specs: PickerSlot<InspectionItemSpec>;
  /** 이 채널이 받는 단위. 검사 항목의 단위와 견주는 한쪽이다 */
  channelUnitCode: string;
  /** 단위 식별자를 코드로 옮기는 표. 옮기지 못하는 값이 있다 */
  uomCodeById: ReadonlyMap<number, string>;
}

/** 숫자 식별자를 고르는 칸의 값으로 옮긴다. 고르지 않았으면 빈 문자열이다. */
export const asOptionValue = (id: number | null): string => (id === null ? '' : String(id));

/**
 * 고른 값을 식별자로 되돌린다. **읽을 수 없으면 고르지 않은 것으로 다룬다.**
 *
 * ⛔ **`NaN` 을 식별자로 삼지 않는다** — 그대로 두면 서버로 나가 400 이 되고, 화면에는
 * 「저장하지 못했습니다」만 남아 **무엇이 잘못됐는지 아무도 모른다.** 고르지 않은 것으로
 * 다루면 적어도 「이어 두지 않았다」는 사실이 창에 그대로 보인다.
 */
export const asId = (value: string): number | null => {
  if (value === '') return null;
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : null;
};

/**
 * 칸 하나가 낼 보조 문구. **실패가 잘림보다, 잘림이 잠긴 사유보다 앞선다** —
 * 아무것도 못 받은 것이 가장 큰 사실이다.
 */
const slotNote = (
  slot: PickerSlot<unknown>,
  failedMessage: string,
  emptyMessage?: string,
): string | undefined => {
  if (slot.isError) return failedMessage;
  if (slot.truncated) return t.optionsTruncated;
  if (!slot.isLoading && slot.items.length === 0) return emptyMessage;

  return undefined;
};

/**
 * 지금 어떤 상태인지 한 줄. **셋을 가른다** — 위 표를 참고.
 */
const stateNote = (
  inspectionItemId: number | null,
  pickedSpec: InspectionItemSpec | null,
): string => {
  if (inspectionItemId === null) return t.itemPicker.unmapped;

  return pickedSpec === null
    ? t.itemPicker.mappedUnknown
    : t.itemPicker.mappedKnown(pickedSpec.inspectionItemName);
};

const unitSlot = (judgment: UnitMatch): ReactNode => {
  switch (judgment.kind) {
    case 'mismatch':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.unitMatch.mismatchTitle}>
            {t.unitMatch.mismatch(judgment.channelUnitCode, judgment.itemUnitCode)}
          </AlertBanner>
        </div>
      );
    case 'unknown':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.unitMatch.unknown}</AlertBanner>
        </div>
      );
    case 'match':
    case 'notComparable':
      return null;
  }
};

/**
 * 채널을 검사 항목에 잇는 세 칸.
 *
 * ⚠ **계약에 검사 항목의 전체 목록이 없다.** 항목은 검사기준의 버전에 속하므로 기준 →
 * 버전 → 항목을 차례로 좁혀야 닿는다. 그래서 세 칸이다.
 *
 * ⛔ **이어 둔 항목의 이름을 지어내지 않는다.** 채널 응답에는 식별자만 오고 그것으로 이름을
 * 되찾는 길이 계약에 없다 — 「이어져 있다」까지만 말하고, 확인하려면 다시 고르라고 안내한다.
 */
export const ItemPicker = ({
  inspectionItemId,
  onChangeItem,
  inspectionPlanId,
  onChangePlan,
  inspectionPlanVersionId,
  onChangeVersion,
  plans,
  versions,
  specs,
  channelUnitCode,
  uomCodeById,
}: ItemPickerProps) => {
  const planOptions: CodeOption[] = plans.items.map((plan) => ({
    value: String(plan.inspectionPlanId),
    label: `${plan.inspectionPlanCode} · ${plan.inspectionPlanName}`,
  }));

  const versionOptions: CodeOption[] = versions.items.map((version) => ({
    value: String(version.inspectionPlanVersionId),
    /* 상태 값 목록을 받지 않는다 — 코드를 그대로 둔다(공유계약 G-9). */
    label: t.itemPicker.versionOption(version.planVersion, version.statusCode),
  }));

  const itemOptions: CodeOption[] = specs.items.map((spec) => ({
    value: String(spec.inspectionItemSpecId),
    label: `${spec.inspectionItemCode} · ${spec.inspectionItemName}`,
  }));

  /* 고른 항목을 «지금 목록»에서 찾는다. 못 찾으면 이름을 아는 것이 아니다. */
  const pickedSpec =
    specs.items.find((spec) => spec.inspectionItemSpecId === inspectionItemId) ?? null;

  /*
   * ⭐ **아래 칸은 위 칸을 골랐을 때만 나타나고, 나타나면 커서가 그리로 간다**(#360). 칸이 그려진 뒤에야 옮길 수
   * 있어 옮길 곳을 적어 두고 그린 뒤에 옮긴다. 위 칸을 «다른 값으로» 바꿀 때는 칸이 이미 있어 옮기지 않는다.
   */
  const versionSelectId = useId();
  const itemSelectId = useId();
  const pendingFocusId = useRef<string | null>(null);

  useEffect(() => {
    const targetId = pendingFocusId.current;
    if (targetId === null) return;
    const target = document.getElementById(targetId);
    if (target === null) return;
    pendingFocusId.current = null;
    target.focus();
  });

  const changePlan = (nextPlanId: number | null): void => {
    if (inspectionPlanId === null && nextPlanId !== null) pendingFocusId.current = versionSelectId;
    onChangePlan(nextPlanId);
  };

  const changeVersion = (nextVersionId: number | null): void => {
    if (inspectionPlanVersionId === null && nextVersionId !== null) {
      pendingFocusId.current = itemSelectId;
    }
    onChangeVersion(nextVersionId);
  };

  const showsVersion = inspectionPlanId !== null;
  const showsItem = inspectionPlanVersionId !== null;
  /* 끊을 것이 있을 때만 [연결 해제] 를 둔다 — 비어 있으면 누를 까닭이 없다. */
  const showsUnmap = inspectionItemId !== null;

  return (
    <div className="form-grid-full">
      {/* ⓘ 의 문장이 묶음 이름에 섞이지 않게 이름은 `aria-label` 로 준다(조건 묶음과 같다). */}
      <fieldset className="picker-group" aria-label={t.itemPicker.legend}>
        <legend className="field-label">
          <span className="info-label">
            {t.itemPicker.legend}
            <InfoTip text={t.itemPicker.legendInfo} />
          </span>
        </legend>

        {/*
         * ⭐ **지금 어떤 상태인지를 먼저 말한다 — 그리고 그것은 «셋»이다**(공유계약 G-9).
         *
         * | 사태 | 무엇을 말하나 |
         * | --- | --- |
         * | 이어 둔 데가 없다 | 「미지정」 — 값이 버려진다는 뜻은 묶음 이름 옆 ⓘ 로 |
         * | 이어져 있는데 **무엇인지 못 찾았다** | 확인하려면 아래에서 고르라 |
         * | 이어져 있고 **이름을 안다** | 어느 항목으로 가는지 |
         *
         * ⛔ 아래에서 골라 이름을 알게 된 뒤에도 「확인할 수 없다」고 하면, **바로 옆에
         * 이름을 적어 두고 모른다고 말하는 셈**이 된다(브라우저 확인에서 실제로 그렇게 보였다).
         */}
        <p className="field-note">{stateNote(inspectionItemId, pickedSpec)}</p>

        {/*
         * ⛔ **경고를 고르는 칸 «아래»에 두지 않는다.** 창 본문이 스크롤되는 자리라
         * 아래에 두면 방금 고른 사람에게 접혀 있고, 접힌 경고는 없는 경고다
         * (브라우저 확인 실측 — 노란 띠가 바닥에 잘려 있었다).
         */}
        {unitSlot(judgeUnit(channelUnitCode, pickedSpec, uomCodeById))}

        <div className="form-grid">
          <SelectField
            label={t.itemPicker.planLabel}
            options={planOptions}
            value={asOptionValue(inspectionPlanId)}
            onChange={(value) => changePlan(asId(value))}
            placeholder={t.itemPicker.planPlaceholder}
            note={slotNote(plans, t.itemPicker.plansLoadFailed)}
          />

          {/* 칸이 빠져도 행 배치는 그대로 — 빈자리로 칸 자리를 지킨다(검사 기준 | 버전 / 검사 항목 | 연결 해제). */}
          {showsVersion ? (
            <SelectField
              id={versionSelectId}
              label={t.itemPicker.versionLabel}
              options={versionOptions}
              value={asOptionValue(inspectionPlanVersionId)}
              onChange={(value) => changeVersion(asId(value))}
              placeholder={t.itemPicker.versionPlaceholder}
              note={slotNote(versions, t.itemPicker.versionsLoadFailed, t.itemPicker.noVersions)}
            />
          ) : (
            <div className="field-cell" aria-hidden="true" />
          )}

          {(showsItem || showsUnmap) &&
            (showsItem ? (
              <SelectField
                id={itemSelectId}
                label={t.itemPicker.itemLabel}
                options={itemOptions}
                value={asOptionValue(inspectionItemId)}
                onChange={(value) => onChangeItem(asId(value))}
                placeholder={t.itemPicker.itemPlaceholder}
                note={slotNote(specs, t.itemPicker.itemsLoadFailed, t.itemPicker.noItems)}
              />
            ) : (
              <div className="field-cell" aria-hidden="true" />
            ))}

          {/* 잇는 것과 끊는 것은 뜻이 반대다 — 끊는 자리를 따로 둔다. */}
          {showsUnmap && (
            <div className="field-cell field-cell-unlabeled">
              <Button variant="outlined" onClick={() => onChangeItem(null)}>
                {t.itemPicker.unmapAction}
              </Button>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
};
