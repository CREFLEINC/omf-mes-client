import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

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
 * 치수 측정(레퍼런스 화면) — 열은 가장 많이 재는 항목의 시료 수만큼 n1~nN, 항목마다 자기 시료 수까지만 칸이 열린다.
 * 규격을 벗어난 값은 그 칸이 붉다. 판정은 시료를 다 재야 낸다(덜 적은 줄은 「3/5」처럼 잰 수를 보인다).
 */
export const MeasurementTable = ({
  items,
  values,
  versionAcceptance,
  disabled,
  onChange,
}: MeasurementTableProps) => {
  const columns = Math.max(1, ...items.map((item) => item.measurementCount));
  const filled = items.filter((item) =>
    (values[item.inspectionItemSpecId] ?? []).some((text) => numberOf(text) !== null),
  ).length;

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
                <th scope="col">{t.dimension.item}</th>
                <th scope="col" className="parts-iqc-spec">
                  {t.dimension.spec}
                </th>
                {Array.from({ length: columns }, (_, i) => (
                  <th key={i} scope="col">
                    {t.dimension.sample(i + 1)}
                  </th>
                ))}
                <th scope="col">{t.dimension.judgment}</th>
              </tr>
            </thead>
            <tbody>
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
                    <th
                      scope="row"
                      className={`parts-iqc-rowno parts-iqc-st-${state}`}
                      title={t.dimension.state[state]}
                    >
                      {position + 1}
                    </th>
                    <td className="parts-iqc-spec">
                      <span>{nominal || range}</span>
                      {/* 공차 표기가 없는 규격은 위 줄이 이미 범위다 — 같은 말을 두 번 적지 않는다 */}
                      {nominal !== '' && range !== nominal && <span>{range}</span>}
                    </td>
                    {Array.from({ length: columns }, (_, i) =>
                      i < item.measurementCount ? (
                        <td key={i}>
                          <input
                            className={
                              judgeValue(numbers[i] ?? null, item) === 'REJECTED'
                                ? 'parts-iqc-cell parts-iqc-cell-ng'
                                : 'parts-iqc-cell'
                            }
                            inputMode="decimal"
                            aria-label={t.dimension.cell(position + 1, i + 1)}
                            aria-invalid={
                              judgeValue(numbers[i] ?? null, item) === 'REJECTED' || undefined
                            }
                            value={row[i] ?? ''}
                            disabled={disabled}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              onChange(item.inspectionItemSpecId, i, event.target.value)
                            }
                          />
                        </td>
                      ) : (
                        <td key={i} className="parts-iqc-cell-off" aria-hidden="true" />
                      ),
                    )}
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
