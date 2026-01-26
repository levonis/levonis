/**
 * Content Filter System
 * Filters harmful, unethical, or inappropriate content in Arabic and English
 */

// Arabic profanity and inappropriate words (common examples)
const ARABIC_BANNED_WORDS = [
  // Common insults and profanity
  'حمار', 'غبي', 'احمق', 'تافه', 'حقير', 'وسخ', 'قذر', 'كلب', 'خنزير',
  'عاهرة', 'شرموطة', 'قحبة', 'ابن الكلب', 'ابن الحرام', 'لعنة',
  'زبي', 'كس', 'طيز', 'منيوك', 'معرص', 'ديوث', 'شاذ',
  'نيك', 'انيك', 'اغتصاب', 'متناك', 'منتاك',
  // Hate speech
  'ارهاب', 'ارهابي', 'داعش', 'قتل', 'اقتل', 'موت',
  // Spam indicators
  'سكس', 'بورن', 'xxx', 'porn',
];

// English profanity and inappropriate words
const ENGLISH_BANNED_WORDS = [
  // Common profanity
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'cock', 'pussy', 'cunt',
  'bastard', 'whore', 'slut', 'nigger', 'faggot', 'retard',
  // Variations
  'f*ck', 'sh*t', 'b*tch', 'a$$', 'd1ck', 'fuk', 'fuq',
  // Hate speech
  'nazi', 'kill', 'murder', 'terrorist', 'rape',
  // Spam
  'porn', 'xxx', 'sex', 'nude',
];

// Patterns for bypassing filters (leetspeak, spacing, etc.)
const BYPASS_PATTERNS = [
  /[f]+[\s_\-\.]*[u]+[\s_\-\.]*[c]+[\s_\-\.]*[k]+/gi,
  /[s]+[\s_\-\.]*[h]+[\s_\-\.]*[i]+[\s_\-\.]*[t]+/gi,
  /[b]+[\s_\-\.]*[i]+[\s_\-\.]*[t]+[\s_\-\.]*[c]+[\s_\-\.]*[h]+/gi,
];

// Normalize Arabic text (remove diacritics and normalize letters)
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F]/g, '') // Remove Arabic diacritics
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// Normalize English text
function normalizeEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[8]/g, 'b')
    .replace(/[\s_\-\.]+/g, '');
}

export interface ContentFilterResult {
  isClean: boolean;
  flaggedWords: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  message?: string;
}

/**
 * Check if text contains inappropriate content
 */
export function filterContent(text: string): ContentFilterResult {
  if (!text || typeof text !== 'string') {
    return { isClean: true, flaggedWords: [], severity: 'none' };
  }

  const flaggedWords: string[] = [];
  const normalizedArabic = normalizeArabic(text);
  const normalizedEnglish = normalizeEnglish(text);
  const lowerText = text.toLowerCase();

  // Check Arabic words
  for (const word of ARABIC_BANNED_WORDS) {
    const normalizedWord = normalizeArabic(word);
    if (normalizedArabic.includes(normalizedWord)) {
      flaggedWords.push(word);
    }
  }

  // Check English words
  for (const word of ENGLISH_BANNED_WORDS) {
    const normalizedWord = normalizeEnglish(word);
    if (normalizedEnglish.includes(normalizedWord) || lowerText.includes(word)) {
      flaggedWords.push(word);
    }
  }

  // Check bypass patterns
  for (const pattern of BYPASS_PATTERNS) {
    if (pattern.test(text)) {
      flaggedWords.push('bypass_pattern');
    }
  }

  // Determine severity
  let severity: ContentFilterResult['severity'] = 'none';
  if (flaggedWords.length > 0) {
    if (flaggedWords.length >= 3) {
      severity = 'high';
    } else if (flaggedWords.length >= 2) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  }

  return {
    isClean: flaggedWords.length === 0,
    flaggedWords: [...new Set(flaggedWords)],
    severity,
    message: flaggedWords.length > 0 
      ? 'يحتوي النص على كلمات غير مناسبة' 
      : undefined
  };
}

/**
 * Validate username for inappropriate content
 */
export function validateUsername(username: string): ContentFilterResult {
  const result = filterContent(username);
  
  // Additional username-specific checks
  const suspiciousPatterns = [
    /admin/i,
    /support/i,
    /official/i,
    /moderator/i,
    /لايفونس/i,
    /ليفو/i,
    /الادارة/i,
    /المشرف/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(username)) {
      result.flaggedWords.push('impersonation');
      result.isClean = false;
      result.severity = 'medium';
      result.message = 'اسم المستخدم غير مسموح به';
    }
  }

  return result;
}

/**
 * Validate store/display name
 */
export function validateDisplayName(name: string): ContentFilterResult {
  return filterContent(name);
}

/**
 * Validate bio/description content
 */
export function validateBio(bio: string): ContentFilterResult {
  const result = filterContent(bio);
  
  // Check for suspicious URLs
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urls = bio.match(urlPattern) || [];
  
  // Flag suspicious domains
  const suspiciousDomains = ['bit.ly', 'tinyurl', 'goo.gl', 't.co'];
  for (const url of urls) {
    for (const domain of suspiciousDomains) {
      if (url.toLowerCase().includes(domain)) {
        result.flaggedWords.push('suspicious_url');
        result.isClean = false;
        result.severity = 'medium';
        result.message = 'يحتوي النص على روابط مشبوهة';
      }
    }
  }

  return result;
}

/**
 * Censor inappropriate words in text
 */
export function censorContent(text: string): string {
  let censored = text;
  
  for (const word of [...ARABIC_BANNED_WORDS, ...ENGLISH_BANNED_WORDS]) {
    const regex = new RegExp(word, 'gi');
    censored = censored.replace(regex, '*'.repeat(word.length));
  }
  
  return censored;
}

/**
 * Check if an image URL is from a trusted domain
 */
export function validateImageUrl(url: string): boolean {
  if (!url) return true;
  
  const trustedDomains = [
    'supabase.co',
    'supabase.in',
    'lovable.app',
    'googleapis.com',
    'cloudinary.com',
  ];
  
  try {
    const urlObj = new URL(url);
    return trustedDomains.some(domain => urlObj.hostname.endsWith(domain));
  } catch {
    return false;
  }
}
