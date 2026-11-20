import { Button, Checkbox, Chip, IconButton, Table, TextField, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoTip } from '../../patterns/info-tip';
import { Select } from '../../patterns/select';
import { isShortageLine } from './shortage-banner';
import {
  describeAvailableQty,
  describeReference,
  toReference,
  type AvailableQtyLookup,
  type ItemNameLookup,
  type ReferenceSource,
} from './lookups';
import type { AssignmentMode, SelectOption, ShipmentRequestLineDraft } from './types';
import type { SelectItems } from '@crefle/web-ui';
import { lineFieldId, readQty, type LineFieldName } from './validation';

const t = messages.shipmentRequestCreate;

/**
 * 열 폭 — 흡수 열(품목)에도 예산을 잡는다(`docs/layout-conventions.md` 의 방법).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다(예산 **272px**) |
 * | 요청 | 112px | 수 + 단위 표기(지시서 경유) 또는 `sm` 입력칸(단독 생성) |
 * | 단위 | 144px | 이름 표기(지시서 경유) 또는 `sm` 선택칸(단독 생성) |
 * | 가용 | 96px | 수만(로딩·실패 문구도 이 폭 안) |
 * | 배정 | 152px | `sm` 입력칸 + 오류 + 「부족」 표식 |
 * | 검사 | 88px | 스위치 하나 |
 * | 행 조작(단독 생성만) | 64px | 아이콘 버튼 하나 |
 * | **지정 폭 합** | **592 · 656px** | 흡수 열 예산 272px 을 더하면 864 · **928px** — `58rem`(928px)에 맞는다 |
 *
 * ⭐ **두 열을 걷어 품목 열이 넓어졌다**(사용자 결정 2026-09-18). 종전에는 「고객 LOT 요구」
 * 200px·「잔여 유효기간」 128px 이 더 있어 지정 폭 합이 **984px** 이었고, 담는 칸 928px 을
 * 넘은 56px 이 **폭을 지정하지 않은 품목 열에서 깎였다** — 가장 중요한 열이 가장 좁았다.
 * 게다가 그 칸 안에 검색칸·선택칸·한계 문구가 세로로 쌓여 있었다.
 *
 * ⚠ **단위 열 144px 은 종전 예산 표에 빠져 있었다**(이 주석의 앞 판과 설계 선행 문서 둘 다).
 * 그래서 「지정 폭 합 840」으로 읽혔는데 실제는 984 였다 — 이번에 실측해 바로잡았다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
const WIDTH = {
  requestedQty: '112px',
  uom: '144px',
  availableQty: '96px',
  allocatedQty: '152px',
  inspection: '88px',
  rowActions: '64px',
  /** 피처 012 — 「창고 이름 (공장 이름)」 선택칸 + 안내 한 줄. */
  warehouse: '208px',
  /** S/O 경유는 [나누기] 글자 단추가 들어간다. */
  rowActionsSplit: '96px',
} as const;

export interface LineTableProps {
  mode: AssignmentMode;
  rows: ShipmentRequestLineDraft[];
  /** 줄 단위 오류. 열쇠는 `lineFieldId`가 만든다 — 줄이 둘 이상일 때 서로 섞이지 않는다 */
  errors: Record<string, string>;
  /** 품목 이름 풀이 — 번호 하나씩 푼다(`lookups.ts` 의 `useItemNames`). */
  itemNames: ItemNameLookup;
  uomLookup: ReferenceSource;
  uomOptions: SelectOption[];
  availableQty: AvailableQtyLookup;
  isLocked?: boolean;
  onPatch: (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>) => void;
  onRemove: (key: string) => void;
  /** 그 줄의 품목을 바꾸려고 팝업을 연다. 단독 생성에서만 쓰인다. */
  onPickItem: (key: string) => void;
  /** 출고 창고 선택지(피처 012 FR-003) — 고른 사업부의 활성 창고. 묶음 제목에 사업부가 붙는다. */
  warehouseOptions: SelectItems;
  /** 사업부를 골랐는가 — 아니면 창고 칸·[나누기]가 잠긴다(US1-2). */
  hasBusinessUnit: boolean;
  onChangeWarehouse: (key: string, warehouseId: string) => void;
  /** S/O 줄을 나눈다(FR-005). S/O 경유에서만 쓰인다. */
  onSplit: (key: string) => void;
  /** 나눈 줄을 「SO 번호 n행」으로 가리킨다. 단독 생성은 `null`. */
  salesOrderNo: string | null;
}

