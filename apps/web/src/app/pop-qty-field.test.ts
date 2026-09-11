import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * PQC 수량 칸 감지기 — **좁은 칸이 값을 잘라 보이지 않는지** 본다(#1047).
 *
 * 렌더 테스트로는 잡히지 않는다. `vitest.config.ts`가 `css: false`라 스타일이 테스트에
 * 도달하지 않고, jsdom은 배치를 계산하지 않는다 — 칸이 13px로 눌려도 값은 멀쩡히 들어가
 * 있어 게이트가 전부 초록이다.
 *
 * 실측으로 겪은 것(88단계 시험 49번): 검사 수량을 나눈 셋은 1024 폭에서 칸 하나가 78px인데,
 * DS `TextField`의 `xl`이 좌우 안쪽 여백을 각 20px 쓰고 단위(`EA`)가 그 안에 또 서서
 * **값이 들어갈 자리가 13px밖에 남지 않았다** — `100`을 넣으면 `1`만 보였다.
 */
const cssSource = readFileSync(resolve(process.cwd(), 'src/app/pop.css'), 'utf8');

/** 주석을 걷어낸 규칙 원문 — 주석에 적힌 선택자가 규칙으로 잡히지 않게 한다. */
const rules = cssSource.replace(/\/\*[\s\S]*?\*\//gu, '');

describe('PQC 수량 칸', () => {
  /**
   * DS 부품의 겉 이름은 해시가 붙어(`_inputWrap_17t7r_38`) 판마다 달라진다. 저장소가 이미
   * 쓰는 형태(`[class*='action']`)와 같이 **부분 일치로** 겨냥한다.
   */
  it('셋의 안쪽 여백을 좁혀 값 자리를 낸다', () => {
    expect(rules).toMatch(
      /\.pqc-qty-split\s*\[class\*=['"]inputWrap['"]\]\s*\{[^}]*padding-inline:\s*var\(--space-2\)/u,
    );
  });

  /**
   * ⛔ 되돌아가는 것을 막는다. 값과 단위 사이를 DS 기본값(8)으로 두면 다시 8px을 잃는다 —
   * 셋 다 합쳐 24px이고, 그만큼이 세 자리 수량의 마지막 자리다.
   */
  it('값과 단위 사이도 함께 좁힌다', () => {
    expect(rules).toMatch(
      /\.pqc-qty-split\s*\[class\*=['"]inputWrap['"]\]\s*\{[^}]*gap:\s*var\(--space-1\)/u,
    );
  });

  /**
   * ⛔ **터치 타겟을 줄여서 자리를 만들지 않는다**(POP 세로·촉감 예산). 좁히는 것은 좌우
   * 안쪽 여백뿐이고 칸의 높이·너비는 그대로다.
   */
  it('칸의 높이를 줄이지 않는다', () => {
    expect(rules).not.toMatch(
      /\.pqc-qty-split\s*\[class\*=['"]inputWrap['"]\]\s*\{[^}]*(?:min-block-size|block-size|height)\s*:/u,
    );
  });
});
