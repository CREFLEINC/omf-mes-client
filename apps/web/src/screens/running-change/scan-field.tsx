import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
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
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  onScan: (code: string) => void;
  /** 직전 스캔의 결과. 아직 읽은 것이 없으면 `null` — 자리는 그대로 둔다(아래 참조). */
  outcome: ScanOutcomeView | null;
}

/**
 * 신규 부품 LOT 스캔 칸 — **디자인 시스템 부품의 조합**이다(스펙 §7 갈래 c). 새 원시 요소가
 * 아니므로 `ds-candidates/`에 두지 않는다.
 *
 * 스캐너는 키보드처럼 코드를 쳐 넣고 끝에 Enter 를 붙인다. 그래서 이 칸이 하는 일은 셋이다 —
 * **포커스를 붙들고**, Enter 를 받고, 읽은 뒤 스스로 비운다.
 *
 * ⭐ **포커스를 되돌리는 것이 이 부품의 본론이다.** 작업자는 화면을 보지 않고 읽는다. 조회가
 * 끝난 뒤 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다**.
 *
 * 이 부품은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ScanField = ({ isScanning, onScan, outcome }: ScanFieldProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * 조회가 끝나면 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 화면에 들어오자마자
   * 읽을 수 있다 — 작업자가 칸을 눌러 줄 필요가 없다.
   *
   * ⚠ **이 되돌림만으로는 부족하다.** 조회가 아주 빨리 끝나면 「조회 중」이 한 번도 그려지지
   * 않아 이 효과가 다시 돌 일이 없다 — 그때 버튼을 눌러 보낸 작업자는 **포커스를 버튼에
   * 남긴 채** 다음 코드를 읽는다. 그래서 보내는 자리에서도 한 번 되돌린다(`submit`).
   */
  useEffect(() => {
    if (!isScanning) inputRef.current?.focus();
  }, [isScanning]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    /*
     * ⛔ 기본 제출을 막는다. `<form>`은 기본이 GET 제출이라 Enter 한 번에 읽은 코드가 질의
     * 문자열로 올라가고 화면이 통째로 다시 뜬다 — 담아 둔 부품과 고른 대상이 그 자리에서
     * 사라진다.
     */
    event.preventDefault();

    /*
     * **버튼 잠금과 별개의 겹이다.** Enter 의 암묵 제출은 제출 버튼이 잠기면 일어나지 않으므로
     * 평소에는 이 줄이 걸릴 일이 없다 — 걸리는 것은 버튼을 지나지 않는 제출뿐이다.
     */
    if (isScanning) return;

    const code = normalizeScanCode(value);
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

  return (
    <form onSubmit={submit}>
      <div className="scan-row">
        <TextField
          size="xl"
          ref={inputRef}
          label={t.scan.label}
          value={value}
          fullWidth
          autoComplete="off"
          /*
           * ⛔ **조회 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고, 되돌려
           * 놓기 전에 읽힌 코드가 사라진다 — 스캐너는 사람이 기다려 주지 않는다.
           */
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        {/*
         * 스캔 실패의 대체 경로. **칸으로 포커스를 옮기는 것이 전부다** — 코드는 이미 손으로
         * 칠 수 있고, 없던 것은 「어디를 눌러야 하는가」였다.
         *
         * ⭐ **칸 오른쪽에 선다**(사용자 지시 2026-09-11 · 자매 화면 P-02-03 · P-02-08 과 같은
         *    자리). 아랫줄로 내리면 눈이 칸을 지나쳐 내려갔다가 다시 올라온다 — 이 단추가
         *    하는 일은 바로 그 칸으로 돌아가는 것이다.
         *
         * ⭐ **두 단계로 내려온다** — [ 교체 등록 ] 채움 · 이것은 테두리. 설계가 「큰 타겟」으로
         *    지목한 것은 [ 교체 등록 ] 하나뿐이다(§7).
         *
         * ⛔ 별도 입력창을 열지 않는다. 스캐너가 살아 있을 때 그 창이 스캔값을 가로챈다.
         *
         * ⛔ **[ 읽기 ] 단추를 두지 않는다**(설계 §3 도면 · 사용자 지시 2026-09-11). 스캐너는
         *    코드 끝에 Enter 를 붙여 보내므로 제출은 폼이 알아서 하고(칸이 하나뿐인 폼은
         *    Enter 로 제출된다), 손으로 칠 때도 Enter 가 같은 길이다.
         */}
        <Button
          type="button"
          variant="outlined"
          size="xl"
          className={popTouchClass('normal')}
          onClick={() => {
            inputRef.current?.focus();
          }}
        >
          {t.scan.manualEntry}
        </Button>
      </div>

      {/*
       * 스캔 결과는 **입력 묶음 «다음»에** 한 자리에서만 선다(자매 화면 `P-02-03` 과 같은 자리).
       * 칸 바로 밑에 두면 읽을 때마다 그 줄이 나타났다 사라지면서 아래의 칸·버튼이 밀린다.
       *
       * ⛔ **없을 때도 자리를 지운다.** 뜨고 지면 아래가 위아래로 움직여, 다음 코드를 읽으려던
       *    손이 옆 것을 누른다. 그래서 «내용»만 바뀌고 상자는 늘 서 있다.
       *
       * ⭐ **다른 POP 알림과 같은 띠로 낸다**(`AlertBanner` · 사용자 지시 2026-09-10) — 자매
       * 화면(`P-02-03`)이 같은 자리에서 같은 모양을 쓴다.
       *
       * 부품이 무게에 따라 `role="status"`·`alert` 를 붙여 준다 — 화면을 보지 않는 작업자도
       * 읽힌 결과를 듣는다. 이 화면의 사용자는 손과 눈이 설비에 가 있다.
       */}
      <div className="scan-outcome">
        {outcome !== null && <AlertBanner variant={outcome.tone} title={outcome.text} />}
      </div>
    </form>
  );
};
