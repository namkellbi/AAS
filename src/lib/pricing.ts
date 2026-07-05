import { openAIModelOptions } from '@/lib/openai-models';

export type PricingConfig = {
  chat: Record<string, { inPerM: number; outPerM: number }>;
  ttsPerMillionChars: number;
  whisperPerMinute: number;
};

export const defaultPricing: PricingConfig = {
  chat: Object.fromEntries(openAIModelOptions.map((option) => [option.id, { inPerM: option.inputUsdPerMillion, outPerM: option.outputUsdPerMillion }])),
  ttsPerMillionChars: 12,
  whisperPerMinute: 0.006
};

export const fallbackChatPricing = { inPerM: 0.4, outPerM: 1.6 };
