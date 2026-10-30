import { Tabs } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { numberOf } from './form-state';
import { acceptanceOf, judgeDimension, judgeValue } from './judgment';

type ItemSpec = components['schemas']['InspectionItemSpec'];

const t = messages.partsIqcInspection;

/** 「6.76 ±0.1」 — 위아래 공차가 같으면 ±, 다르면 「+a/-b」. 규격이 한쪽뿐이면 그 한쪽만. */
export const specLines = (item: ItemSpec): [string, string] => {
  const fmt = (v: number): string => String(Number(v.toFixed(6)));
  const { targetValue: target, lowerLimit: lower, upperLimit: upper } = item;
  const range =
    lower != null && upper != null
      ? `${fmt(lower)} ~ ${fmt(upper)}`
      : lower != null
        ? `≥ ${fmt(lower)}`
        : upper != null
          ? `≤ ${fmt(upper)}`
          : '-';
  if (target == null || lower == null || upper == null)
    return [target == null ? '' : fmt(target), range];
  const plus = Number((upper - target).toFixed(6));
  const minus = Number((target - lower).toFixed(6));
  return [
    plus === minus ? `${fmt(target)} ±${fmt(plus)}` : `${fmt(target)} +${fmt(plus)}/-${fmt(minus)}`,
    range,
  ];
};

/**
 * 줄의 형편 — 항목 번호 칸의 바탕색으로 말한다(참고: omf-dx-vina 수입검사). 색을 못 읽어도 칸 이름(`title`)과 판정 칸의 글이 남는다.
 * 벗어난 시료가 이미 허용 불량 수(c)를 넘었으면 덜 적었어도 불합격이 정해진 줄이다 — 표시만 그렇고 판정 계산은 시료를 다 재야 낸다.
 */
export type RowState = 'err' | 'empty' | 'wait' | 'done';

export const rowStateOf = (
  put: number,
  count: number,
  outCount: number,
  acceptance: number,
): RowState =>
  outCount > acceptance ? 'err' : put === 0 ? 'empty' : put < count ? 'wait' : 'done';

export interface MeasurementTableProps {
  items: ItemSpec[];
  values: Record<number, string[]>;
  versionAcceptance: number | null;
  disabled: boolean;
  onChange: (itemId: number, index: number, text: string) => void;
}

/**
 * 치수 측정(레퍼런스 화면) — 시료마다 탭 하나(n=1 · n=2 …, 사용자 지시 2026-10-30 「엑셀 시트처럼」). 탭 안에는 그 시료를 재는
 * 항목이 세로로 선다 — 항목마다 자기 시료 수까지만 탭에 나온다. 규격을 벗어난 값은 그 칸이 붉고, 탭 이름 옆에 그 시료의
 * 규격 밖 수(붉은 숫자) 또는 다 적었음(✓)이 붙는다. 판정 칸은 그 항목의 모든 시료 기준이다 — 덜 적은 줄은 「3/5」처럼 잰 수.
 * Enter 는 아래 칸으로, 탭의 마지막 칸에서는 다음 탭의 첫 칸으로 간다(스캐너·키보드 입력 흐름).
 */
