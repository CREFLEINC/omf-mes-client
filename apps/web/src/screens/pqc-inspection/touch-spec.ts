import type { ButtonSize } from '@crefle/web-ui';

/**
 * 이 화면의 터치 규격 — **72픽셀**.
 *
 * 설계 §3 의 액션바가 72 급이고(「검사 확정」), 키패드 키도 같은 손으로 누른다. 값을 쓰는 곳
 * 마다 적으면 등급이 바뀔 때 한쪽만 고쳐져 같은 화면에 두 크기가 선다.
 *
 * ⚠ **이 화면이 소유한다** — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const POP_TOUCH_SIZE: ButtonSize = '2xl';
