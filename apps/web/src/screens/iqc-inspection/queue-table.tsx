import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from './status-badge';
import { formatDateTime, type InspectionQueueRow } from './types';
import type { ItemNameLookup, NameLookup } from './reference-lookup';

/**
 * 좌측 검사 대기 큐의 표.
 *
 * **네 칸뿐이다.** 이 창이 화면의 약 1/3 폭이라(화면 스펙 §3) 고르는 데 필요한 것만 싣는다 —
 * 품목·수량 같은 나머지는 고른 뒤 우측 창이 보인다.
 *
 * **의뢰번호 칸이 곧 「이 줄을 연다」다.** 저장소의 목록 창들이 쓰는 관용구와 같은 형태이며
 * (`users-roles/user-list-pane.tsx` 등), 고른 줄은 `aria-current` 로 표시한다.
 *
 * ⚠ **자재 LOT 을 번호로 그린다.** 계약이 식별자(정수)만 주고 LOT 번호 문자열을 주지 않는다.
 * 이름을 채우는 참조 조회를 얹지 않는 이유는 `queries.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.queue;

export interface QueueTableProps {
  rows: InspectionQueueRow[];
  /** 품목 풀이. 첫 칸이 **이름과 코드를 두 줄로** 세운다(사용자 지시 2026-09-21). */
  itemNames: ItemNameLookup;
  /** 자재 LOT 번호 풀이. **번호가 아니라 LOT 번호를 보인다**(omf-all-around#40). */
  lotNumbers: NameLookup;
  /** 고른 의뢰. 없으면 `null` — 아무 줄도 현재가 아니다 */
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 결과가 없을 때 표 자리에 그릴 것. 조회 실패와 빈 결과는 부르는 쪽이 가른다 */
  empty: ReactNode;
}

