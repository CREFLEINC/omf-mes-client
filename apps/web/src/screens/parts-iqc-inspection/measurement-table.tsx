import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useRef, type KeyboardEvent } from 'react';

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
 * 줄의 형편 — 항목 번호 칸의 이름(`title`)과 판정 칸의 글로 말한다(번호 칸 바탕색은 걷었다 · 실검증 2026-10-30).
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
 * 치수 측정(레퍼런스 화면 · 사용자 시안 2026-10-30) — 엑셀처럼 한 표에 항목 · 규격 · n1~nN · 판정. 열은 가장 많이 재는 항목의
 * 시료 수만큼, 항목마다 자기 시료 수까지만 칸이 열린다. 규격을 벗어난 값은 그 칸이 붉다. 판정 칸은 그 항목의 모든 시료
 * 기준이다 — 덜 적은 줄은 「3/5」처럼 잰 수. Enter 는 같은 시료의 아래 칸으로, 열의 마지막 칸에서는 다음 시료 열의 첫 칸으로 간다
 * (스캐너·키보드 입력 흐름 — 시료 하나를 집어 항목을 차례로 잰다).
 */
export const MeasurementTable = ({
  items,
  values,
  versionAcceptance,
  disabled,
  onChange,
}: MeasurementTableProps) => {
  const columns = Math.max(1, ...items.map((item) => item.measurementCount));
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const filled = items.filter((item) =>
    (values[item.inspectionItemSpecId] ?? []).some((text) => numberOf(text) !== null),
  ).length;

  /* 열 순서(n1 의 모든 항목 → n2 …)로 다음 칸 — 시료 수가 적은 항목은 그 열에 칸이 없어 건너뛴다. */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const cells = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>('input.parts-iqc-cell') ?? [],
    ).sort(
      (a, b) =>
        Number(a.dataset.sample) - Number(b.dataset.sample) ||
        Number(a.dataset.row) - Number(b.dataset.row),
    );
    cells[cells.indexOf(event.currentTarget) + 1]?.focus();
  };

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
      {items.length === 0 ? null : (
        <div className="parts-iqc-grid-scroll">
          <table className="parts-iqc-grid">
            <thead>
              <tr>
                <th scope="col" className="parts-iqc-item">
                  {t.dimension.item}
                </th>
                <th scope="col" className="parts-iqc-spec">
                  {t.dimension.spec}
                </th>
                {Array.from({ length: columns }, (_, i) => (
                  <th key={i} scope="col">
                    {t.dimension.sample(i + 1)}
                  </th>
                ))}
                <th scope="col" className="parts-iqc-verdict-head">
                  {t.dimension.judgment}
                </th>
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {items.map((item, position) => {
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
                return (
                  <tr
                    key={item.inspectionItemSpecId}
                    className={state === 'err' ? 'parts-iqc-row-ng' : undefined}
                  >
                    {/* 치수 항목 차례(①②…) — 도면 풍선 번호와 맞춘다. 기준서 순번은 외관 등 앞 항목까지 세어 어긋난다. */}
                    <th scope="row" title={t.dimension.state[state]}>
                      {position + 1}
                    </th>
                    <td className="parts-iqc-spec">
                      <span>{nominal || range}</span>
                      {/* 공차 표기가 없는 규격은 위 줄이 이미 범위다 — 같은 말을 두 번 적지 않는다 */}
                      {nominal !== '' && range !== nominal && <span>{range}</span>}
                    </td>
                    {Array.from({ length: columns }, (_, i) => {
                      if (i >= item.measurementCount)
                        return <td key={i} className="parts-iqc-cell-off" aria-hidden="true" />;
                      const cellNg = judgeValue(numbers[i] ?? null, item) === 'REJECTED';
                      return (
                        <td key={i}>
                          <input
                            className={
                              cellNg ? 'parts-iqc-cell parts-iqc-cell-ng' : 'parts-iqc-cell'
                            }
                            inputMode="decimal"
                            aria-label={t.dimension.cell(position + 1, i + 1)}
                            aria-invalid={cellNg || undefined}
                            data-row={position}
                            data-sample={i}
                            value={row[i] ?? ''}
                            disabled={disabled}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={onKeyDown}
                            onChange={(event) =>
                              onChange(item.inspectionItemSpecId, i, event.target.value)
                            }
                          />
                        </td>
                      );
                    })}
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
      )}
    </section>
  );
};
