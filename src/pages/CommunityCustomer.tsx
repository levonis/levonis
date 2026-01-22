import { ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CommunityCustomerStrip from '@/components/community/CommunityCustomerStrip';
import CommunityExploreStrip from '@/components/community/CommunityExploreStrip';

export default function CommunityCustomer() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">لوحة الزبون</h1>
              <p className="text-sm text-muted-foreground">واجهة مبدئية قابلة للتطوير لاحقاً</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <CommunityCustomerStrip />

        <div className="my-6 h-px bg-border" />

        <CommunityExploreStrip />
      </main>
    </div>
  );
}

