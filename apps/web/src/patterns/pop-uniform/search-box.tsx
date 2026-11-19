import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { PuManualDialog } from './field';
import { PuIcon } from './icon';
import { puCx } from './layout';
import './search-box.css';

const t = messages.popUniform;

/**
 * 왼쪽 목록 위 찾기 칸(#295 · 사용자 지시 2026-11-19 「키보드 팝업이 뜰 수 있게 해줘」).
 *
 * 칸을 누르면 [직접 입력]과 같은 창(`PuManualDialog` 찾기 모양)이 글자판과 함께 뜬다. [검색]·Enter 로 넣은 글자가
 * 목록을 거르고 창이 닫힌다. [취소]는 지금 거르는 글자를 그대로 둔다. 칸에는 거르는 글자가 보이고 [×]로 비운다.
 * 목록은 창이 떠 있는 동안에도 줄 수 · 쪽 넘김이 그대로다.
 */
export const PuSearchBox = ({
  value,
  onChange,
  label,
  title,
  placeholder,
  disabled = false,
  className,
}: {
  /** 지금 목록을 거르는 글자. */
  value: string;
  onChange: (value: string) => void;
  /** 칸 이름(읽어 주는 이름). */
  label: string;
  /** 창 제목. */
  title: string;
  /** 칸 안 흐린 안내 — 창 안에서는 「… 로 검색」. */
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) => {
  const [isOpen, setOpen] = useState(false);
  const open = (): void => {
    if (!disabled) setOpen(true);
  };

  return (
    <>
      <div className={puCx('pu-input pu-search', className)}>
        <PuIcon name="search" />
        <input
          type="search"
          readOnly
          value={value}
          aria-label={label}
          aria-haspopup="dialog"
          placeholder={placeholder}
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
          title={title}
          label={label}
          search
          placeholder={t.scan.searchPlaceholder(placeholder)}
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
    </>
  );
};
