import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  ArrowRight, 
  Store, 
  MoreVertical,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  FileWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import AvatarWithFrame from '@/components/merchant/AvatarWithFrame';

interface AdminChatTopBarProps {
  userName: string;
  usersId: string;
  userImage?: string | null;
  userFrameUrl?: string | null;
  status?: 'open' | 'disputed' | 'resolved';
  isSuspended?: boolean;
  onBack: () => void;
  // Admin actions
  onBanUser?: (reason: string) => void;
  onUnbanUser?: () => void;
  onTempRestrict?: (hours: number, reason: string) => void;
  onResolveDispute?: (resolution: string) => void;
  onCloseDispute?: () => void;
  onWarnUser?: (reason: string) => void;
  onViewProfile?: () => void;
  onViewComplaints?: () => void;
}

export default function AdminChatTopBar({
  userName,
  usersId,
  userImage,
  userFrameUrl,
  status = 'open',
  isSuspended = false,
  onBack,
  onBanUser,
  onUnbanUser,
  onTempRestrict,
  onResolveDispute,
  onCloseDispute,
  onWarnUser,
  onViewProfile,
  onViewComplaints,
}: AdminChatTopBarProps) {
  const navigate = useNavigate();
  
  // Dialog states
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [restrictDialogOpen, setRestrictDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [warnDialogOpen, setWarnDialogOpen] = useState(false);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  
  // Form states
  const [banReason, setBanReason] = useState('');
  const [restrictHours, setRestrictHours] = useState(24);
  const [restrictReason, setRestrictReason] = useState('');
  const [resolution, setResolution] = useState('');
  const [warnReason, setWarnReason] = useState('');

  const goToProfile = () => {
    navigate(`/profile/${usersId}`);
    onViewProfile?.();
  };

  const handleBan = () => {
    if (banReason.trim()) {
      onBanUser?.(banReason);
      setBanDialogOpen(false);
      setBanReason('');
    }
  };

  const handleUnban = () => {
    onUnbanUser?.();
    setUnbanDialogOpen(false);
  };

  const handleRestrict = () => {
    if (restrictReason.trim()) {
      onTempRestrict?.(restrictHours, restrictReason);
      setRestrictDialogOpen(false);
      setRestrictReason('');
      setRestrictHours(24);
    }
  };

  const handleResolve = () => {
    if (resolution.trim()) {
      onResolveDispute?.(resolution);
      setResolveDialogOpen(false);
      setResolution('');
    }
  };

  const handleWarn = () => {
    if (warnReason.trim()) {
      onWarnUser?.(warnReason);
      setWarnDialogOpen(false);
      setWarnReason('');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-2.5 border-b bg-card shadow-sm">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
          onClick={onBack}
        >
          <ArrowRight className="h-5 w-5" />
        </Button>

        {/* User Avatar - Clickable */}
        <button onClick={goToProfile} className="shrink-0 hover:opacity-80 transition-opacity">
          <AvatarWithFrame
            imageUrl={userImage}
            frameUrl={userFrameUrl}
            size="xs"
          />
        </button>

        {/* User Name - Center */}
        <button 
          onClick={goToProfile}
          className="flex-1 min-w-0 text-right hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm truncate">{userName}</h1>
            {isSuspended && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                محظور
              </Badge>
            )}
            {status === 'disputed' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-500">
                نزاع
              </Badge>
            )}
            {status === 'resolved' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-500">
                محلول
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">عرض الملف الشخصي</p>
        </button>

        {/* Profile Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
          onClick={goToProfile}
        >
          <User className="h-5 w-5 text-primary" />
        </Button>

        {/* Admin Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* View Actions */}
            <DropdownMenuItem onClick={goToProfile} className="gap-2">
              <User className="h-4 w-4" />
              عرض الملف الشخصي
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewComplaints} className="gap-2">
              <FileWarning className="h-4 w-4" />
              عرض الشكاوى
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {/* Dispute Actions - Show only if status is disputed */}
            {status === 'disputed' && (
              <>
                <DropdownMenuItem 
                  onClick={() => setResolveDialogOpen(true)} 
                  className="gap-2 text-green-600"
                >
                  <CheckCircle className="h-4 w-4" />
                  حل النزاع
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onCloseDispute} 
                  className="gap-2 text-muted-foreground"
                >
                  <XCircle className="h-4 w-4" />
                  إغلاق النزاع
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            {/* Warning Action */}
            <DropdownMenuItem 
              onClick={() => setWarnDialogOpen(true)} 
              className="gap-2 text-amber-500"
            >
              <AlertTriangle className="h-4 w-4" />
              إرسال تحذير
            </DropdownMenuItem>
            
            {/* Restriction Actions */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 text-orange-500">
                <Clock className="h-4 w-4" />
                تقييد مؤقت
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => { setRestrictHours(6); setRestrictDialogOpen(true); }}>
                  6 ساعات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRestrictHours(12); setRestrictDialogOpen(true); }}>
                  12 ساعة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRestrictHours(24); setRestrictDialogOpen(true); }}>
                  24 ساعة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRestrictHours(72); setRestrictDialogOpen(true); }}>
                  3 أيام
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRestrictHours(168); setRestrictDialogOpen(true); }}>
                  أسبوع
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSeparator />
            
            {/* Ban/Unban Actions */}
            {isSuspended ? (
              <DropdownMenuItem 
                onClick={() => setUnbanDialogOpen(true)} 
                className="gap-2 text-green-600"
              >
                <Unlock className="h-4 w-4" />
                رفع الحظر
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                onClick={() => setBanDialogOpen(true)} 
                className="gap-2 text-destructive"
              >
                <Ban className="h-4 w-4" />
                حظر المستخدم
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ban Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              حظر المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حظر {userName} من استخدام المنصة. هذا الإجراء يمكن التراجع عنه لاحقاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>سبب الحظر *</Label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="اكتب سبب الحظر هنا..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBan}
              disabled={!banReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تأكيد الحظر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unban Dialog */}
      <AlertDialog open={unbanDialogOpen} onOpenChange={setUnbanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-green-600" />
              رفع الحظر
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رفع الحظر عن {userName}؟ سيتمكن من استخدام المنصة مرة أخرى.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban} className="bg-green-600 hover:bg-green-700">
              تأكيد رفع الحظر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temporary Restriction Dialog */}
      <AlertDialog open={restrictDialogOpen} onOpenChange={setRestrictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              تقييد مؤقت - {restrictHours} ساعة
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تقييد {userName} لمدة {restrictHours} ساعة من إرسال الرسائل.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>سبب التقييد *</Label>
            <Textarea
              value={restrictReason}
              onChange={(e) => setRestrictReason(e.target.value)}
              placeholder="اكتب سبب التقييد هنا..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestrict}
              disabled={!restrictReason.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              تأكيد التقييد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve Dispute Dialog */}
      <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              حل النزاع
            </AlertDialogTitle>
            <AlertDialogDescription>
              اكتب ملخص الحل الذي تم التوصل إليه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>ملخص الحل *</Label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="اكتب ملخص الحل هنا..."
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResolve}
              disabled={!resolution.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              تأكيد الحل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Dialog */}
      <AlertDialog open={warnDialogOpen} onOpenChange={setWarnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              إرسال تحذير
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إرسال تحذير رسمي إلى {userName} وتسجيله في ملفه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>نص التحذير *</Label>
            <Textarea
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              placeholder="اكتب نص التحذير هنا..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleWarn}
              disabled={!warnReason.trim()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              إرسال التحذير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
