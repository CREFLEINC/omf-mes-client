import { messages } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import { PuNote, PuScanField } from '../../patterns/pop-uniform';
import { normalizeScanCode } from './scan';

const t = messages.runningChange;

/**
 * 스캔 한 번의 결과. **무게(`tone`)를 함께 든다** — 성공과 실패가 같은 모양이면 실패를 놓친다
 * (전례 `P-02-03`).
 */
export interface ScanOutcomeView {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

export interface ScanFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 막는다. */
  isScanning: boolean;
  onScan: (code: string) => void;
  /** 부품을 담았는가 — 초록 「스캔 완료」. */
  done: boolean;
  /** 직전 스캔의 결과. 아직 읽은 것이 없거나 덧붙일 말이 없으면 `null`. */
  outcome: ScanOutcomeView | null;
}

/**
 * 신규 부품 LOT 스캔 칸 — POP 통일 스캔 칸(`PuScanField`, 시안 규칙 6): 빨간 테두리 + 스캔 대기 →
 * 읽으면 초록 스캔 완료. 옆은 [직접 입력] 하나. 못 찾으면 칸을 비우고 칸 바로 아래 빨간 한 줄.
 *
 * ⭐ **포커스를 되돌리는 것이 이 부품의 본론이다.** 작업자는 화면을 보지 않고 읽는다. 조회가 끝난 뒤
 * 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다**.
 *
 * ⛔ **조회 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고, 되돌려 놓기 전에 읽힌
 *    코드가 사라진다 — 스캐너는 사람이 기다려 주지 않는다.
 */
export const ScanField = ({
  value,
  onChange,
  isScanning,
  onScan,
  done,
  outcome,
}: ScanFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  /* 조회가 끝나면 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 들어오자마자 읽을 수 있다. */
  useEffect(() => {
    if (!isScanning) inputRef.current?.focus();
  }, [isScanning]);

  const submit = (raw: string): void => {
    /* ⚠ 조회 중에 같은 코드가 또 나가지 않게 한다 — 제출 단추가 없어 이 줄이 유일한 방어다. */
    if (isScanning) return;

    const code = normalizeScanCode(raw);
    if (code === null) return;

    onChange(code);
    onScan(code);
    inputRef.current?.focus();
  };

  return (
    <PuScanField
      label={t.scan.label}
      ariaLabel={t.scan.label}
      required
      value={value}
      onChange={onChange}
      onSubmit={submit}
      placeholder={t.scan.placeholder}
      done={done}
      inputRef={inputRef}
      error={outcome?.tone === 'error' ? outcome.text : undefined}
      manual={{ title: t.scan.manualEntry, label: t.scan.label }}
    >
      {/* 여러 건이 걸린 것은 다시 읽으면 풀린다 — 못 찾은 것(빨강)과 갈라 주의 줄로 낸다. */}
      {outcome?.tone === 'warning' && <PuNote tone="warn">{outcome.text}</PuNote>}
      {/* 읽은 코드와 찾은 번호가 다르면 둘을 함께 적는다 — 잘못 걸린 것인지 작업자가 판단한다. */}
      {outcome?.tone === 'success' && <PuNote tone="ok">{outcome.text}</PuNote>}
    </PuScanField>
  );
};
