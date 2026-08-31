import { Checkbox, Chip, type Column, IconButton, Select, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';

import { isShortageLine } from './shortage-banner';
import {
  describeAvailableQty,
  describeReference,
  toReference,
  type AvailableQtyLookup,
  type ReferenceSource,
} from './lookups';
import type { AssignmentMode, SelectOption, ShipmentRequestLineDraft } from './types';
import { lineFieldId, readQty, type LineFieldName } from './validation';

const t = messages.shipmentRequestCreate;

/**
 * 열 폭 — 흡수 열(품목)에도 예산을 잡는다(`docs/layout-conventions.md` W-06-05가 되살린 방법).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | **품목** | **미지정** | 「코드 · 이름」(지시서 경유) 또는 선택칸(단독 생성)을 담고 남는 폭을 흡수한다 |
 * | 요청 | 112px | 수 + 단위 표기(지시서 경유) 또는 `sm` 입력칸(단독 생성) |
 * | 가용 | 96px | 수만(로딩·실패 문구도 이 폭 안) |
 * | 배정 | 152px | `sm` 입력칸 + 오류 + 「부족」 표식 |
 * | 검사 | 88px | 스위치 하나 |
 * | 고객 LOT 요구 | 200px | 200자 자유 텍스트를 짧게 보이는 `TextArea` 2행 |
 * | 잔여 유효기간 | 128px | `sm` 입력칸 + 단위 「일」 |
 * | 행 조작(단독 생성만) | 64px | 아이콘 버튼 하나 |
 * | **지정 폭 합** | **776 · 840px** | 흡수 열 예산 184px을 더하면 960 · 1,024px — `58rem`(928px) 위다 |
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
const WIDTH = {
  requestedQty: '112px',
  availableQty: '96px',
  allocatedQty: '152px',
  inspection: '88px',
  customerLotRequirement: '200px',
  shelfLife: '128px',
  rowActions: '64px',
} as const;

export interface LineTableProps {
  mode: AssignmentMode;
  rows: ShipmentRequestLineDraft[];
  /** 줄 단위 오류. 열쇠는 `lineFieldId`가 만든다 — 줄이 둘 이상일 때 서로 섞이지 않는다 */
  errors: Record<string, string>;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  availableQty: AvailableQtyLookup;
  isLocked?: boolean;
  onPatch: (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>) => void;
  onRemove: (key: string) => void;
}

