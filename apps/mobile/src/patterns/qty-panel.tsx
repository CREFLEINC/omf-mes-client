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
  /** 숫자판 단추의 이름. */
  padLabel: string;
  /** 판 머리 오른쪽의 판정(칩). */
  status?: ReactNode;
  /** 막대. 넘기지 않으면 그리지 않는다 - 견줄 예정이 없는 입하(발주 없음)가 그렇다. */
  meter?: QtyPanelMeter;
  /** 막대 아래 범례. 수 몇 개를 이름과 함께 늘어놓는다. */
  legend?: ReactNode;
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
  status,
  meter,
  legend,
  note,
  error,
}: QtyPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messageId = useId();
  const message = error ?? note;

  return (
    <div className={error === undefined ? 'qty-panel' : 'qty-panel qty-panel--error'}>
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
          value={value}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={message === undefined ? undefined : messageId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onFocus={onFocus}
        />
        <span className="qty-panel__unit">{unit}</span>
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
