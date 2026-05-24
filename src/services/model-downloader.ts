// Main-process model downloader — downloads SenseVoiceSmall ONNX model on first launch

import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// SenseVoiceSmall INT8 ONNX model (zh/en/ja/ko/yue)
const MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface DownloadProgress {
  stage: 'downloading' | 'extracting' | 'done' | 'error';
  percent: number;
  error?: string;
}

function fail(reject: (e: Error) => void, onProgress: (p: DownloadProgress) => void, msg: string): void {
  const err = new Error(msg);
  onProgress({ stage: 'error', percent: 0, error: msg });
  reject(err);
}

function request(
  url: string,
  onProgress: (p: DownloadProgress) => void,
  resolve: (f: string) => void,
  reject: (e: Error) => void,
  destDir: string,
  tmpFile: string,
  modelFile: string,
  retriesLeft: number,
): void {
  https.get(url, (res) => {
    // Follow redirect
    if (res.statusCode === 301 || res.statusCode === 302) {
      const location = res.headers.location;
      if (!location) {
        fail(reject, onProgress, 'Redirect without Location header');
        return;
      }
      request(location, onProgress, resolve, reject, destDir, tmpFile, modelFile, retriesLeft);
      return;
    }

    // Reject non-2xx responses
    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
      const msg = `Model download failed: HTTP ${res.statusCode}`;
      if (retriesLeft > 0) {
        console.log(`[ModelDL] ${msg}, retrying... (${retriesLeft} left)`);
        setTimeout(() => {
          request(url, onProgress, resolve, reject, destDir, tmpFile, modelFile, retriesLeft - 1);
        }, RETRY_DELAY_MS);
      } else {
        fail(reject, onProgress, msg);
      }
      return;
    }

    pipeDownload(res, tmpFile, onProgress, () => {
      try {
        onProgress({ stage: 'extracting', percent: 100 });
        extractTarBz2(tmpFile, destDir);
        fs.unlinkSync(tmpFile);
      } catch (err: any) {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
        if (retriesLeft > 0) {
          console.log(`[ModelDL] Extraction failed: ${err.message}, retrying... (${retriesLeft} left)`);
          setTimeout(() => {
            request(MODEL_URL, onProgress, resolve, reject, destDir, tmpFile, modelFile, retriesLeft - 1);
          }, RETRY_DELAY_MS);
          return;
        }
        fail(reject, onProgress, `Extraction failed: ${err.message}`);
        return;
      }

      // Verify model file exists
      if (!fs.existsSync(modelFile)) {
        fail(reject, onProgress, 'Model file not found after extraction');
        return;
      }

      onProgress({ stage: 'done', percent: 100 });
      resolve(modelFile);
    }, (err) => {
      // Download stream error
      if (retriesLeft > 0) {
        console.log(`[ModelDL] Download error: ${err.message}, retrying... (${retriesLeft} left)`);
        setTimeout(() => {
          request(MODEL_URL, onProgress, resolve, reject, destDir, tmpFile, modelFile, retriesLeft - 1);
        }, RETRY_DELAY_MS);
      } else {
        fail(reject, onProgress, err.message);
      }
    });
  }).on('error', (err) => {
    if (retriesLeft > 0) {
      console.log(`[ModelDL] Request error: ${err.message}, retrying... (${retriesLeft} left)`);
      setTimeout(() => {
        request(MODEL_URL, onProgress, resolve, reject, destDir, tmpFile, modelFile, retriesLeft - 1);
      }, RETRY_DELAY_MS);
    } else {
      fail(reject, onProgress, err.message);
    }
  });
}

function extractTarBz2(tarPath: string, destDir: string): void {
  try {
    execSync(`tar -xjf "${tarPath}" -C "${destDir}"`, {
      stdio: 'pipe',
      timeout: 180000, // 3 min timeout for extraction
    });
  } catch (e: any) {
    const msg = e.stderr?.toString() || e.message || 'tar extraction failed';
    throw new Error(`tar extraction failed: ${msg}. Ensure tar is available in PATH.`);
  }
}

export function ensureModel(
  modelDir: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const funasrDir = path.join(modelDir, 'funasr');
    const asrModel = path.join(funasrDir, 'model.int8.onnx');
    const tokensFile = path.join(funasrDir, 'tokens.txt');

    // Model already present — skip download
    if (fs.existsSync(asrModel) && fs.existsSync(tokensFile)) {
      onProgress({ stage: 'done', percent: 100 });
      resolve(asrModel);
      return;
    }

    fs.mkdirSync(funasrDir, { recursive: true });
    const tmpFile = path.join(modelDir, 'sensevoice-models.tar.bz2');

    onProgress({ stage: 'downloading', percent: 0 });
    request(MODEL_URL, onProgress, resolve, reject, funasrDir, tmpFile, asrModel, MAX_RETRIES);
  });
}

function pipeDownload(
  res: any,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): void {
  const total = parseInt(res.headers['content-length'] || '0', 10);
  let received = 0;
  const file = fs.createWriteStream(dest);

  res.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (total > 0) {
      onProgress({ stage: 'downloading', percent: Math.round((received / total) * 100) });
    }
  });

  file.on('finish', () => {
    file.close();
    onDone();
  });

  file.on('error', onError);
  res.pipe(file);
  res.on('error', onError);
}
