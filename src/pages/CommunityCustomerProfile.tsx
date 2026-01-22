import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, User } from "lucide-react";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";

export default function CommunityCustomerProfile() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">إكمال الملف الشخصي</h1>
              <p className="text-sm text-muted-foreground">مطلوب لتفعيل لوحة المجتمع</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/community/customer")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CommunityCustomerProfileModal onDone={() => navigate("/community/customer", { replace: true })} />
        </Card>
      </main>
    </div>
  );
}
