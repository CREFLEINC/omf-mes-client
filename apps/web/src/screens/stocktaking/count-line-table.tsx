import {
  Button,
  type Column,
  EmptyState,
  Select,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { codeNote, codePlaceholder } from './code-options';
import type { LineRowView } from './line-replace-request';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { SelectOption } from './types';

const t = messages.stocktaking;

export interface CountLineColumnsInput {
  /**
   * 블라인드 실사인가. **열 구성이 갈리는 유일한 축**이다(계획 결정 4).
   *
   * 값이 아니라 **실사 헤더가 정한 사실**을 쓴다 — 줄마다 `systemQty`가 왔는지로 판정하면
   * 한 줄만 빠진 어긋난 응답에서 열이 나타났다 사라진다.
   */
  isBlind: boolean;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: ReferenceSource;
  /** 차이 사유 선택지. 값 목록이 확정되지 않아 지금은 비어 있다(승인 G1). */
  reasonOptions: SelectOption[];
  /** 전송 중인가. 표 안 두 칸이 함께 잠긴다(수명 표 18행). */
  isLocked: boolean;
  onChangeQty: (inventoryCountLineId: number, text: string) => void;
  onChangeReason: (inventoryCountLineId: number, code: string) => void;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: ReactNode | null): ReactNode => value ?? t.values.empty;

/**
 * 수량 하나의 표기. **단위를 수량에 붙인다** — 단위 열을 따로 두면 폭이 100px 넘게 들고,
 * 정작 필요한 순간(수량을 읽을 때)에는 눈이 표를 가로질러야 한다(W-01-03이 세운 처리).
 *
 * **수량이 오지 않았으면 그 사정을 밝힌다**(계획 결정 4 · 어긋남 1). 계약은 `systemQty`를
 * 필수로 두면서 설명에는 「블라인드 실사에서는 내려보내지 않는다」라 적었다 — 타입을 믿고
 * 그대로 그리면 `undefined`가 수량 자리에 나온다.
 */
const describeQty = (qty: number | null, uomName: string): string =>
  qty === null ? t.values.qtyNotProvided : t.lineTable.qtyWithUom(String(qty), uomName);

/**
 * 고른 위치의 라인 표 — **이 저장소에서 표 안 입력칸이 둘인 첫 자리다.**
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 64px | 두 자리 수 + 우측정렬 여백 |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 자재 LOT | 152px | LOT 번호 + 4갈래 표기 |
 * | 장부 수량 | 112px | 수 + 단위 표기 · **블라인드에서 빠진다** |
 * | 실물 수량 | 136px | `sm` 입력칸 + 단위 표기 + 인라인 오류 |
 * | 차이 | 96px | 부호 있는 수 + 낡음 표식 · **블라인드에서 빠진다** |
 * | 차이 사유 | 184px | `sm` 선택칸(자리표시 문구가 들어간다) |
 * | **지정 폭 합** | **744px** | 블라인드에서는 536px |
 * | 흡수 열 예산 | 184px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **928px** | `58rem`에 정확히 맞는다 |
 *
 * **장부와 차이가 함께 빠지는 것이 요점이다**(감지기 M30). 차이만 보여도
 * **실물 − 차이 = 장부**로 역산되어 블라인드가 무의미해진다 — 한쪽만 감추면 감춘 뜻이 없다.
 * 요약 4칸의 차이 건수는 그대로 보인다(건수는 개별 장부 수량을 드러내지 않는다).
 *
 * **카운트 시각·담당자 열이 없다**(계획 결정 9). 착수 이슈 §4가 「카운트 시각 컬럼이 비지
 * 않도록 설계돼 있어 미실사를 판정할 수 없다」고 밝힌 값이라, 표에 내면 사용자가 실사 여부로
 * 읽는다 — 화면 타입에 자리조차 두지 않아 여기로 샐 경로가 없다.
 *
 * **위치 열도 없다** — 표 전체의 축이라 위 선택칸에서 보인다.
 */
export const buildCountLineColumns = ({
  isBlind,
  itemLookup,
  uomLookup,
  lotLookup,
  reasonOptions,
  isLocked,
  onChangeQty,
  onChangeReason,
}: CountLineColumnsInput): Column<LineRowView>[] => {
  const uomNameOf = (row: LineRowView): string =>
    describeReference(toReference(uomLookup, row.line.uomId));

  const systemQtyColumn: Column<LineRowView> = {
    key: 'systemQty',
    header: t.lineTable.systemQty,
    align: 'end',
    width: '112px',
    render: (row) => describeQty(row.line.systemQty, uomNameOf(row)),
  };

  const varianceColumn: Column<LineRowView> = {
    key: 'variance',
    header: t.lineTable.variance,
    align: 'end',
    width: '96px',
    /*
     * **서버가 준 값만 낸다**(감지기 M45). 실물에서 장부를 빼는 계산을 화면에서 다시 하지
     * 않는다(착수 이슈 §6) — 대신 친 값이 저장된 값과 다르면 **낡았다는 사실만** 밝힌다.
     * 그것이 「계산하지 않는다」와 「낡은 값을 그대로 두지 않는다」를 함께 지키는 유일한 형태다.
     */
    render: (row) => (
      <>
        {row.line.varianceQty === null ? t.values.qtyNotProvided : String(row.line.varianceQty)}
        {row.isVarianceStale && <span className="field-note">{t.lineTable.varianceStale}</span>}
      </>
    ),
  };

  return [
    {
      key: 'lineNo',
      header: t.lineTable.lineNo,
      align: 'end',
      width: '64px',
      render: (row) => row.line.lineNo,
    },
    {
      key: 'item',
      header: t.lineTable.item,
      /*
       * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
       * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
       */
      render: (row) => describeReference(toReference(itemLookup, row.line.itemId)),
    },
    {
      key: 'lot',
      header: t.lineTable.lot,
      width: '152px',
      /*
       * **`null`은 빈 값이지 참조 실패가 아니다**(W-01-10 전례). 「알 수 없음」으로 내면
       * *값이 잘못됐다*는 뜻이 되어 사용자가 반대로 읽는다 — 참조를 부르기 전에 갈라 낸다.
       */
      render: (row) =>
        orEmptyMark(
          row.line.lotId === null ? null : describeReference(toReference(lotLookup, row.line.lotId)),
        ),
    },
    ...(isBlind ? [] : [systemQtyColumn]),
    {
      key: 'countedQty',
      header: t.lineTable.countedQty,
      width: '136px',
      /*
       * **표 안의 입력칸.** 보이는 라벨을 둘 자리가 없어 `aria-label`로 준다(배치 규범 3의
       * 이탈 조건). 이름에 **줄번호**를 넣는다 — 「실물 수량」이 줄마다 되풀이되면 어느 줄인지
       * 알 수 없다. 내부 번호를 넣지 않는 것은 그것이 화면 밖으로 새는 또 하나의 경로여서다.
       *
       * 단위는 `helperText`로 붙인다. 오류가 있으면 디자인 시스템이 오류 문구로 대체하는데,
       * 그 순간에는 단위보다 「무엇이 잘못됐는지」가 먼저 읽혀야 하므로 그 규칙을 그대로 쓴다.
       */
      render: (row) => (
        <TextField
          size="sm"
          fullWidth
          inputMode="decimal"
          aria-label={t.lineTable.countedQtyLabel(row.line.lineNo)}
          value={row.qtyText}
          disabled={isLocked}
          error={row.qty.kind === 'invalid' ? row.qty.message : undefined}
          helperText={t.lineTable.qtyWithUom('', uomNameOf(row)).trim()}
          onChange={(event) => {
            onChangeQty(row.line.inventoryCountLineId, event.target.value);
          }}
        />
      ),
    },
    ...(isBlind ? [] : [varianceColumn]),
    {
      key: 'reason',
      header: t.lineTable.reason,
      width: '184px',
      /*
       * **필수 표시를 화면이 지어내지 않는다.** 필수 여부는 `variance-rule.ts`가 판정하고
       * (감지기 M36) 이 칸은 그 결과를 `invalid`로 받는다 — 여기서 다시 비교하면 표시와
       * 저장 판정이 갈린다.
       */
      render: (row) => (
        <div className="field-cell">
          <Select
            size="sm"
            aria-label={t.lineTable.reasonLabel(row.line.lineNo)}
            options={reasonOptions}
            value={row.reasonCode === '' ? null : row.reasonCode}
            placeholder={codePlaceholder()}
            disabled={isLocked}
            invalid={row.reason.kind === 'invalid' || (row.isReasonRequired && row.reason.kind === 'none')}
            onChange={(value) => {
              onChangeReason(row.line.inventoryCountLineId, value);
            }}
          />
          {row.reason.kind === 'invalid' && (
            <span className="field-error">{row.reason.message}</span>
          )}
          {codeNote(reasonOptions) !== undefined && (
            <span className="field-note">{codeNote(reasonOptions)}</span>
          )}
        </div>
      ),
    },
  ];
};

export interface CountLineTableProps extends CountLineColumnsInput {
  rows: LineRowView[];
  isLoading: boolean;
  /** 이 위치의 라인을 전부 받지 못했는가. **표식과 저장 차단이 같은 사실을 말한다.** */
  isTruncated: boolean;
  onRetryReferences: () => void;
}

/**
 * 고른 위치의 라인 표와 그 안내.
 *
 * **빈 상태를 표의 `empty`가 맡는다**(감지기 M34). 바깥에서 0건을 갈라 다른 것을 그리면
 * `empty`가 닿을 수 없는 죽은 가지가 된다(W-01-07 Minor의 형태).
 *
 * **치환의 뜻을 표 위에서 늘 밝힌다**(계획 결정 15). 저장 확인 창을 두지 않는 대신 이 안내가
 * 항상 보인다 — 파괴 경로(부분 저장)는 **전 줄 필수**와 **잘림 차단**이 구조로 막으므로 창이
 * 지킬 것이 없고, 위치마다 되풀이되는 조작에 마찰만 더한다.
 *
 * **좁히는 조건을 두지 않는다**(계획 결정 6 · 감지기 M44). 계약에 `uncountedOnly`·
 * `varianceOnly`·`itemId`가 있으나 그 조건으로 받은 목록을 저장하면 **나머지가 미실사로
 * 되돌아간다** — 조건을 만들지 않으면 그 사고 경로가 코드에 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const CountLineTable = ({
  rows,
  isLoading,
  isTruncated,
  isBlind,
  itemLookup,
  uomLookup,
  lotLookup,
  reasonOptions,
  isLocked,
  onChangeQty,
  onChangeReason,
  onRetryReferences,
}: CountLineTableProps) => {
  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.lines}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const columns = buildCountLineColumns({
    isBlind,
    itemLookup,
    uomLookup,
    lotLookup,
    reasonOptions,
    isLocked,
    onChangeQty,
    onChangeReason,
  });

  /* 이 표가 이름을 내는 참조 셋 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError = itemLookup.isError || uomLookup.isError || lotLookup.isError;

  return (
    <>
      <p className="field-note">{t.notes.replaceSemantics}</p>
      <p className="field-note">{t.notes.countedQtyEmptyStart}</p>

      {/*
       * **잘림은 경고가 아니라 차단이다**(계획 결정 8). 못 받은 줄이 치환에 실리지 않으면
       * 그 줄이 미실사로 되돌아간다 — 살아 있는 영역으로 알려 표를 보지 않는 사용자에게도 닿게 한다.
       */}
      {isTruncated && (
        <p className="field-error" role="status">
          {t.reasons.linesTruncated}
        </p>
      )}

      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰이며 셀 텍스트가
           * 되지 않는다. 미지정이면 인덱스가 key가 되어 위치를 바꿀 때 앞 위치의 줄에 친 값이
           * 새 줄의 입력칸에 남아 보일 수 있다.
           */
          getRowId={(row) => String(row.line.inventoryCountLineId)}
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

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" disabled={isLocked} onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
