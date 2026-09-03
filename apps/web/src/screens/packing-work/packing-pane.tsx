import { AlertBanner, Button, Select, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { isMixedLot, totalQty } from './contents';
import type { CodeLabels } from './queries';
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
  /** 품목코드·단위 — 담은 줄에 붙는다(스펙 §3 · §4-B). */
  labels: CodeLabels;
  /** 확정이 막혀 있으면 그 사유. 없으면 `null` */
  blockedReason: string | null;
  isConfirming: boolean;
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
  onTypeChange,
  onParentChange,
  onConfirm,
  labels,
  blockedReason,
  isConfirming,
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

  const columns: Column<PackingLine>[] = [
    {
      key: 'lotNo',
      header: t.contents.lotColumn,
      render: (line) => (
        <span className="pack-work-lot-no" title={line.lotNo}>
          {line.lotNo}
        </span>
      ),
    },
    {
      key: 'itemCode',
      header: t.contents.itemColumn,
      width: '132px',
      render: (line) => labels.itemCodeOf(line.itemId) ?? t.contents.unknownCode,
    },
    {
      key: 'qty',
      header: t.contents.qtyColumn,
      align: 'end',
      width: '120px',
      render: (line) => withUom(line.qty, line.uomId),
    },
  ];

  return (
    <>
      <div className="pack-work-unit-fields">
        <label className="pack-work-field">
          <span className="pack-work-field-label">{t.unit.typeLabel}</span>
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
            value={
              draft.parentHandlingUnitId === null ? NO_PARENT : String(draft.parentHandlingUnitId)
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

      {draft.handlingUnit === null && <p className="field-note">{t.unit.numberPending}</p>}
      {unitTypesFailed && <p className="field-error">{t.unit.typeLoadFailed}</p>}
      {parentsFailed && <p className="field-error">{t.unit.parentLoadFailed}</p>}
      {locked && <p className="field-note">{t.unit.lockedNotice}</p>}

      <h3 className="pane-title">{t.contents.sectionLabel}</h3>
      <Table
        className="pack-work-content-table"
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
                  /* LOT·품목 두 열을 묶어 합계 라벨을 놓는다 — 열 수가 어긋나면 값이 밀린다. */
                  { key: 'label', content: t.contents.totalLabel, colSpan: 2, emphasis: true },
                  {
                    key: 'total',
                    content:
                      totalUomId === null
                        ? String(totalQty(draft.lines))
                        : withUom(totalQty(draft.lines), totalUomId),
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

      <div className="pack-work-actions">
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
