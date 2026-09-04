import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { normalizeScanCode } from './scan';

const t = messages.runningChange;

export interface ScanFieldProps {
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  onScan: (code: string) => void;
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
export const ScanField = ({ isScanning, onScan }: ScanFieldProps) => {
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
         * 장갑 낀 손으로 누른다 — **DS 의 `2xl`(72px)을 그대로 쓴다.** 착수 이슈 6항이
         * 「터치 타겟도 해소됐다 · 제품 측 임시 지정은 폐기됐다」로 정했다.
         */}
        <Button type="submit" variant="filled" size="2xl" disabled={isScanning}>
          {isScanning ? t.scan.scanning : t.scan.submit}
        </Button>
      </div>

      {/*
       * 스캔 실패의 대체 경로. **칸으로 포커스를 옮기는 것이 전부다** — 코드는 이미 손으로
       * 칠 수 있고, 없던 것은 「어디를 눌러야 하는가」였다.
       *
       * ⛔ 별도 입력창을 열지 않는다. 스캐너가 살아 있을 때 그 창이 스캔값을 가로챈다.
       */}
      <div className="scan-manual">
        <Button
          type="button"
          variant="outlined"
          size="2xl"
          onClick={() => {
            inputRef.current?.focus();
          }}
        >
          {t.scan.manualEntry}
        </Button>
      </div>
    </form>
  );
};
