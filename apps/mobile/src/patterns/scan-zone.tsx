import { Icon } from '@crefle/web-ui';
import { useId, type ReactNode } from 'react';

import type { ScanField } from './use-scan-field';
import './scan-zone.css';

export interface ScanZoneProps {
  /** 스캐너 입력을 받는 칸. `useScanField` 가 준 것을 그대로 넘긴다. */
  field: Pick<ScanField, 'ref'>;
  /** 칸의 이름. 화면에는 지시가 서고 이름은 낭독기에만 준다. */
  label: string;
  /** 무엇을 하라는가. 칸이 비어 있는 동안 구역의 제목으로 선다. */
  prompt: string;
  /** 라벨 형식처럼 지시 아래 작게 붙는 안내. */
  hint?: string;
  /** 읽은 값이 받을 수 없는 것일 때. 구역 아래 한 줄로 선다. */
  error?: string;
  /**
   * 이미 라벨을 받은 뒤. 구역은 얇은 대기 줄로 접힌다 - 스캐너는 계속 이 칸이 받아 다른 라벨을
   * 읽으면 되묻지만, 화면의 주인공은 이제 다음 단계다.
   */
  standby?: boolean;
  /** 구역 오른쪽 끝의 단추(직접 입력). */
  trailing?: ReactNode;
  /** 구역 안 아래 한 줄의 단추들. 오른쪽 끝에 다 들지 않을 때(직접 입력 · 되돌리기) 쓴다. */
  actions?: ReactNode;
}

/**
 * 스캔 구역. 스캔이 이 앱의 첫 동작이라 글자 칸처럼 생기지 않게 따로 세운다.
 *
 * 전에는 스캔 칸이 이름 · 주소를 적는 칸과 같은 모양이라, 늘 잡혀 있는 초점 테두리(빨간
 * 이중선)로만 다른 칸과 갈렸다 - 그것이 화면에서 가장 큰 빨강이었다(개편 제안 v2). 구역은 아이콘
 * 칸과 굵은 지시로 「여기를 향해 쏜다」를 말하고, 칸이 잡혀 있는 동안만 테두리가 숨 쉰다.
 * 숫자판 등으로 칸이 놓이면 멈춰, 지금 스캔이 들어가는지가 그대로 보인다.
 */
export const ScanZone = ({
  field,
  label,
  prompt,
  hint,
  error,
  standby = false,
  trailing,
  actions,
}: ScanZoneProps) => {
  const id = useId();
  const hintId = useId();
  const errorId = useId();

  return (
    <div
      className={[
        'scan-zone',
        standby ? 'scan-zone--standby' : '',
        error === undefined ? '' : 'scan-zone--error',
      ]
        .filter((name) => name !== '')
        .join(' ')}
    >
      <div className="scan-zone__box">
        <span className="scan-zone__tile" aria-hidden="true">
          <Icon name="barcode_scanner" size={standby ? 20 : 28} />
        </span>
        <span className="scan-zone__text">
          <label htmlFor={id} className="scan-zone__label">
            {label}
          </label>
          <input
            id={id}
            ref={field.ref}
            className="scan-zone__input"
            placeholder={prompt}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={error === undefined ? undefined : true}
            aria-describedby={
              error === undefined ? (hint === undefined ? undefined : hintId) : errorId
            }
          />
          {hint === undefined || standby ? null : (
            <span id={hintId} className="scan-zone__hint">
              {hint}
            </span>
          )}
        </span>
        {trailing}
        {actions === undefined ? null : <div className="scan-zone__actions">{actions}</div>}
      </div>
      {error === undefined ? null : (
        <p id={errorId} className="scan-zone__error">
          <Icon name="error" size={20} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
