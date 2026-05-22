import type { IRecognitionProvider, RecognitionResult } from './speech-recognition';

export interface FunASRCloudConfig {
  endpoint: string;        // e.g. http://localhost:10095
  apiKey?: string;         // optional auth token
  timeoutMs?: number;
}

export class FunASRCloudProvider implements IRecognitionProvider {
  readonly name = 'FunASR-Cloud';
  readonly type = 'api' as const;
  readonly vadEnabled = false;
  isReady = false;

  private endpoint: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: FunASRCloudConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.apiKey = config.apiKey || '';
    this.timeoutMs = config.timeoutMs || 15000;
  }

  async initialize(): Promise<boolean> {
    if (!this.endpoint) {
      console.log('[FunASR-Cloud] No endpoint configured');
      this.isReady = false;
      return false;
    }
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${this.endpoint}/api/status`, {
        method: 'GET',
        signal: ctrl.signal,
      });
      if (res.ok) {
        this.isReady = true;
        console.log('[FunASR-Cloud] Server reachable at', this.endpoint);
        return true;
      }
    } catch {
      console.log('[FunASR-Cloud] Server unreachable, will try on transcribe');
    }
    this.isReady = true;
    return true;
  }

  async transcribe(
    audioBuffer: Buffer,
    _sampleRate: number,
    lang?: string,
  ): Promise<RecognitionResult> {
    const t0 = performance.now();

    if (!this.endpoint) {
      return {
        text: '（云 ASR 未配置服务地址）',
        durationMs: 0,
        language: lang || 'zh',
      };
    }

    try {
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', blob, 'audio.wav');
      if (lang) formData.append('language', lang);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.endpoint}/api/recognize`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`ASR API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json: any = await res.json();
      const text: string = json?.text || json?.result?.text || json?.data?.text || '';

      console.log('[FunASR-Cloud] Result:', text.slice(0, 80));

      return {
        text: text || '（未识别到内容）',
        durationMs: performance.now() - t0,
        language: lang || 'zh',
        confidence: json?.confidence ?? json?.result?.confidence,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('[FunASR-Cloud] Timeout after', this.timeoutMs, 'ms');
        return {
          text: '（云 ASR 请求超时）',
          durationMs: performance.now() - t0,
          language: lang || 'zh',
        };
      }
      console.error('[FunASR-Cloud] Error:', err.message);
      return {
        text: '（云 ASR 服务异常）',
        durationMs: performance.now() - t0,
        language: lang || 'zh',
      };
    }
  }

  async dispose(): Promise<void> {
    this.isReady = false;
  }
}
