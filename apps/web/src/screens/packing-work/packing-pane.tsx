import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { RefObject } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import { isMixedLot, totalQty } from './contents';
import type { CodeLabels } from './queries';
import type { CodeValue, HandlingUnit, PackingDraft } from './types';

const t = messages.packingWork;

/** 「상위 없음」을 고르는 자리. 빈 문자열은 Select 의 「고르지 않음」과 구분되지 않는다. */
const NO_PARENT = 'none';

export interface PackingPaneProps {
  draft: PackingDraft;
  unitTypes: readonly CodeValue[];
  unitTypesFailed: boolean;
  parents: readonly HandlingUnit[];
  parentsFailed: boolean;
  /** 내용물을 담기 시작하면 유형·상위를 바꿀 수 없다 — 서버에 이미 만들어진 값이다. */
  locked: boolean;
  onTypeChange: (code: string) => void;
  onParentChange: (parentId: number | null) => void;
  onConfirm: () => void;
  /** 품목코드·단위 — 담은 줄에 붙는다(스펙 §3 · §4-B). */
  labels: CodeLabels;
  /** 「담기」를 눌렀는데 유형이 비어 있을 때 이 칸에 붙는 사유. */
  typeError: string | null;
  /** 사유를 붙이면서 이 칸으로 데려가기 위한 자리. */
  typeRef: RefObject<HTMLButtonElement | null>;
  /** 확정을 누를 수 있는가. **사유 문장과 다른 축이다** — 말하지 않아도 막는다(스펙 §6). */
  canConfirm: boolean;
  /** 확정이 막혀 있으면서 «화면 어디에도 없는» 사유. 없으면 `null` */
  blockedReason: string | null;
  isConfirming: boolean;
  /**
   * 담다가 그만둘 수 있는가 — **확정 전에만 열린다**(스펙 §5-7).
   *
   * ⭐ 호출이 둘로 갈리며 「번호는 있고 내용물은 없는」 상태가 생겼다. 그대로 두면 빈 포장이
   * 쌓이므로 거두는 자리가 필요하다.
   */
  canDiscard: boolean;
  isDiscarding: boolean;
  onDiscard: () => void;
}

/**
 * 우단 《포장 단위》·《내용물》.
 *
 * ⭐ **포장 번호는 구획 제목 옆에 붙는다**(스펙 §3 — 「《포장 단위》 HU-2026-0804-0007」).
 * 번호를 별도 줄로 크게 세우면 그 아래 「유형」이 오른쪽 「상위」와 어긋나 보인다(실측).
 *
 * ⭐ **유형·상위는 위아래 두 줄이다**(스펙 §3) — 라벨이 왼쪽, 값이 오른쪽에 선다. 좌우로
 * 늘어놓으면 스펙의 읽는 순서가 사라지고 값 칸이 절반으로 좁아진다.
 */
