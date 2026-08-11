import { StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeBlindCount, type CountSummaryView, type CountView } from './types';

const t = messages.stocktaking;

export interface SummaryPaneProps {
  count: CountView;
  summary: CountSummaryView;
  /**
   * 창고 이름. **화면이 참조를 풀어 넘긴다** — 이 부품 안에 번호를 문자열로 만드는 자리를
   * 두지 않으면 그 값이 제목줄로 샐 경로도 없다(#44).
   */
  warehouseName: string;
}

interface HeadingItem {
  key: string;
  label: string;
  value: ReactNode;
}

interface SummaryCell {
  key: string;
  label: string;
  value: number;
}

/**
 * 고른 실사의 제목줄과 **요약 4칸**.
 *
 * **요약을 화면이 세지 않는다**(착수 이슈 §6 ⭐ · 계획 결정 5). 서버가 계산해 상세 응답에
 * 함께 내려준 네 건수를 그대로 보인다 — 창고 하나의 라인이 수백~수천 건이라 전 라인을 받아
 * 세면 쪽과 어긋나고, 라인 목록의 `page.total`로 대신해도 위치로 좁혀 받은 수라 합계가 다르다.
 * 그래서 이 부품은 **라인을 받지 않는다.** 셀 수 있는 재료가 없으면 세는 코드도 생기지 않는다.
 *
 * **`StatCard`의 `status`(색 점)와 `delta`를 쓰지 않는다**(계획 결정 5). 색만으로 「마감할 수
 * 있다/없다」를 전하면 명도 대비·색각 이상에서 뜻이 사라지고, 증감은 견줄 앞 값이 없다.
 * 판정의 정본은 **마감 버튼의 사유 텍스트**이며 그 자리는 PR ④다.
 *
 * **상태 코드를 해석하지 않는다**(공유계약 G-2). 값 집합이 확정되지 않아 화면이 「마감됨」을
 * 판정하면 값이 정해질 때 조용히 틀린다 — 서버가 준 코드를 평문으로 그대로 낸다.
 *
 * **블라인드는 읽기 전용 표기다**(계획 결정 4 · 어긋남 9). 착수 이슈는 「개시 후에는 컨트롤을
 * 비활성으로」라 했으나 실사 헤더를 고치는 오퍼레이션이 계약에 아예 없다(실측) — 비활성
 * 컨트롤을 두면 「언젠가 켜질 수 있는 것」으로 읽힌다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SummaryPane = ({ count, summary, warehouseName }: SummaryPaneProps) => {
  const headingItems: HeadingItem[] = [
    { key: 'inventoryCountNo', label: t.detail.inventoryCountNo, value: count.inventoryCountNo },
    { key: 'countTypeCode', label: t.detail.countType, value: count.countTypeCode },
    { key: 'warehouse', label: t.detail.warehouse, value: warehouseName },
    { key: 'plannedDate', label: t.detail.plannedDate, value: count.plannedDate },
    { key: 'blindCount', label: t.detail.blindCount, value: describeBlindCount(count.blindCount) },
    { key: 'statusCode', label: t.detail.status, value: count.statusCode },
  ];

  /* 네 칸의 차례가 곧 실사의 진행 순서다 — 계획한 것 · 센 것 · 남은 것 · 어긋난 것. */
  const summaryCells: SummaryCell[] = [
    { key: 'plannedCount', label: t.detail.planned, value: summary.plannedCount },
    { key: 'countedCount', label: t.detail.counted, value: summary.countedCount },
    { key: 'uncountedCount', label: t.detail.uncounted, value: summary.uncountedCount },
    { key: 'varianceCount', label: t.detail.variance, value: summary.varianceCount },
  ];

  return (
    <>
      {/* 이름·값 짝을 한 덩어리로 낸다. 폼이 아니라 **값 표기**다(배치 규범 3). */}
      <div role="group" aria-label={t.detail.label}>
        <dl className="filter-bar">
          {headingItems.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {count.blindCount && <p className="field-note">{t.detail.blindNote}</p>}

      <div className="filter-bar" role="group" aria-label={t.detail.summaryLabel}>
        {summaryCells.map((cell) => (
          <StatCard
            key={cell.key}
            label={cell.label}
            /*
             * **서버가 준 수를 그대로 낸다.** 자릿수 구분·반올림을 붙이지 않는다 —
             * 화면이 값을 손대는 자리를 만들면 「그대로 보인다」가 곧 깨진다.
             */
            value={String(cell.value)}
            unit={t.detail.countUnit}
          />
        ))}
      </div>

      {/* 이 숫자가 어디서 왔는지 밝힌다 — 밝히지 않으면 화면이 센 것으로 읽힌다. */}
      <p className="field-note">{t.detail.summaryNote}</p>
    </>
  );
};
