export type OpenAIModelOption = {
  id: string;
  label: string;
  description: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  recommendedFor: string;
  badge?: string;
};

export const recommendedOpenAIModel = 'gpt-4.1-nano';

export const openAIModelOptions: OpenAIModelOption[] = [
  {
    id: 'gpt-4.1-nano',
    label: 'GPT-4.1 nano',
    description: 'Cheapest option for testing affiliate post analysis.',
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    recommendedFor: 'Initial testing, bulk scoring, low-cost drafts',
    badge: 'Recommended cheapest'
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    description: 'Low-cost general model with good quality for short JSON analysis.',
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
    recommendedFor: 'Balanced low-cost analysis'
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    description: 'Better instruction following for product angles and structured output.',
    inputUsdPerMillion: 0.4,
    outputUsdPerMillion: 1.6,
    recommendedFor: 'Higher-quality product suggestions'
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Higher quality, higher cost. Use for final review, not bulk testing.',
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 8,
    recommendedFor: 'Final strategy analysis'
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Strong multimodal/general model, more expensive than mini/nano options.',
    inputUsdPerMillion: 2.5,
    outputUsdPerMillion: 10,
    recommendedFor: 'High-quality analysis when cost matters less'
  }
];

export function formatModelPrice(model: OpenAIModelOption) {
  return `$${model.inputUsdPerMillion}/$${model.outputUsdPerMillion} per 1M in/out tokens`;
}
