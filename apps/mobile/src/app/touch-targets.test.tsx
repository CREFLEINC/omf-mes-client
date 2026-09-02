import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCREENS = join(dirname(fileURLToPath(import.meta.url)), '..', 'screens');

const screenFiles = (): { name: string; text: string }[] =>
  readdirSync(SCREENS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(join(SCREENS, entry.name))
        .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
        .map((file) => ({
          name: `${entry.name}/${file}`,
          text: readFileSync(join(SCREENS, entry.name, file), 'utf-8'),
        })),
    );

/**
 * 장갑을 낀 손이 누르는 자리는 72픽셀이어야 하고 그것을 내는 것은 2xl 하나다.
 *
 * 화면마다 눈으로 맞추면 화면끼리 규격이 갈린다.
 */
describe('터치 규격', () => {
  it('핵심 액션 버튼은 2xl 이다', () => {
    const offenders = screenFiles()
      .filter((file) => file.text.includes('variant="filled"'))
      .filter((file) => !file.text.includes('size="2xl"'))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  /* 입력류는 xl 이 최대다. 그보다 크게 주면 타입이 막는다 - 여기서는 관례만 지킨다. */
  it('입력류에 2xl 을 주지 않는다', () => {
    const offenders = screenFiles()
      .filter((file) => /<(TextField|TextArea|Select|NumberPad)[^>]*size="2xl"/s.test(file.text))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });
});
