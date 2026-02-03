import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Gift, Package, X, Ticket, Loader2, ShoppingBag, Sparkles } from "lucide-react";

// Lazy load panels
const AllOffersPanel = lazy(() => import("@/components/rewards/panels/AllOffersPanel"));
const AllStoragePanel = lazy(() => import("@/components/rewards/panels/AllStoragePanel"));

type TabId = 'offers' | 'storage';

export default function OffersStorageSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSheet, setActiveSheet] = useState<TabId | null>(null);

  const tabs = [
    { 
      id: 'offers' as const, 
      label: 'عروض مضاعفة مع هدايا مضمنة', 
      icon: Gift, 
      color: 'from-rose-500 to-pink-600',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      iconColor: 'text-rose-500',
      description: 'منتجات مع تذاكر مجانية للمسابقات'
    },
    { 
      id: 'storage' as const, 
      label: 'مخزني', 
      icon: Package, 
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-500',
      description: 'جوائزك ومشترياتك في انتظار الشحن'
    },
  ];

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'offers':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              اشترِ منتجات واحصل على تذاكر مجانية للمسابقات
            </p>
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <AllOffersPanel />
            </Suspense>
          </div>
        );
      case 'storage':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              منتجاتك المخزنة في انتظار طلب الشحن
            </p>
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <AllStoragePanel />
            </Suspense>
          </div>
        );
      default:
        return null;
    }
  };

  const getSheetTitle = () => {
    const tab = tabs.find(t => t.id === activeSheet);
    return tab?.label || '';
  };

  return (
    <>
      <section className="container mx-auto px-4 py-6 md:py-10">
        {/* Section Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-foreground">عروض حصرية ومخزني</h2>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            منتجات مع تذاكر مجانية • تتبع جوائزك ومشترياتك
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 max-w-2xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            
            return (
              <Card 
                key={tab.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-300 ${tab.bgColor} ${tab.borderColor} border-2 overflow-hidden group`}
                onClick={() => setActiveSheet(tab.id)}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${tab.color} shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm md:text-base mb-1">{tab.label}</h3>
                      <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Ticket Earning Methods Info */}
        <div className="mt-6 max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="h-5 w-5 text-purple-500" />
                <h4 className="font-bold text-sm">طرق الحصول على التذاكر</h4>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>تحويل النقاط إلى تذاكر من مركز المكافآت</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>تذاكر مجانية شهرياً لحاملي بطاقات العضوية</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>تذاكر مضمنة مع المنتجات (يحددها الأدمن لكل منتج)</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                onClick={() => navigate('/rewards')}
              >
                انتقل لمركز المكافآت
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sheet for content */}
      <Sheet open={!!activeSheet} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0 pb-0">
          <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">{getSheetTitle()}</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          <div className="overflow-y-auto h-full px-4 py-4 pb-24">
            {renderSheetContent()}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
