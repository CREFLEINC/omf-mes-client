import { Button, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isLinePosted } from './approval-progress';
import {
  describeReference,
  isLotHeld,
  toReference,
  type LotReferenceSource,
  type ReferenceSource,
} from './lookups';
import type { IssueLineView } from './types';

const t = messages.disposalIssue;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * 열 폭 예산을 재는 감지기가 이 값을 읽는다 — 숫자를 테스트가 따로 적으면 배치 규범이 바뀔 때
 * 둘이 갈린다. 표마다 자기 상수를 갖는다: 한 표의 열 구성이 바뀔 때 다른 표가 끌려가면 안 된다.
 */
export const ISSUE_LINE_TABLE_MIN_WIDTH_PX = 928;

export interface IssueLineColumnsInput {
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: LotReferenceSource;
  locationLookup: ReferenceSource;
}

/**
 * 품의 라인 표의 열 구성 — **다섯이고 전부 읽기다.**
 *
 * **이 표에는 입력칸도 선택칸도 없다.** 이미 만들어진 전표의 라인이라 이 화면에서 고치지
 * 않는다 — 계약에 라인 치환 경로가 있으나 「전기된 전표의 라인은 바꿀 수 없다」이고, 무엇보다
 * 이 화면의 소관은 **만들고 처리하는 것**이지 고치는 것이 아니다.
 *
 * **줄번호·단위 열을 두지 않는다.** 서버가 부여한 순번은 사용자에게 뜻이 적고(계획 §5.5),
 * 단위는 수량 표기에 붙인다(「40 SAMPLE-UOM-EA」 — W-01-03이 세운 처리).
 *
 * **전기 열이 이 표에만 있는 이유**: 「이 전표가 실제로 재고를 움직였는가」는 라인의 원장 라인
 * 유무로만 알 수 있고(계획 결정 7), 그 값은 상세 응답의 라인에만 실려 온다 — 목록 응답에는
 * 없어서 이력 목록에 그 열을 둘 수 없다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다(예산 200px) |
 * | 자재 LOT | 168px | LOT 번호 15자 113px + 4갈래 표기 + **보류 표식** |
 * | 위치 | 136px | 「코드 · 이름」 |
 * | 폐기 수량 | 120px | 수 + 단위 표기 |
 * | **전기** | 112px | 「전기됨 / 전기 전」 |
 * | **지정 폭 합** | **536px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **736px** | `58rem`(928px) 안에 들어간다 |
 *
 * **흡수 열이 실제로 받는 폭은 392px**(928 − 536)로 예산 200px보다 넓다 — 열 폭 합만 세는
 * 단언은 흡수 열이 몇십 px밖에 못 받는 어긋남을 놓치므로 **남는 폭까지 함께 단언한다**(C46).
 */
export const buildIssueLineColumns = ({
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
}: IssueLineColumnsInput): Column<IssueLineView>[] => [
  {
    key: 'item',
    header: t.issueLineTable.item,
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(`omf-mes#44`). 이름으로 풀 수 없는 세 갈래
     * (미도착·목록에 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => describeReference(toReference(itemLookup, row.itemId)),
  },
  {
    key: 'lot',
    header: t.issueLineTable.lot,
    width: '168px',
    render: (row) => (
      <>
        {describeReference(toReference(lotLookup, row.lotId))}
        {/*
         * 보류 표식은 **알리는 것이지 막는 것이 아니다.** 폐기는 보류·차단된 자재를 덜어
         * 내는 일이고, 여기는 이미 만들어진 전표라 막을 것도 없다. **색에만 기대지 않는다.**
         */}
        {isLotHeld(lotLookup, row.lotId) && (
          <span className="field-note">{t.values.lotHeld}</span>
        )}
      </>
    ),
  },
  {
    key: 'location',
    header: t.issueLineTable.location,
    width: '136px',
    render: (row) => describeReference(toReference(locationLookup, row.sourceLocationId)),
  },
  {
    key: 'issueQty',
    header: t.issueLineTable.issueQty,
    width: '120px',
    /* 단위를 수량에 붙인다 — 열을 늘리는 것보다 줄이는 것이 먼저다. */
    render: (row) =>
      t.issueLineTable.issueQtyPair(
        row.issueQty,
        describeReference(toReference(uomLookup, row.uomId)),
      ),
  },
  {
    key: 'posted',
    header: t.issueLineTable.posted,
    width: '112px',
    /*
     * **원장 라인 유무로만 갈린다**(계획 결정 7). 상태 코드로 판정하면 조용히 틀린다 —
     * 목이 전기 뒤에도 초안 상태를 그대로 주는 것이 실측됐다. 판정 자체는
     * `approval-progress.ts` 한 곳에 있고 이 표는 그 결과를 글자로 옮기기만 한다.
     */
    render: (row) => (isLinePosted(row) ? t.values.posted : t.values.notPosted),
  },
];

export interface IssueLineTableProps extends IssueLineColumnsInput {
  rows: IssueLineView[];
  /** 이름 참조가 하나라도 실패했는가. 사유와 복구 경로를 표 아래에 함께 낸다. */
  hasReferenceError: boolean;
  onRetryReferences: () => void;
}

/**
 * 품의 라인 표.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 — 바깥에서
 * 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다. 계약이 라인 최소 개수를 강제하지
 * 않아(실측) **라인이 없는 전표가 실제로 만들어질 수 있다.**
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const IssueLineTable = ({
  rows,
  itemLookup,
  uomLookup,
  lotLookup,
  locationLookup,
  hasReferenceError,
  onRetryReferences,
}: IssueLineTableProps) => {
  const columns = buildIssueLineColumns({ itemLookup, uomLookup, lotLookup, locationLookup });

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰인다.
           * 미지정이면 인덱스가 key가 되어 줄 구성이 바뀔 때 앞 줄의 표식이 남아 보인다.
           */
          getRowId={(row) => String(row.goodsIssueLineId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noIssueLinesTitle}
              description={t.empty.noIssueLinesDescription}
            />
          }
        />
      </div>

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
