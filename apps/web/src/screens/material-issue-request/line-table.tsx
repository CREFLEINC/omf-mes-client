import {
  Chip,
  type Column,
  EmptyState,
  IconButton,
  Select,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { isOutsideBom } from './bom-origin';
import type { ItemLookupResult, LookupResult } from './lookups';
import type { MaterialIssueLineDraft, SelectOption } from './types';
import { lineFieldId, type LineFieldName } from './validation';

const t = messages.materialIssueRequest;

/**
 * 열 폭 — 흡수 열(품목)에도 예산을 잡는다(`docs/layout-conventions.md` 관례).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | **품목** | **미지정** | 「코드 · 이름」 또는 선택칸에 「BOM 밖」 표식이 붙는다 — 남는 폭을 흡수한다 |
 * | BOM 소요 | 96px | 수만. 서버가 낸 값이라 입력칸이 없다 |
 * | 기출고 | 96px | 같음 |
 * | 부족 | 96px | 같음 |
 * | 요청 수량 | 136px | `sm` 입력칸 + 오류 한 줄 |
 * | 단위 | 160px | 「코드 · 이름」을 담는 `sm` 선택칸 |
 * | 행 조작 | 64px | 아이콘 버튼 하나 |
 * | **지정 폭 합** | **648px** | 흡수 열 예산 280px 을 더하면 928px — `58rem` 안이라 가로 스크롤이 없다 |
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
const WIDTH = {
  requiredQty: '96px',
  issuedQty: '96px',
  shortageQty: '96px',
  requestedQty: '136px',
  uom: '160px',
  rowActions: '64px',
} as const;

export interface LineTableProps {
  rows: MaterialIssueLineDraft[];
  /** 줄 단위 오류. 열쇠는 `lineFieldId`가 만든다 — 줄이 둘 이상일 때 서로 섞이지 않는다 */
  errors: Record<string, string>;
  itemLookup: ItemLookupResult;
  uomLookup: LookupResult;
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  isLocked?: boolean;
  onPatch: (key: string, patch: Partial<Omit<MaterialIssueLineDraft, 'key'>>) => void;
  onRemove: (key: string) => void;
}

/** 서버가 낸 수를 그대로 보인다. 손으로 더한 줄은 셋 다 값이 없다. */
const readOnlyQty = (value: number | null): string =>
  value === null ? t.values.empty : String(value);

/**
 * 요청 품목 표 — 6열(품목·BOM 소요·기출고·부족·요청 수량·단위) + 행 조작.
 *
 * ⛔ **BOM 소요·기출고·부족 세 열은 읽기 전용이다.** 화면이 다시 계산하지 않는다
 * (공유계약 L-2 — `shortageQty` 는 서버가 낸다).
 *
 * **BOM 유래 줄은 품목·단위를 고칠 수 없다** — 소요 목록이 정한 값이다. 손으로 더한 줄만
 * 둘을 고른다.
 *
 * **BOM 밖 표식은 막지 않는다**(스펙 §5-3). 표식과 본문의 `bomComponentId` 가 `bom-origin.ts`
 * 의 같은 판정을 지난다.
 *
 * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다 — `aria-label`에 줄번호를 넣는다
 * (배치 규범 3의 이탈 조건).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LineTable = ({
  rows,
  errors,
  itemLookup,
  uomLookup,
  itemOptions,
  uomOptions,
  isLocked = false,
  onPatch,
  onRemove,
}: LineTableProps) => {
  const errorOf = (row: MaterialIssueLineDraft, field: LineFieldName): string | undefined =>
    errors[lineFieldId(row.key, field)];

  const columns: Column<MaterialIssueLineDraft>[] = [
    {
      key: 'item',
      header: t.lineTable.item,
      render: (row, rowIndex) => (
        <div className="field-cell">
          {row.origin === 'shortage' ? (
            <span>{lookupDisplayLabel(itemLookup, row.itemId)}</span>
          ) : (
            <Select
              size="sm"
              options={itemOptions}
              value={row.itemId === '' ? null : row.itemId}
              invalid={errorOf(row, 'itemId') !== undefined}
              disabled={isLocked}
              aria-label={t.lineTable.itemLabel(rowIndex + 1)}
              onChange={(value) => {
                /*
                 * 품목을 고르면 기준단위를 함께 채운다 — 단위를 따로 고르게 두면 비운 채로
                 * 두기 쉽고, 그 줄은 본문에서 조용히 빠진다.
                 */
                const baseUomId = itemLookup.entries.find(
                  (entry) => entry.value === value,
                )?.baseUomId;

                onPatch(row.key, {
                  itemId: value,
                  ...(baseUomId === undefined ? {} : { uomId: String(baseUomId) }),
                });
              }}
            />
          )}
          {row.itemId !== '' && isOutsideBom(row) && (
            <Chip variant="status" status="warning" size="sm">
              {t.warnings.outsideBom}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'requiredQty',
      header: t.lineTable.requiredQty,
      align: 'end',
      width: WIDTH.requiredQty,
      render: (row) => readOnlyQty(row.requiredQty),
    },
    {
      key: 'issuedQty',
      header: t.lineTable.issuedQty,
      align: 'end',
      width: WIDTH.issuedQty,
      render: (row) => readOnlyQty(row.issuedQty),
    },
    {
      key: 'shortageQty',
      header: t.lineTable.shortageQty,
      align: 'end',
      width: WIDTH.shortageQty,
      render: (row) => readOnlyQty(row.shortageQty),
    },
    {
      key: 'requestedQty',
      header: t.lineTable.requestedQty,
      width: WIDTH.requestedQty,
      render: (row, rowIndex) => (
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
        row.origin === 'shortage' ? (
          <span>{lookupDisplayLabel(uomLookup, row.uomId)}</span>
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
      key: 'rowActions',
      header: t.lineTable.rowActions,
      width: WIDTH.rowActions,
      render: (row, rowIndex) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={t.actions.removeLine(rowIndex + 1)}
          disabled={isLocked}
          onClick={() => {
            onRemove(row.key);
          }}
        />
      ),
    },
  ];

  return (
    <div className="wide-table">
      {/*
       * `getRowId`가 초안 키를 쓴다 — 인덱스가 키가 되면 가운데 줄을 지울 때 치고 있던 칸의
       * DOM 노드가 대신 지워져 입력과 포커스가 다른 줄로 옮겨 붙는다.
       */}
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.key}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.noLinesTitle}
            description={t.empty.noLinesDescription}
          />
        }
      />
    </div>
  );
};
