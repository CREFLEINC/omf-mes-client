import { Button, Icon } from '@crefle/web-ui';
import { useId, useRef } from 'react';

import { FieldLabel } from './field-label';

export interface FileFieldProps {
  label: string;
  /** 트리거 버튼의 문구. 「파일 고르기」처럼 **하는 일**을 적는다 */
  buttonLabel: string;
  /** 고른 파일의 이름. 고르지 않았으면 `null` */
  fileName: string | null;
  /** 받아들일 확장자 목록(`accept`). 걸러 주기만 하고 **막지는 못한다** */
  accept?: string;
  disabled?: boolean;
  /** 알아 둘 규칙 — 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  info?: string;
  /** 필수 칸 — 라벨 밖에 빨간 * 를 둔다. 검증(잠금)은 쓰는 쪽이 한다. */
  required?: boolean;
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
 *
 * 모양은 검사 기준 엑셀 업로드 창의 파일 상자와 같다(사용자 지시 2026-11-27 · #360) — 테두리 상자 안에 파일 표식 ·
 * 고른 파일 이름 · 오른쪽 작은 외곽선 단추. 고르기 전에는 안내 문장 없이 단추만 선다.
 */
export const FileField = ({
  label,
  buttonLabel,
  fileName,
  accept,
  disabled = false,
  info,
  required = false,
  onSelect,
}: FileFieldProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field-cell tool-master-file-field">
      <FieldLabel htmlFor={id} label={label} info={info} required={required} />
      <input
        ref={inputRef}
        id={id}
        type="file"
        aria-required={required || undefined}
        accept={accept}
        disabled={disabled}
        className="file-input"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      <div className="inspection-standard-import-box">
        <div className="inspection-standard-import-box-head">
          <Icon name="file_copy" size={20} aria-hidden />
          {fileName !== null && <strong title={fileName}>{fileName}</strong>}
          <Button
            type="button"
            variant="outlined"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
