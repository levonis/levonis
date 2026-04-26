import { supabase } from '@/integrations/supabase/client';

const GENERIC_EDGE_FUNCTION_ERROR = 'Edge Function returned a non-2xx status code';

type FunctionErrorLike = {
  message?: string;
  context?: {
    clone?: () => { json?: () => Promise<any>; text?: () => Promise<string> };
    json?: () => Promise<any>;
    text?: () => Promise<string>;
  };
};

async function readFunctionErrorBody(error: FunctionErrorLike): Promise<string | null> {
  const response = typeof error.context?.clone === 'function' ? error.context.clone() : error.context;
  if (!response) return null;

  if (typeof response.json === 'function') {
    try {
      const body = await response.json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    } catch {
      // Fall through to text parsing.
    }
  }

  if (typeof response.text === 'function') {
    try {
      const text = await response.text();
      if (!text?.trim()) return null;
      try {
        const body = JSON.parse(text);
        if (typeof body?.error === 'string' && body.error.trim()) return body.error;
        if (typeof body?.message === 'string' && body.message.trim()) return body.message;
      } catch {
        return text.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function getFriendlyFunctionErrorMessage(error: unknown, fallback = 'حدث خطأ في الاتصال بالخدمة، حاول مرة أخرى'): Promise<string> {
  if (!error || typeof error !== 'object') return fallback;

  const functionError = error as FunctionErrorLike;
  const bodyMessage = await readFunctionErrorBody(functionError);
  if (bodyMessage) return bodyMessage;

  if (functionError.message && !functionError.message.includes(GENERIC_EDGE_FUNCTION_ERROR)) {
    return functionError.message;
  }

  return fallback;
}

export function installFriendlyFunctionErrorMessages() {
  if (typeof window === 'undefined') return;

  const marker = '__levo_friendly_function_errors_installed__';
  if ((window as any)[marker]) return;
  (window as any)[marker] = true;

  const functionsClient = supabase.functions as any;
  const originalInvoke = functionsClient.invoke?.bind(functionsClient);
  if (!originalInvoke) return;

  functionsClient.invoke = async (...args: any[]) => {
    const result = await originalInvoke(...args);
    if (result?.error?.message?.includes(GENERIC_EDGE_FUNCTION_ERROR)) {
      const friendlyMessage = await getFriendlyFunctionErrorMessage(result.error);
      result.error = Object.assign(Object.create(Object.getPrototypeOf(result.error)), result.error, {
        message: friendlyMessage,
      });
    }
    return result;
  };
}