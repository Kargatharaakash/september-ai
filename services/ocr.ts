// Updated OCR service: uses fetchWithRetries, structured logging, and explicit config validation.

import { fetchWithRetries, TimeoutError, HTTPError } from '../utils/http';
import * as logger from '../utils/logger';
import { ExternalServiceError, ConfigurationError } from '../utils/errors';

export type OCRResult = {
  text: string;
  raw?: any;
};

const OCR_SPACE_API = 'https://api.ocr.space/parse/image';
const OCR_TIMEOUT_MS = 20_000;

function ensureEnvVar(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return val;
}

async function performOCRSpaceAPI(base64Image: string, options: { detectOrientation?: boolean; isTable?: boolean } = {}): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;
  if (!apiKey) {
    // Do NOT silently fall back to a demo key in production.
    throw new ConfigurationError('OCR API key is not configured (EXPO_PUBLIC_OCR_API_KEY).');
  }

  logger.debug('Calling OCR.space API (Engine 2)');

  const form = new FormData();
  form.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
  form.append('language', 'eng');
  form.append('OCREngine', '2');
  form.append('detectOrientation', options.detectOrientation ? 'true' : 'false');
  form.append('scale', 'true');
  form.append('isTable', options.isTable ? 'true' : 'false');

  try {
    const res = await fetchWithRetries(OCR_SPACE_API, {
      method: 'POST',
      body: form as any,
      headers: {
        apikey: apiKey,
      } as any,
    }, {
      timeoutMs: OCR_TIMEOUT_MS,
      retries: 3,
      retryDelayMs: 700,
      retryOn: (status: number) => status === 429 || status >= 500,
    });

    const json = await res.json();
    logger.debug('OCR.space API raw response', json);

    // Basic response validation
    if (!json || json.OCRExitCode === undefined) {
      throw new ExternalServiceError('ocr.space', 'Unexpected OCR API response shape', json);
    }

    if (json.OCRExitCode !== 1) {
      const msgs = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join('; ') : json.ErrorMessage || 'Unknown OCR failure';
      throw new ExternalServiceError('ocr.space', `OCR failed: ${msgs}`, json);
    }

    const parsed = json.ParsedResults && json.ParsedResults[0];
    const extractedText = parsed && parsed.ParsedText ? String(parsed.ParsedText).trim() : '';

    if (!extractedText) {
      throw new ExternalServiceError('ocr.space', 'No readable text found', json);
    }

    return extractedText;
  } catch (err) {
    if (err instanceof TimeoutError) {
      logger.error('OCR request timed out', err);
      throw new ExternalServiceError('ocr.space', 'OCR request timed out', err);
    } else if (err instanceof HTTPError) {
      logger.error('OCR HTTP error', err);
      throw new ExternalServiceError('ocr.space', 'OCR HTTP error', err);
    }
    logger.error('OCR error', err);
    throw err;
  }
}

// Example: wrap the flow to convert imageUri to base64, enhance image, etc.
// Keep image enhancement in a separate small function and catch errors there.
export async function extractTextFromImage(imageUri: string, options: { enhanceImage?: boolean; detectOrientation?: boolean; isTable?: boolean } = {}): Promise<OCRResult> {
  logger.info('Starting OCR for image', imageUri);
  if (!imageUri) throw new Error('imageUri is required');

  try {
    // Convert image to base64 - keep error handling local and specific
    const base64 = await imageToBase64(imageUri);
    const text = await performOCRSpaceAPI(base64, { detectOrientation: options.detectOrientation, isTable: options.isTable });
    return { text, raw: undefined };
  } catch (err) {
    logger.error('Failed to extract text', err);
    throw err;
  }
}

// Keep imageToBase64 smaller and explicit
import { readAsStringAsync } from 'expo-file-system';
async function imageToBase64(imageUri: string): Promise<string> {
  try {
    return await readAsStringAsync(imageUri, { encoding: 'base64' as any });
  } catch (err) {
    logger.error('imageToBase64 failed', err);
    throw new Error('Failed to process image file');
  }
}