import { Button, Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { SourceLineView, SourceReceiptView } from './types';

const t = messages.poRegister;

export interface SourceReceiptPaneProps {
  receipt: SourceReceiptView;
  lines: SourceLineView[];
  /** 대상으로 확정된 줄. 라인이 한 줄뿐이면 고르지 않아도 확정된다(계획 결정 4) */
  chosenLineId: number | null;
  supplierLookup: ReferenceSource;
  /**
   * 사업부 — **이 구획이 이름으로 그리지 않는 유일한 참조**다. 그래도 받는 이유는 복구 수단이
   * 이 화면에 한 곳뿐이고(다섯을 함께 되살린다), 사업부는 승계 원천이 없는 유일한 필수 값이라
   * 그 실패에 복구 버튼이 서지 않으면 등록이 영구 잠기기 때문이다.
   *
   * 「참조 → 보이는 자리 → 복구」를 자리마다 맞추는 전례 규율과는 여기서 어긋난다 —
   * 발주 정보 구획이 자기 재시도 수단을 갖게 되면 그때 그쪽으로 옮긴다.
   */
  businessUnitLookup: ReferenceSource;
  plantLookup: ReferenceSource;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  /**
   * 대상을 바꾸는 길이 잠겼는가.
   *
   * 나가는 중에 대상이 바뀌면 도착한 결과가 **다른 맥락에 놓인다.** 이미 등록한 뒤에 바뀌면
   * 만들어진 전표를 보이는 화면이 다른 초과분을 가리킨다 — 두 경우 모두 잠근다.
   */
  isLocked?: boolean;
  /** 잠긴 사유. **잠갔으면 반드시 함께 온다** — 사유 없는 잠금은 죽은 버튼과 구분되지 않는다 */
  lockedReason?: string;
  onChoose: (inboundReceiptLineId: number) => void;
  onRetryReferences: () => void;
}

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

/**
 * 넘어온 초과분 — **읽기 전용 구획이다.**
 *
 * 여기서 고치는 것은 없다. 무엇을 정산하는지 밝히고, 라인이 여럿이면 **어느 줄을 승계할지만**
 * 고르게 한다. 값을 고칠 수 있게 보이면 사용자가 이 화면에서 입하를 고칠 수 있다고 읽는다.
 *
 * **「이것이 초과분인가」를 판정하지 않는다**(계획 결정 3). 계약이 그 사실을 내려주지 않으므로
 * 표식·거르기·경고 어느 것도 지어내지 않고, 넘어온 전표를 그대로 보인다.
 *
 * **줄을 자동으로 고르지 않는다.** 여러 줄 중 첫 줄을 화면이 고르면 사용자가 확인하지 않은
 * 선택이 되돌릴 수 없는 전표에 실린다.
 */
export const SourceReceiptPane = ({
  receipt,
  lines,
  chosenLineId,
  supplierLookup,
  businessUnitLookup,
  plantLookup,
  itemLookup,
  uomLookup,
  isLocked = false,
  lockedReason,
  onChoose,
  onRetryReferences,
}: SourceReceiptPaneProps) => {
  /** 고를 것이 있는가. 한 줄뿐이면 고르는 버튼을 두지 않는다 — 누를 이유가 없는 버튼이다. */
  const isChoosable = lines.length > 1;

  /**
   * 잠긴 사유가 서는 자리. **줄마다 나누지 않는다** — 사정이 표 전체에 하나뿐이라
   * 줄마다 사본을 두면 같은 사실이 줄 수만큼 읽힌다(줄 단위로 갈리는 오류와 다른 자리다).
   */
  const lockedReasonId = useId();

  const summary: SummaryItem[] = [
    { key: 'inboundReceiptNo', label: t.source.inboundReceiptNo, value: receipt.inboundReceiptNo },
    {
      key: 'supplier',
      label: t.source.supplier,
      value: describeReference(toReference(supplierLookup, receipt.supplierId)),
    },
    {
      key: 'plant',
      label: t.source.plant,
      value: describeReference(toReference(plantLookup, receipt.plantId)),
    },
    {
      key: 'status',
      label: t.source.status,
      /* 값으로 분기하지 않고 서버가 준 코드를 그대로 보인다(공유계약 G-2). */
      value: (
        <Chip variant="status" size="sm">
          {receipt.statusCode}
        </Chip>
      ),
    },
  ];

  /**
   * 열 폭. 지정 합은 552px이고 흡수 열(품목)이 나머지를 가져간다 —
   * `.wide-table`의 하한(58rem = 928px) 안에서 품목이 376px을 받는다.
   */
  const columns: Column<SourceLineView>[] = [
    {
      key: 'lineNo',
      header: t.source.lineNo,
      align: 'end',
      width: '72px',
      render: (row) => row.lineNo,
    },
    {
      key: 'item',
      header: t.source.item,
      render: (row) => describeReference(toReference(itemLookup, row.itemId)),
    },
    {
      key: 'receivedQty',
      header: t.source.receivedQty,
      align: 'end',
      width: '160px',
      render: (row) => row.receivedQty,
    },
    {
      key: 'uom',
      header: t.source.uom,
      width: '160px',
      render: (row) => describeReference(toReference(uomLookup, row.uomId)),
    },
    {
      key: 'choose',
      header: t.source.choose,
      width: '160px',
      /*
       * 고른 줄에는 버튼 대신 표식을 둔다 — 이미 대상인 줄을 다시 누르는 조작에는 뜻이 없고,
       * 무엇이 대상인지는 표식이 더 곧게 말한다.
       */
      render: (row) =>
        row.inboundReceiptLineId === chosenLineId || !isChoosable ? (
          <Chip variant="status" status="info" size="sm">
            {t.source.chosen}
          </Chip>
        ) : (
          <Button
            variant="outlined"
            size="sm"
            aria-label={t.source.chooseRow(row.lineNo)}
            disabled={isLocked}
            aria-describedby={isLocked ? lockedReasonId : undefined}
            onClick={() => {
              onChoose(row.inboundReceiptLineId);
            }}
          >
            {t.source.choose}
          </Button>
        ),
    },
  ];

  /**
   * **안내가 말하는 다섯과 복구가 되살리는 다섯이 같아야 한다.**
   *
   * 하나라도 빠뜨리면 그 참조만 실패했을 때 복구 버튼이 화면 어디에도 서지 않는다 —
   * 문구는 다섯을 실패 목록으로 말하는데 조건은 넷인 상태가 그 형태다.
   */
  const hasReferenceError = [
    supplierLookup,
    businessUnitLookup,
    plantLookup,
    itemLookup,
    uomLookup,
  ].some((lookup) => lookup.isError);

  return (
    <>
      {/* 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). */}
      <div role="group" aria-label={t.source.label}>
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.inboundReceiptLineId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noSourceLinesTitle}
              description={t.empty.noSourceLinesDescription}
            />
          }
        />
      </div>

      {lines.length > 0 && (
        <p className="field-note">{isChoosable ? t.source.inheritNote : t.source.singleLineNote}</p>
      )}

      {/*
       * 잠긴 사유는 **감추지 않고 항상 보이는 DOM 텍스트**로 렌더해 잇는다 — 잠긴 컨트롤은
       * 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다(배치 규범 4).
       */}
      {isLocked && lockedReason !== undefined && (
        <p id={lockedReasonId} className="field-note">
          {lockedReason}
        </p>
      )}

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
