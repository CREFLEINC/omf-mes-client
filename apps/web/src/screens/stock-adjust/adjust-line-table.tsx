import { Chip, type Column, IconButton, Select, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { deriveActualQty, describeActualQty, describeBookQty, type BookQtyState } from './balances';
import {
  describeReference,
  lotOptionsFor,
  toReference,
  type LotLookupResult,
  type ReferenceSource,
} from './lookups';
import type { AdjustLineDraft, SelectOption } from './types';
import { isExcludedLine, lineFieldId, readQty, type LineFieldName } from './validation';

const t = messages.stockAdjust;

/**
 * 표가 그리는 한 줄 — 초안과 **그 줄의 장부**다.
 *
 * 장부는 갈래마다 출처가 달라(실사가 준 값 · 잔액 조회) 화면이 먼저 하나로 모아 넘긴다.
 * 실물은 여기서 파생한다 — **파생 자리가 하나여야** 표가 보여 준 실물과 다른 값이 생기지 않는다.
 */
export interface AdjustLineRow {
  draft: AdjustLineDraft;
  bookQty: BookQtyState;
}

export interface AdjustLineTableProps {
  rows: AdjustLineRow[];
  /** 줄 단위 오류. 열쇠는 `lineFieldId`가 만든다 — 줄이 둘 이상일 때 서로 섞이지 않는다 */
  errors: Record<string, string>;
  locationLookup: ReferenceSource;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotLookupResult;
  locationOptions: SelectOption[];
  itemOptions: SelectOption[];
  uomOptions: SelectOption[];
  /** 전체가 잠겼는가. 잠긴 사유는 표 안이 아니라 조작 자리에 한 번 선다 */
  isLocked?: boolean;
  onPatch: (key: string, patch: Partial<Omit<AdjustLineDraft, 'key'>>) => void;
  onRemove: (key: string) => void;
}

/**
 * 조정 라인 표 — **「장부 · 실물 · 차이」 세 열이 이 화면의 요점이다**(조심 ③ · D-5).
 *
 * ⭐ **입력칸은 「차이」 하나뿐이다.** 「실물」은 `장부 + 차이`로 계산해 읽기 전용으로 보인다 —
 * 실물을 입력칸으로 두면 그것이 곧 결과 수량 입력이 되어, 스펙이 ⛔로 든 「보유 수량 [ 180 ]」과
 * 같은 오독을 부른다. 세 열을 다 보이는 것은 **덮어쓰기로 읽히지 않게** 하려면 장부가 보여야
 * 하고, 차이가 얼마인지 눈으로 맞추려면 실물이 보여야 하기 때문이다.
 *
 * ⭐ **차이에 하한이 없다**(조심 ② · D-4). 줄이는 조정이 정상 경로다. 차이가 0인 줄은 오류가
 * 아니라 **제외**이고, 그 사실은 막는 것이 아니라 표식으로 밝힌다.
 *
 * **라인 사유 칸이 없다**(D-7 · 미결 #87). 조정 라인에 사유를 담을 자리가 아직 없어 보낼 곳이
 * 없다 — 실사에서 실려 온 사유만 **읽기 전용 글자**로 보인다. 고를 수 있는 칸을 두면 사용자가
 * 고른 값이 어디에도 저장되지 않는다.
 *
 * 열 폭의 도출(흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 위치 | 152px | 「코드 · 이름」 또는 `sm` 선택칸 |
 * | **품목** | **미지정** | 「코드 · 이름」과 단위 선택칸을 담고 남는 폭을 흡수한다 |
 * | 자재 LOT | 136px | LOT 번호 또는 `sm` 선택칸 |
 * | 장부 | 112px | 수 + 단위 표기 · 네 갈래 문구 |
 * | 실물 | 112px | 수 + 단위 표기 |
 * | 차이 | 152px | `sm` 입력칸 + 단위 + 인라인 오류 |
 * | 행 조작 | 64px | 아이콘 버튼 하나 |
 * | **지정 폭 합** | **728px** | |
 * | 흡수 열 예산 | 184px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **912px** | `58rem`(928px) 안에 든다 |
 *
 * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다 — `aria-label`에 줄번호를 넣는다
 * (배치 규범 3의 이탈 조건). **내부 번호를 넣지 않는다** — 그것이 화면 밖으로 새는 경로다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const AdjustLineTable = ({
  rows,
  errors,
  locationLookup,
  itemLookup,
  uomLookup,
  lotLookup,
  locationOptions,
  itemOptions,
  uomOptions,
  isLocked = false,
  onPatch,
  onRemove,
}: AdjustLineTableProps) => {
  const errorOf = (row: AdjustLineRow, field: LineFieldName): string | undefined =>
    errors[lineFieldId(row.draft.key, field)];

  /**
   * 단위 이름. **고르지 않았으면 빈 글자다** — 「알 수 없음」을 단위 자리에 붙이면 수량이
   * 잘못된 것처럼 읽힌다.
   */
  const uomNameOf = (row: AdjustLineRow): string =>
    row.draft.uomId === ''
      ? ''
      : describeReference(toReference(uomLookup, Number(row.draft.uomId)));

  /** 실사에서 승계한 줄인가. 위치·품목·LOT·단위를 고칠 수 없는 사정이 이 값 하나다. */
  const isInherited = (row: AdjustLineRow): boolean => row.draft.countLineId !== null;

  const columns: Column<AdjustLineRow>[] = [
    {
      key: 'location',
      header: t.lineTable.location,
      width: '152px',
      render: (row, rowIndex) =>
        isInherited(row) ? (
          <>
            {describeReference(toReference(locationLookup, Number(row.draft.locationId)))}
            <Chip variant="status" status="info" size="sm">
              {t.lineTable.inherited}
            </Chip>
          </>
        ) : (
          <Select
            size="sm"
            options={locationOptions}
            value={row.draft.locationId === '' ? null : row.draft.locationId}
            invalid={errorOf(row, 'locationId') !== undefined}
            disabled={isLocked}
            aria-label={t.lineTable.locationLabel(rowIndex + 1)}
            onChange={(value) => {
              onPatch(row.draft.key, { locationId: value });
            }}
          />
        ),
    },
    {
      key: 'item',
      header: t.lineTable.item,
      /*
       * **품목과 단위가 한 칸에 산다.** 단위 열을 따로 두면 세 수량 열 사이에 끼어 「장부 ·
       * 실물 · 차이」가 끊기고, 그 셋이 한눈에 짝지어 읽히는 것이 이 화면의 요점이다.
       */
      render: (row, rowIndex) =>
        isInherited(row) ? (
          <div className="field-cell">
            {describeReference(toReference(itemLookup, Number(row.draft.itemId)))}
            {/*
             * **실사에서 적은 사유는 글자로만 보인다**(D-7). 고를 수 있는 칸을 두면 사용자가
             * 고른 값이 어디에도 저장되지 않는다 — 조정 라인에 사유를 담을 자리가 없다.
             */}
            {row.draft.countReasonCode !== null && (
              <span className="field-note">
                {t.lineTable.countReason(row.draft.countReasonCode)}
              </span>
            )}
          </div>
        ) : (
          <div className="field-cell">
            <Select
              size="sm"
              options={itemOptions}
              value={row.draft.itemId === '' ? null : row.draft.itemId}
              invalid={errorOf(row, 'itemId') !== undefined}
              disabled={isLocked}
              aria-label={t.lineTable.itemLabel(rowIndex + 1)}
              onChange={(value) => {
                /*
                 * 품목이 바뀌면 **그 품목의 LOT이 아닌 값이 남는다** — 함께 비운다.
                 * 남겨 두면 서버가 거절할 짝이 화면에서는 정상으로 보인다.
                 */
                onPatch(row.draft.key, { itemId: value, lotId: '' });
              }}
            />
            <Select
              size="sm"
              options={uomOptions}
              value={row.draft.uomId === '' ? null : row.draft.uomId}
              invalid={errorOf(row, 'uomId') !== undefined}
              disabled={isLocked}
              aria-label={t.lineTable.uomLabel(rowIndex + 1)}
              onChange={(value) => {
                onPatch(row.draft.key, { uomId: value });
              }}
            />
          </div>
        ),
    },
    {
      key: 'lot',
      header: t.lineTable.lot,
      width: '136px',
      /*
       * **`''`은 빈 값이지 참조 실패가 아니다.** 「알 수 없음」으로 내면 *값이 잘못됐다*는 뜻이
       * 되어 사용자가 반대로 읽는다 — 참조를 부르기 전에 갈라 낸다.
       */
      render: (row, rowIndex) =>
        isInherited(row) ? (
          row.draft.lotId === '' ? (
            t.values.empty
          ) : (
            describeReference(toReference(lotLookup, Number(row.draft.lotId)))
          )
        ) : (
          <Select
            size="sm"
            options={lotOptionsFor(lotLookup, row.draft.itemId)}
            value={row.draft.lotId === '' ? null : row.draft.lotId}
            disabled={isLocked}
            aria-label={t.lineTable.lotLabel(rowIndex + 1)}
            onChange={(value) => {
              onPatch(row.draft.key, { lotId: value });
            }}
          />
        ),
    },
    {
      key: 'bookQty',
      header: t.lineTable.bookQty,
      align: 'end',
      width: '112px',
      /* **읽기 전용이다.** 장부는 시스템이 아는 값이고 이 화면이 고치는 값이 아니다. */
      render: (row) => describeBookQty(row.bookQty, uomNameOf(row)),
    },
    {
      key: 'actualQty',
      header: t.lineTable.actualQty,
      align: 'end',
      width: '112px',
      /*
       * **파생 값이고 입력칸이 아니다**(D-5). 이 칸이 `textbox`가 되는 순간 화면이 결과 수량을
       * 받는 자리가 되고, 잔량을 직접 고치지 않는다는 규율이 무너진다.
       */
      render: (row) =>
        describeActualQty(
          deriveActualQty(row.bookQty, readQty(row.draft.adjustmentQtyText)),
          uomNameOf(row),
        ),
    },
    {
      key: 'adjustmentQty',
      header: t.lineTable.adjustmentQty,
      width: '152px',
      /*
       * **이 표의 유일한 입력칸이다.** `type="number"`를 쓰지 않는다 — 브라우저가 「-」만 친
       * 중간 상태를 빈 값으로 되돌려, 음수를 치는 정상 경로에서 값이 사라진다.
       */
      render: (row, rowIndex) => (
        <div className="field-cell">
          <TextField
            size="sm"
            fullWidth
            inputMode="decimal"
            aria-label={t.lineTable.adjustmentQtyLabel(rowIndex + 1)}
            value={row.draft.adjustmentQtyText}
            disabled={isLocked}
            error={errorOf(row, 'adjustmentQty')}
            helperText={uomNameOf(row) === '' ? undefined : uomNameOf(row)}
            onChange={(event) => {
              onPatch(row.draft.key, { adjustmentQtyText: event.target.value });
            }}
          />
          {/* 차이 0은 **오류가 아니라 제외**다 — 막지 않고 무엇이 일어나는지만 밝힌다. */}
          {isExcludedLine(row.draft) && (
            <Chip variant="status" status="warning" size="sm">
              {t.lineTable.excluded}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'rowActions',
      header: t.lineTable.rowActions,
      width: '64px',
      render: (row, rowIndex) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={t.actions.removeLine(rowIndex + 1)}
          disabled={isLocked}
          onClick={() => {
            onRemove(row.draft.key);
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
      <Table density="compact" columns={columns} rows={rows} getRowId={(row) => row.draft.key} />
    </div>
  );
};
