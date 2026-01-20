/**
 * Why Auto Address Injection Not Possible - شرح قيود المتصفح
 * 
 * يوضح للمستخدم لماذا لا يمكن إدخال العنوان تلقائياً
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, Globe, Chrome } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function WhyAutoAddressNotPossible() {
  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Shield className="w-4 h-4" />
          لماذا لا يمكن إدخال العنوان تلقائياً؟
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="explanation" className="border-none">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <span className="text-xs text-blue-600 dark:text-blue-400">اضغط لمعرفة التفاصيل</span>
            </AccordionTrigger>
            <AccordionContent className="text-xs space-y-3 text-muted-foreground">
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <p className="font-medium text-foreground">سياسة Same-Origin</p>
                  <p>
                    المتصفحات تمنع أي موقع من الوصول لمحتوى موقع آخر (مثل Amazon/Newegg) 
                    لحماية بياناتك وخصوصيتك.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-foreground">X-Frame-Options</p>
                  <p>
                    المتاجر الكبرى ترفض العرض داخل مواقع أخرى (iframe) لمنع الاحتيال، 
                    لذا نفتحها في نافذة منفصلة.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Chrome className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                <div>
                  <p className="font-medium text-foreground">الحل المتاح</p>
                  <p>
                    افتح المتجر، انسخ عنوان المخزن الظاهر أعلاه، وألصقه في إعدادات التوصيل 
                    داخل المتجر. ستظهر الأسعار والشحن الصحيح حسب موقعنا.
                  </p>
                </div>
              </div>

              {/* Future: Chrome Extension suggestion */}
              <div className="p-2 bg-muted/50 rounded-lg mt-2">
                <p className="text-xs">
                  💡 <strong>مستقبلاً:</strong> قد نوفر إضافة للمتصفح (Extension) 
                  تملأ العنوان تلقائياً وترسل بيانات المنتج مباشرة.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
