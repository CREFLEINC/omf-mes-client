/**
 * 씨앗 서버가 돌려줄 **진짜 PNG**를 만든다.
 *
 * ⭐ **왜 필요한가.** 종전 씨앗은 `{ format:'png', content:'synthetic-label' }` 이라는 JSON 을
 * 돌려줬다. 브라우저 확인에서는 셸이 가짜라 바이트를 보지 않아 지나갔지만, 실제 POP 셸은
 * 형식 시그니처를 검사하므로 그 응답으로는 **실기 인쇄 확인을 시작조차 할 수 없다**.
 *
 * ⛔ **라벨 서식이 아니다.** 실제 서식은 서버가 그린다(설계 결정 18). 여기서 만드는 것은
 *    「인쇄 경로가 끝까지 도는가」를 보기 위한 **합성 그림**이며 규격을 흉내 내지 않는다.
 *
 * ⛔ 제품 데이터를 넣지 않는다 — 발행 기록 번호로 막대 모양만 가른다.
 */
import { deflateSync } from 'node:zlib';

const WIDTH = 600;
const HEIGHT = 400;
const BORDER = 8;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};

/**
 * 회색조 8비트 PNG 한 장. 테두리와 세로 막대를 그린다 — **막대 배치가 발행 기록 번호에서
 * 나오므로**, 재출력이 앞의 것과 다른 그림인지 눈으로 가릴 수 있다.
 */
export const makeLabelPng = (seed = 1) => {
  const raw = Buffer.alloc((WIDTH + 1) * HEIGHT, 0xff);

  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * (WIDTH + 1);
    raw[row] = 0; // 필터 없음

    for (let x = 0; x < WIDTH; x += 1) {
      const onBorder = x < BORDER || x >= WIDTH - BORDER || y < BORDER || y >= HEIGHT - BORDER;
      /* 가운데 띠에만 막대를 둔다 — 위아래는 비워 두어 테두리가 잘렸는지 바로 보인다. */
      const inBand = y > HEIGHT * 0.4 && y < HEIGHT * 0.75 && x > 60 && x < WIDTH - 60;
      const bar = inBand && (Math.floor(x / 7) + seed) % 3 === 0;

      if (onBorder || bar) raw[row + 1 + x] = 0x00;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // 비트 깊이
  header[9] = 0; // 회색조

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