const columnsOf = (
  selectedId: number | null,
  onSelect: (inspectionRequestId: number) => void,
  itemNames: ItemNameLookup,
  lotNumbers: NameLookup,
): Column<InspectionQueueRow>[] => [
  {
    /* 첫 칸은 자재 LOT — 검사자가 손에 든 LOT 으로 줄을 찾는다(#133 · 담당자 지시). */
    key: 'lotId',
    header: t.columns.lotId,
    width: '35%',
    /*
     * 열 폭은 품목 40 · LOT 35 · 상태 10 · 일시 15(%)로 고정한다(#133) — 값 길이로 폭이 흔들리지 않는다.
     * LOT 번호는 한 줄이고, 모자라면 앞 마디만 말줄임이다(`iqc-inspection-lot`).
     *
     * 없는 것이 정상이다(작업지시 대상 검사 등) — 빈 칸으로 두면 못 불러온 것과 구분되지 않아
     * 풀이가 네 갈래를 서로 다른 글자로 낸다.
     */
    render: (row) => {
      const lotNo = lotNumbers.labelOf(row.lotId);
      /* 줄을 바꾸지 않고 말줄임 — 전체 번호는 마우스를 올리면 보인다. */
      /*
       * 끝 마디(일련번호)는 늘 보이게 앞쪽만 줄인다 — 같은 품목·같은 날 LOT 은 끝 마디만 달라, 끝이 잘리면
       * 줄끼리 구분이 안 된다(omf-all-around#133). 구분자가 없으면 통째로 말줄임이다.
       * 4M 변경품이면 번호 오른쪽에 작게 붙인다 — 번호가 줄어도 표시는 남는다(omf-all-around#63).
       */
      const cut = lotNo.lastIndexOf('|') + 1;
      return (
        <span className="iqc-inspection-lot-cell">
          <span className="iqc-inspection-lot" title={lotNo}>
            {cut > 0 && cut < lotNo.length ? (
              <>
                <span className="iqc-inspection-lot-head">{lotNo.slice(0, cut)}</span>
                <span className="iqc-inspection-lot-tail">{lotNo.slice(cut)}</span>
              </>
            ) : (
              lotNo
            )}
          </span>
          {row.isFourMChange && (
            <Chip variant="status" size="sm" status="warning" title={t.fourMBadgeTitle}>
              {t.fourMBadge}
            </Chip>
          )}
        </span>
      );
    },
  },
  {
    key: 'item',
    header: t.columns.item,
    /* 「이름 / 코드」. 긴 이름은 두 줄까지 보이고 넘으면 말줄임, 전체 값은 마우스를 올리면 보인다(#133). */
    width: '40%',
    /*
     * **이 칸이 곧 「이 줄을 연다」다**(둘째 칸 · #133) — 저장소의 목록 창들과 같은 관용구다. 종전에는 그 자리가
     * 의뢰번호였는데, 고르는 데 필요한 값이 아니고 고른 뒤 우측 창이 먼저 보여 주므로
     * **검사자가 실제로 찾는 값**(무엇을 검사하는가)에 자리를 내줬다(사용자 지시 2026-09-21).
     *
     * 이름과 코드를 **두 줄로** 세운다 — 좁은 칸에서 한 줄로 붙이면 이름이 잘려 무엇인지 알 수
     * 없다. 못 푼 갈래는 줄이 하나뿐이라 풀이가 네 갈래의 사유를 그 자리에 낸다.
     */
    render: (row) => {
      const parts = itemNames.partsOf(row.itemId);
      const label = itemNames.labelOf(row.itemId);

      return (
        <button
          type="button"
          className="link-cell iqc-inspection-queue-item"
          aria-current={row.inspectionRequestId === selectedId ? 'true' : undefined}
          title={parts === null ? label : `${parts.name} · ${parts.code}`}
          aria-label={t.openRow(
            parts === null ? label : `${parts.name} ${parts.code}`,
            row.inspectionRequestNo,
          )}
          onClick={() => onSelect(row.inspectionRequestId)}
        >
          {parts === null ? (
            <span className="iqc-inspection-queue-item-name">{label}</span>
          ) : (
            <>
              <span className="iqc-inspection-queue-item-name">{parts.name}</span>
              <span className="iqc-inspection-queue-item-code">{parts.code}</span>
            </>
          )}
        </button>
      );
    },
  },
  {
    key: 'statusCode',
    header: t.columns.statusCode,
    width: '10%',
    render: (row) => {
      const badge = toStatusBadge(row.statusCode);

      return (
        <Chip variant="status" size="sm" status={badge.tone}>
          {badge.label}
        </Chip>
      );
    },
  },
  {
    key: 'requestedAt',
    header: t.columns.requestedAt,
    width: '15%',
    sortable: true,
    /* 정렬은 원문(RFC3339)으로 한다 — 표기용 문자열로 정렬하면 형식이 아닌 값이 섞일 때 어긋난다. */
    sortAccessor: (row) => row.requestedAt,
    /* 날짜·시각은 한 줄로 온전히 보인다. */
    render: (row) => (
      <span className="iqc-inspection-requested-at">{formatDateTime(row.requestedAt)}</span>
    ),
  },
];

export const QueueTable = ({
  rows,
  itemNames,
  lotNumbers,
  selectedId,
  onSelect,
  empty,
}: QueueTableProps) => (
  /*
   * 줄 아무 곳이나 눌러도 고른다(omf-all-around#133) — DS 표에 줄 클릭이 없어 눌린 줄의 품목 단추로 넘긴다.
   * 키보드·화면 낭독기는 종전처럼 그 단추 하나로 고른다(줄마다 탭 멈춤을 늘리지 않는다).
   */
  <div
    className="iqc-inspection-queue-rows"
    onClick={(event) => {
      const target = event.target as Element;
      if (target.closest('button, a, input, select, textarea') !== null) return;
      target
        .closest('tbody tr')
        ?.querySelector<HTMLButtonElement>('.iqc-inspection-queue-item')
        ?.click();
    }}
  >
    <Table
      /* 제목은 화면에서 감추고 표의 접근 이름으로만 남긴다. */
      caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
      density="compact"
      columns={columnsOf(selectedId, onSelect, itemNames, lotNumbers)}
      rows={rows}
      getRowId={(row) => String(row.inspectionRequestId)}
      empty={empty}
    />
  </div>
);
