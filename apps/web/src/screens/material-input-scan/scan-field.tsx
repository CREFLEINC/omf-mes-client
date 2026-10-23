import { AlertBanner, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { useScannerSubmit } from '../../patterns/pop-scanner-submit';
import { normalizeScanCode } from './scan';

const t = messages.materialInputScan;

/**
 * 스캔 한 번의 결과. **무게(`tone`)를 함께 든다** — 성공과 실패가 같은 모양이면 실패를 놓친다.
 */
export interface ScanOutcomeView {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

export interface ScanFieldProps {
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  onScan: (code: string) => void;
  /** 직전 스캔의 결과. 아직 읽은 것이 없으면 `null` — 자리는 그대로 둔다(아래 참조). */
  outcome: ScanOutcomeView | null;
  /**
   * 바뀔 때마다 칸에 포커스를 되돌린다. 키패드로 수량을 넣고 기록한 뒤 다음 스캔이 칸으로
   * 들어가게 부르는 쪽이 값을 올린다(PG-21).
   */
  focusRequest?: number;
}

/**
 * 스캔 입력 칸 — **디자인 시스템 부품의 조합**이다(갈래 c). 새 원시 요소가 아니므로
 * `ds-candidates/`에 두지 않는다.
 *
 * 스캐너는 키보드처럼 코드를 쳐 넣고 끝에 Enter를 붙인다. 그래서 이 칸이 하는 일은 셋이다 —
 * **포커스를 붙들고**, Enter를 받고, 읽은 뒤 스스로 비운다.
 *
 * ⭐ **포커스를 되돌리는 것이 이 부품의 본론이다.** 작업자는 화면을 보지 않고 연달아 읽는다.
 * 조회가 끝난 뒤 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다** —
 * 작업자는 읽었다고 믿고 넘어간다.
 *
 * ⛔ **숫자 키패드를 여기 두지 않는다.** 그 부품은 다른 화면(`P-CO-01`)이 소유하고 있고,
 * 여기서 또 만들면 같은 것이 둘이 된다.
 */
export const ScanField = ({ isScanning, onScan, outcome, focusRequest = 0 }: ScanFieldProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * 조회가 끝나면 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 화면에 들어오자마자
   * 읽을 수 있다 — 작업자가 칸을 눌러 줄 필요가 없다.
   *
   * ⚠ **이 되돌림만으로는 부족하다.** 조회가 아주 빨리 끝나면 「조회 중」이 한 번도 그려지지
   * 않아 이 효과가 다시 돌 일이 없다 — 그때 버튼을 눌러 보낸 작업자는 **포커스를 버튼에
   * 남긴 채** 다음 코드를 읽고, 그 코드는 아무 데도 들어가지 않는다. 그래서 보내는 자리에서도
   * 한 번 되돌린다(`submit`). 둘은 서로 다른 경로를 덮는다 — 이 효과는 **처음 들어왔을 때**와
   * 조회가 끝난 시점을, `submit`은 버튼으로 보낸 직후를 맡는다.
   */
  useEffect(() => {
    if (!isScanning) inputRef.current?.focus();
  }, [isScanning, focusRequest]);

  /*
   * ⭐ **스캔 한 번에 보낸다**(omf-all-around#35). 실기에서 LOT 을 읽고도 Enter 를 한 번 더
   *    쳐야 담겼다 — 스캐너가 Enter 를 안 붙이거나 Tab 을 붙이거나 입력기가 Enter 를 삼키는
   *    경우를 `patterns/pop-scanner-submit` 이 함께 받는다. 보내는 길은 아래 `send` 하나다.
   */
  const send = (raw: string): void => {
    /*
     * **버튼 잠금과 별개의 겹이다**(전례 `login/screen.tsx`와 같은 규율). 제출 단추가 없어진 지금
     * (설계 §3 도면) **이 줄이 유일한 방어다** — 앞 판은 잠긴 단추가 Enter 의 암묵 제출까지
     * 막아 주어 「평소에는 걸릴 일이 없다」고 적어 두었으나, 그 단추가 사라졌다. 겹친 조회가
     * 나가면 **뒤 조회가 앞 조회의 후보 목록을 보고 중복을 판정해** 같은 자재가 두 줄로 담긴다.
     */
    if (isScanning) return;

    const code = normalizeScanCode(raw);
    if (code === null) return;

    /*
     * **보내기 전에 비운다.** 조회가 끝난 뒤 비우면 그사이 읽힌 다음 코드가 앞 코드 뒤에
     * 이어 붙어, 두 코드가 한 줄로 뭉친 검색어가 나간다.
     */
    setValue('');
    onScan(code);

    /* 버튼으로 보냈으면 포커스가 버튼에 있다. 위 효과가 돌지 않는 경우까지 여기서 덮는다. */
    inputRef.current?.focus();
  };

  const scanner = useScannerSubmit(send, () => inputRef.current?.value ?? '');

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    /*
     * ⛔ 기본 제출을 막는다. `<form>`은 기본이 GET 제출이라 Enter 한 번에 읽은 코드가 질의
     * 문자열로 올라가고 화면이 통째로 다시 뜬다 — 담아 둔 후보가 그 자리에서 사라진다.
     */
    event.preventDefault();
    scanner.submit(value);
  };

  return (
    <form onSubmit={submit} className="material-input-scan">
      {/*
       * 칸 하나가 스캐너와 손 입력을 함께 받는다. 칸에 바로 칠 수 있으므로 [직접 입력] 버튼과
       * 안내 문장을 두지 않는다(C-19 「값을 넣는 칸을 버튼으로 대신하지 않는다」). 받는 대상은
       * 안내 문구(placeholder)에 적는다(C-13).
       */}
      <TextField
        size="xl"
        ref={inputRef}
        label={t.scan.label}
        placeholder={t.scan.placeholder}
        value={value}
        fullWidth
        autoComplete="off"
        /*
         * ⛔ **조회 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고, 되돌려
         * 놓기 전에 읽힌 코드가 사라진다 — 스캐너는 사람이 기다려 주지 않는다. 두 번 보내는
         * 것은 `send`의 진행 중 검사가 막는다.
         */
        onKeyDown={scanner.onKeyDown}
        onChange={(event) => {
          setValue(event.target.value);
          scanner.noteInput(event.target.value);
        }}
      />

      {/*
       * 결과 — 칸 바로 아래 한 줄. **없을 때도 자리를 지운다.** 뜨고 지면 아래 목록이 위아래로
       * 움직이고, 다음 코드를 읽으려던 손이 옆 것을 누른다. 높이는 `pop.css` 가 잡는다.
       *
       * 부품이 무게에 따라 `role="status"`·`alert` 를 붙여 준다 — 화면을 보지 않는 작업자도
       * 읽힌 결과를 듣는다.
       */}
      <div className="scan-outcome">
        {outcome !== null && <AlertBanner variant={outcome.tone} title={outcome.text} />}
      </div>
    </form>
  );
};
