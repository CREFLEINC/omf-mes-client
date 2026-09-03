import { AlertBanner, Button, Select, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { isMixedLot, totalQty } from './contents';
import type { CodeValue, HandlingUnit, PackingDraft, PackingLine } from './types';

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
  /** 확정이 막혀 있으면 그 사유. 없으면 `null` */
  blockedReason: string | null;
  isConfirming: boolean;
}

/**
 * 우단 《포장 단위》·《내용물》.
 *
 * ⭐ **포장 번호는 서버가 매긴 뒤에야 있다**(스펙 §4-A 「자동」). 첫 내용물을 담을 때 만들어지므로
 * 그전에는 자리만 두고 「언제 부여되는가」를 말한다 — 빈 자리만 두면 번호가 없는 것인지 아직
 * 안 온 것인지 알 수 없다.
 */
export const PackingPane = ({
  draft,
  unitTypes,
  unitTypesFailed,
  parents,
  parentsFailed,
  locked,
  onTypeChange,
  onParentChange,
  onConfirm,
  blockedReason,
  isConfirming,
}: PackingPaneProps) => {
  const columns: Column<PackingLine>[] = [
    {
      key: 'lotNo',
      header: t.contents.lotColumn,
      render: (line) => (
        <span className="packing-lot-no" title={line.lotNo}>
          {line.lotNo}
        </span>
      ),
    },
    {
      key: 'qty',
      header: t.contents.qtyColumn,
      align: 'end',
      width: '96px',
      render: (line) => String(line.qty),
    },
  ];

  return (
    <>
      <p className="packing-unit-no">
        {draft.handlingUnit === null
          ? t.unit.numberPending
          : draft.handlingUnit.handlingUnitNo}
      </p>

      <div className="packing-unit-fields">
        <label className="packing-field">
          <span className="packing-field-label">{t.unit.typeLabel}</span>
          <Select
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

        <label className="packing-field">
          <span className="packing-field-label">{t.unit.parentLabel}</span>
          <Select
            options={[
              { value: NO_PARENT, label: t.unit.parentNone },
              ...parents.map((unit) => ({
                value: String(unit.handlingUnitId),
                label: unit.handlingUnitNo,
              })),
            ]}
            value={
              draft.parentHandlingUnitId === null
                ? NO_PARENT
                : String(draft.parentHandlingUnitId)
            }
            size="xl"
            aria-label={t.unit.parentLabel}
            disabled={locked || parentsFailed}
            onChange={(value) => {
              onParentChange(value === NO_PARENT ? null : Number(value));
            }}
          />
        </label>
      </div>

      {unitTypesFailed && <p className="field-error">{t.unit.typeLoadFailed}</p>}
      {parentsFailed && <p className="field-error">{t.unit.parentLoadFailed}</p>}
      {locked && <p className="field-note">{t.unit.lockedNotice}</p>}

      <h3 className="pane-title">{t.contents.sectionLabel}</h3>
      <Table
        className="packing-content-table"
        columns={columns}
        rows={[...draft.lines]}
        getRowId={(line) => `${String(line.lotId)}-${String(line.itemId)}`}
        density="comfortable"
        empty={t.contents.empty}
        summaryRows={
          draft.lines.length === 0
            ? undefined
            : [
                [
                  { key: 'label', content: t.contents.totalLabel, emphasis: true },
                  {
                    key: 'total',
                    content: String(totalQty(draft.lines)),
                    align: 'end',
                    emphasis: true,
                  },
                ],
              ]
        }
      />

      {/*
        혼적 — **막지 않는다**(스펙 §5-5). 추적은 내용물 행으로 남는다. 여기서 막으면 실물로는
        가능한 포장을 화면이 거부하게 된다.
      */}
      {isMixedLot(draft.lines) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.contents.mixedTitle}>
            {t.contents.mixedBody}
          </AlertBanner>
        </div>
      )}

      <div className="packing-actions">
        <Button
          type="button"
          variant="filled"
          size="xl"
          className={popTouchClass('destructive')}
          disabled={blockedReason !== null || isConfirming}
          onClick={onConfirm}
        >
          {isConfirming ? t.confirm.submitting : t.confirm.submit}
        </Button>
        {blockedReason !== null && <p className="field-note">{blockedReason}</p>}
      </div>
    </>
  );
};
