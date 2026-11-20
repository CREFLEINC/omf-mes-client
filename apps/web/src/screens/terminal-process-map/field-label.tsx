import { Icon } from '@crefle/web-ui';

export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /** 라벨 오른쪽 같은 줄의 짧은 안내(작은 보조 글자). */
  hint?: string;
  /** 라벨 오른쪽 같은 줄의 안내 라벨 — 정보 아이콘 + 파란 바탕(사용자 지시 2026-11-20 · #333). */
  note?: string;
  /** 빨간 필수 표시(`required-mark`). 라벨 밖이라 접근 이름은 그대로다. */
  required?: boolean;
  /** 라벨 뒤 「(선택)」 같은 표시. 라벨 밖이라 접근 이름은 그대로다. */
  optionalMark?: string;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤(`Select`)의 라벨. 배치 규범 3을 그대로 구현한다.
 *
 * 필수 표시는 `<label>` 밖에 둔다 — 문자열에 `*` 를 붙이면 접근 이름이 「이름 *」이 되어 라벨 조회가 깨진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({
  htmlFor,
  label,
  hint,
  note,
  required = false,
  optionalMark,
}: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && (
      <span className="required-mark" aria-hidden="true">
        {' '}
        *
      </span>
    )}
    {optionalMark !== undefined && <span className="optional-mark"> {optionalMark}</span>}
    {hint !== undefined && <span className="terminal-map-label-hint">{hint}</span>}
    {note !== undefined && (
      <span className="iqc-inspection-action-note terminal-map-label-note" data-tone="info">
        <Icon name="info" size={14} aria-hidden />
        {note}
      </span>
    )}
  </span>
);
