import { messages } from '@omf-mes/i18n';
import { useEffect, useLayoutEffect, useState } from 'react';

import { formatFigure } from './types';
import { NoRecords, Panel } from './viz';
import type { NamedQty } from './viz-math';

const t = messages.dashboard.quality;
const v = messages.dashboard.viz;

/**
 * 품질 종합 「불량 유형」(⭐ 사용자 확정 2026-10-19) — 도넛 + 범례(유형명 · 수량 · 비율). 품질 종합 전용이다 — 다른
 * 탭의 구성비 · 파레토는 공용 부품을 그대로 쓴다.
 *
 * - 수량 큰 순. 범례가 카드 높이(같은 행 「최근 검사 LOT 판정 현황」이 정한다 · `.dash-qo-fit` 크기 봉쇄) 안에
 *   들어가는 만큼 유형을 하나씩 보이고, 나머지는 「기타 (n종)」 한 조각 · 한 줄로 합친다 — 도넛 합계는 늘 100%.
 *   넘치면 한 줄씩 덜어 내고, 크기 · 자료가 바뀌면 처음부터 다시 맞춘다(대시보드 「가동 외 설비」와 같은 방식).
 *   1열이면 따라갈 옆 카드가 없어 모두 보인다. 한 줄도 들어가지 않으면 자르지 않고 제 높이로 세운다.
 * - ⚠ 비율의 분모는 전체 유형 합이다(합친 뒤에도 같다).
 * - ⭐ 조각 위에는 글자를 얹지 않고 가운데에 전체 불량 수량을 둔다 — 비율은 범례 · 마우스 올림에서 읽는다
 *   (사용자 지시 2026-10-19 「차트 내부 비율 과도 표시 정리 · 중앙에 전체 불량 수량」).
 */

export interface DonutSlice extends NamedQty {
  /** 전체 유형 합 대비 비율(0~100). */
  share: number;
  /** 「기타」로 합친 유형 수. 합친 조각이 아니면 0. */
  merged: number;
}

/** 「기타」 조각의 키 — 유형 키(불량 코드 번호)와 겹치지 않는다. */
export const OTHER_SLICE_KEY = 'other';

/**
 * 수량 큰 순으로 앞에서 `shown` 개를 각각, 나머지를 「기타」 하나로. `shown` 이 유형 수 이상이면 모두 각각.
 * 같은 수량은 받은 순서를 지킨다.
 */
export const toDonutSlices = (entries: readonly NamedQty[], shown: number): DonutSlice[] => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
  const shareOf = (value: number): number => (total === 0 ? 0 : (Math.max(0, value) / total) * 100);
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, Math.max(0, shown));
  const rest = sorted.slice(head.length);
  const slices: DonutSlice[] = head.map((entry) => ({
    ...entry,
    share: shareOf(entry.value),
    merged: 0,
  }));

  if (rest.length > 0) {
    const value = rest.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
    slices.push({
      key: OTHER_SLICE_KEY,
      label: t.otherTypes(formatFigure(rest.length)),
      value,
      share: shareOf(value),
      merged: rest.length,
    });
  }

  return slices;
};

/**
 * 조각 색 — DS 정보 파랑과 차트 회색에서만(상태색 빨강 · 노랑 · 초록을 피한다). ⭐ 순위대로 파랑 · 회색을 번갈아
 * 짙은 것부터 옅게 — 이웃한 범례끼리 비슷한 색이 이어지지 않게(사용자 지시 2026-10-19). 여덟째부터 되풀이.
 */
const PALETTE_SIZE = 7;
const toneOf = (slice: DonutSlice, index: number): string =>
  slice.merged > 0 ? 'dash-donut-other' : `dash-donut-${String((index % PALETTE_SIZE) + 1)}`;

const formatShare = (share: number): string => `${String(Math.round(share))}%`;

const SIZE = 160;
const CENTER = SIZE / 2;
const OUTER = 78;
const INNER = 46;
const LABEL_R = (OUTER + INNER) / 2;

const pointAt = (radius: number, turn: number): [number, number] => {
  const angle = turn * 2 * Math.PI - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
};

/** 도넛 한 조각(시작 · 끝은 한 바퀴 비율). 한 바퀴 전체면 반 바퀴 둘로 그린다(호 하나로는 원이 닫히지 않는다). */
const arcPath = (start: number, end: number): string => {
  if (end - start >= 0.9999) return `${arcPath(0, 0.5)} ${arcPath(0.5, 1)}`;
  const large = end - start > 0.5 ? 1 : 0;
  const [ox1, oy1] = pointAt(OUTER, start);
  const [ox2, oy2] = pointAt(OUTER, end);
  const [ix2, iy2] = pointAt(INNER, end);
  const [ix1, iy1] = pointAt(INNER, start);
  return [
    `M ${String(ox1)} ${String(oy1)}`,
    `A ${String(OUTER)} ${String(OUTER)} 0 ${String(large)} 1 ${String(ox2)} ${String(oy2)}`,
    `L ${String(ix2)} ${String(iy2)}`,
    `A ${String(INNER)} ${String(INNER)} 0 ${String(large)} 0 ${String(ix1)} ${String(iy1)}`,
    'Z',
  ].join(' ');
};

