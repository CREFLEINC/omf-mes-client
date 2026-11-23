/*
 * POP 셸의 늘 서 있는 겹 — 공통 이동 메뉴 · 사번 입력 창 · 사번 없을 때 홈으로 보내기(#291 · #334).
 * 진입 파일(`pop-main.tsx`)은 불러들이는 순간 화면을 세우므로, 그려 보는 시험(`pop-chrome.test.tsx`)을 위해 따로 둔다.
 */
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { usePopIdentity } from '../patterns/pop-identity';
import { useLegacyOutboxDrain } from '../patterns/pop-legacy-outbox';
import { setPrinterTerminal } from '../patterns/pop-printer-choice';
import {
  usePopRegistration,
  useRefreshPopTerminalOnScreenEntry,
} from '../patterns/pop-registration';
import { PopScreenNav } from '../patterns/pop-screen-nav';
import { PopTopPrinterTarget, PopTopStatusTarget } from '../patterns/pop-top-status';
import { PuToastHost } from '../patterns/pop-uniform';
import { HeaderPrinter } from '../screens/pop-home/login/header-printer';
import { PopLoginDialog } from '../screens/pop-home/login/login-panel';

/**
 * 단말을 켰을 때 맨 처음 서는 화면 — 홈(사번은 맨 위 줄 [로그인]으로 넣는다 · omf-all-around#334).
 *
 * ⛔ **주소를 여기서 지어내지 않는다.** 라우트 표에 실제로 있는 경로여야 하고, 아래 시험이
 * 그것을 지킨다 — 화면이 옮겨지면 이 상수도 함께 고쳐야 한다.
 */
export const POP_ENTRY_PATH = '/pop/home';

/**
 * 화면 위에 늘 서 있는 것 — **공통 이동 메뉴**(맨 위 줄·업무 묶음·화면 탭, #291)다. [사용자 전환]도
 * 그 맨 위 줄에 있다.
 *
 * ⭐ **길 위에 두어야 길을 안다.** 라우터 «안» 겹이라 지금 어느 화면인지 알 수 있고, 그래야
 * 진입 화면에서 스스로 빠질 수 있다. 라우터 밖에 두면 주소를 직접 읽어야 하고, 화면을 옮겨도
 * 다시 그려지지 않는다.
 */
export const PopChrome = () => {
  /* ⭐ 관리웹에서 바꾼 단말 공정·설비가 단말을 다시 켜지 않아도 보이게 한다(#1202). */
  useRefreshPopTerminalOnScreenEntry();
  const { terminal, restart } = usePopRegistration();
  /* 맨 위 줄에서 고른 프린터는 단말 코드마다 기억한다 — 발행 화면이 읽기 전에 알려 둔다. */
  setPrinterTerminal(terminal?.terminalCode ?? null);
  const { workerNo } = usePopIdentity();
  /* 없앤 생산 포장·PQC 제품 검사 화면이 단말에 남긴 확정을 마저 보낸다(#293). */
  useLegacyOutboxDrain(terminal !== null);
  const { pathname } = useLocation();
  /* 맨 위 줄의 화면 상태 자리(연결·전송 표시). 화면이 `PopTopStatus` 로 그 자리에 그린다. */
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [printerSlot, setPrinterSlot] = useState<HTMLElement | null>(null);
  /* 사번 입력 창 — 맨 위 줄 「사번 미입력 | 로그인」이 연다(사용자 지시 2026-11-20 · #334). */
  const [isLoginOpen, setLoginOpen] = useState(false);

  /*
   * ⭐ **사번이 없으면 어느 화면이든 홈으로 보낸다**(사용자 지시 2026-11-17 · #291 · #334).
   *    공통 메뉴로 사번 없이 다른 화면에 들어가면 「사번이 확인되지 않았습니다」 띠만 서고 할 일이
   *    없었다. 사번은 처음부터 동기로 읽히므로(`worker-session`) 확인 중에 튕기지 않는다.
   */
  if (workerNo === null && pathname !== POP_ENTRY_PATH) {
    return <Navigate to={POP_ENTRY_PATH} replace />;
  }

  /*
   * ⭐ 공통 이동 메뉴(#291)를 화면 «위»에 세우고, 화면은 남은 높이를 가져간다(`.pop-frame__body`).
   *    화면들은 `height: 100%` 로 그 칸을 채우므로 화면 코드는 그대로다.
   */
  return (
    <div className="pop-frame">
      <PopScreenNav
        terminalCode={terminal?.terminalCode ?? null}
        printer={<HeaderPrinter />}
        statusRef={setStatusSlot}
        printerRef={setPrinterSlot}
        onReRegister={restart}
        onLogin={() => {
          setLoginOpen(true);
        }}
      />
      {isLoginOpen && workerNo === null && (
        <PopLoginDialog
          onClose={() => {
            setLoginOpen(false);
          }}
        />
      )}
      <div className="pop-frame__body">
        <PopTopStatusTarget.Provider value={statusSlot}>
          <PopTopPrinterTarget.Provider value={printerSlot}>
            <Outlet />
          </PopTopPrinterTarget.Provider>
        </PopTopStatusTarget.Provider>
      </div>
      {/* 처리 결과 알림 자리 — 작업 줄 위 가운데(POP 통일 규칙 13 · #295). */}
      <PuToastHost />
    </div>
  );
};
