import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { useScannerSubmit } from '../../patterns/pop-scanner-submit';
import { PuButton, PuIcon, PuManualDialog, PuNote, puCx } from '../../patterns/pop-uniform';
import { normalizeScanCode } from './scan';

const t = messages.materialInputScan;
const u = messages.popUniform;

/**
 * 스캔 한 번의 결과. **무게(`tone`)를 함께 든다** — 성공과 실패가 같은 모양이면 실패를 놓친다.
 */
export interface ScanOutcomeView {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

const NOTE_TONE = { success: 'ok', warning: 'warn', error: 'bad' } as const;

export interface ScanFieldProps {
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  onScan: (code: string) => void;
  /** 직전 스캔의 결과. 아직 읽은 것이 없으면 `null`. */
  outcome: ScanOutcomeView | null;
  /**
   * 바뀔 때마다 칸에 포커스를 되돌린다. 키패드로 수량을 넣고 기록한 뒤 다음 스캔이 칸으로
   * 들어가게 부르는 쪽이 값을 올린다(PG-21).
   */
  focusRequest?: number;
  /**
   * 사번이 없어 스캔을 받지 않는다(PI-17). 칸은 읽기 전용이고 포커스를 붙들지 않으며, 누르면
   * `onLockedPress`로 사번 입력 창을 연다.
   */
  isLocked?: boolean;
  onLockedPress?: () => void;
  /** 칸 바로 아래 한 줄(담긴 미전송 투입 · 직접 입력 까닭 · 다 투입함 등). 스캔 결과가 있으면 그 아래. */
  children?: ReactNode;
}

/**
 * 스캔 칸(POP 통일 규칙 6) — 칸 이름 「자재 LOT · 금형 코드」 + 스캔 칸 + 옆 [직접 입력].
 * 모양은 공통 `PuScanField` 와 같은 `pu-scan` 이다. 이 화면만의 일(사번 없을 때 잠금 · 기록 뒤 포커스
 * 되돌림 · 조회 중 두 번 보내지 않기)이 있어 화면 안에 둔다.
 *
 * 스캐너는 키보드처럼 코드를 쳐 넣고 끝에 Enter를 붙인다. 그래서 이 칸이 하는 일은 셋이다 —
 * **포커스를 붙들고**, Enter를 받고, 읽은 뒤 스스로 비운다.
 *
 * ⭐ **포커스를 되돌리는 것이 이 부품의 본론이다.** 작업자는 화면을 보지 않고 연달아 읽는다.
 * 조회가 끝난 뒤 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다**.
 */
export const ScanField = ({
  isScanning,
  onScan,
  outcome,
  focusRequest = 0,
  isLocked = false,
  onLockedPress,
  children,
}: ScanFieldProps) => {
  const [value, setValue] = useState('');
  const [isManualOpen, setManualOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const outcomeId = useId();

  /*
   * 조회가 끝나면 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 화면에 들어오자마자
   * 읽을 수 있다 — 작업자가 칸을 눌러 줄 필요가 없다. 보내는 자리(`send`)에서도 한 번 되돌린다.
   */
  useEffect(() => {
    if (!isScanning && !isLocked && !isManualOpen) inputRef.current?.focus();
  }, [isScanning, focusRequest, isLocked, isManualOpen]);

  /*
   * ⭐ **스캔 한 번에 보낸다**(omf-all-around#35). 스캐너가 Enter 를 안 붙이거나 Tab 을 붙이거나
   *    입력기가 Enter 를 삼키는 경우를 `patterns/pop-scanner-submit` 이 함께 받는다. 보내는 길은 이것 하나다.
   */
  const send = (raw: string): void => {
    /*
     * 겹친 조회가 나가면 **뒤 조회가 앞 조회의 후보 목록을 보고 중복을 판정해** 같은 자재가 두 줄로
     * 담긴다 — 조회 중에는 보내지 않는다.
     */
    if (isScanning || isLocked) return;

    const code = normalizeScanCode(raw);
    if (code === null) return;

    /* **보내기 전에 비운다.** 조회가 끝난 뒤 비우면 그사이 읽힌 다음 코드가 앞 코드 뒤에 붙는다. */
    setValue('');
    onScan(code);

    inputRef.current?.focus();
  };

  const scanner = useScannerSubmit(send, () => inputRef.current?.value ?? '');

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    /* ⛔ 기본 제출을 막는다 — Enter 한 번에 화면이 통째로 다시 뜬다. */
    event.preventDefault();
    scanner.submit(value);
  };

  const isDone = outcome?.tone === 'success';
  const problem = outcome !== null && outcome.tone !== 'success' ? outcome : null;

  return (
    <form onSubmit={submit} className="pu-field mi-scan">
      <label className="pu-label" htmlFor={inputId}>
        {t.scan.label}
      </label>
      <div className="pu-row">
        <div className={puCx('pu-scan', isDone && 'is-done')}>
          <PuIcon name="scan" />
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            placeholder={t.scan.placeholder}
            autoComplete="off"
            readOnly={isLocked}
            aria-describedby={problem === null ? undefined : outcomeId}
            onClick={isLocked ? onLockedPress : undefined}
            /*
             * ⛔ **조회 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고, 되돌려
             * 놓기 전에 읽힌 코드가 사라진다. 두 번 보내는 것은 `send`의 진행 중 검사가 막는다.
             */
            onKeyDown={scanner.onKeyDown}
            onChange={(event) => {
              setValue(event.target.value);
              scanner.noteInput(event.target.value);
            }}
          />
          <span className="ready">{isDone ? u.scan.done : u.scan.ready}</span>
        </div>
        {/* 라벨이 상해 못 읽으면 번호를 넣는다 — 스캔한 것과 똑같이 처리한다. */}
        <PuButton
          onClick={() => {
            if (isLocked) {
              onLockedPress?.();
              return;
            }
            setManualOpen(true);
          }}
        >
          {u.scan.manual}
        </PuButton>
      </div>

      {/*
       * 결과 — 칸 바로 아래 한 줄. 못 찾음·막힘은 빨강, 이미 담김·여러 건은 노랑. 담은 것은 칸의
       * 「스캔 완료」와 아래 투입 줄이 말한다. 화면을 보지 않는 작업자도 듣도록 읽어 준다.
       */}
      {problem !== null && (
        <PuNote tone={NOTE_TONE[problem.tone]} id={outcomeId} live>
          {problem.text}
        </PuNote>
      )}
      {outcome !== null && outcome.tone === 'success' && children === undefined && (
        <PuNote tone="ok" live>
          {outcome.text}
        </PuNote>
      )}
      {children}

      {isManualOpen && (
        <PuManualDialog
          title={t.scan.label}
          label={t.scan.label}
          onClose={() => {
            setManualOpen(false);
          }}
          onSubmit={(entered) => {
            setManualOpen(false);
            send(entered);
          }}
        />
      )}
    </form>
  );
};