const Donut = ({
  slices,
  caption,
  total,
}: {
  slices: DonutSlice[];
  caption: string;
  total: number;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  let turn = 0;
  const arcs = slices.map((slice, index) => {
    const start = turn;
    turn += slice.share / 100;
    return { slice, index, start, end: turn };
  });
  const tip = hovered === null ? null : arcs[hovered];
  const tipPoint =
    tip === undefined || tip === null ? null : pointAt(OUTER, (tip.start + tip.end) / 2);

  return (
    <figure className="dash-donut-figure">
      <svg
        className="dash-donut-svg"
        viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`}
        role="img"
        aria-label={caption}
      >
        <circle
          className="dash-donut-track"
          cx={CENTER}
          cy={CENTER}
          r={LABEL_R}
          strokeWidth={OUTER - INNER}
        />
        {arcs.map(({ slice, index, start, end }) =>
          end - start <= 0 ? null : (
            <path
              key={slice.key}
              className={`dash-donut-slice ${toneOf(slice, index)}`}
              d={arcPath(start, end)}
              onMouseEnter={() => {
                setHovered(index);
              }}
              onMouseLeave={() => {
                setHovered(null);
              }}
            />
          ),
        )}
        <text className="dash-donut-total" x={CENTER} y={CENTER - 4} textAnchor="middle">
          {formatFigure(total)}
          <tspan className="dash-donut-total-unit" dx={3}>
            {t.qtyUnit}
          </tspan>
        </text>
        <text className="dash-donut-total-label" x={CENTER} y={CENTER + 16} textAnchor="middle">
          {t.defectTypesTotal}
        </text>
      </svg>
      {tip !== null && tip !== undefined && tipPoint !== null && (
        <div
          className="dash-line-tip dash-donut-tip"
          role="tooltip"
          style={{
            left: `${String((tipPoint[0] / SIZE) * 100)}%`,
            top: `${String((tipPoint[1] / SIZE) * 100)}%`,
          }}
        >
          <span className="dash-line-tip-date">{tip.slice.label}</span>
          <span className="dash-line-tip-value">
            {`${formatFigure(tip.slice.value)} ${t.qtyUnit} · ${formatShare(tip.slice.share)}`}
          </span>
        </div>
      )}
      {/* 숨김 표는 감싼 상자로 줄인다 — 다른 그래프와 같은 방식. */}
      <div className="dash-sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{v.itemColumn}</th>
              <th scope="col">{v.qtyColumn}</th>
              <th scope="col">{t.shareColumn}</th>
            </tr>
          </thead>
          <tbody>
            {slices.map((slice) => (
              <tr key={slice.key}>
                <th scope="row">{slice.label}</th>
                <td>{formatFigure(slice.value)}</td>
                <td>{formatShare(slice.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

export const DefectTypesPanel = ({ entries, tag }: { entries: NamedQty[]; tag: string }) => {
  /* 각각 보일 유형 수. `null` 이면 모두. */
  const [shown, setShown] = useState<number | null>(null);
  const [fitted, setFitted] = useState(false);
  const [tooTall, setTooTall] = useState(false);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  /* 크기가 바뀌면 다시 그려 다시 잰다 — 이미 「모두」(`null`)일 때 `setShown(null)` 만으로는 다시 그리지 않는다. */
  const [, setRevision] = useState(0);

  useEffect(() => {
    setShown(null);
    setTooTall(false);
  }, [entries]);

  useEffect(() => {
    const body = box?.parentElement;
    const card = box?.closest<HTMLElement>('.dash-panel');
    if (body === null || body === undefined || card === null || card === undefined) {
      return undefined;
    }
    if (typeof ResizeObserver === 'undefined') return undefined;
    let lastHeight = body.clientHeight;
    let lastWidth = body.clientWidth;
    const read = (): void => {
      setFitted(getComputedStyle(card).contain.includes('size'));
    };
    const observer = new ResizeObserver(() => {
      read();
      if (body.clientWidth !== lastWidth) {
        /* 폭이 바뀌면 처음부터 — 「너무 높음」도 다시 본다. */
        lastWidth = body.clientWidth;
        lastHeight = body.clientHeight;
        setTooTall(false);
        setShown(null);
        setRevision((revision) => revision + 1);
      } else if (body.clientHeight !== lastHeight) {
        lastHeight = body.clientHeight;
        setShown(null);
        setRevision((revision) => revision + 1);
      }
    });
    observer.observe(body);
    read();

    return () => {
      observer.disconnect();
    };
  }, [box]);

  useLayoutEffect(() => {
    const body = box?.parentElement;
    if (body === null || body === undefined || !fitted || tooTall) return;
    if (body.scrollHeight <= body.clientHeight + 1) return;
    const current = shown ?? entries.length;
    /* 처음 덜 때는 둘을 합친다 — 하나만 「기타 (1종)」으로 바꾸면 줄 수가 줄지 않는다. */
    const next = current >= entries.length ? entries.length - 2 : current - 1;
    if (next >= 1) setShown(next);
    else setTooTall(true);
  });

  const slices = toDonutSlices(entries, shown ?? entries.length);
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);

  return (
    <Panel
      title={t.phenomena}
      sub={t.defectTypesSub}
      tag={tag}
      className={tooTall ? undefined : 'dash-qo-fit'}
    >
      <div ref={setBox} className="dash-donut">
        {entries.length === 0 ? (
          <NoRecords />
        ) : (
          <>
            <Donut slices={slices} caption={t.phenomena} total={total} />
            <ul className="dash-donut-legend">
              {slices.map((slice, index) => (
                <li key={slice.key} className="dash-donut-legend-row">
                  <span className={`dash-donut-key ${toneOf(slice, index)}`} aria-hidden="true" />
                  <span className="dash-donut-name" title={slice.label}>
                    {slice.label}
                  </span>
                  <span className="dash-donut-qty">
                    {formatFigure(slice.value)}
                    <span className="dash-donut-unit">{t.qtyUnit}</span>
                  </span>
                  <span className="dash-donut-share">{formatShare(slice.share)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
};