export const MeasurementTable = ({
  items,
  values,
  versionAcceptance,
  disabled,
  onChange,
}: MeasurementTableProps) => {
  const columns = Math.max(1, ...items.map((item) => item.measurementCount));
  const [active, setActive] = useState(1);
  const shown = Math.min(active, columns);
  const bodyRef = useRef<HTMLDivElement>(null);
  /* 다음 탭으로 넘어간 뒤 첫 칸에 커서를 둔다 — 탭이 그려진 «다음»이라 효과에서 한다. */
  const focusFirst = useRef(false);
  useEffect(() => {
    if (!focusFirst.current) return;
    focusFirst.current = false;
    bodyRef.current?.querySelector<HTMLInputElement>('input.parts-iqc-cell')?.focus();
  }, [shown]);

  const filled = items.filter((item) =>
    (values[item.inspectionItemSpecId] ?? []).some((text) => numberOf(text) !== null),
  ).length;

  /* 탭 이름 옆 표시 — 그 시료의 규격 밖 칸 수, 없고 다 적었으면 ✓. */
  const tabMark = (n: number): ReactNode => {
    const inTab = items.filter((item) => item.measurementCount >= n);
    const texts = inTab.map((item) => values[item.inspectionItemSpecId]?.[n - 1]);
    const out = inTab.filter(
      (item, i) => judgeValue(numberOf(texts[i]), item) === 'REJECTED',
    ).length;
    if (out > 0)
      return (
        <span className="parts-iqc-tab-mark is-ng" aria-label={t.dimension.tabOut(out)}>
          {out}
        </span>
      );
    return texts.every((text) => numberOf(text) !== null) ? (
      <span className="parts-iqc-tab-mark is-ok" aria-label={t.dimension.tabDone}>
        ✓
      </span>
    ) : null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const cells = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>('input.parts-iqc-cell') ?? [],
    );
    const next = cells[cells.indexOf(event.currentTarget) + 1];
    if (next !== undefined) next.focus();
    else if (shown < columns) {
      focusFirst.current = true;
      setActive(shown + 1);
    }
  };

  const table = (n: number) => (
    <div className="parts-iqc-grid-scroll" ref={n === shown ? bodyRef : undefined}>
      <table className="parts-iqc-grid">
        <thead>
          <tr>
            <th scope="col">{t.dimension.item}</th>
            <th scope="col" className="parts-iqc-spec">
              {t.dimension.spec}
            </th>
            <th scope="col">{t.dimension.sampleValue(n)}</th>
            <th scope="col">{t.dimension.judgment}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, position) => {
            if (item.measurementCount < n) return null;
            const row = values[item.inspectionItemSpecId] ?? [];
            const numbers = Array.from({ length: item.measurementCount }, (_, i) =>
              numberOf(row[i]),
            );
            const { outCount } = judgeDimension(numbers, item, versionAcceptance);
            const put = numbers.filter((value) => value !== null).length;
            const state = rowStateOf(
              put,
              item.measurementCount,
              outCount,
              acceptanceOf(item, versionAcceptance),
            );
            const [nominal, range] = specLines(item);
            const cellNg = judgeValue(numbers[n - 1] ?? null, item) === 'REJECTED';
            return (
              <tr
                key={item.inspectionItemSpecId}
                className={state === 'err' ? 'parts-iqc-row-ng' : undefined}
              >
                {/* 치수 항목 차례(①②…) — 도면 풍선 번호와 맞춘다. 기준서 순번은 외관 등 앞 항목까지 세어 어긋난다. */}
                <th
                  scope="row"
                  className={`parts-iqc-rowno parts-iqc-st-${state}`}
                  title={t.dimension.state[state]}
                >
                  {position + 1}
                </th>
                {/* 규격은 한 줄 — 「목표 ±공차 (하한 ~ 상한)」(사용자 지시 2026-10-30). 공차 표기가 없으면 범위만. */}
                <td className="parts-iqc-spec">
                  {nominal === '' || range === nominal ? nominal || range : `${nominal} (${range})`}
                </td>
                <td>
                  <input
                    className={cellNg ? 'parts-iqc-cell parts-iqc-cell-ng' : 'parts-iqc-cell'}
                    inputMode="decimal"
                    aria-label={t.dimension.cell(position + 1, n)}
                    aria-invalid={cellNg || undefined}
                    value={row[n - 1] ?? ''}
                    disabled={disabled}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={onKeyDown}
                    onChange={(event) =>
                      onChange(item.inspectionItemSpecId, n - 1, event.target.value)
                    }
                  />
                </td>
                <td
                  className={
                    state === 'err'
                      ? 'parts-iqc-verdict parts-iqc-verdict-ng'
                      : state === 'done'
                        ? 'parts-iqc-verdict parts-iqc-verdict-ok'
                        : 'parts-iqc-verdict'
                  }
                >
                  {state === 'empty'
                    ? '-'
                    : state === 'err'
                      ? t.ng
                      : state === 'wait'
                        ? `${String(put)}/${String(item.measurementCount)}`
                        : t.ok}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="parts-iqc-block" aria-labelledby="parts-iqc-dimension">
      <div className="parts-iqc-block-head">
        <h3 id="parts-iqc-dimension">
          {t.dimension.heading}
          {items.length > 0 && (
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          )}
        </h3>
        <span className="parts-iqc-muted">
          {items.length === 0 ? t.dimension.none : t.dimension.progress(filled, items.length)}
        </span>
      </div>
      {items.length === 0 ? null : columns === 1 ? (
        table(1)
      ) : (
        <Tabs
          className="parts-iqc-sample-tabs"
          size="sm"
          aria-label={t.dimension.heading}
          value={String(shown)}
          onChange={(value) => setActive(Number(value))}
          items={Array.from({ length: columns }, (_, i) => ({
            value: String(i + 1),
            label: t.dimension.sampleTab(i + 1),
            badge: tabMark(i + 1),
            content: i + 1 === shown ? table(i + 1) : null,
          }))}
        />
      )}
    </section>
  );
};
