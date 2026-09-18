import {
  Button,
  Checkbox,
  Chip,
  IconButton,
  Select,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
      /*
       * ⭐ **두 모드가 같은 모양이다** — 「코드 · 이름」 읽기 전용(사용자 결정 2026-09-18).
       *    현장이 코드로 대조하고 라벨·QR 도 코드다.
       * ⭐ **단독 생성에서는 눌러서 바꾼다.** 잘못 고른 줄을 지우고 다시 만들지 않아도 된다.
       *    ⛔ 지시서 경유는 품목이 지시서가 정한 값이라 바꿀 수 없다 — 누르는 자리를 두지 않는다.
       */
      render: (row, rowIndex) => {
        const label = describeReference(itemNames.of(row.itemId === '' ? null : Number(row.itemId)));

        if (isFromOrder) return label;

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