export const PackingPane = ({
  draft,
  unitTypes,
  unitTypesFailed,
  parents,
  parentsFailed,
  locked,
  typeError,
  canConfirm,
  typeRef,
  onTypeChange,
  onParentChange,
  onConfirm,
  labels,
  blockedReason,
  isConfirming,
  canDiscard,
  isDiscarding,
  onDiscard,
}: PackingPaneProps) => {
  /*
   * ⭐ **수량에는 단위를 붙인다**(스펙 §3 — `100 EA`). 「100」과 「100 EA」는 다른 값이라,
   * 단위 없이 숫자만 두면 읽는 사람이 자기가 아는 단위로 채워 읽는다.
   *
   * ⚠ 단위 이름이 아직 오지 않았으면 **숫자만 보인다** — 지어낸 단위를 붙이지 않는다.
   */
  const withUom = (qty: number, uomId: number): string => {
    const uomCode = labels.uomCodeOf(uomId);

    return uomCode === null ? String(qty) : `${String(qty)} ${uomCode}`;
  };

  /** 담은 것이 모두 같은 단위일 때만 합계에 단위를 붙인다 — 섞였으면 더한 값의 단위가 없다. */
  const totalUomId = ((): number | null => {
    const ids = new Set(draft.lines.map((line) => line.uomId));

    return ids.size === 1 ? ([...ids][0] ?? null) : null;
  })();

  return (
    <>
      <div className="pack-work-unit-fields">
        <label className="pack-work-field">
          <span className="pack-work-field-label">{t.unit.typeLabel}</span>
          <Select
            ref={typeRef}
            invalid={typeError !== null}
            options={unitTypes.map((value) => ({
              value: value.code,
              label: value.nameKo ?? value.codeName,
            }))}
            value={draft.handlingUnitTypeCode}
            placeholder={t.unit.typePlaceholder}
            size="xl"
            aria-label={t.unit.typeLabel}
            disabled={locked || unitTypesFailed}
            onChange={onTypeChange}
          />
        </label>

        <label className="pack-work-field">
          <span className="pack-work-field-label">{t.unit.parentLabel}</span>
          <Select
            options={[
              { value: NO_PARENT, label: t.unit.parentNone },
              ...parents.map((unit) => ({
                value: String(unit.handlingUnitId),
                label: unit.handlingUnitNo,
              })),
            ]}
            /*
             * ⚠ **고르기 전에는 비워 둔다**(사용자 지시 2026-09-07). 스펙 §3 도면은 이 자리를
             * 「(없음)」으로 그리지만, 고른 적 없는 칸이 값을 고른 것처럼 서면 「없음을 골랐다」와
             * 구분되지 않는다. 목록에는 「(없음)」을 그대로 두어 **고른 상위를 무를 길**은 남긴다.
             */
            value={draft.parentHandlingUnitId === null ? null : String(draft.parentHandlingUnitId)}
            placeholder=""
            size="xl"
            aria-label={t.unit.parentLabel}
            disabled={locked || parentsFailed}
            onChange={(value) => {
              onParentChange(value === NO_PARENT ? null : Number(value));
            }}
          />
        </label>
      </div>

      {typeError !== null && <p className="field-error">{typeError}</p>}
      {unitTypesFailed && <p className="field-error">{t.unit.typeLoadFailed}</p>}
      {parentsFailed && <p className="field-error">{t.unit.parentLoadFailed}</p>}

      <h3 className="pane-title">{t.contents.sectionLabel}</h3>
      {/*
       * ⛔ **열 머리글을 두지 않는다.** 스펙 §3 도면의 내용물은 `✅ LOT-…0031  ABC-123  100 EA`
       *   형태의 목록이고 「LOT·품목·수량」 머리줄이 없다(사용자 지적 2026-09-10). 세로 예산이
       *   빠듯한 화면이라 그 한 줄이 담은 줄 하나만큼을 가져간다.
       */}
      {draft.lines.length === 0 ? (
        <p className="field-note pack-work-content-empty">{t.contents.empty}</p>
      ) : (
        <>
          <ul className="pack-work-contents" aria-label={t.contents.sectionLabel}>
            {draft.lines.map((line) => (
              <li className="pack-work-content-line" key={`${String(line.lotId)}-${String(line.itemId)}`}>
                {/* 담긴 줄임을 나타내는 표식 — 스펙 도면의 ✅. 읽어 주는 도구에는 값이 아니다. */}
                <span className="pack-work-content-mark" aria-hidden="true">
                  ✓
                </span>
                <span className="pack-work-lot-no" title={line.lotNo}>
                  {line.lotNo}
                </span>
                <span className="pack-work-content-item">
                  {labels.itemCodeOf(line.itemId) ?? t.contents.unknownCode}
                </span>
                <span className="pack-work-content-qty">{withUom(line.qty, line.uomId)}</span>
              </li>
            ))}
          </ul>
          {/*
           * ⭐ **합계는 구분선 아래 한 줄이다**(스펙 §3). 담은 것이 여러 단위로 섞이면 더한 값의
           *   단위가 없으므로 숫자만 낸다 — 지어낸 단위를 붙이지 않는다.
           */}
          <p className="pack-work-content-total">
            <span>{t.contents.totalLabel}</span>
            <span>
              {totalUomId === null
                ? String(totalQty(draft.lines))
                : withUom(totalQty(draft.lines), totalUomId)}
            </span>
          </p>
        </>
      )}

      {/*
        혼적 — **막지 않는다**(스펙 §5-5). 추적은 내용물 행으로 남는다. 여기서 막으면 실물로는
        가능한 포장을 화면이 거부하게 된다.
      */}
      {/*
        ⛔ **본문을 덧대지 않는다.** 스펙 §3 이 그린 것은 「⚠ 한 포장에 여러 LOT 이 섞였습니다」
        한 줄이고, 「막지 않는다」는 것은 **막지 않는 것으로** 이미 말한다.
      */}
      {isMixedLot(draft.lines) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.contents.mixedTitle} />
        </div>
      )}

      <div className="pack-work-actions">
        {/*
         * ⭐ **취소는 확정 옆에 선다** — 담던 것을 거두는 조작이라 담는 자리에 있어야 한다.
         * ⛔ **확정과 같은 무게로 그리지 않는다** — 되돌리는 쪽이 눈에 먼저 들어오면 안 된다.
         */}
        <Button
          type="button"
          variant="outlined"
          size="xl"
          disabled={!canDiscard || isDiscarding}
          onClick={onDiscard}
        >
          {t.unit.discardAction}
        </Button>
        <Button
          type="button"
          variant="filled"
          size="xl"
          className={popTouchClass('destructive')}
          disabled={!canConfirm || isConfirming}
          onClick={onConfirm}
        >
          {isConfirming ? t.confirm.submitting : t.confirm.submit}
        </Button>
        {blockedReason !== null && <p className="field-note">{blockedReason}</p>}
      </div>
    </>
  );
};
