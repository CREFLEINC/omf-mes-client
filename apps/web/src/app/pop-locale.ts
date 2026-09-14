/*
 * POP 단말의 언어를 정한다 — **Windows 표시 언어를 따른다.**
 *
 * ⛔ **`pop-main.tsx` 에서 화면을 싣는 import 보다 먼저 import 한다.** 화면이 문구 슬라이스를
 * 모듈 최상위에서 붙잡으므로(`const t = messages.xxx`), 싣고 나서 정하면 이미 붙잡은 자리는
 * 한국어로 남는다. ES 모듈은 import 순서대로 평가되므로 이 파일을 위에 두는 것으로 충분하다.
 *
 * 관리웹과 달리 언어 선택을 저장하지 않는다 — 키오스크라 고르는 손이 없다. Electron 의
 * `navigator.languages` 는 운영체제 표시 언어에서 온다. 모르는 언어면 한국어다(`resolveLocale`).
 */
import { activeLocale, resolveLocale, setLocale } from '@omf-mes/i18n';

setLocale(resolveLocale(globalThis.navigator.languages));
document.documentElement.lang = activeLocale();
