
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Pencil, X, FileSpreadsheet, Calendar, Type, Hash, Check, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatNumberInput, parseFormattedNumber } from '@/lib/utils';
import AdminLayout, { AdminSection, AdminLoading } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface DraftColumn { id: string; name: string; type?: 'text' | 'date' | 'number'; }
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
  const queryClient = useQueryClient();
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

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
      setDraftTitle(draft.title);
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
    },
  });

  // Auto-save logic
  useEffect(() => {
    if (!activeDraft) return;
    const snapshot = JSON.stringify({ title: activeDraft.title, columns: activeDraft.columns, rows: activeDraft.rows });
    if (snapshot === lastSavedRef.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      lastSavedRef.current = snapshot;
      saveDraft.mutate(activeDraft);
    }, 1200);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [activeDraft]);

  const updateDraft = useCallback((updater: (d: Draft) => Draft) => {
    setActiveDraft(prev => prev ? updater(prev) : prev);
  }, []);

  const addColumn = (type: 'text' | 'date' | 'number' = 'text') => {
    const labels = { text: 'عمود', date: 'تاريخ', number: 'رقم' };
    const name = `${labels[type]} ${(activeDraft?.columns.length || 0) + 1}`;
    const colId = newColId();
    updateDraft(d => {
      const newRows = type === 'date'
        ? d.rows.map(r => ({ ...r, [colId]: new Date().toISOString().split('T')[0] }))
        : d.rows;
      return { ...d, columns: [...d.columns, { id: colId, name, type }], rows: newRows };
    });
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

  const changeColumnType = (colId: string, type: 'text' | 'date' | 'number') => {
    updateDraft(d => ({
      ...d,
      columns: d.columns.map(c => c.id === colId ? { ...c, type } : c),
    }));
  };

  const addRow = () => {
    updateDraft(d => {
      const newRow: DraftRow = { id: newRowId() };
      d.columns.forEach(col => {
        if (col.type === 'date') {
          newRow[col.id] = new Date().toISOString().split('T')[0];
        }
      });
      return { ...d, rows: [...d.rows, newRow] };
    });
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

  const colTypeIcon = (type?: string) => {
    if (type === 'date') return <Calendar className="h-3 w-3" />;
    if (type === 'number') return <Hash className="h-3 w-3" />;
    return <Type className="h-3 w-3" />;
  };

  const colTypeBadge = (type?: string) => {
    if (type === 'date') return 'تاريخ';
    if (type === 'number') return 'رقم';
    return 'نص';
  };

  if (isLoading) return <AdminLoading />;

  // Draft editor view
  if (activeDraft) {
    return (
      <AdminLayout title="">
        {/* Header bar */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
          <Button variant="ghost" size="sm" onClick={() => { setActiveDraft(null); }} className="gap-1 text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> العودة
          </Button>
          <div className="h-5 w-px bg-border/50" />
          {editingTitle ? (
            <Input
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              className="h-8 text-sm font-semibold max-w-[250px]"
              autoFocus
              onBlur={() => { updateDraft(d => ({ ...d, title: draftTitle })); setEditingTitle(false); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { updateDraft(d => ({ ...d, title: draftTitle })); setEditingTitle(false); }
                if (e.key === 'Escape') setEditingTitle(false);
              }}
            />
          ) : (
            <h2
              className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
              onClick={() => { setDraftTitle(activeDraft.title); setEditingTitle(true); }}
            >
              {activeDraft.title}
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </h2>
          )}
          <div className="mr-auto" />
          <span className="text-xs text-muted-foreground">
            {saveDraft.isPending ? 'جارٍ الحفظ...' : 'محفوظ تلقائياً'}
          </span>

          {/* Add Column Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> عمود
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>نوع العمود</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addColumn('text')} className="gap-2">
                <Type className="h-4 w-4" /> نص
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addColumn('date')} className="gap-2">
                <Calendar className="h-4 w-4" /> تاريخ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addColumn('number')} className="gap-2">
                <Hash className="h-4 w-4" /> رقم
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> صف
          </Button>
        </div>

        {/* Spreadsheet */}
        <div className="overflow-auto rounded-xl border border-border/60 bg-card shadow-sm">
          {activeDraft.columns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <FileSpreadsheet className="h-10 w-10 opacity-30" />
              <p className="text-sm">ابدأ بإضافة أعمدة من الزر أعلاه</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/50">
                  <th className="p-2.5 text-center w-12 text-muted-foreground text-xs font-medium">#</th>
                  {activeDraft.columns.map(col => (
                    <th key={col.id} className="p-0 min-w-[160px] border-r border-border/30 last:border-r-0">
                      {editingColId === col.id ? (
                        <div className="flex items-center gap-1 p-1.5">
                          <Input
                            value={editingColName}
                            onChange={e => setEditingColName(e.target.value)}
                            className="h-7 text-xs"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id, editingColName); if (e.key === 'Escape') setEditingColId(null); }}
                            onBlur={() => renameColumn(col.id, editingColName)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-2.5 py-2 group">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground/70">{colTypeIcon(col.type)}</span>
                            <span className="font-medium text-xs">{col.name}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[140px]">
                              <DropdownMenuItem onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }} className="gap-2 text-xs">
                                <Pencil className="h-3 w-3" /> إعادة تسمية
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">تغيير النوع</DropdownMenuLabel>
                              {(['text', 'date', 'number'] as const).map(t => (
                                <DropdownMenuItem key={t} onClick={() => changeColumnType(col.id, t)} className="gap-2 text-xs">
                                  {colTypeIcon(t)}
                                  {colTypeBadge(t)}
                                  {col.type === t && <Check className="h-3 w-3 mr-auto text-primary" />}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => deleteColumn(col.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
                                <Trash2 className="h-3 w-3" /> حذف العمود
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                    <td colSpan={activeDraft.columns.length + 2} className="p-10 text-center text-muted-foreground text-xs">
                      لا توجد صفوف — اضغط "صف" للبدء
                    </td>
                  </tr>
                ) : (
                  activeDraft.rows.map((row, idx) => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors group/row">
                      <td className="p-2.5 text-center text-muted-foreground/60 text-xs font-mono">{idx + 1}</td>
                      {activeDraft.columns.map(col => (
                        <td key={col.id} className="p-0 border-r border-border/20 last:border-r-0">
                          {col.type === 'date' ? (
                            <input
                              type="date"
                              value={row[col.id] || ''}
                              onChange={e => setCellVal(row.id, col.id, e.target.value)}
                              className="w-full h-9 px-2.5 text-xs bg-transparent border-0 outline-none focus:bg-primary/5 transition-colors"
                            />
                          ) : col.type === 'number' ? (
                            editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                              <input
                                type="number"
                                value={cellValue}
                                onChange={e => setCellValue(e.target.value)}
                                className="w-full h-9 px-2.5 text-xs bg-primary/5 border-0 outline-none font-mono"
                                autoFocus
                                onBlur={() => { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            ) : (
                              <div
                                className="px-2.5 py-2 min-h-[36px] cursor-text text-xs font-mono hover:bg-muted/30 transition-colors flex items-center"
                                onClick={() => { setEditingCell({ rowId: row.id, colId: col.id }); setCellValue(row[col.id] || ''); }}
                              >
                                {row[col.id] || <span className="text-muted-foreground/30">—</span>}
                              </div>
                            )
                          ) : editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                            <input
                              value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              className="w-full h-9 px-2.5 text-xs bg-primary/5 border-0 outline-none"
                              autoFocus
                              onBlur={() => { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : (
                            <div
                              className="px-2.5 py-2 min-h-[36px] cursor-text text-xs hover:bg-muted/30 transition-colors flex items-center"
                              onClick={() => { setEditingCell({ rowId: row.id, colId: col.id }); setCellValue(row[col.id] || ''); }}
                            >
                              {row[col.id] || <span className="text-muted-foreground/30">—</span>}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="p-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/60 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => deleteRow(row.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick add row at bottom */}
        {activeDraft.columns.length > 0 && (
          <Button variant="ghost" size="sm" onClick={addRow} className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/40 hover:border-border">
            <Plus className="h-3.5 w-3.5 ml-1" /> إضافة صف جديد
          </Button>
        )}
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
            <Card key={draft.id} className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30" onClick={() => { setActiveDraft(draft); setDraftTitle(draft.title); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{draft.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{draft.columns.length} أعمدة</Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{draft.rows.length} صفوف</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
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
