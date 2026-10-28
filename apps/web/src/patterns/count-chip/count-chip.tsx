import type { ChipStatus } from '@crefle/web-ui';

/**
 * 페이지 머리 조건 칩(규범 6장 `CountChip`, C-17, C-19). 조건 이름과 건수를 보이고, 누르면 그 조건으로 바뀐다.
 * 모양은 선택과 관계없이 같고 선택된 것만 테두리가 굵다. 색은 같은 조건의 상태 칩 색(`tone`)이고, 상태가 아닌 조건은 `idle`이다.
 *
 * 쓰는 화면: W-02-01 ERP W/O 처리 작업함, W-02-09 LOT 추적.
 * DS `Chip` 필터형에 같은 모양이 생기면 걷어 낸다(규범 6장 DS 요청 목록).
 */
export interface CountChipProps {
  tone: ChipStatus;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export const CountChip = ({ tone, label, selected, onSelect }: CountChipProps) => (
  <button
    type="button"
    className={`count-chip count-chip-${tone}${selected ? ' is-selected' : ''}`}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {label}
  </button>
);
