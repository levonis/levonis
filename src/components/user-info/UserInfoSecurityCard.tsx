import { Eye, EyeOff, Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function UserInfoSecurityCard({
  showPasswordForm,
  setShowPasswordForm,
  changingPassword,
  passwordData,
  setPasswordData,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onSubmit,
}: {
  showPasswordForm: boolean;
  setShowPasswordForm: (v: boolean) => void;
  changingPassword: boolean;
  passwordData: PasswordData;
  setPasswordData: (v: PasswordData) => void;
  showCurrentPassword: boolean;
  setShowCurrentPassword: (v: boolean) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          الأمان
        </h3>
      </div>

      <div className="p-5">
        {!showPasswordForm ? (
          <Button 
            variant="outline" 
            className="w-full h-11 rounded-xl gap-2 font-bold border-border/50 hover:border-primary/30 hover:bg-primary/5"
            onClick={() => setShowPasswordForm(true)}
          >
            <Lock className="h-4 w-4 text-primary" />
            تغيير كلمة المرور
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {[
              { id: "currentPassword", label: "كلمة المرور الحالية", value: passwordData.currentPassword, show: showCurrentPassword, setShow: setShowCurrentPassword, onChange: (v: string) => setPasswordData({ ...passwordData, currentPassword: v }) },
              { id: "newPassword", label: "كلمة المرور الجديدة", value: passwordData.newPassword, show: showNewPassword, setShow: setShowNewPassword, onChange: (v: string) => setPasswordData({ ...passwordData, newPassword: v }) },
              { id: "confirmPassword", label: "تأكيد كلمة المرور", value: passwordData.confirmPassword, show: showConfirmPassword, setShow: setShowConfirmPassword, onChange: (v: string) => setPasswordData({ ...passwordData, confirmPassword: v }) },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id} className="text-xs font-bold">{field.label}</Label>
                <div className="relative">
                  <Input
                    id={field.id}
                    type={field.show ? "text" : "password"}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={field.label}
                    required
                    minLength={field.id !== "currentPassword" ? 6 : undefined}
                    className="h-10 rounded-xl border-border/50 pl-10"
                  />
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => field.setShow(!field.show)}
                  >
                    {field.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1 h-10 rounded-xl font-bold" disabled={changingPassword}>
                {changingPassword && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ كلمة المرور
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                }}
                disabled={changingPassword}
              >
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
