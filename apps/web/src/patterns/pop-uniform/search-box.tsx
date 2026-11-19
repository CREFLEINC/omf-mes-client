import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { PuManualDialog } from './field';
import { PuIcon } from './icon';
import { puCx } from './layout';
import './search-box.css';

const t = messages.popUniform;

/**
 * 왼쪽 목록 위 찾기 칸(#295 · 사용자 지시 2026-11-19 「키보드 팝업이 뜰 수 있게 해줘」).
 *
 * 칸을 누르면 [직접 입력]과 같은 창(`PuManualDialog` 찾기 모양 · 제목 없음)이 글자판과 함께 뜬다. [검색]·Enter 로 넣은 글자가
 * 목록을 거르고 창이 닫힌다. [취소]는 지금 거르는 글자를 그대로 둔다. 칸에는 거르는 글자가 보이고 [×]로 비운다.
 * 목록은 창이 떠 있는 동안에도 줄 수 · 쪽 넘김이 그대로다.
 */
export const PuSearchBox = ({
  value,
  onChange,
  label,
  heading,
  disabled = false,
  className,
}: {
  /** 지금 목록을 거르는 글자. */
  value: string;
  onChange: (value: string) => void;
  /** 칸 이름(읽어 주는 이름). */
  label: string;
  /**
   * 칸 위에 보이는 이름 — 넣을 값(「공급사 또는 품목의 코드나 이름」). 비우면 `label`. 칸 안 흐린 안내는 없고,
   * 창 안 칸 안내가 「… 을/를 입력하세요」다(사용자 지시 2026-11-19).
   */
  heading?: string;
  disabled?: boolean;
  className?: string;
}) => {
  const inputId = useId();
  const [isOpen, setOpen] = useState(false);
  const open = (): void => {
    if (!disabled) setOpen(true);
  };

  return (
    <div className="pu-field">
      <label className="pu-label" htmlFor={inputId}>
        {heading ?? label}
      </label>
      <div className={puCx('pu-input pu-search', className)}>
        <PuIcon name="search" />
        <input
          id={inputId}
          type="search"
          readOnly
          value={value}
          aria-label={label}
          aria-haspopup="dialog"
          disabled={disabled}
          autoComplete="off"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }}
        />
        {value !== '' && !disabled ? (
          <button
            type="button"
            className="pu-search-clear"
            aria-label={t.search.clear}
            title={t.search.clear}
            onClick={() => {
              onChange('');
            }}
          >
            <PuIcon name="x" />
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <PuManualDialog
          label={label}
          search
          placeholder={t.scan.manualPlaceholder(heading ?? label)}
          initialValue={value}
          onClose={() => {
            setOpen(false);
          }}
          onSubmit={(entered) => {
            setOpen(false);
            onChange(entered);
          }}
        />
      ) : null}
    </div>
  );
};
