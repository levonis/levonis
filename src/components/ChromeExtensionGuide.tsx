import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Chrome, Download, Settings, FolderOpen, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ChromeExtensionGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChromeExtensionGuide({ open, onOpenChange }: ChromeExtensionGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const extensionsUrl = 'chrome://extensions';

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(extensionsUrl);
    setCopied(true);
    toast.success('تم نسخ الرابط!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExtensions = () => {
    // Try to open extensions page (won't work due to chrome:// protocol restrictions)
    // But we'll copy the URL and show instructions
    handleCopyUrl();
    toast.info('الصق الرابط في شريط العنوان بالمتصفح');
  };

  const handleDownload = () => {
    // Create a link to download the extension folder info
    toast.success('جاري تجهيز ملفات الإضافة...', { duration: 2000 });
    
    // In a real scenario, this would download from a hosted location
    // For now, show the next step
    setTimeout(() => {
      setCurrentStep(1);
    }, 1000);
  };

  const steps = [
    {
      icon: Download,
      title: 'تحميل الإضافة',
      description: 'اضغط على الزر أدناه لتحميل ملفات الإضافة',
      action: (
        <Button onClick={handleDownload} className="w-full gap-2" size="lg">
          <Download className="w-5 h-5" />
          تحميل Levonis Extension
        </Button>
      )
    },
    {
      icon: Settings,
      title: 'فتح إعدادات Chrome',
      description: 'انسخ الرابط والصقه في شريط العنوان',
      action: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm" dir="ltr">
            <span className="flex-1">{extensionsUrl}</span>
            <Button variant="ghost" size="icon" onClick={handleCopyUrl}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button onClick={() => setCurrentStep(2)} className="w-full gap-2">
            التالي
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    {
      icon: Settings,
      title: 'تفعيل Developer Mode',
      description: 'فعّل وضع المطور من الزاوية العليا اليمنى',
      action: (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm">Developer mode</span>
              <div className="w-12 h-6 bg-primary rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
          <Button onClick={() => setCurrentStep(3)} className="w-full">التالي</Button>
        </div>
      )
    },
    {
      icon: FolderOpen,
      title: 'تحميل الإضافة',
      description: 'اضغط "Load unpacked" واختر مجلد chrome-extension',
      action: (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <FolderOpen className="w-3 h-3" />
              Load unpacked
            </Badge>
            <Badge variant="secondary">chrome-extension</Badge>
          </div>
          <Button onClick={() => setCurrentStep(4)} className="w-full">التالي</Button>
        </div>
      )
    },
    {
      icon: CheckCircle2,
      title: 'تم التثبيت! 🎉',
      description: 'الآن يمكنك إرسال المنتجات من Amazon/Newegg بضغطة واحدة',
      action: (
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-green-700 dark:text-green-400">
              افتح أي منتج على Amazon أو Newegg وستجد زر "إرسال إلى Levonis"
            </p>
          </div>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            إغلاق
          </Button>
        </div>
      )
    }
  ];

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Chrome className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle>تثبيت إضافة Chrome</DialogTitle>
              <DialogDescription>Levonis Store Helper</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-1 rounded-full transition-colors ${
                index <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Current Step */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              currentStep === steps.length - 1 ? 'bg-green-500/20' : 'bg-primary/10'
            }`}>
              <CurrentIcon className={`w-5 h-5 ${
                currentStep === steps.length - 1 ? 'text-green-500' : 'text-primary'
              }`} />
            </div>
            <div>
              <p className="font-semibold">{steps[currentStep].title}</p>
              <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
            </div>
          </div>

          {steps[currentStep].action}
        </div>

        {/* Back button */}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="mt-2"
          >
            رجوع
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
