import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { ScanField } from './use-scan-field';
import './scan-zone.css';

const t = messages.taskFlow;

export interface ScanZoneProps {
  /** 스캐너 입력을 받는 칸. `useScanField` 가 준 것을 그대로 넘긴다. */
  field: Pick<ScanField, 'ref'>;
  /** 칸의 이름. 화면에는 「SCAN」 한 낱말이 서고 이름은 낭독기에만 준다. */
  label: string;
  /**
   * 무엇을 하라는가. 낭독기에만 칸의 설명으로 준다 - 화면에서는 단계 제목이 같은 말을 한다.
   */
  prompt: string;
  /** 읽은 값이 받을 수 없는 것일 때. 구역 아래 한 줄로 선다. */
  error?: string;
  /**
   * 이미 라벨을 받은 뒤. 구역은 얇은 대기 줄로 접힌다 - 스캐너는 계속 이 칸이 받아 다른 라벨을
   * 읽으면 되묻지만, 화면의 주인공은 이제 다음 단계다.
   */
  standby?: boolean;
  /** 구역 아래 오른쪽 끝에 따로 서는 아이콘 단추들(직접 입력 · 목록에서 고르기). */
  tools?: ReactNode;
}

/**
 * 스캔 구역. 스캔이 이 앱의 첫 동작이라 글자 칸처럼 생기지 않게 따로 세운다.
 *
 * 전에는 스캔 칸이 이름 · 주소를 적는 칸과 같은 모양이라, 늘 잡혀 있는 초점 테두리(빨간
 * 이중선)로만 다른 칸과 갈렸다 - 그것이 화면에서 가장 큰 빨강이었다(개편 제안 v2). 구역은 아이콘
 * 칸과 「SCAN」 한 낱말로 「여기를 향해 쏜다」를 말하고, 칸이 잡혀 있는 동안만 테두리가 숨 쉰다.
 * 숫자판 등으로 칸이 놓이면 멈춰, 지금 스캔이 들어가는지가 그대로 보인다.
 *
 * 구역 안에는 지시 · 형식 안내 · 단추를 두지 않는다(사용자 지시 2026-10-21). 손으로 넣는 길은
 * 구역 아래 따로 선 아이콘이다.
 */
export const ScanZone = ({
  field,
  label,
  prompt,
  error,
  standby = false,
  tools,
}: ScanZoneProps) => {
  const id = useId();
  const promptId = useId();
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
        <label htmlFor={id} className="scan-zone__hidden">
          {label}
        </label>
        <span id={promptId} className="scan-zone__hidden">
          {prompt}
        </span>
        <input
          id={id}
          ref={field.ref}
          className="scan-zone__input"
          placeholder={t.scanZone}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? promptId : errorId}
        />
      </div>
      {error === undefined ? null : (
        <p id={errorId} className="scan-zone__error">
          <Icon name="error" size={20} />
          <span>{error}</span>
        </p>
      )}
      {tools === undefined ? null : <div className="scan-zone__tools">{tools}</div>}
    </div>
  );
};