/**
 * 출하작업지시 라인 표 — 5열(품목·요청·단위·가용·배정·검사)에 단독 생성일 때만 행 조작 열이
 * 붙는다.
 *
 * ⛔ **「고객 LOT 요구」·「잔여 유효기간」 두 열을 걷었다**(사용자 결정 2026-09-18). 표시만이
 * 아니라 입력 자리와 본문 실림까지 없앴다 — 계약은 둘 다 선택으로 두고, 값이 없으면 서버가
 * 조건 판정 자체를 하지 않는다(`assertShelfLife` 는 하한이 널이면 곧바로 반환한다). 지시서가
 * 두 값을 실어 오지 않으므로 **들어오는 데이터를 버리는 일도 없다.** 되살리려면 이 표와
 * 초안·검증·본문 네 곳을 되돌린다.
 *
 * **지시서 경유는 품목·요청 수량이 읽기 전용이다**(미결 항목 표의 구현 판단). 배정 수량·검사
 * 대상은 계약이 라인마다 받으므로(`ShipmentRequestLineCreate`) 두 모드 모두에서 고칠 수 있다.
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
  itemNames,
  uomLookup,
  uomOptions,
  availableQty,
  isLocked = false,
  onPatch,
  onRemove,
  onPickItem,
  warehouseOptions,
  hasBusinessUnit,
  onChangeWarehouse,
  onSplit,
  salesOrderNo,
}: LineTableProps) => {
  const isFromOrder = mode === 'fromOrder';

  const errorOf = (row: ShipmentRequestLineDraft, field: LineFieldName): string | undefined =>
    errors[lineFieldId(row.key, field)];

  /**
   * 그 줄의 단위 이름 — **단위 열이 쓰는 유일한 자리**다.
   *
   * ⛔ **수량 칸에 다시 적지 않는다**(사용자 지시 2026-09-18). 종전에는 요청·배정 수량 아래에
   *    보조 문구로 단위를 달았는데, 그 한 줄이 입력칸을 밀어 올려 **줄마다 높이가 달라 보였다.**
   *    게다가 `shipment_request_line` 의 단위 칸은 `uom_id` **하나**이고 요청·배정·출하 수량
   *    셋이 그것을 함께 쓴다 — 계약 본문도 라인당 `uomId` 하나다. 수량마다 단위를 다시 적는 것은
   *    **구조상 있을 수 없는 차이**를 있는 것처럼 보이게 하는 중복이었다.
   */
  /** 「SO 번호 n행」 — 나눈 줄과 묶음 합계가 S/O 줄을 가리킬 때 쓴다. */
  const sourceRefOf = (row: ShipmentRequestLineDraft): string =>
    salesOrderNo === null || row.salesOrderLineNo === null
      ? t.values.empty
      : t.lineTable.salesOrderLineRef(salesOrderNo, row.salesOrderLineNo);

  const uomNameOf = (row: ShipmentRequestLineDraft): string =>
    row.uomId === '' ? '' : describeReference(toReference(uomLookup, Number(row.uomId)));

  const columns: Column<ShipmentRequestLineDraft>[] = [
    {
      key: 'item',
      header: t.lineTable.item,
      /*
       * ⭐ **두 모드가 같은 모양이다** — 「코드 · 이름」 읽기 전용(사용자 결정 2026-09-18).
       *    현장이 코드로 대조하고 라벨·QR 도 코드다.
       * ⭐ **단독 생성에서는 눌러서 바꾼다.** 잘못 고른 줄을 지우고 다시 만들지 않아도 된다.
       *    ⛔ 지시서 경유는 품목이 지시서가 정한 값이라 바꿀 수 없다 — 누르는 자리를 두지 않는다.
       */
      render: (row, rowIndex) => {
        const label = describeReference(
          itemNames.of(row.itemId === '' ? null : Number(row.itemId)),
        );

        if (row.splitOf !== null) {
          /* 나눈 줄 — 품목은 원 줄과 같다. 어느 S/O 줄에서 나왔는지만 적는다(시안 W0401-After). */
          return (
            <span className="sr-split-row">
              {t.lineTable.splitRowLabel(sourceRefOf(row))}
            </span>
          );
        }

        if (isFromOrder) {
          return (
            <div className="field-cell">
              <span>{label}</span>
              {row.erpStorageLocationCode !== null && (
                <span className="field-note">
                  {t.lineTable.erpWarehouseHint(row.erpStorageLocationCode)}
                </span>
              )}
            </div>
          );
        }

        return (
          <div className="field-cell">
            <Button
              variant="text"
              size="sm"
              disabled={isLocked}
              aria-label={t.lineTable.itemLabel(rowIndex + 1)}
              onClick={() => {
                onPickItem(row.key);
              }}
            >
              {row.itemId === '' ? t.lineTable.itemUnpicked : label}
            </Button>
            {errorOf(row, 'itemId') !== undefined && (
              <span className="field-error">{errorOf(row, 'itemId')}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'requestedQty',
      header: t.lineTable.requestedQty,
      align: 'end',
      width: WIDTH.requestedQty,
      render: (row, rowIndex) =>
        row.splitOf !== null ? (
          t.values.empty
        ) : isFromOrder ? (
          row.requestedQty
        ) : (
          <TextField
            size="sm"
            fullWidth
            inputMode="decimal"
            aria-label={t.lineTable.requestedQtyLabel(rowIndex + 1)}
            value={row.requestedQty}
            disabled={isLocked}
            error={errorOf(row, 'requestedQty')}
            onChange={(event) => {
              onPatch(row.key, { requestedQty: event.target.value });
            }}
          />
        ),
    },
    {
      key: 'uom',
      header: t.lineTable.uom,
      width: WIDTH.uom,
      render: (row, rowIndex) =>
        isFromOrder ? (
          uomNameOf(row)
        ) : (
          <Select
            size="sm"
            options={uomOptions}
            value={row.uomId === '' ? null : row.uomId}
            invalid={errorOf(row, 'uomId') !== undefined}
            disabled={isLocked}
            aria-label={t.lineTable.uomLabel(rowIndex + 1)}
            onChange={(value) => {
              onPatch(row.key, { uomId: value });
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
        describeAvailableQty(
          availableQty.of(
            row.itemId === '' ? null : Number(row.itemId),
            row.warehouseId === '' ? null : Number(row.warehouseId),
          ),
        ),
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
      key: 'warehouse',
      /* 고를 수 있는 창고 규칙은 칸 머리 ⓘ 로(관리웹 정리 시안 A — 늘 보이는 규칙 문장을 걷는다). */
      header: (
        <span className="info-label">
          {t.lineTable.warehouse}
          <InfoTip text={t.notes.warehouseRule} />
        </span>
      ),
      width: WIDTH.warehouse,
      /*
       * ⭐ 줄마다 출고 창고 하나(피처 012 FR-003). 사업부를 고르기 전에는 잠긴다(US1-2).
       * 첫 줄 창고로 채운 값은 「첫 줄 창고로 채움」을 작게 적고(FR-004), 사업부를 바꿔 비운 줄은 노란 테로 짚는다.
       */
      render: (row, rowIndex) => {
        const error = errorOf(row, 'warehouseId');
        const placeholder = !hasBusinessUnit
          ? t.lineTable.warehouseNeedsBusinessUnit
          : row.warehouseCleared
            ? t.lineTable.warehouseReselect
            : t.lineTable.warehousePlaceholder;

        return (
          <div className={row.warehouseCleared ? 'field-cell sr-warehouse is-cleared' : 'field-cell sr-warehouse'}>
            <Select
              size="sm"
              options={warehouseOptions}
              value={row.warehouseId === '' ? null : row.warehouseId}
              placeholder={placeholder}
              invalid={error !== undefined}
              disabled={isLocked || !hasBusinessUnit}
              aria-label={t.lineTable.warehouseLabel(rowIndex + 1)}
              onChange={(value) => {
                onChangeWarehouse(row.key, value);
              }}
            />
            {error !== undefined && <span className="field-error">{error}</span>}
            {error === undefined && row.warehouseFilled && row.warehouseId !== '' && (
              <span className="field-note">{t.lineTable.warehouseFilledFromFirst}</span>
            )}
          </div>
        );
      },
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
    isFromOrder
      ? ({
          key: 'rowActions',
          header: t.lineTable.rowActions,
          width: WIDTH.rowActionsSplit,
          /*
           * S/O 경유 — 원 줄은 [나누기](FR-005), 나눈 줄은 [삭제]로 되돌린다. 원 줄은 지울 수 없다(S/O 가 정한 줄).
           */
          render: (row: ShipmentRequestLineDraft, rowIndex: number) =>
            row.splitOf === null ? (
              <Button
                variant="text"
                size="sm"
                disabled={isLocked || !hasBusinessUnit}
                aria-label={t.actions.splitLineLabel(rowIndex + 1)}
                onClick={() => {
                  onSplit(row.key);
                }}
              >
                {t.actions.splitLine}
              </Button>
            ) : (
              <IconButton
                icon="delete"
                size="sm"
                aria-label={t.actions.removeSplitLine(rowIndex + 1)}
                disabled={isLocked}
                onClick={() => {
                  onRemove(row.key);
                }}
              />
            ),
        } satisfies Column<ShipmentRequestLineDraft>)
      : ({
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
        } satisfies Column<ShipmentRequestLineDraft>),
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
