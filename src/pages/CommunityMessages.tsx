import { useEffect, useState } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ListingConversations } from '@/components/marketplace/ListingConversations';

export default function CommunityMessages() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">محادثات المجتمع</h1>
              <p className="text-sm text-muted-foreground">نفس واجهة المحادثات الحالية داخل المجتمع</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/community')} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              رجوع
            </Button>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="mt-4 h-40 w-full bg-muted rounded-xl animate-pulse" />
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              سيتم فتح واجهة المحادثات الآن.
            </p>
          </section>
        )}

        {/* Reuse existing messaging UI as-is (opens as overlay dialog) */}
        <ListingConversations
          externalOpen={open}
          onExternalOpenChange={setOpen}
          onClose={() => navigate('/community')}
        >
          <span className="sr-only">فتح المحادثات</span>
        </ListingConversations>
      </main>
    </div>
  );
}
