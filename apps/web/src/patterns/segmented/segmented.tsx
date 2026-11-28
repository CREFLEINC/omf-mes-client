import { Icon } from '@crefle/web-ui';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Material Symbols 아이콘 이름. 글자 앞에 놓인다. */
  icon?: string;
}

export interface SegmentedProps<T extends string> {
  /** 묶음의 접근 이름 — 무엇을 고르는 단추인지(예: 「보기」). */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * 붙임 단추 — 칸이 붙은 단추 하나에서 **둘 중(또는 몇 가지 중) 하나**를 고른다. 같은 자료를 다른 모양으로 보는
 * 보기 전환(표 / 일정)에 쓴다. 한 테두리 안에 칸이 붙어 있고, 고른 칸만 진하게 채운다.
 *
 * 조건 칩(`CountChip`)과 모양이 다르다 — 칩은 「무엇을 보나」(조건)이고 이것은 「어떻게 보나」(보기)라, 한 줄에 나란히
 * 놓여도 헷갈리지 않아야 한다. 빨강은 쓰지 않는다(C-19).
 *
 * 고른 칸을 다시 눌러도 알리지 않는다 — 늘 하나가 골라져 있고, 푸는 동작이 없다.
 *
 * 쓰는 화면: W-02-08 W/O 진행현황 조회. DS 에 같은 부품이 생기면 걷어 낸다(규범 6장 DS 요청 목록).
 */
export const Segmented = <T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) => (
  <div aria-label={label} className="segmented" role="group">
    {options.map((option) => {
      const selected = option.value === value;

      return (
        <button
          key={option.value}
          aria-pressed={selected}
          className={selected ? 'segmented-option is-selected' : 'segmented-option'}
          type="button"
          onClick={() => {
            if (!selected) onChange(option.value);
          }}
        >
          {option.icon !== undefined && <Icon name={option.icon} size={18} />}
          {option.label}
        </button>
      );
    })}
  </div>
);
