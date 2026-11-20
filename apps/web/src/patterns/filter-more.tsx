import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

const t = messages.common.filterMore;

/** 접힌 칸에 걸린 조건 하나 — 「상태: 반려」처럼 라벨과 값을 한 줄로. */
export interface HiddenFilterChip<K extends string = string> {
  key: K;
  label: string;
  /** × 의 접근명. 비우면 「〈label〉 조건 제거」. */
  removeLabel?: string;
}

/**
 * 「조건 더보기」의 펼침 상태(C-6). 늘 접힌 채로 들어온다 — 접힌 칸에 걸린 조건은
 * `HiddenFilterChips` 가 칩으로 알리므로, 펼쳐 두지 않아도 무엇으로 걸렀는지 보인다.
 */
export const useFilterMore = () => {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  return {
    isOpen,
    /** 접고 펴는 상자의 id — `FilterMoreButton` 의 aria-controls. */
    id,
    toggle: (): void => {
      setIsOpen((open) => !open);
    },
  };
};

/**
 * 「조건 더보기 / 조건 접기」 단추. 조회 · 초기화 묶음의 오른쪽 끝에 둔다
 * (입고 관리 상세 조건 자리, 사용자 지시 2026-10-21).
 */
export const FilterMoreButton = ({
  open,
  controlsId,
  onToggle,
}: {
  open: boolean;
  controlsId: string;
  onToggle: () => void;
}) => (
  <Button
    variant="text"
    size="sm"
    aria-expanded={open}
    aria-controls={controlsId}
    onClick={onToggle}
  >
    {open ? t.close : t.open}
  </Button>
);

/**
 * 접힌 칸에 걸린 조건을 칩으로 알린다 — 모르는 사이 목록이 좁혀져 있지 않게.
 * 펼쳐 있으면 칸에 값이 보이므로 그리지 않는다. 보이는 칸의 조건은 칩으로 겹쳐 적지 않는다.
 */
export const HiddenFilterChips = <K extends string>({
  open,
  chips,
  onRemove,
}: {
  open: boolean;
  chips: readonly HiddenFilterChip<K>[];
  onRemove: (key: K) => void;
}) => {
  if (open || chips.length === 0) return null;

  return (
    <div className="filter-bar filter-more-chips">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          variant="status"
          removeLabel={chip.removeLabel ?? t.remove(chip.label)}
          onRemove={() => {
            onRemove(chip.key);
          }}
        >
          {chip.label}
        </Chip>
      ))}
    </div>
  );
};

/**
 * 「초기화」를 세울지 — 편집 중인 값이나 조회에 쓰인 값이 처음 값과 다를 때만 보인다.
 * 값으로 견준다(배열 · 객체는 JSON 으로). 처음 값이 날짜에 기대면 같은 함수로 만들어 넘긴다.
 */
export const hasChangedFilters = <T extends object>(
  defaults: T,
  ...values: readonly T[]
): boolean =>
  values.some((value) =>
    (Object.keys({ ...defaults, ...value }) as (keyof T)[]).some(
      (key) => JSON.stringify(value[key] ?? null) !== JSON.stringify(defaults[key] ?? null),
    ),
  );
