import { User } from "lucide-react";

export default function UserInfoPageHeader() {
  return (
    <header className="mb-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground">معلومات الحساب</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة معلومات حسابك الشخصية</p>
        </div>
      </div>
    </header>
  );
}