/**
 * 출하작업지시 라인 표 — 7열(품목·요청·가용·배정·검사·고객 LOT 요구·잔여 유효기간)에
 * 단독 생성일 때만 행 조작 열이 붙는다.
 *
 * **지시서 경유는 품목·요청 수량이 읽기 전용이다**(미결 항목 표의 구현 판단). 배정 수량·검사
 * 대상·고객 LOT 요구·잔여 유효기간은 계약이 라인마다 받으므로(`ShipmentRequestLineCreate`)
 * 두 모드 모두에서 고칠 수 있다.
 *
 * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다 — `aria-label`에 줄번호를 넣는다
 * (배치 규범 3의 이탈 조건).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LineTable = ({
  mode,
  rows,
  errors,
  itemLookup,
  uomLookup,
  itemOptions,
  uomOptions,
  availableQty,
  isLocked = false,
  onPatch,
  onRemove,
}: LineTableProps) => {
  const isFromOrder = mode === 'fromOrder';

  const errorOf = (row: ShipmentRequestLineDraft, field: LineFieldName): string | undefined =>
    errors[lineFieldId(row.key, field)];

  const uomNameOf = (row: ShipmentRequestLineDraft): string =>
    row.uomId === '' ? '' : describeReference(toReference(uomLookup, Number(row.uomId)));

  const columns: Column<ShipmentRequestLineDraft>[] = [
    {
      key: 'item',
      header: t.lineTable.item,
      render: (row, rowIndex) =>
        isFromOrder ? (
          describeReference(toReference(itemLookup, Number(row.itemId)))
        ) : (
          <Select
            size="sm"
            options={itemOptions}
            value={row.itemId === '' ? null : row.itemId}
            invalid={errorOf(row, 'itemId') !== undefined}
            disabled={isLocked}
            aria-label={t.lineTable.itemLabel(rowIndex + 1)}
            onChange={(value) => {
              onPatch(row.key, { itemId: value });
            }}
          />
        ),
    },
    {
      key: 'requestedQty',
      header: t.lineTable.requestedQty,
      align: 'end',
      width: WIDTH.requestedQty,
      render: (row, rowIndex) =>
        isFromOrder ? (
          <div className="field-cell">
            <span>{row.requestedQty}</span>
            <span className="field-note">{uomNameOf(row)}</span>
          </div>
        ) : (
          <TextField
            size="sm"
            fullWidth
            inputMode="decimal"
            aria-label={t.lineTable.requestedQtyLabel(rowIndex + 1)}
            value={row.requestedQty}
            disabled={isLocked}
            error={errorOf(row, 'requestedQty')}
            helperText={uomNameOf(row) === '' ? undefined : uomNameOf(row)}
            onChange={(event) => {
              onPatch(row.key, { requestedQty: event.target.value });
            }}
          />
        ),
    },
    {
      key: 'availableQty',
      header: t.lineTable.availableQty,
      align: 'end',
      width: WIDTH.availableQty,
      /* 읽기 전용이다 — 장부는 시스템이 아는 값이고 이 화면이 고치는 값이 아니다. */
      render: (row) =>
        describeAvailableQty(availableQty.of(row.itemId === '' ? null : Number(row.itemId))),
    },
    {
      key: 'allocatedQty',
      header: t.lineTable.allocatedQty,
      width: WIDTH.allocatedQty,
      render: (row, rowIndex) => (
        <div className="field-cell">
          <TextField
            size="sm"
            fullWidth
            inputMode="decimal"
            aria-label={t.lineTable.allocatedQtyLabel(rowIndex + 1)}
            value={row.allocatedQty}
            disabled={isLocked}
            error={errorOf(row, 'allocatedQty')}
            helperText={uomNameOf(row) === '' ? undefined : uomNameOf(row)}
            onChange={(event) => {
              onPatch(row.key, { allocatedQty: event.target.value });
            }}
          />
          {/* 0(제외)이나 오류가 아니라 「가용보다 많다」는 사실만 밝힌다 — 막지 않는다(C5). */}
          {isShortageLine(row, availableQty) && (
            <Chip variant="status" status="warning" size="sm">
              {t.shortage.title}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'shippingInspectionRequired',
      header: t.lineTable.inspection,
      width: WIDTH.inspection,
      render: (row, rowIndex) => (
        <Checkbox
          aria-label={t.lineTable.inspectionLabel(rowIndex + 1)}
          checked={row.shippingInspectionRequired}
          disabled={isLocked}
          onChange={(event) => {
            onPatch(row.key, { shippingInspectionRequired: event.target.checked });
          }}
        />
      ),
    },
    {
      key: 'customerLotRequirement',
      header: t.lineTable.customerLotRequirement,
      width: WIDTH.customerLotRequirement,
      /*
       * 상용구 마스터가 없어(미결 항목 표) 200자 자유 텍스트로 받는다 — 계약에 길이 제약이
       * 없어 서버가 거절하지는 않지만, 화면이 정한 실용적 상한을 `maxLength`로 안내한다.
       */
      render: (row, rowIndex) => (
        <TextArea
          rows={2}
          fullWidth
          maxLength={200}
          aria-label={t.lineTable.customerLotRequirementLabel(rowIndex + 1)}
          value={row.customerLotRequirement}
          disabled={isLocked}
          onChange={(event) => {
            onPatch(row.key, { customerLotRequirement: event.target.value });
          }}
        />
      ),
    },
    {
      key: 'minimumRemainingShelfLifeDays',
      header: t.lineTable.minimumRemainingShelfLifeDays,
      width: WIDTH.shelfLife,
      render: (row, rowIndex) => (
        <TextField
          size="sm"
          fullWidth
          inputMode="numeric"
          aria-label={t.lineTable.minimumRemainingShelfLifeDaysLabel(rowIndex + 1)}
          value={row.minimumRemainingShelfLifeDays}
          disabled={isLocked}
          error={errorOf(row, 'minimumRemainingShelfLifeDays')}
          onChange={(event) => {
            onPatch(row.key, { minimumRemainingShelfLifeDays: event.target.value });
          }}
        />
      ),
    },
    ...(isFromOrder
      ? []
      : [
          {
            key: 'rowActions',
            header: t.lineTable.rowActions,
            width: WIDTH.rowActions,
            render: (row: ShipmentRequestLineDraft, rowIndex: number) => (
              <IconButton
                icon="delete"
                size="sm"
                aria-label={t.actions.removeLine(rowIndex + 1)}
                disabled={isLocked || rows.length <= 1}
                onClick={() => {
                  onRemove(row.key);
                }}
              />
            ),
          } satisfies Column<ShipmentRequestLineDraft>,
        ]),
  ];

  return (
    <div className="wide-table">
      {/*
       * `getRowId`가 초안 키를 쓴다 — 인덱스가 키가 되면 가운데 줄을 지울 때 치고 있던 칸의
       * DOM 노드가 대신 지워져 입력과 포커스가 다른 줄로 옮겨 붙는다.
       */}
      <Table density="compact" columns={columns} rows={rows} getRowId={(row) => row.key} />
    </div>
  );
};
