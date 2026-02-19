import { User, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function UserInfoPageHeader() {
  const navigate = useNavigate();
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">معلومات الحساب</h1>
          <p className="text-xs text-muted-foreground">إدارة معلومات حسابك الشخصية</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </header>
  );
}
