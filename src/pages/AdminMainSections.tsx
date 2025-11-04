import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface AdminMainSectionsProps {
  mainSections: any[] | undefined;
  mainSectionDialogOpen: boolean;
  setMainSectionDialogOpen: (open: boolean) => void;
  editingMainSection: any;
  setEditingMainSection: (section: any) => void;
  handleMainSectionSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  createMainSection: any;
  updateMainSection: any;
  deleteMainSection: any;
}

const AdminMainSections = ({
  mainSections,
  mainSectionDialogOpen,
  setMainSectionDialogOpen,
  editingMainSection,
  setEditingMainSection,
  handleMainSectionSubmit,
  createMainSection,
  updateMainSection,
  deleteMainSection,
}: AdminMainSectionsProps) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">إدارة الأقسام الرئيسية</h2>
        
        <Dialog open={mainSectionDialogOpen} onOpenChange={(open) => {
          setMainSectionDialogOpen(open);
          if (!open) setEditingMainSection(null);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
              <Plus className="ml-2 h-4 w-4" />
              إضافة قسم رئيسي جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingMainSection ? 'تعديل القسم الرئيسي' : 'إضافة قسم رئيسي جديد'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleMainSectionSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name_ar">الاسم بالعربي *</Label>
                <Input 
                  id="name_ar" 
                  name="name_ar" 
                  defaultValue={editingMainSection?.name_ar}
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">الاسم بالإنجليزي *</Label>
                <Input 
                  id="name" 
                  name="name"
                  defaultValue={editingMainSection?.name}
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_order">ترتيب العرض *</Label>
                <Input 
                  id="display_order" 
                  name="display_order"
                  type="number"
                  min="0"
                  defaultValue={editingMainSection?.display_order || 0}
                  required 
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                disabled={createMainSection.isPending || updateMainSection.isPending}
              >
                {(createMainSection.isPending || updateMainSection.isPending) && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                {editingMainSection ? 'تحديث' : 'إضافة'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم بالعربي</TableHead>
              <TableHead>الاسم بالإنجليزي</TableHead>
              <TableHead>ترتيب العرض</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mainSections?.map((section) => (
              <TableRow key={section.id}>
                <TableCell className="font-medium">{section.name_ar}</TableCell>
                <TableCell>{section.name}</TableCell>
                <TableCell>{section.display_order}</TableCell>
                <TableCell className="text-left">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingMainSection(section);
                        setMainSectionDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('هل أنت متأكد من حذف هذا القسم الرئيسي؟')) {
                          deleteMainSection.mutate(section.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminMainSections;