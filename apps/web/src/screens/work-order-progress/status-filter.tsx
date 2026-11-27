import { messages } from '@omf-mes/i18n';

import { CountChip } from '../../patterns/count-chip';
import { statusTone } from './status-tone';

const t = messages.workOrderProgress.summary;

export interface StatusFilterProps {
  /**
   * 상태 코드 → 건수. **상태 조건을 뺀** 나머지 조건 기준이다 — 상태를 골라도 다른 칩의 건수가 남는다.
   * 아직 못 받았으면 `undefined` — 그때는 건수 없이 「전체」와 고른 상태만 둔다.
   */
  counts: Record<string, number> | undefined;
  /** 상태를 가리지 않은 전체 건수. */
  total: number | undefined;
  /** 마스터가 정한 상태 순서. 칩을 이 순서로 놓는다. */
  order: readonly string[];
  /** 걸린 상태. 고르지 않았으면 빈 문자열이다. */
  selected: string;
  labelOf: (statusCode: string) => string;
  /** 고른 상태(「전체」는 빈 문자열)를 알린다. */
  onSelect: (statusCode: string) => void;
}

/**
 * 상태 조건 칩(C-17) — 상태 이름과 건수를 보이고, 누르면 그 상태만 조회한다.
 *
 * - **0 건인 상태는 두지 않는다.** 다만 걸려 있는 상태는 0 건이어도 남긴다 — 풀 수단이 사라지면 안 된다.
 * - 고른 칩을 다시 누르면 「전체」로 돌아간다.
 * - 색은 표의 상태 칩과 같다(`status-tone.ts`).
 *
 * ⛔ **상태 값 목록을 화면에 박지 않는다**(G-8). 칩은 서버가 센 상태(`statusCounts` 의 키)에서 나온다 —
 * 마스터에 없는 코드가 와도 받은 코드 그대로 칩이 된다.
 */
export const StatusFilter = ({
  counts,
  total,
  order,
  selected,
  labelOf,
  onSelect,
}: StatusFilterProps) => {
  const known = counts ?? {};
  const codes = [
    ...order.filter((code) => Object.hasOwn(known, code)),
    ...Object.keys(known).filter((code) => !order.includes(code)),
  ].filter((code) => (known[code] ?? 0) > 0 || code === selected);
  /* 걸린 상태가 건수에 없어도(아직 못 받았거나 0 건) 칩은 남긴다. */
  const shown = selected === '' || codes.includes(selected) ? codes : [...codes, selected];

  const labelWithCount = (label: string, count: number | undefined): string =>
    count === undefined ? label : t.statusChip(label, count);

  return (
    <div aria-label={t.statusLabel} className="work-order-progress-status-filter" role="group">
      <CountChip
        label={labelWithCount(t.statusAll, total)}
        selected={selected === ''}
        tone="idle"
        onSelect={() => {
          onSelect('');
        }}
      />
      {shown.map((code) => (
        <CountChip
          key={code}
          label={labelWithCount(
            labelOf(code),
            counts === undefined ? undefined : (known[code] ?? 0),
          )}
          selected={code === selected}
          tone={statusTone(code)}
          onSelect={() => {
            onSelect(code === selected ? '' : code);
          }}
        />
      ))}
    </div>
  );
};
