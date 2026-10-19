import { messages } from '@omf-mes/i18n';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

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
  /** 전체 유형 합 대비 비율(0~100). 조각 크기에 쓴다. */
  share: number;
  /** 화면에 적는 정수 비율 — 모든 조각을 더하면 100이 되게 맞춘 값(`roundShares`). */
  shareLabel: number;
  /** 「기타」로 합친 유형 수. 합친 조각이 아니면 0. */
  merged: number;
}

/** 「기타」 조각의 키 — 유형 키(불량 코드 번호)와 겹치지 않는다. */
export const OTHER_SLICE_KEY = 'other';

/**
 * 수량 큰 순으로 앞에서 `shown` 개를 각각, 나머지를 「기타」 하나로. `shown` 이 유형 수 이상이면 모두 각각.
 * 같은 수량은 받은 순서를 지킨다.
 */
export const toDonutSlices = (
  entries: readonly NamedQty[],
  shown: number,
  /** 목록 밖 나머지 수량(PQC 품목별 상위 5 밖 · 사용자 지시 2026-10-19) — 「기타」에 더하고 비율 모수에 넣는다. */
  remainder = 0,
): DonutSlice[] => {
  const extra = Math.max(0, remainder);
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0) + extra;
  const shareOf = (value: number): number => (total === 0 ? 0 : (Math.max(0, value) / total) * 100);
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, Math.max(0, shown));
  const rest = sorted.slice(head.length);
  const slices: DonutSlice[] = head.map((entry) => ({
    ...entry,
    share: shareOf(entry.value),
    shareLabel: 0,
    merged: 0,
  }));

  if (rest.length > 0 || extra > 0) {
    const value = rest.reduce((sum, entry) => sum + Math.max(0, entry.value), 0) + extra;
    slices.push({
      key: OTHER_SLICE_KEY,
      label: extra > 0 ? t.otherRest : t.otherTypes(formatFigure(rest.length)),
      value,
      share: shareOf(value),
      shareLabel: 0,
      merged: Math.max(1, rest.length),
    });
  }

  const labels = roundShares(slices.map((slice) => slice.share));
  return slices.map((slice, index) => ({ ...slice, shareLabel: labels[index] ?? 0 }));
};

/**
 * 정수 비율을 더하면 100이 되게 맞춘다(최대 나머지 방식) — 각자 반올림하면 합이 99 · 101이 될 수 있다
 * (⭐ 사용자 지시 2026-10-19 「반올림으로 인한 합계 차이 처리」). 내림한 뒤 모자란 만큼 소수 부분이 큰 순으로 1씩
 * 더한다. 모두 0이면 모두 0.
 */
export const roundShares = (shares: readonly number[]): number[] => {
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return shares.map(() => 0);
  const floors = shares.map((share) => Math.floor(share));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = shares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return floors;
};

/**
 * 조각 색(⭐ 사용자 지시 2026-10-19) — 가장 많은 유형만 강조색(DS 정보 파랑), 나머지는 명도 차이가 뚜렷한 중립
 * 회색을 짙은 것부터 옅게. 도넛과 범례가 같은 클래스를 써 색이 늘 같다. 여덟째부터 회색이 되풀이.
 */
const PALETTE_SIZE = 7;
const toneOf = (slice: DonutSlice, index: number): string => {
  if (slice.merged > 0) return 'dash-donut-other';
  if (index === 0) return 'dash-donut-1';
  return `dash-donut-${String(((index - 1) % (PALETTE_SIZE - 1)) + 2)}`;
};

const formatShare = (slice: DonutSlice): string => `${String(slice.shareLabel)}%`;

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
  /*
   * 말풍선은 화면 기준(position: fixed)으로 띄운다 — 카드는 넘치는 내용을 자르므로(`.dash-qo-fit`) 카드 안에
   * 두면 위쪽 조각의 말풍선이 잘렸다(사용자 지적 2026-10-19). 조각 가운데의 화면 좌표를 그때그때 잰다.
   */
  const [tipAt, setTipAt] = useState<{ x: number; y: number } | null>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  let turn = 0;
  const arcs = slices.map((slice, index) => {
    const start = turn;
    turn += slice.share / 100;
    return { slice, index, start, end: turn };
  });
  const tip = hovered === null ? null : arcs[hovered];
  const open = (index: number): void => {
    const arc = arcs[index];
    if (arc === undefined || svgEl === null) return;
    const rect = svgEl.getBoundingClientRect();
    const [x, y] = pointAt(OUTER, (arc.start + arc.end) / 2);
    setHovered(index);
    setTipAt({ x: rect.left + (x / SIZE) * rect.width, y: rect.top + (y / SIZE) * rect.height });
  };
  const close = (): void => {
    setHovered(null);
    setTipAt(null);
  };
  /* 화면 좌표로 띄웠으니, 스크롤 · 크기 변경이 생기면 닫는다(제자리에 남지 않게). */
  useEffect(() => {
    if (tipAt === null) return undefined;
    const dismiss = (): void => {
      setHovered(null);
      setTipAt(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [tipAt]);

  return (
    <figure className="dash-donut-figure">
      <svg
        ref={setSvgEl}
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
                open(index);
              }}
              onMouseLeave={close}
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
      {tip !== null && tip !== undefined && tipAt !== null && (
        <div
          className="dash-line-tip dash-donut-tip"
          role="tooltip"
          style={{ left: `${String(tipAt.x)}px`, top: `${String(tipAt.y)}px` }}
        >
          <span className="dash-line-tip-date">{tip.slice.label}</span>
          <span className="dash-line-tip-value">
            {`${formatFigure(tip.slice.value)} ${t.qtyUnit} · ${formatShare(tip.slice)}`}
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
                <td>{formatShare(slice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

export const DefectTypesPanel = ({
  entries,
  tag,
  title = t.phenomena,
  sub = t.defectTypesSub,
  toolbar,
  caption,
  remainder = 0,
}: {
  entries: NamedQty[];
  /** 목록 밖 나머지 수량 — 「기타」로 넣고 합계 · 비율에 포함(기본 0 · 기존 화면 그대로). */
  remainder?: number;
  /** 원형 위 전환 탭 등(PQC 「불량현상 · 품목별」 · 사용자 지시 2026-10-19). 기본 없음. */
  toolbar?: ReactNode;
  /** 그림 이름(화면 낭독) — 기본은 제목. */
  caption?: string;
  tag: string;
  /** 부제 — PQC 불량현상은 집계 기준을 적는다(사용자 지시 2026-10-19). 기본은 기존 문구, `null` 이면 없음. */
  sub?: string | null;
  /** IQC 「품목(CODE)별 불량 구성」도 같은 원형 그래프다(사용자 지시 2026-10-19). */
  title?: string;
}) => {
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

  const slices = toDonutSlices(entries, shown ?? entries.length, remainder);
  const total =
    entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0) + Math.max(0, remainder);

  return (
    <Panel
      title={title}
      sub={sub ?? undefined}
      tag={tag}
      className={tooTall ? undefined : 'dash-qo-fit'}
    >
      {toolbar}
      <div ref={setBox} className="dash-donut">
        {entries.length === 0 ? (
          <NoRecords />
        ) : (
          <>
            <Donut slices={slices} caption={caption ?? title} total={total} />
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
                  <span className="dash-donut-share">{formatShare(slice)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
};
