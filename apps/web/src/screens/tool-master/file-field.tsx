import { Button } from '@crefle/web-ui';
import { useId, useRef } from 'react';

import { FieldLabel } from './field-label';

export interface FileFieldProps {
  label: string;
  /** 트리거 버튼의 문구. 「파일 고르기」처럼 **하는 일**을 적는다 */
  buttonLabel: string;
  /** 고른 파일의 이름. 고르지 않았으면 `null` */
  fileName: string | null;
  /** 고르지 않았을 때 그 자리에 설 문장. 빈칸으로 두지 않는다(G-9) */
  emptyText: string;
  /** 받아들일 확장자 목록(`accept`). 걸러 주기만 하고 **막지는 못한다** */
  accept?: string;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
}

/**
 * 파일 하나를 고르는 칸.
 *
 * ⚠ **디자인 시스템에 파일 입력이 없다**(설치본 30종 실측 — 2026-08-22). 갈래 판정은 **d**
 * (진짜 새 원시 요소)이고, 규범대로 **여기서 먼저 만든다.** 두 번째 사용처가 생기면
 * `ds-candidates/` 로, 세 번째에서 디자인 시스템으로 올린다 — 사용처 하나로 공용 부품의
 * 모양을 굳히지 않는다.
 *
 * ⭐ **native `<input type="file">` 을 숨기고 버튼이 그것을 부른다.** 브라우저 기본 파일
 * 입력은 문구·너비를 우리가 정할 수 없어 다른 칸들과 층이 어긋난다. 다만 **입력 요소 자체를
 * 없애지는 않는다** — 라벨과 `id` 로 이어 두어야 보조기술이 「파일 고르기」 칸으로 읽는다.
 *
 * ⭐ **고른 파일 이름을 보이는 글자로 낸다.** 이름이 없으면 사용자는 무엇을 올리는지 모른 채
 * 되돌릴 수 없는 쓰기를 누르게 된다.
 */
export const FileField = ({
  label,
  buttonLabel,
  fileName,
  emptyText,
  accept,
  disabled = false,
  onSelect,
}: FileFieldProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} />
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="file-input"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outlined"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </Button>
      <span className="field-note">{fileName ?? emptyText}</span>
    </div>
  );
};
