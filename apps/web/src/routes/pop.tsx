import type { RouteObject } from 'react-router';

import { EmergencyWorkOrderFieldScreen } from '../screens/emergency-work-order-field/screen';
import { MaterialInputScanScreen } from '../screens/material-input-scan/screen';
import { PqcInspectionScreen } from '../screens/pqc-inspection/screen';
import { ToolUsageScreen } from '../screens/tool-usage/screen';
import { WorkerAssignmentScreen } from '../screens/worker-assignment/screen';

/**
 * POP(현장 단말) 화면의 라우트 표.
 *
 * **왜 관리웹 라우트와 한 배열에 두지 않는가.** POP은 관리웹의 한 구역이 아니라 **다른
 * 프로그램**이다 — Electron 설치형 셸이 산업용 패널 PC에서 키오스크로 뜬다. 코드가 한 벌인
 * 것은 「도메인 타입·검증·API 클라이언트·디자인 토큰을 공유한다」는 뜻이지 「같은 화면 목록에
 * 산다」는 뜻이 아니다. 한 배열에 섞여 있으면 POP 화면이 늘어날수록 관리웹 라우트 표가 자기
 * 것이 아닌 것으로 채워지고, 두 프로그램의 화면을 **같은 파일에서 동시에 고치게 된다**.
 *
 * `index.tsx`가 로그인(W-CO-01) 주석에서 「별도 라우터는 라우트 표가 둘이 되어 이 주소가
 * 어디 있는지를 두 곳에서 찾게 만든다」며 버린 대안과 형태는 같고 근거는 다르다. 그쪽은
 * **같은 프로그램 안의 한 화면**이라 표를 쪼갤 이유가 없었다. 이쪽은 폼팩터가 갈리므로
 * 「어디서 찾는가」의 답이 오히려 분명해진다 — `/pop`으로 시작하면 여기다.
 *
 * ⛔ **POP 라우트를 `index.tsx`에 직접 추가하지 않는다.** 새 P- 화면은 이 배열에만 붙인다.
 *
 * ⚠ 지금은 `index.tsx`가 이 배열을 그대로 펼쳐 넣는다 — **주소도 동작도 이전과 같다.**
 * 이 파일이 분리된 것은 소유를 가르기 위해서이지 번들을 가르기 위해서가 아니다. POP 전용
 * 빌드 엔트리는 아직 없고, `apps/pop`은 여전히 `apps/web/dist`를 통째로 복사해 쓴다.
 */
export const popRoutes: RouteObject[] = [
  /*
   * P-CO-01 — **POP 셸의 진입 화면이다.** 스펙 §1 이 IA 위치를 「POP > 진입(셸 공통)」으로
   * 못박았다: 메뉴로 찾아 들어가는 화면이 아니라 **단말을 켰을 때 맨 처음 서는 화면**이다.
   * 그래서 이 배열의 첫 자리에 둔다 — 아래 태스크 화면들은 이 화면이 사번을 정한 «뒤»에 선다.
   *
   * ⛔ **세로 예산이 셸 밖에 서는 이유다.** §3/E-1 은 헤더 64 + 본문 704 = 768 이고 「슬랙이
   * 0」이라, 관리웹 셸의 상단 바와 본문 여백이 위에 얹히면 1024×768 단말에서 본문 아래가
   * 잘린다.
   *
   * ⚠ **이 화면이 정한 사번을 아직 아무도 읽지 않는다.** 아래 화면들은 각자 다른 출처를
   * 쓰고 있고(셸이 채울 `patterns/pop-identity` · 진입 주소), 이 화면은 값을 단말 메모리에
   * 두기만 한다(`patterns/worker-session`). 단말·공정은 여전히 셸 몫이라, 이 화면이 섰다고
   * 그 자리가 채워지는 것은 아니다.
   */
  { path: '/pop/worker-assignment', element: <WorkerAssignmentScreen /> },
  /*
   * P-02-03 — **POP(현장 단말) 화면의 첫 라우트다.** 로그인과 같이 관리웹 셸 배열의 형제로
   * 서서 `AppLayout`을 지나지 않는다.
   *
   * 근거: 이 화면 앞에 선 사람은 장갑을 낀 채 스캐너를 든다. 사이드바·상단 바는 마우스로
   * 메뉴를 오가는 사람을 위한 것이라, 1024×768 단말에서는 **누르지 않을 것들이 화면 너비의
   * 4분의 1을 가져간다.** 셸 밖에 선 근거가 로그인과 다르다 — 그쪽은 메뉴가 성립하지 않는
   * 것이고 이쪽은 메뉴를 쓸 손이 없는 것이다.
   *
   * ⛔ **사이드바에 올리지 않는다.** 관리웹 사용자가 갈 자리가 아니다. 진입은 작업지시를 실은
   * 주소(`?workOrderId=`)로만 하며, `P-02-01`(작업 시작)이 서면 그 화면이 이 주소로 넘긴다.
   *
   * ⚠ **이 라우트도 접근을 제한하지 않는다.** 화면의 단말 게이팅은 오조작을 줄이는 장치이지
   * 집행이 아니다(공유계약 F-1 · F-5) — 집행은 서버의 403이다.
   *
   * ⚠ **단말·공정·사번은 셸이 채운다**(`patterns/pop-identity`). 그 자리가 아직 비어 있어
   * 이 화면은 「단말이 확인되지 않았습니다」로 막힌 채 뜬다 — 모르는 것을 통과로 처리하지
   * 않는다(F-6). `P-CO-01`과 단말 토큰이 서면 그때 채워진다.
   */
  { path: '/pop/material-input', element: <MaterialInputScanScreen /> },
  /*
   * P-05-01 — **POP 태스크 화면이라 셸 밖에 선다**(관리웹 사이드바로 옮겨 다니는 화면이 아니다).
   * 주소 앞머리 `/pop`이 그 사실을 드러낸다.
   *
   * ⚠ **진입 컨텍스트를 질의 문자열로 받는다** — 작업지시 선택(P-02-01)과 사번 인증(P-CO-01)이
   * 아직 이 저장소에 없다. 그 화면들이 서면 `entry-context.ts` 하나가 바뀐다.
   */
  { path: '/pop/tool-usage', element: <ToolUsageScreen /> },
  /*
   * P-02-12 — 긴급 W/O 를 현장에서 «집는» 자리다. 관리웹의 `W-02-07`
   * (`production/emergency-work-orders`)이 «만드는» 화면이고, 이 주소는 그렇게 만들어진
   * 지시를 골라 정상 경로 화면(위 `/pop/material-input` 등)으로 넘긴다.
   *
   * ⚠ **진입 컨텍스트를 받지 않는다** — 목록이 곧 진입이라 주소에 실을 것이 없다. 나가는
   * 쪽에만 `?workOrderId=` 를 싣는다.
   */
  { path: '/pop/emergency-work-orders', element: <EmergencyWorkOrderFieldScreen /> },
  /*
   * P-02-13 — 공정 중 제품을 검사하고 판정한다. **검사 «수행» 지점이 생산 공정이라** 품질
   * 관리자가 결과를 횡단해 보는 화면(W-03-xx)과 다른 자리에 선다.
   *
   * ⚠ **진입 대상을 질의 문자열로 받는다**(`?ir=<검사의뢰 id>`) — 이 화면이 부르는 경로는
   * 진입·항목 목록·결과 저장 셋뿐이라 «고를 목록»을 스스로 조회하지 않는다. 대상 없이 들어오면
   * 작업 화면에서 진입하라고 안내한다.
   */
  { path: '/pop/pqc-inspection', element: <PqcInspectionScreen /> },
];
