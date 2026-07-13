// Modelos de LLM disponíveis para escolha nos chats (Athos GS / Athos CS).
// Mesma lista usada no DescompliqueiOS — mantida aqui para reuso.
export interface LlmModel { id: string; label: string; badge: string; }

export const LLM_MODELS: LlmModel[] = [
  // OpenAI 2026
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano", badge: "OpenAI" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", badge: "OpenAI" },
  { id: "openai/gpt-5.4", label: "GPT-5.4", badge: "OpenAI" },
  { id: "openai/gpt-5.5", label: "GPT-5.5", badge: "OpenAI" },
  // Anthropic 2026
  { id: "anthropic/claude-fable-5", label: "Claude Fable 5", badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8", badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8-fast", label: "Claude Opus 4.8 Fast", badge: "Anthropic" },
  // Google 2026
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", badge: "Google" },
  // xAI 2026
  { id: "x-ai/grok-4.3", label: "Grok 4.3", badge: "xAI" },
  { id: "x-ai/grok-4.20", label: "Grok 4.20", badge: "xAI" },
  // DeepSeek 2026
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", badge: "DeepSeek" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", badge: "DeepSeek" },
  // Qwen 2026
  { id: "qwen/qwen3.7-max", label: "Qwen 3.7 Max", badge: "Qwen" },
  // Mistral 2026
  { id: "mistralai/mistral-medium-3-5", label: "Mistral Medium 3.5", badge: "Mistral" },
  // Personalizado
  { id: "__custom__", label: "Personalizado...", badge: "Custom" },
];

export const CUSTOM_MODEL_SENTINEL = "__custom__";
export const DEFAULT_LLM_MODEL = "openai/gpt-5.4-mini";

// Janela de contexto (tokens) por modelo — usado na barra de uso.
// Best-effort; modelos ausentes simplesmente não mostram a barra de contexto.
export const MODEL_CONTEXT: Record<string, number> = {
  "openai/gpt-5.4-nano": 400_000,
  "openai/gpt-5.4-mini": 400_000,
  "openai/gpt-5.4": 400_000,
  "openai/gpt-5.5": 400_000,
  "anthropic/claude-fable-5": 200_000,
  "anthropic/claude-opus-4.8": 200_000,
  "anthropic/claude-opus-4.8-fast": 200_000,
  "google/gemini-3.5-flash": 1_000_000,
  "x-ai/grok-4.3": 256_000,
  "x-ai/grok-4.20": 256_000,
  "deepseek/deepseek-v4-flash": 128_000,
  "deepseek/deepseek-v4-pro": 128_000,
  "qwen/qwen3.7-max": 256_000,
  "mistralai/mistral-medium-3-5": 128_000,
};
