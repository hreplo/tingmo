// i18n — 5-language translation dictionary

export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko';

type LocaleMap = Record<Locale, string>;

const D: Record<string, LocaleMap> = {
  // ── Navigation ─────────────────────────────────────────
  'nav.history':     { 'zh-CN': '历史',  'zh-TW': '歷史',  en: 'History',   ja: '履歴',      ko: '기록' },
  'nav.dictionary':  { 'zh-CN': '词典',  'zh-TW': '詞典',  en: 'Dictionary', ja: '辞書',     ko: '사전' },
  'nav.model':       { 'zh-CN': '模型',  'zh-TW': '模型',  en: 'Model',      ja: 'モデル',   ko: '모델' },
  'nav.settings':    { 'zh-CN': '设置',  'zh-TW': '設定',  en: 'Settings',   ja: '設定',     ko: '설정' },
  'nav.about':       { 'zh-CN': '关于',  'zh-TW': '關於',  en: 'About',      ja: '情報',     ko: '정보' },

  // ── Brand ──────────────────────────────────────────────
  'brand.name': { 'zh-CN': 'TINGMO', 'zh-TW': 'TINGMO', en: 'TINGMO', ja: 'TINGMO', ko: 'TINGMO' },

  // ── Sections (unified: tag + title merged into one key) ─
  'section.history':    { 'zh-CN': '历史',  'zh-TW': '歷史',  en: 'History',   ja: '履歴',      ko: '기록' },
  'section.dictionary': { 'zh-CN': '词典',  'zh-TW': '詞典',  en: 'Dictionary', ja: '辞書',     ko: '사전' },
  'section.model':      { 'zh-CN': '模型',  'zh-TW': '模型',  en: 'Model',      ja: 'モデル',   ko: '모델' },
  'section.voice':      { 'zh-CN': '语音',  'zh-TW': '語音',  en: 'Voice',      ja: '音声',     ko: '음성' },
  'section.keybind':    { 'zh-CN': '快捷键','zh-TW': '快捷鍵',en: 'Keybinds',   ja: 'キー',     ko: '단축키' },
  'section.translate':  { 'zh-CN': '翻译',  'zh-TW': '翻譯',  en: 'Translation', ja: '翻訳',    ko: '번역' },
  'section.options':    { 'zh-CN': '选项',  'zh-TW': '選項',  en: 'Options',     ja: 'オプション', ko: '옵션' },
  'section.llm':        { 'zh-CN': 'AI 润色','zh-TW': 'AI 潤色',en: 'AI Refine', ja: 'AI 補正',  ko: 'AI 교정' },
  'section.about':      { 'zh-CN': '关于',  'zh-TW': '關於',  en: 'About',       ja: '情報',     ko: '정보' },

  // ── Settings: Voice ────────────────────────────────────
  'settings.voiceMode':          { 'zh-CN': '语音模式', 'zh-TW': '語音模式', en: 'Voice mode',     ja: '音声モード',  ko: '음성 모드' },
  'settings.voiceMode.local':    { 'zh-CN': '本地',     'zh-TW': '本地',     en: 'Local',          ja: 'ローカル',     ko: '로컬' },
  'settings.voiceMode.cloud':    { 'zh-CN': 'API',      'zh-TW': 'API',      en: 'API',            ja: 'API',          ko: 'API' },
  'settings.recognitionLanguage':{ 'zh-CN': '识别语言', 'zh-TW': '識別語言', en: 'Language',        ja: '認識言語',     ko: '인식 언어' },
  'settings.language.zh':        { 'zh-CN': '中文',     'zh-TW': '中文',     en: 'Chinese',        ja: '中国語',       ko: '중국어' },
  'settings.language.en':        { 'zh-CN': '英文',     'zh-TW': '英文',     en: 'English',        ja: '英語',         ko: '영어' },

  // ── Settings: Keybinds ─────────────────────────────────
  'settings.voiceInput':    { 'zh-CN': '语音输入', 'zh-TW': '語音輸入', en: 'Voice input',    ja: '音声入力',   ko: '음성 입력' },
  'settings.translateInput':{ 'zh-CN': '翻译输入', 'zh-TW': '翻譯輸入', en: 'Translate input', ja: '翻訳入力',   ko: '번역 입력' },

  // ── Settings: Translation ──────────────────────────────
  'settings.targetLanguage':       { 'zh-CN': '目标语言', 'zh-TW': '目標語言', en: 'Target language',   ja: '目標言語',     ko: '대상 언어' },
  'settings.translateEngine':      { 'zh-CN': '翻译引擎', 'zh-TW': '翻譯引擎', en: 'Engine',            ja: '翻訳エンジン', ko: '번역 엔진' },
  'settings.translateEngine.disabled':{ 'zh-CN': '未启用（需先开启 LLM 润色）', 'zh-TW': '未啟用（需先開啟 LLM 潤色）', en: 'Disabled (enable LLM refine first)', ja: '無効（LLM補正を先に有効化）', ko: '비활성화 (LLM 교정 먼저 활성화)' },

  // ── Settings: Options ──────────────────────────────────
  'settings.launchAtStartup': { 'zh-CN': '开机自启',   'zh-TW': '開機自啟',   en: 'Launch at startup',  ja: '起動時に実行', ko: '시작 시 실행' },
  'settings.muteOnRecord':    { 'zh-CN': '录音时静音', 'zh-TW': '錄音時靜音', en: 'Mute while recording', ja: '録音中ミュート', ko: '녹음 중 음소거' },
  'settings.useDictionary':   { 'zh-CN': '启用词典',   'zh-TW': '啟用詞典',   en: 'Use dictionary',      ja: '辞書を使用',     ko: '사전 사용' },
  'settings.uiLanguage':      { 'zh-CN': '界面语言',   'zh-TW': '介面語言',   en: 'UI Language',         ja: '表示言語',       ko: '인터페이스 언어' },

  // ── Settings: LLM ──────────────────────────────────────
  'settings.enableRefine':         { 'zh-CN': '启用润色',     'zh-TW': '啟用潤色',     en: 'Enable refine',     ja: '補正を有効化', ko: '교정 활성화' },
  'settings.apiKey':               { 'zh-CN': 'API Key',      'zh-TW': 'API Key',      en: 'API Key',           ja: 'APIキー',       ko: 'API 키' },
  'settings.apiKeyPlaceholder':    { 'zh-CN': 'sk-...',       'zh-TW': 'sk-...',       en: 'sk-...',            ja: 'sk-...',        ko: 'sk-...' },
  'settings.model':                { 'zh-CN': '模型',         'zh-TW': '模型',         en: 'Model',             ja: 'モデル',        ko: '모델' },
  'settings.apiEndpoint':          { 'zh-CN': 'API 端点',     'zh-TW': 'API 端點',     en: 'API endpoint',      ja: 'APIエンドポイント', ko: 'API 엔드포인트' },
  'settings.apiEndpointPlaceholder':{ 'zh-CN': 'https://api.openai.com/v1','zh-TW': 'https://api.openai.com/v1', en: 'https://api.openai.com/v1', ja: 'https://api.openai.com/v1', ko: 'https://api.openai.com/v1' },

  // ── Model tab ──────────────────────────────────────────
  'model.asrEngine':            { 'zh-CN': 'ASR 引擎', 'zh-TW': 'ASR 引擎', en: 'ASR engine',        ja: 'ASRエンジン',   ko: 'ASR 엔진' },
  'model.asrEngineValue':       { 'zh-CN': 'Paraformer-large INT8','zh-TW':'Paraformer-large INT8',en:'Paraformer-large INT8',ja:'Paraformer-large INT8',ko:'Paraformer-large INT8' },
  'model.punctuationModel':     { 'zh-CN': '标点模型', 'zh-TW': '標點模型', en: 'Punctuation',       ja: '句読点モデル',  ko: '문장 부호' },
  'model.punctuationModelValue':{ 'zh-CN': 'CT-Transformer','zh-TW':'CT-Transformer',en:'CT-Transformer',ja:'CT-Transformer',ko:'CT-Transformer' },
  'model.vad':                  { 'zh-CN': 'VAD',      'zh-TW': 'VAD',      en: 'VAD',               ja: 'VAD',           ko: 'VAD' },
  'model.vadValue':             { 'zh-CN': 'FSMN-VAD', 'zh-TW': 'FSMN-VAD', en: 'FSMN-VAD',          ja: 'FSMN-VAD',      ko: 'FSMN-VAD' },
  'model.inferenceFramework':   { 'zh-CN': '推理框架', 'zh-TW': '推理框架', en: 'Framework',         ja: '推論フレームワーク', ko: '추론 프레임워크' },
  'model.inferenceFrameworkValue':{'zh-CN':'ONNX Runtime','zh-TW':'ONNX Runtime',en:'ONNX Runtime',  ja:'ONNX Runtime',   ko:'ONNX Runtime' },
  'model.size':                 { 'zh-CN': '体积',     'zh-TW': '體積',     en: 'Size',              ja: 'サイズ',        ko: '크기' },
  'model.sizeValue':            { 'zh-CN': '~304 MB',  'zh-TW': '~304 MB',  en: '~304 MB',           ja: '~304 MB',       ko: '~304 MB' },

  // ── History tab ────────────────────────────────────────
  'history.totalDuration':  { 'zh-CN': '累计时长', 'zh-TW': '累計時長', en: 'Total duration',  ja: '累計時間',    ko: '총 시간' },
  'history.totalCharCount': { 'zh-CN': '累计字数', 'zh-TW': '累計字數', en: 'Total characters', ja: '累計文字数',  ko: '총 글자 수' },
  'history.recentRecords':  { 'zh-CN': '最近记录', 'zh-TW': '最近記錄', en: 'Recent records',   ja: '最近の記録',  ko: '최근 기록' },
  'history.clear':          { 'zh-CN': '清空',     'zh-TW': '清空',     en: 'Clear',           ja: '消去',        ko: '지우기' },
  'history.empty':          { 'zh-CN': '暂无语音输入记录', 'zh-TW': '暫無語音輸入記錄', en: 'No voice input records yet', ja: '音声入力記録なし', ko: '음성 입력 기록 없음' },
  'history.unit.seconds':   { 'zh-CN': ' 秒', 'zh-TW': ' 秒', en: 's',   ja: '秒',   ko: '초' },
  'history.unit.minutes':   { 'zh-CN': ' 分', 'zh-TW': ' 分', en: 'm',   ja: '分',   ko: '분' },
  'history.unit.characters':{ 'zh-CN': ' 字', 'zh-TW': ' 字', en: ' chars', ja: ' 文字', ko: ' 글자' },

  // ── Dictionary tab ─────────────────────────────────────
  'dictionary.description': { 'zh-CN': '添加专业词汇、人名、品牌名等专属词汇。ASR 识别时会优先匹配，LLM 润色时也会保留不修改。', 'zh-TW': '添加專業詞彙、人名、品牌名等專屬詞彙。ASR 識別時會優先匹配，LLM 潤色時也會保留不修改。', en: 'Add proper nouns, technical terms, brand names. ASR will match them with priority, and LLM refinement will preserve them unchanged.', ja: '固有名詞、技術用語、ブランド名を追加。ASRが優先マッチングし、LLM補正時にも保持されます。', ko: '고유 명사, 기술 용어, 브랜드명을 추가하세요. ASR이 우선 매칭하고 LLM 교정 시에도 보존됩니다.' },
  'dictionary.word':            { 'zh-CN': '添加词汇', 'zh-TW': '添加詞彙', en: 'Add term', ja: '用語を追加', ko: '용어 추가' },
  'dictionary.wordPlaceholder': { 'zh-CN': '输入你想说的词，如 SQL、ChatGPT', 'zh-TW': '輸入你想說的詞，如 SQL、ChatGPT', en: 'Enter a term, e.g. SQL, Kubernetes', ja: '用語を入力（例: SQL, Kubernetes）', ko: '용어 입력 (예: SQL, Kubernetes)' },
  'dictionary.add':                    { 'zh-CN': '添加', 'zh-TW': '添加', en: 'Add',    ja: '追加',   ko: '추가' },
  'dictionary.delete':                 { 'zh-CN': '删除', 'zh-TW': '刪除', en: 'Delete', ja: '削除',   ko: '삭제' },

  // ── Hotkey recorder ────────────────────────────────────
  'hotkey.recordingTooltip':    { 'zh-CN': '请按键...',   'zh-TW': '請按鍵...',   en: 'Press keys...',  ja: 'キーを押してください...', ko: '키를 누르세요...' },
  'hotkey.clickToReset':        { 'zh-CN': '点击重新设置', 'zh-TW': '點擊重新設定', en: 'Click to rebind', ja: 'クリックで再設定',       ko: '클릭하여 재설정' },
  'hotkey.recordingPlaceholder': { 'zh-CN': '请按键...',   'zh-TW': '請按鍵...',   en: 'Press keys...',  ja: 'キーを押してください...', ko: '키를 누르세요...' },
  'hotkey.resetToDefault':      { 'zh-CN': '恢复默认',     'zh-TW': '恢復默認',     en: 'Reset',          ja: 'デフォルトに戻す',       ko: '기본값으로 재설정' },
  'hotkey.key.rightCtrl': { 'zh-CN': '右 Ctrl','zh-TW': '右 Ctrl',en: 'Right Ctrl', ja: '右 Ctrl',ko: '오른쪽 Ctrl' },
  'hotkey.key.leftCtrl':  { 'zh-CN': '左 Ctrl','zh-TW': '左 Ctrl',en: 'Left Ctrl',  ja: '左 Ctrl',ko: '왼쪽 Ctrl' },
  'hotkey.key.rightAlt':  { 'zh-CN': '右 Alt', 'zh-TW': '右 Alt', en: 'Right Alt',  ja: '右 Alt', ko: '오른쪽 Alt' },
  'hotkey.key.leftAlt':   { 'zh-CN': '左 Alt', 'zh-TW': '左 Alt', en: 'Left Alt',   ja: '左 Alt', ko: '왼쪽 Alt' },
  'hotkey.key.rightShift':{ 'zh-CN': '右 Shift','zh-TW':'右 Shift',en: 'Right Shift',ja: '右 Shift',ko:'오른쪽 Shift' },
  'hotkey.key.leftShift': { 'zh-CN': '左 Shift','zh-TW':'左 Shift',en: 'Left Shift', ja: '左 Shift',ko:'왼쪽 Shift' },
  'hotkey.key.win':       { 'zh-CN': 'Win',     'zh-TW': 'Win',      en: 'Win',        ja: 'Win',     ko: 'Win' },

  // ── Floating window status ─────────────────────────────
  'status.recognizing':{ 'zh-CN': '识别中',   'zh-TW': '識別中',   en: 'Recognizing...', ja: '認識中...',   ko: '인식 중...' },
  'status.refining':   { 'zh-CN': '润色中',   'zh-TW': '潤色中',   en: 'Refining...',    ja: '補正中...',   ko: '교정 중...' },
  'status.success':    { 'zh-CN': '完成',     'zh-TW': '完成',     en: 'Done',           ja: '完了',        ko: '완료' },
  'status.error':      { 'zh-CN': '失败',     'zh-TW': '失敗',     en: 'Failed',         ja: '失敗',        ko: '실패' },

  // ── Error panel ────────────────────────────────────────
  'error.retry':             { 'zh-CN': '重试', 'zh-TW': '重試', en: 'Retry', ja: '再試行', ko: '재시도' },
  'error.copy':              { 'zh-CN': '复制', 'zh-TW': '複製', en: 'Copy',  ja: 'コピー', ko: '복사' },
  'error.noAudioCaptured':   { 'zh-CN': '没有采集到音频，请检查麦克风权限', 'zh-TW': '沒有採集到音頻，請檢查麥克風權限', en: 'No audio captured. Please check microphone permission.', ja: '音声が取得できません。マイクの権限を確認してください。', ko: '오디오를 캡처하지 못했습니다. 마이크 권한을 확인하세요.' },

  // ── About ──────────────────────────────────────────────
  'about.appName':     { 'zh-CN': 'TingMo 听墨', 'zh-TW': 'TingMo 聽墨', en: 'TingMo 听墨', ja: 'TingMo 听墨', ko: 'TingMo 听墨' },
  'about.description': { 'zh-CN': '桌面 AI 语音输入法。按快捷键开始录音，再次按下停止，语音自动转文字注入光标位置。', 'zh-TW': '桌面 AI 語音輸入法。按快捷鍵開始錄音，再次按下停止，語音自動轉文字注入游標位置。', en: 'Desktop AI voice input. Press hotkey to record, press again to stop. Speech is converted to text and injected at cursor.', ja: 'デスクトップAI音声入力。ホットキーで録音開始、もう一度押すと停止。音声がテキストに変換されカーソル位置に注入されます。', ko: '데스크톱 AI 음성 입력. 단축키로 녹음 시작, 다시 누르면 중지. 음성이 텍스트로 변환되어 커서 위치에 입력됩니다.' },
};

export function translate(key: string, locale: Locale): string {
  return D[key]?.[locale] ?? key;
}
