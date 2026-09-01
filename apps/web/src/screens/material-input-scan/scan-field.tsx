import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { normalizeScanCode } from './scan';

const t = messages.materialInputScan;

export interface ScanFieldProps {
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  onScan: (code: string) => void;
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
export const ScanField = ({ isScanning, onScan }: ScanFieldProps) => {
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
  }, [isScanning]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    /*
     * ⛔ 기본 제출을 막는다. `<form>`은 기본이 GET 제출이라 Enter 한 번에 읽은 코드가 질의
     * 문자열로 올라가고 화면이 통째로 다시 뜬다 — 담아 둔 후보가 그 자리에서 사라진다.
     */
    event.preventDefault();

    /*
     * **버튼 잠금과 별개의 겹이다**(전례 `login/screen.tsx`와 같은 규율). Enter의 암묵 제출은
     * 제출 버튼이 잠기면 일어나지 않으므로 평소에는 이 줄이 걸릴 일이 없다 — 걸리는 것은
     * 버튼을 지나지 않는 제출(프로그램적 제출)뿐이고, 그 길로 겹친 조회가 나가면 **뒤 조회가
     * 앞 조회의 후보 목록을 보고 중복을 판정해** 같은 자재가 두 줄로 담긴다.
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
          ref={inputRef}
          label={t.scan.label}
          value={value}
          fullWidth
          autoComplete="off"
          /*
           * ⛔ **조회 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고, 되돌려
           * 놓기 전에 읽힌 코드가 사라진다 — 스캐너는 사람이 기다려 주지 않는다. 두 번 보내는
           * 것은 `submit`의 진행 중 검사가 막는다.
           */
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        {/*
         * 장갑 낀 손으로 누른다 — 착수 이슈 6번이 정한 72px 하한을 함께 건다.
         * DS 의 `xl` 은 60px 이라 12px 이 모자라고, 그 부족분을 제품이 임시로 채운다.
         */}
        <Button
          type="submit"
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={isScanning}
        >
          {isScanning ? t.scan.scanning : t.scan.submit}
        </Button>
      </div>

      {/*
       * 스캔 실패의 대체 경로(스펙 §3 · D-3). **칸으로 포커스를 옮기는 것이 전부다** — 코드는
       * 이미 손으로 칠 수 있고, 없던 것은 「어디를 눌러야 하는가」였다. 터치 단말에서는 이
       * 포커스가 화면 자판을 함께 띄운다.
       *
       * ⛔ 별도 입력창을 열지 않는다. 스캐너가 살아 있을 때 그 창이 스캔값을 가로챈다.
       */}
      <div className="scan-manual">
        <Button
          type="button"
          variant="outlined"
          size="xl"
          className="pop-touch-target"
          onClick={() => {
            inputRef.current?.focus();
          }}
        >
          {t.scan.manualEntry}
        </Button>
        <p className="field-note">{t.notes.manualEntry}</p>
      </div>
    </form>
  );
};
