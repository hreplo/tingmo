// LLM Refinement Provider interface and System Prompts

export interface DictEntry {
  word: string;
  replace: string;
}

export type PolishMode = 'raw' | 'light' | 'structured' | 'formal' | 'custom';

export const POLISH_MODES: { value: PolishMode; labelKey: string }[] = [
  { value: 'raw', labelKey: 'polish.raw' },
  { value: 'light', labelKey: 'polish.light' },
  { value: 'structured', labelKey: 'polish.structured' },
  { value: 'formal', labelKey: 'polish.formal' },
  { value: 'custom', labelKey: 'polish.custom' },
];

export interface RefineContext {
  language?: string;
  dictionary?: DictEntry[];
  polishMode?: PolishMode;
  customPrompt?: string;
}

export interface RefinementResult {
  refinedText: string;
  originalText: string;
  provider: string;
  durationMs: number;
}

export interface IRefinementProvider {
  readonly name: string;

  /** Refine raw ASR text into structured, clean output */
  refine(rawText: string, context?: RefineContext): Promise<RefinementResult>;

  /** Translate text to a target language */
  translate(text: string, targetLang: string, context?: RefineContext): Promise<RefinementResult>;
}

function buildDictHint(dictionary?: DictEntry[]): string {
  if (!dictionary || dictionary.length === 0) return '';
  const items = dictionary.map(e => `"${e.word}" → "${e.replace}"`).join('、');
  return `\n以下词汇是用户的专属词汇，请保持不替换、不修改其写法：${items}`;
}

// ── Polish prompts per mode ─────────────────────────────────

const PROMPT_RAW = `你是一个标点补全助手。只做一件事：给文本补全中英文标点符号。
- 保持原文用词、语序、结构完全不变
- 不要添加、删除、修改任何字词
- 不要改变任何表达方式{dict_hint}
直接返回补全标点后的文字，不要任何解释或前缀。`;

const PROMPT_LIGHT = `你是一个语音输入润色助手。请对语音识别结果做以下处理：
1. 删除口语填充词：嗯、啊、就是、那个、然后、反正、这个、呃
2. 补全标点符号（中英文正确混用）
3. 保持原意和语序，不添加、不编造、不删减实质内容{dict_hint}
直接返回润色后的文字，不要任何解释或前缀。`;

const PROMPT_STRUCTURED = `你是一个语音输入润色助手。请对语音识别结果做以下处理：
1. 删除填充词：嗯、啊、就是、那个、然后、反正、这个、呃
2. 根据内容自动结构化：
   - 如果是罗列或分点说明 → 用 Markdown 列表
   - 如果是步骤或要求 → 用编号
   - 如果是叙述 → 保持段落
3. 补全标点符号（中英文正确混用）
4. 保持原意，不添加、不编造、不删减实质内容{dict_hint}
直接返回润色后的文字，不要任何解释或前缀。`;

const PROMPT_FORMAL = `你是一个语音输入转正式书面语助手。请对语音识别结果做以下处理：
1. 删除口语填充词：嗯、啊、就是、那个、然后、反正、这个、呃
2. 将口语化表达转为正式书面语（如"咱们"→"我们"，"搞一下"→"处理"）
3. 补全标点符号，使用规范的书面语表达
4. 保持原意，不添加、不编造、不删减实质内容{dict_hint}
直接返回润色后的文字，不要任何解释或前缀。`;

const MODE_PROMPTS: Record<PolishMode, string> = {
  raw: PROMPT_RAW,
  light: PROMPT_LIGHT,
  structured: PROMPT_STRUCTURED,
  formal: PROMPT_FORMAL,
  custom: '', // filled from context
};

export function buildRefinePrompt(context?: RefineContext): string {
  const mode = context?.polishMode || 'structured';
  const dictHint = buildDictHint(context?.dictionary);

  if (mode === 'custom' && context?.customPrompt) {
    return context.customPrompt.replace('{dict_hint}', dictHint);
  }

  const base = MODE_PROMPTS[mode] || PROMPT_STRUCTURED;
  return base.replace('{dict_hint}', dictHint);
}

const TRANSLATE_BASE = `You are a translator. Translate the following text into {targetLang}.
Preserve the structure (lists, paragraphs, numbering).{dict_hint}
Output only the translated text, no explanations.`;

export function buildTranslatePrompt(targetLang: string, dictionary?: DictEntry[]): string {
  return TRANSLATE_BASE
    .replace('{targetLang}', targetLang)
    .replace('{dict_hint}', dictionary?.length ? `\nPreserve these terms exactly as written: ${dictionary.map(e => e.replace).join(', ')}` : '');
}
