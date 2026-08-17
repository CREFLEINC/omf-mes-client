import { Chip, type Column, IconButton, Select, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { LineDraft, SelectOption } from './types';
import { lineFieldId, type LineFieldName } from './validation';

const t = messages.poRegister;

export interface LineTableProps {
  rows: LineDraft[];
  /** 줄 단위 오류·경고. 열쇠는 `lineFieldId`가 만든다 — 줄이 둘 이상일 때 서로 섞이지 않는다 */
  errors: Record<string, string>;
  warnings: Record<string, string>;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  /**
   * 표 전체가 잠겼는가. **나가는 중과 이미 등록한 뒤가 같은 잠금을 쓴다**(완료 조건 C19·C24).
   *
   * 한 칸이라도 열려 있으면 사용자가 그 칸을 고치고 나서 **자기가 고친 값으로 등록된 줄 알게
   * 된다** — 나가는 본문은 이미 조립됐고, 등록된 전표는 이 화면에서 고칠 수 없다.
   * 잠긴 사유는 표 안이 아니라 조작 자리(등록 버튼 옆)에 한 번 선다.
   */
  isLocked?: boolean;
  onPatch: (key: string, patch: Partial<Omit<LineDraft, 'key'>>) => void;
  onRemove: (key: string) => void;
}

/**
 * 발주 라인 표 — **이 화면이 값을 치는 자리다.**
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 72px | 두 자리 수 + 승계 표식 |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 발주수량 | 160px | 입력칸 + 하한 안내 + 인라인 오류가 들어가는 폭 |
 * | 단위 | 160px | 선택칸 또는 이름 |
 * | 초과 허용 · 부족 허용 | 각 136px | 입력칸 + 경고 문구 |
 * | 행 조작 | 72px | 아이콘 버튼 하나 |
 * | **지정 폭 합** | **736px** | 흡수 열이 192px을 받아 `58rem`(928px) 안에 든다 |
 *
 * **승계 줄의 품목·단위는 고르지 않는다**(계획 결정 4). 넘어온 줄에서 그대로 이어받은 값이라,
 * 고칠 수 있게 두면 승계 근거와 다른 품목이 승계 표식을 단 채 전표에 실린다.
 *
 * **표시 번호는 목록 안의 위치(1..N)다.** 계약의 줄번호는 배열 순서로 서버가 부여하므로
 * (공유계약 A-5) 화면이 값을 지어내지 않는다.
 *
 * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다 — `aria-label`에 줄번호를 넣는다
 * (배치 규범 3의 이탈 조건). 오류·경고는 디자인 시스템이 그 칸에 이어 준다.
 */
export const LineTable = ({
  rows,
  errors,
  warnings,
  itemLookup,
  uomLookup,
  itemOptions,
  uomOptions,
  isLocked = false,
  onPatch,
  onRemove,
}: LineTableProps) => {
  /** 마지막 한 줄은 지울 수 없다 — 라인이 0행이면 계약이 요구하는 최소 1행을 만들 수 없다. */
  const isRemovable = rows.length > 1 && !isLocked;

  const errorOf = (row: LineDraft, field: LineFieldName): string | undefined =>
    errors[lineFieldId(row.key, field)];

  const warningOf = (row: LineDraft, field: LineFieldName): string | undefined =>
    warnings[lineFieldId(row.key, field)];

  const toleranceCell = (
    row: LineDraft,
    rowIndex: number,
    field: 'toleranceOverQty' | 'toleranceUnderQty',
    label: string,
  ): ReactNode => (
    <TextField
      type="number"
      size="sm"
      fullWidth
      inputMode="decimal"
      aria-label={label}
      disabled={isLocked}
      value={row[field]}
      error={errorOf(row, field)}
      /* 오류가 있으면 디자인 시스템이 경고 자리를 오류로 대체한다 — 먼저 읽혀야 할 것이 오류다. */
      helperText={warningOf(row, field)}
      onChange={(event) => {
        onPatch(row.key, { [field]: event.target.value });
      }}
    />
  );

  const columns: Column<LineDraft>[] = [
    {
      key: 'lineNo',
      header: t.lineTable.lineNo,
      align: 'end',
      width: '72px',
      render: (row, rowIndex) => (
        <>
          {rowIndex + 1}
          {row.sourceLineId !== null && (
            <Chip variant="status" status="info" size="sm">
              {t.lineTable.inherited}
            </Chip>
          )}
        </>
      ),
    },
    {
      key: 'item',
      header: t.lineTable.item,
      render: (row, rowIndex) =>
        row.sourceLineId === null ? (
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
        ) : (
          describeReference(toReference(itemLookup, Number(row.itemId)))
        ),
    },
    {
      key: 'orderedQty',
      header: t.lineTable.orderedQty,
      width: '160px',
      render: (row, rowIndex) => (
        <TextField
          type="number"
          size="sm"
          fullWidth
          inputMode="decimal"
          aria-label={t.lineTable.orderedQtyLabel(rowIndex + 1)}
          disabled={isLocked}
          value={row.orderedQty}
          error={errorOf(row, 'orderedQty')}
          /* 승계 줄에는 하한이 있다 — 오류가 나기 전에 얼마 이상인지 읽히게 한다. */
          helperText={row.sourceQty === null ? undefined : t.lineTable.minNote(row.sourceQty)}
          onChange={(event) => {
            onPatch(row.key, { orderedQty: event.target.value });
          }}
        />
      ),
    },
    {
      key: 'uom',
      header: t.lineTable.uom,
      width: '160px',
      render: (row, rowIndex) =>
        row.sourceLineId === null ? (
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
        ) : (
          describeReference(toReference(uomLookup, Number(row.uomId)))
        ),
    },
    {
      key: 'toleranceOverQty',
      header: t.lineTable.toleranceOver,
      width: '136px',
      render: (row, rowIndex) =>
        toleranceCell(
          row,
          rowIndex,
          'toleranceOverQty',
          t.lineTable.toleranceOverLabel(rowIndex + 1),
        ),
    },
    {
      key: 'toleranceUnderQty',
      header: t.lineTable.toleranceUnder,
      width: '136px',
      render: (row, rowIndex) =>
        toleranceCell(
          row,
          rowIndex,
          'toleranceUnderQty',
          t.lineTable.toleranceUnderLabel(rowIndex + 1),
        ),
    },
    {
      key: 'rowActions',
      header: t.lineTable.rowActions,
      width: '72px',
      render: (row, rowIndex) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={t.actions.removeLine(rowIndex + 1)}
          disabled={!isRemovable}
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
       * **`getRowId`가 초안 키를 쓴다**(사본 체크리스트 2번). 인덱스가 키가 되면 가운데 줄을
       * 지울 때 치고 있던 칸의 DOM 노드가 대신 지워져 입력과 포커스가 다른 줄로 옮겨 붙는다.
       */}
      <Table density="compact" columns={columns} rows={rows} getRowId={(row) => row.key} />
    </div>
  );
};
