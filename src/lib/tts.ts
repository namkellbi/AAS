import type {
  GeminiTtsVoice,
  OpenAiTtsVoice,
  TtsProvider,
  TtsVoice,
  VieneuTtsVoice
} from '@/lib/types';

export type TtsVoiceOption = {
  id: TtsVoice;
  label: string;
  description: { en: string; vi: string };
};

export const openAiTtsModel = 'gpt-4o-mini-tts';
export const geminiTtsModel = 'gemini-2.5-flash-preview-tts';
export const vieneuTtsModel = 'vieneu-v3-turbo-onnx-int8';

export const openAiTtsVoiceOptions: Array<TtsVoiceOption & { id: OpenAiTtsVoice }> = [
  {
    id: 'nova',
    label: 'Nova',
    description: { en: 'Warm and conversational', vi: 'Ấm, tự nhiên, hợp kể chuyện' }
  },
  {
    id: 'onyx',
    label: 'Onyx',
    description: { en: 'Deep and grounded', vi: 'Trầm, chắc, rõ ý' }
  },
  {
    id: 'shimmer',
    label: 'Shimmer',
    description: { en: 'Bright and articulate', vi: 'Sáng, rõ, nhịp linh hoạt' }
  }
];

const geminiVoices: Array<[GeminiTtsVoice, string, string]> = [
  ['Zephyr', 'Bright', 'Sáng'],
  ['Puck', 'Upbeat', 'Vui và có năng lượng'],
  ['Charon', 'Informative', 'Rõ ràng, cung cấp thông tin'],
  ['Kore', 'Firm', 'Chắc chắn'],
  ['Fenrir', 'Excitable', 'Hào hứng'],
  ['Leda', 'Youthful', 'Trẻ trung'],
  ['Orus', 'Firm', 'Mạnh và chắc'],
  ['Aoede', 'Breezy', 'Nhẹ và thoáng'],
  ['Callirrhoe', 'Easy-going', 'Thoải mái'],
  ['Autonoe', 'Bright', 'Sáng'],
  ['Enceladus', 'Breathy', 'Nhiều hơi, mềm'],
  ['Iapetus', 'Clear', 'Rõ lời'],
  ['Umbriel', 'Easy-going', 'Tự nhiên, thoải mái'],
  ['Algieba', 'Smooth', 'Mỏng và mượt'],
  ['Despina', 'Smooth', 'Nhẹ và mượt'],
  ['Erinome', 'Clear', 'Rõ ràng'],
  ['Algenib', 'Gravelly', 'Khàn nhẹ'],
  ['Rasalgethi', 'Informative', 'Diễn đạt rõ ý'],
  ['Laomedeia', 'Upbeat', 'Tươi vui'],
  ['Achernar', 'Soft', 'Mềm và nhẹ'],
  ['Alnilam', 'Firm', 'Chắc'],
  ['Schedar', 'Even', 'Đều và ổn định'],
  ['Gacrux', 'Mature', 'Trưởng thành'],
  ['Pulcherrima', 'Forward', 'Trực diện'],
  ['Achird', 'Friendly', 'Thân thiện'],
  ['Zubenelgenubi', 'Casual', 'Đời thường'],
  ['Vindemiatrix', 'Gentle', 'Dịu dàng'],
  ['Sadachbia', 'Lively', 'Sinh động'],
  ['Sadaltager', 'Knowledgeable', 'Am hiểu, rõ ràng'],
  ['Sulafat', 'Warm', 'Ấm áp']
];

export const geminiTtsVoiceOptions: Array<TtsVoiceOption & { id: GeminiTtsVoice }> =
  geminiVoices.map(([id, en, vi]) => ({
    id,
    label: id,
    description: { en, vi }
  }));

const vieneuVoices: Array<[VieneuTtsVoice, string, string]> = [
  ['Ngoc-Huyen-Clone', 'Authorized cloned voice · Northern female', 'Giọng clone được cấp phép · Nữ miền Bắc'],
  ['Minh Đức', 'Northern male · News', 'Nam miền Bắc · Tin tức'],
  ['Phạm Tuyên', 'Northern male · Natural', 'Nam miền Bắc · Tự nhiên'],
  ['Thái Sơn', 'Southern male · Storytelling', 'Nam miền Nam · Kể chuyện'],
  ['Xuân Vĩnh', 'Southern male · Natural', 'Nam miền Nam · Tự nhiên'],
  ['Thanh Bình', 'Northern male · Storytelling', 'Nam miền Bắc · Kể chuyện'],
  ['Trúc Ly', 'Northern female · Natural', 'Nữ miền Bắc · Tự nhiên'],
  ['Ngọc Linh', 'Northern female · Storytelling', 'Nữ miền Bắc · Kể chuyện'],
  ['Đoan Trang', 'Northern female · Natural', 'Nữ miền Bắc · Tự nhiên'],
  ['Mai Anh', 'Northern female · News', 'Nữ miền Bắc · Tin tức'],
  ['Thục Đoan', 'Southern female · Storytelling', 'Nữ miền Nam · Kể chuyện'],
  ['Minh Triết', 'Southern male · News', 'Nam miền Nam · Tin tức'],
  ['Thùy Dung', 'Southern female · News', 'Nữ miền Nam · Tin tức'],
  ['Quang Sơn', 'Central male · Natural', 'Nam miền Trung · Tự nhiên'],
  ['Ngọc Trân', 'Central female · Natural', 'Nữ miền Trung · Tự nhiên']
];

export const vieneuTtsVoiceOptions: Array<TtsVoiceOption & { id: VieneuTtsVoice }> =
  vieneuVoices.map(([id, en, vi]) => ({
    id,
    label: id,
    description: { en, vi }
  }));

export function getTtsVoiceOptions(provider: TtsProvider): TtsVoiceOption[] {
  if (provider === 'gemini') return geminiTtsVoiceOptions;
  if (provider === 'vieneu') return vieneuTtsVoiceOptions;
  return openAiTtsVoiceOptions;
}

export function getTtsModel(provider: TtsProvider): string {
  if (provider === 'gemini') return geminiTtsModel;
  if (provider === 'vieneu') return vieneuTtsModel;
  return openAiTtsModel;
}

export function isTtsVoiceForProvider(provider: TtsProvider, voice: unknown): voice is TtsVoice {
  return getTtsVoiceOptions(provider).some((option) => option.id === voice);
}

export function getDefaultVoiceForProvider(provider: TtsProvider): TtsVoice {
  if (provider === 'gemini') return 'Leda';
  if (provider === 'vieneu') return 'Ngoc-Huyen-Clone';
  return 'nova';
}

// Backward-compatible aliases for modules that still describe OpenAI-only pricing.
export const ttsVoiceOptions = openAiTtsVoiceOptions;
export const ttsModel = openAiTtsModel;
