import { IconButton } from '@crefle/web-ui';
import { useId, useRef, type ReactNode } from 'react';

import './qty-panel.css';

export interface QtyPanelMeter {
  /** 이번 전에 이미 받은 양(담아 둔 것 포함). */
  before: number;
  /** 이번에 받는 양. */
  now: number;
  /** 받기로 한 전체(발주량). */
  total: number;
}

export interface QtyPanelProps {
  /** 숫자판이 이 칸을 가리키는 id. */
  id: string;
  label: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  /** 칸이 잡히면 숫자판을 연다. 단말 키보드는 부르지 않는다. */
  onFocus: () => void;
  /**
   * 숫자판 단추의 이름. 넘기지 않으면 단추를 두지 않는다 - 칸을 누르면 숫자판이 열리므로 단추는
   * 같은 일을 한 번 더 하는 것이다(입하 등록 수량 확인, 사용자 지시 2026-10-21).
   */
  padLabel?: string;
  /** 수 뒤에 붙는 「/300」 같은 기준. 받을 것 중 얼마인지를 한 줄로 읽는다. */
  of?: string;
  /** 수를 오른쪽에 붙인다. 표의 수량 칸처럼 수는 오른쪽에서 읽는다. */
  align?: 'start' | 'end';
  /** 판 머리 오른쪽의 판정(칩). */
  status?: ReactNode;
  /** 막대. 넘기지 않으면 그리지 않는다 - 견줄 예정이 없는 입하(발주 없음)가 그렇다. */
  meter?: QtyPanelMeter;
  /** 막대 아래 범례. 수 몇 개를 이름과 함께 늘어놓는다. */
  legend?: ReactNode;
  /**
   * 수 옆, 숫자판 단추 앞에 서는 단추 하나. 접어 둔 선택 입력을 여는 자리다 - 판 밖에 한 줄로 두면
   * 그 줄만큼 화면이 길어진다.
   */
  extra?: ReactNode;
  /** 칸 아래 안내. 오류가 있으면 그것이 대신 선다. */
  note?: string;
  error?: string;
}

/** 막대 한 칸의 너비. 넘친 몫은 막대 끝에서 자른다 - 넘친 것은 판정 칩이 말한다. */
const share = (part: number, total: number) =>
  total <= 0 ? 0 : Math.max(0, Math.min(100, (part / total) * 100));

/**
 * 수량 판. 「몇 개를 받는가」가 수량 단계의 주인공이라 수를 36px 로 세운다.
 *
 * 전에는 수량이 이름 칸과 같은 크기의 입력 칸이라, 미리 채운 300 과 발주 · 잔여가 같은 무게의
 * 글자로 섞였다. 판은 수 하나를 크게 두고, 그 수가 전체의 어디쯤인지를 막대로 보인다 - 이번이
 * 마지막 분량인지, 모자라는지가 숫자를 견주기 전에 보인다.
 */
export const QtyPanel = ({
  id,
  label,
  value,
  unit,
  onChange,
  onFocus,
  padLabel,
  of,
  align = 'start',
  status,
  meter,
  legend,
  extra,
  note,
  error,
}: QtyPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messageId = useId();
  const message = error ?? note;

  return (
    /*
     * 판 어디를 눌러도 칸이 잡히고 숫자판이 열린다(사용자 지시 2026-10-21) - 수 글자만 누를 수
     * 있으면 장갑 낀 손가락이 비켜 간다. 판 안의 단추는 제 일을 한다. 초점과 낭독은 칸이 따로 받는다
     * - 판은 누르는 자리를 넓힐 뿐이다.
     */
    <div
      className={[
        'qty-panel',
        error === undefined ? '' : 'qty-panel--error',
        align === 'end' ? 'qty-panel--end' : '',
      ]
        .filter((name) => name !== '')
        .join(' ')}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a, input') !== null) {
          return;
        }

        inputRef.current?.focus();
        onFocus();
      }}
    >
      <div className="qty-panel__head">
        <label htmlFor={id} className="qty-panel__label">
          {label}
        </label>
        {status}
      </div>

      <div className="qty-panel__value">
        <input
          ref={inputRef}
          id={id}
          className="qty-panel__input"
          inputMode="none"
          autoComplete="off"
          placeholder="0"
          value={value}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={message === undefined ? undefined : messageId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={onFocus}
        />
        {of === undefined ? null : <span className="qty-panel__of">{of}</span>}
        <span className="qty-panel__unit">{unit}</span>
        {extra === undefined ? null : <span className="qty-panel__extra">{extra}</span>}
        {padLabel === undefined ? null : (
          <IconButton
            className="qty-panel__pad"
            icon="dialpad"
            size="lg"
            aria-label={padLabel}
            onClick={() => {
              inputRef.current?.focus();
              onFocus();
            }}
          />
        )}
      </div>

      {meter === undefined ? null : (
        <div className="qty-panel__meter" aria-hidden="true">
          <span
            className="qty-panel__meter-before"
            style={{ width: `${String(share(meter.before, meter.total))}%` }}
          />
          <span
            className={
              meter.before + meter.now > meter.total
                ? 'qty-panel__meter-now qty-panel__meter-now--over'
                : 'qty-panel__meter-now'
            }
            style={{
              width: `${String(Math.min(share(meter.now, meter.total), 100 - share(meter.before, meter.total)))}%`,
            }}
          />
        </div>
      )}

      {legend === undefined ? null : <div className="qty-panel__legend">{legend}</div>}

      {message === undefined ? null : (
        <p
          id={messageId}
          className={error === undefined ? 'qty-panel__note' : 'qty-panel__note qty-panel__error'}
        >
          {message}
        </p>
      )}
    </div>
  );
};
