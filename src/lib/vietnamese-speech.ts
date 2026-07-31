const spokenPhrases: Array<[string, string]> = [
  ['chx bt', 'chưa biết'],
  ['ko bt', 'không biết'],
  ['k bt', 'không biết'],
  ['ai bt', 'ai biết']
];

const contextualSpokenPatterns: Array<[RegExp, string]> = [
  // "ng" is commonly "người" before a person/group descriptor. Keep this
  // contextual so phrases such as "ng mai" (ngày mai) are not changed.
  [
    /(^|[\s([{'"“”])ng(?=\s+(?:ta|lớn|già|trẻ|khác|lạ|quen|yêu|nhà|ngoài|việt|tốt|xấu|mới|cũ|này|kia|nào|có|không|làm|nói|hỏi|bán|mua|dùng)\b)/giu,
    '$1người'
  ]
];

const spokenTokens: Array<[string, string]> = [
  ['khôngg', 'không'],
  ['khong', 'không'],
  ['buoncuoi', 'buồn cười'],
  ['duma', 'đù má'],
  ['đuma', 'đù má'],
  ['bcuoi', 'buồn cười'],
  ['dth', 'dễ thương'],
  ['đth', 'dễ thương'],
  ['đhs', 'đéo hiểu sao'],
  ['dhs', 'đéo hiểu sao'],
  ['bth', 'bình thường'],
  ['kbt', 'không biết'],
  ['kbiet', 'không biết'],
  ['hnay', 'hôm nay'],
  ['hqua', 'hôm qua'],
  ['nma', 'nhưng mà'],
  ['mng', 'mọi người'],
  ['ntn', 'như thế nào'],
  ['jz', 'gì vậy'],
  ['đcm', 'đờ cờ mờ'],
  ['dcm', 'đờ cờ mờ'],
  ['clm', 'cờ lờ mờ'],
  ['vcc', 'vờ cờ cờ'],
  ['nch', 'nói chuyện'],
  ['vcl', 'vờ cờ lờ'],
  ['vch', 'vãi chưởng'],
  ['vkl', 'vờ ca lờ'],
  ['vl', 'vờ lờ'],
  ['vc', 'vờ cờ'],
  ['đm', 'đờ mờ'],
  ['dm', 'đờ mờ'],
  ['ny', 'người yêu'],
  ['cr', 'crush'],
  ['ck', 'chồng'],
  ['vk', 'vợ'],
  ['sv', 'sinh viên'],
  ['gv', 'giáo viên'],
  ['nv', 'nhân viên'],
  ['cty', 'công ty'],
  ['cv', 'công việc'],
  ['mxh', 'mạng xã hội'],
  ['xh', 'xã hội'],
  ['hcm', 'Hồ Chí Minh'],
  ['sg', 'Sài Gòn'],
  ['tp', 'thành phố'],
  ['ae', 'anh em'],
  ['ib', 'nhắn tin'],
  ['inb', 'nhắn tin'],
  ['rep', 'trả lời'],
  ['cmt', 'bình luận'],
  ['avt', 'ảnh đại diện'],
  ['acc', 'tài khoản'],
  ['kb', 'kết bạn'],
  ['nt', 'nhắn tin'],
  ['tl', 'trả lời'],
  ['fb', 'phây búc'],
  ['ig', 'in-sta-gram'],
  ['wtf', 'đắp bờ liu ti ép'],
  ['omg', 'ô em gi'],
  ['lmao', 'eo em ây ô'],
  ['lol', 'eo ô eo'],
  ['đc', 'được'],
  ['dc', 'được'],
  ['đag', 'đang'],
  ['dag', 'đang'],
  ['đg', 'đang'],
  ['dg', 'đang'],
  ['trc', 'trước'],
  ['xg', 'xong'],
  ['vs', 'với'],
  ['ms', 'mới'],
  ['chx', 'chưa'],
  ['cx', 'cũng'],
  ['mik', 'mình'],
  ['mk', 'mình'],
  ['mn', 'mọi người'],
  ['tr', 'trời'],
  ['iu', 'yêu'],
  ['zui', 'vui'],
  ['dzui', 'vui'],
  ['nhìu', 'nhiều'],
  ['thui', 'thôi'],
  ['lun', 'luôn'],
  ['gòi', 'rồi'],
  ['rùi', 'rồi'],
  ['roài', 'rồi'],
  ['khum', 'không'],
  ['hok', 'không'],
  ['hem', 'không'],
  ['hong', 'không'],
  ['hông', 'không'],
  ['ko', 'không'],
  ['th', 'thôi'],
  ['j', 'gì'],
  ['z', 'vậy'],
  ['k', 'không'],
  ['r', 'rồi'],
  ['t', 'tao'],
  ['m', 'mày'],
  ['v', 'vãi']
];

export function normalizeVietnameseForSpeech(input: string) {
  let output = input.normalize('NFC');

  for (const [phrase, spoken] of spokenPhrases) {
    const phrasePattern = phrase.split(/\s+/).map(escapeRegExp).join('\\s+');
    const pattern = new RegExp(`(^|[\\s([{'"“”])${phrasePattern}(?=$|[\\s.,!?;:)}\\]'"“”])`, 'giu');
    output = output.replace(pattern, (_match, prefix: string) => `${prefix}${spoken}`);
  }

  output = output
    .replace(/[:;=8xX][\-^']*[\)\(DdpP]+/g, ' ')
    .replace(/[\)\(]{3,}/g, ' ')
    .replace(/(^|[\s([{'"“”])k{2,}(?=$|[\s.,!?;:)}\]'"“”])/giu, '$1ha ha')
    .replace(/([!?.,])\1{2,}/g, '$1');

  for (const [pattern, spoken] of contextualSpokenPatterns) {
    output = output.replace(pattern, spoken);
  }

  for (const [token, spoken] of spokenTokens) {
    const pattern = new RegExp(`(^|[\\s([{'"“”])${escapeRegExp(token)}(?=$|[\\s.,!?;:)}\\]'"“”])`, 'giu');
    output = output.replace(pattern, (_match, prefix: string) => `${prefix}${spoken}`);
  }

  output = spellUnknownInitialisms(output);

  return output
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '. ')
    .trim();
}

export const vietnameseSlangTtsInstructions = [
  'Khi đọc tiếng Việt, hãy hiểu tiếng lóng và cách viết tắt theo ngữ cảnh của người trẻ Việt Nam.',
  'Đọc phần đã được phiên âm thành lời tự nhiên, không đọc dính các chữ cái và không phát âm biểu tượng cảm xúc.',
  'Không tự thêm ý, không đổi nghĩa, không làm sạch sắc thái cảm xúc hoặc mức độ suồng sã của câu gốc.'
].join(' ');

function spellUnknownInitialisms(input: string) {
  const pattern = /(^|[\s([{'"“”])([A-Za-zĐđ]{2,4})(?=$|[\s.,!?;:)}\]'"“”])/gu;
  return input.replace(pattern, (match, prefix: string, token: string) => {
    if (token === token.toLocaleLowerCase('vi-VN')) return match;
    if (/[aeiouy]/i.test(token)) return match;
    const letters = Array.from(token.toLocaleLowerCase('vi-VN'));
    if (!letters.every((letter) => letter in vietnameseLetterNames)) return match;
    return `${prefix}${letters.map((letter) => vietnameseLetterNames[letter]).join(' ')}`;
  });
}

const vietnameseLetterNames: Record<string, string> = {
  b: 'bê',
  c: 'cờ',
  d: 'dờ',
  đ: 'đờ',
  f: 'ép',
  g: 'gờ',
  h: 'hát',
  j: 'giây',
  k: 'ca',
  l: 'lờ',
  m: 'mờ',
  n: 'nờ',
  p: 'pê',
  q: 'quy',
  r: 'rờ',
  s: 'ét',
  t: 'tê',
  v: 'vờ',
  w: 'đắp bờ liu',
  x: 'ích'
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
