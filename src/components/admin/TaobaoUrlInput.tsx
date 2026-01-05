import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Package, Sparkles, Check, AlertCircle, ExternalLink, Download } from 'lucide-react';
import { extractTaobaoUrl } from '@/lib/api/extractTaobaoUrl';
import { toast } from 'sonner';

interface TaobaoUrlInputProps {
  defaultValue?: string;
  onExtracted?: (url: string, itemId?: string, platform?: string) => void;
  onTriggerProductExtraction?: (url: string) => void;
}

export function TaobaoUrlInput({ defaultValue = '', onExtracted, onTriggerProductExtraction }: TaobaoUrlInputProps) {
  const [pastedText, setPastedText] = useState('');
  const [extractedUrl, setExtractedUrl] = useState(defaultValue);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [platform, setPlatform] = useState<string>('');
  const [itemId, setItemId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setExtractedUrl(defaultValue);
  }, [defaultValue]);

  const handlePaste = async (text: string) => {
    setPastedText(text);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Check if it looks like it needs extraction (contains Chinese/special characters or short URL)
    const needsExtraction = /[\u4e00-\u9fff]|【|】|「|」|e\.tb\.cn|m\.tb\.cn/.test(text) || 
                           text.includes(' ') || 
                           text.length > 150;

    if (!needsExtraction && text.startsWith('http')) {
      // It's a clean URL, use it directly
      setExtractedUrl(text);
      setExtractionStatus('success');
      onExtracted?.(text);
      return;
    }

    // Debounce extraction
    debounceRef.current = setTimeout(async () => {
      await extractUrl(text);
    }, 500);
  };

  const extractUrl = async (text: string) => {
    if (!text.trim()) return;

    setIsExtracting(true);
    setExtractionStatus('idle');

    try {
      const result = await extractTaobaoUrl(text);
      
      if (result.success && result.extracted_url) {
        setExtractedUrl(result.extracted_url);
        setPlatform(result.platform || '');
        setItemId(result.item_id || '');
        setExtractionStatus('success');
        onExtracted?.(result.extracted_url, result.item_id, result.platform);
        toast.success(`تم استخراج رابط ${getPlatformName(result.platform)} بنجاح`);
      } else {
        setExtractionStatus('error');
        toast.error(result.error || 'فشل استخراج الرابط');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionStatus('error');
      toast.error('حدث خطأ أثناء استخراج الرابط');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractProductInfo = () => {
    if (extractedUrl && onTriggerProductExtraction) {
      onTriggerProductExtraction(extractedUrl);
    }
  };

  const getPlatformName = (p?: string) => {
    switch (p) {
      case 'taobao': return 'تاوباو';
      case 'jd': return 'JD';
      case 'tmall': return 'تي مول';
      case '1688': return '1688';
      default: return 'المنتج';
    }
  };

  const getPlatformColor = (p: string) => {
    switch (p) {
      case 'taobao': return 'text-orange-600';
      case 'jd': return 'text-red-600';
      case 'tmall': return 'text-red-500';
      case '1688': return 'text-yellow-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
          <Package className="h-4 w-4" />
          <span>رابط Taobao / JD (للمزامنة التلقائية)</span>
          {platform && (
            <span className={`text-xs px-2 py-0.5 rounded-full bg-white/50 ${getPlatformColor(platform)}`}>
              {getPlatformName(platform)}
            </span>
          )}
        </div>
        {extractedUrl && onTriggerProductExtraction && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExtractProductInfo}
            className="gap-1 text-xs"
          >
            <Download className="h-3 w-3" />
            استخراج المعلومات
          </Button>
        )}
      </div>
      
      {/* Paste Area */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          الصق النص المنسوخ من التطبيق (سيتم استخراج الرابط تلقائياً بالذكاء الاصطناعي)
        </Label>
        <Textarea
          placeholder="مثال: 【淘宝】假一赔四 https://e.tb.cn/h.77BGXtZFQ2kzrfF?tk=G4D2UbFSfoL CZ356 「拓竹...」"
          value={pastedText}
          onChange={(e) => handlePaste(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            handlePaste(text);
          }}
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      {/* Extracted URL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="taobao_url" className="text-xs flex items-center gap-1">
            الرابط المستخرج (بالصيغة القياسية)
            {isExtracting && <Loader2 className="h-3 w-3 animate-spin" />}
            {extractionStatus === 'success' && <Check className="h-3 w-3 text-green-600" />}
            {extractionStatus === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
          </Label>
          {extractedUrl && (
            <a
              href={extractedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              فتح
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id="taobao_url"
            name="taobao_url"
            placeholder="https://item.taobao.com/item.htm?id=..."
            value={extractedUrl}
            onChange={(e) => {
              setExtractedUrl(e.target.value);
              onExtracted?.(e.target.value);
            }}
            className="flex-1 text-xs font-mono"
          />
          {pastedText && !extractedUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => extractUrl(pastedText)}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {itemId && (
          <p className="text-xs text-muted-foreground">
            معرف المنتج: <code className="bg-muted px-1 rounded font-mono">{itemId}</code>
            {platform && <span className="mr-2">• المنصة: {getPlatformName(platform)}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
