
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Save, Pencil, X, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import AdminLayout, { AdminSection, AdminLoading } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DraftColumn { id: string; name: string; type?: 'text' | 'date'; }
interface DraftRow { id: string; [key: string]: string; }
interface Draft {
  id: string;
  title: string;
  columns: DraftColumn[];
  rows: DraftRow[];
  created_at: string;
  updated_at: string;
}

let colCounter = 0;
const newColId = () => `col_${++colCounter}_${Date.now()}`;
const newRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function AdminFinancialDrafts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellValue, setCellValue] = useState('');

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['financial-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_drafts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        columns: (d.columns || []) as DraftColumn[],
        rows: (d.rows || []) as DraftRow[],
      })) as Draft[];
    },
  });

  const createDraft = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from('financial_drafts')
        .insert({ title, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return { ...data, columns: [] as DraftColumn[], rows: [] as DraftRow[] } as Draft;
    },
    onSuccess: (draft) => {
      queryClient.invalidateQueries({ queryKey: ['financial-drafts'] });
      setActiveDraft(draft);
      setNewTitle('');
      toast.success('تم إنشاء المسودة');
    },
    onError: () => toast.error('فشل إنشاء المسودة'),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_drafts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-drafts'] });
      toast.success('تم حذف المسودة');
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (draft: Draft) => {
      const { error } = await supabase
        .from('financial_drafts')
        .update({
          title: draft.title,
          columns: draft.columns as any,
          rows: draft.rows as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-drafts'] });
      toast.success('تم الحفظ');
    },
  });

  const updateDraft = useCallback((updater: (d: Draft) => Draft) => {
    setActiveDraft(prev => prev ? updater(prev) : prev);
  }, []);

  const addColumn = () => {
    const name = `عمود ${(activeDraft?.columns.length || 0) + 1}`;
    updateDraft(d => ({ ...d, columns: [...d.columns, { id: newColId(), name }] }));
  };

  const renameColumn = (colId: string, name: string) => {
    updateDraft(d => ({
      ...d,
      columns: d.columns.map(c => c.id === colId ? { ...c, name } : c),
    }));
    setEditingColId(null);
  };

  const deleteColumn = (colId: string) => {
    updateDraft(d => ({
      ...d,
      columns: d.columns.filter(c => c.id !== colId),
      rows: d.rows.map(r => { const nr = { ...r }; delete nr[colId]; return nr; }),
    }));
  };

  const addRow = () => {
    updateDraft(d => ({ ...d, rows: [...d.rows, { id: newRowId() }] }));
  };

  const deleteRow = (rowId: string) => {
    updateDraft(d => ({ ...d, rows: d.rows.filter(r => r.id !== rowId) }));
  };

  const setCellVal = (rowId: string, colId: string, value: string) => {
    updateDraft(d => ({
      ...d,
      rows: d.rows.map(r => r.id === rowId ? { ...r, [colId]: value } : r),
    }));
  };

  if (isLoading) return <AdminLoading />;

  // Draft editor view
  if (activeDraft) {
    return (
      <AdminLayout title={activeDraft.title}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setActiveDraft(null)}>
            <ArrowRight className="h-4 w-4 ml-1" /> العودة للمسودات
          </Button>
          <Button size="sm" onClick={() => saveDraft.mutate(activeDraft)} disabled={saveDraft.isPending}>
            <Save className="h-4 w-4 ml-1" /> حفظ
          </Button>
          <Button size="sm" variant="secondary" onClick={addColumn}>
            <Plus className="h-4 w-4 ml-1" /> إضافة عمود
          </Button>
          <Button size="sm" variant="secondary" onClick={addRow}>
            <Plus className="h-4 w-4 ml-1" /> إضافة صف
          </Button>
        </div>

        <div className="overflow-auto border rounded-lg bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-center w-10 text-muted-foreground">#</th>
                {activeDraft.columns.map(col => (
                  <th key={col.id} className="p-2 min-w-[140px]">
                    {editingColId === col.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingColName}
                          onChange={e => setEditingColName(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id, editingColName); if (e.key === 'Escape') setEditingColId(null); }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => renameColumn(col.id, editingColName)}>
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="cursor-pointer hover:text-primary font-medium"
                          onDoubleClick={() => { setEditingColId(col.id); setEditingColName(col.name); }}
                        >
                          {col.name}
                        </span>
                        <div className="flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteColumn(col.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </th>
                ))}
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {activeDraft.rows.length === 0 ? (
                <tr>
                  <td colSpan={activeDraft.columns.length + 2} className="p-8 text-center text-muted-foreground">
                    لا توجد صفوف - اضغط "إضافة صف" للبدء
                  </td>
                </tr>
              ) : (
                activeDraft.rows.map((row, idx) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 text-center text-muted-foreground text-xs">{idx + 1}</td>
                    {activeDraft.columns.map(col => (
                      <td key={col.id} className="p-1">
                        {editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                          <Input
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            className="h-7 text-xs border-primary"
                            autoFocus
                            onBlur={() => { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                          />
                        ) : (
                          <div
                            className="px-2 py-1 min-h-[28px] cursor-text rounded hover:bg-muted/50 text-xs"
                            onClick={() => { setEditingCell({ rowId: row.id, colId: col.id }); setCellValue(row[col.id] || ''); }}
                          >
                            {row[col.id] || <span className="text-muted-foreground/40">—</span>}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteRow(row.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminLayout>
    );
  }

  // Drafts list view
  return (
    <AdminLayout title="المسودات المالية" backTo={ADMIN_ROUTES.financials}>
      <div className="flex items-center gap-2 mb-6">
        <Input
          placeholder="اسم المسودة الجديدة..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="max-w-xs"
          onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) createDraft.mutate(newTitle.trim()); }}
        />
        <Button
          onClick={() => newTitle.trim() && createDraft.mutate(newTitle.trim())}
          disabled={!newTitle.trim() || createDraft.isPending}
        >
          <Plus className="h-4 w-4 ml-1" /> إنشاء مسودة
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>لا توجد مسودات بعد</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map(draft => (
            <Card key={draft.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveDraft(draft)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{draft.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {draft.columns.length} أعمدة · {draft.rows.length} صفوف
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(draft.updated_at), 'dd MMM yyyy', { locale: ar })}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={e => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف المسودة؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف "{draft.title}" نهائياً.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDraft.mutate(draft.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
