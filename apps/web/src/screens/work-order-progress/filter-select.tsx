import { Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.workOrderProgress.filters;

export interface FilterSelectProps {
  label: string;
  /** 고를 수 있는 값들. 「전체」는 이 부품이 앞에 붙인다. */
  options: { value: string; label: string }[];
  value: string;
  /**
   * 왜 고를 수 없는가. 값이 있으면 칸을 **끄고 그 문장을 함께 보인다**.
   *
   * ⛔ **끄면 반드시 사유가 있다**(G-2). 사유 없이 꺼진 칸은 「고장 났나」로 읽히고, 사용자가
   * 할 수 있는 일이 없다. 그래서 이 부품은 **끄기와 사유를 한 값으로 받는다** — 따로 받으면
   * 한쪽만 넘기는 실수가 타입으로 막히지 않는다.
   */
  unavailableReason: string | null;
  /** 끄지는 않지만 함께 알릴 말. 잘림 안내가 여기 온다. */
  note: string | null;
  onChange: (value: string) => void;
}

/**
 * 조회 조건의 선택칸 하나.
 *
 * 라벨·사유·안내의 배선(`htmlFor`·`aria-describedby`)이 칸마다 같아서, 세 번 베껴 쓰면 한
 * 곳만 고쳐지는 자리가 된다 — 그 배선을 여기 한 번만 둔다.
 *
 * ⚠ 이 부품은 **화면의 조합물**이지 디자인 시스템의 부품이 아니다(라벨 + Select + 안내문).
 * 세 번째 사용처가 생기면 그때 승격을 따진다.
 */
export const FilterSelect = ({
  label,
  options,
  value,
  unavailableReason,
  note,
  onChange,
}: FilterSelectProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  /* 끈 사유가 있으면 그것이 먼저다 — 못 고르는 이유가 잘림 안내보다 중요하다. */
  const shownNote = unavailableReason ?? note;

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        aria-describedby={shownNote === null ? undefined : noteId}
        disabled={unavailableReason !== null}
        id={id}
        options={[{ value: '', label: t.all }, ...options]}
        value={value}
        onChange={onChange}
      />
      {shownNote === null ? null : (
        <p className="field-note" id={noteId}>
          {shownNote}
        </p>
      )}
    </div>
  );
};
