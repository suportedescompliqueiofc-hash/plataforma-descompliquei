// Lista de modelos do Athos GS — fonte única, extraída de DescompliqueiOS.tsx.
// Qualquer seletor de modelo em outra superfície do Athos deve importar daqui,
// não duplicar a lista (evita a lista ficar desatualizada em algum lugar
// quando um modelo novo for adicionado/removido).
export const MODELS = [
  // ── OpenAI 2026 ───────────────────────────────────────────────────────────
  { id: "openai/gpt-5.6-luna-pro",                label: "GPT-5.6 Luna Pro",       badge: "OpenAI" },
  { id: "openai/gpt-5.4-nano",                    label: "GPT-5.4 Nano",           badge: "OpenAI" },
  { id: "openai/gpt-5.4-mini",                    label: "GPT-5.4 Mini",           badge: "OpenAI" },
  { id: "openai/gpt-5.4",                         label: "GPT-5.4",                badge: "OpenAI" },
  { id: "openai/gpt-5.5",                         label: "GPT-5.5",                badge: "OpenAI" },
  // ── Anthropic 2026 ───────────────────────────────────────────────────────
  { id: "anthropic/claude-fable-5",               label: "Claude Fable 5",         badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8",              label: "Claude Opus 4.8",        badge: "Anthropic" },
  { id: "anthropic/claude-opus-4.8-fast",         label: "Claude Opus 4.8 Fast",   badge: "Anthropic" },
  // ── Google 2026 ──────────────────────────────────────────────────────────
  { id: "google/gemini-3.5-flash",                label: "Gemini 3.5 Flash",       badge: "Google" },
  // ── xAI 2026 ─────────────────────────────────────────────────────────────
  { id: "x-ai/grok-4.3",                          label: "Grok 4.3",               badge: "xAI" },
  { id: "x-ai/grok-4.20",                         label: "Grok 4.20",              badge: "xAI" },
  // ── DeepSeek 2026 ────────────────────────────────────────────────────────
  { id: "deepseek/deepseek-v4-flash",             label: "DeepSeek V4 Flash",      badge: "DeepSeek" },
  { id: "deepseek/deepseek-v4-pro",               label: "DeepSeek V4 Pro",        badge: "DeepSeek" },
  // ── Qwen 2026 ────────────────────────────────────────────────────────────
  { id: "qwen/qwen3.7-max",                       label: "Qwen 3.7 Max",           badge: "Qwen" },
  // ── Mistral 2026 ─────────────────────────────────────────────────────────
  { id: "mistralai/mistral-medium-3-5",           label: "Mistral Medium 3.5",     badge: "Mistral" },
];

export const DEFAULT_MODEL = MODELS[0].id;
