
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Pencil, X, FileSpreadsheet, Calendar, Type, Hash, Check, MoreVertical, Layers, Sigma } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatNumberInput, parseFormattedNumber } from '@/lib/utils';
import AdminLayout, { AdminSection, AdminLoading } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

type ColType = 'text' | 'date' | 'number' | 'quantity';

interface DraftColumn { id: string; name: string; type?: ColType; }
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

// Calculate row subtotal: quantity columns × number columns
function calcRowSubtotal(row: DraftRow, columns: DraftColumn[]): number {
  const qtyCols = columns.filter(c => c.type === 'quantity');
  const numCols = columns.filter(c => c.type === 'number');
  
  if (qtyCols.length === 0 || numCols.length === 0) return 0;
  
  // Sum all (qty × price) combinations per row
  let total = 0;
  for (const qCol of qtyCols) {
    const qty = parseFloat(row[qCol.id] || '0') || 0;
    for (const nCol of numCols) {
      const price = parseFloat(row[nCol.id] || '0') || 0;
      total += qty * price;
    }
  }
  return total;
}

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

  // Check if we should show subtotal column
  const hasSubtotal = useMemo(() => {
    if (!activeDraft) return false;
    return activeDraft.columns.some(c => c.type === 'quantity') && activeDraft.columns.some(c => c.type === 'number');
  }, [activeDraft?.columns]);

  const addColumn = (type: ColType = 'text') => {
    const labels: Record<ColType, string> = { text: 'عمود', date: 'تاريخ', number: 'مبلغ', quantity: 'عدد' };
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
    updateDraft(d => ({ ...d, columns: d.columns.map(c => c.id === colId ? { ...c, name } : c) }));
    setEditingColId(null);
  };

  const deleteColumn = (colId: string) => {
    updateDraft(d => ({
      ...d,
      columns: d.columns.filter(c => c.id !== colId),
      rows: d.rows.map(r => { const nr = { ...r }; delete nr[colId]; return nr; }),
    }));
  };

  const changeColumnType = (colId: string, type: ColType) => {
    updateDraft(d => ({ ...d, columns: d.columns.map(c => c.id === colId ? { ...c, type } : c) }));
  };

  const addRow = () => {
    updateDraft(d => {
      const newRow: DraftRow = { id: newRowId() };
      d.columns.forEach(col => {
        if (col.type === 'date') newRow[col.id] = new Date().toISOString().split('T')[0];
      });
      return { ...d, rows: [...d.rows, newRow] };
    });
  };

  const deleteRow = (rowId: string) => {
    updateDraft(d => ({ ...d, rows: d.rows.filter(r => r.id !== rowId) }));
  };

  const setCellVal = (rowId: string, colId: string, value: string) => {
    updateDraft(d => ({ ...d, rows: d.rows.map(r => r.id === rowId ? { ...r, [colId]: value } : r) }));
  };

  const colTypeIcon = (type?: string) => {
    if (type === 'date') return <Calendar className="h-3 w-3" />;
    if (type === 'number') return <Hash className="h-3 w-3" />;
    if (type === 'quantity') return <Layers className="h-3 w-3" />;
    return <Type className="h-3 w-3" />;
  };

  const colTypeBadge = (type?: string) => {
    if (type === 'date') return 'تاريخ';
    if (type === 'number') return 'مبلغ / رقم';
    if (type === 'quantity') return 'عدد';
    return 'نص';
  };

  const allColTypes: ColType[] = ['text', 'date', 'number', 'quantity'];

  if (isLoading) return <AdminLoading />;

  // ─── DRAFT EDITOR ───
  if (activeDraft) {
    // Column grand totals
    const colGrandTotals: Record<string, number> = {};
    activeDraft.columns.forEach(col => {
      if (col.type === 'number' || col.type === 'quantity') {
        colGrandTotals[col.id] = activeDraft.rows.reduce((sum, row) => sum + (parseFloat(row[col.id] || '0') || 0), 0);
      }
    });
    const grandSubtotal = activeDraft.rows.reduce((sum, row) => sum + calcRowSubtotal(row, activeDraft.columns), 0);

    return (
      <AdminLayout title="">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/30">
          <Button variant="ghost" size="sm" onClick={() => setActiveDraft(null)} className="gap-1 text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> العودة
          </Button>
          <div className="h-5 w-px bg-border/40" />
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
          <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50">
            {saveDraft.isPending ? '⏳ جارٍ الحفظ...' : '✓ محفوظ'}
          </span>

          {/* Add Column Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0">
                <Plus className="h-3.5 w-3.5" /> عمود
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="backdrop-blur-xl bg-card/90 border-border/30">
              <DropdownMenuLabel>نوع العمود</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addColumn('text')} className="gap-2">
                <Type className="h-4 w-4 text-blue-500" /> نص
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addColumn('date')} className="gap-2">
                <Calendar className="h-4 w-4 text-amber-500" /> تاريخ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addColumn('number')} className="gap-2">
                <Hash className="h-4 w-4 text-emerald-500" /> مبلغ / رقم
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addColumn('quantity')} className="gap-2">
                <Layers className="h-4 w-4 text-purple-500" /> عدد
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" onClick={addRow} className="gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0">
            <Plus className="h-3.5 w-3.5" /> صف
          </Button>
        </div>

        {/* Spreadsheet - Glassy 3D */}
        <div className="overflow-auto rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl bg-card/60">
          {activeDraft.columns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg">
                <FileSpreadsheet className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-sm font-medium">ابدأ بإضافة أعمدة من الزر أعلاه</p>
            </div>
          ) : (
            <table className="w-full text-base border-collapse">
              {/* Column Headers */}
              <thead>
                <tr className="bg-gradient-to-b from-muted/60 to-muted/30 border-b border-white/10">
                  <th className="p-3 text-center w-12 text-muted-foreground text-sm font-semibold">#</th>
                  {activeDraft.columns.map(col => (
                    <th key={col.id} className="p-0 min-w-[150px] border-r border-white/5 last:border-r-0">
                      {editingColId === col.id ? (
                        <div className="flex items-center gap-1 p-1.5">
                          <Input
                            value={editingColName}
                            onChange={e => setEditingColName(e.target.value)}
                            className="h-7 text-xs bg-background/60 backdrop-blur"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id, editingColName); if (e.key === 'Escape') setEditingColId(null); }}
                            onBlur={() => renameColumn(col.id, editingColName)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-3 py-2.5 group">
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] ${
                              col.type === 'date' ? 'bg-amber-500/15 text-amber-600' :
                              col.type === 'number' ? 'bg-emerald-500/15 text-emerald-600' :
                              col.type === 'quantity' ? 'bg-purple-500/15 text-purple-600' :
                              'bg-blue-500/15 text-blue-600'
                            }`}>
                              {colTypeIcon(col.type)}
                            </span>
                            <span className="font-semibold text-sm">{col.name}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[140px] backdrop-blur-xl bg-card/90 border-border/30">
                              <DropdownMenuItem onClick={() => { setEditingColId(col.id); setEditingColName(col.name); }} className="gap-2 text-xs">
                                <Pencil className="h-3 w-3" /> إعادة تسمية
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">تغيير النوع</DropdownMenuLabel>
                              {allColTypes.map(t => (
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
                  {/* Subtotal header */}
                  {hasSubtotal && (
                    <th className="px-3 py-2.5 min-w-[130px] border-r border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-orange-500/15 text-orange-600 text-[10px]">
                          <Sigma className="h-3 w-3" />
                        </span>
                        <span className="font-semibold text-sm">المجموع</span>
                      </div>
                    </th>
                  )}
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>

              {/* Rows */}
              <tbody>
                {activeDraft.rows.length === 0 ? (
                  <tr>
                    <td colSpan={activeDraft.columns.length + (hasSubtotal ? 3 : 2)} className="p-12 text-center text-muted-foreground text-xs">
                      لا توجد صفوف — اضغط "صف" للبدء
                    </td>
                  </tr>
                ) : (
                  activeDraft.rows.map((row, idx) => {
                    const rowSub = hasSubtotal ? calcRowSubtotal(row, activeDraft.columns) : 0;
                    return (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-primary/[0.03] transition-colors group/row">
                        <td className="p-3 text-center text-muted-foreground/50 text-sm font-mono select-none">{idx + 1}</td>
                        {activeDraft.columns.map(col => (
                          <td key={col.id} className="p-0 border-r border-white/5 last:border-r-0">
                            {/* DATE */}
                            {col.type === 'date' ? (
                              <div className="relative">
                                <input
                                  type="date"
                                  value={row[col.id] || ''}
                                  onChange={e => setCellVal(row.id, col.id, e.target.value)}
                                  className="w-full h-10 px-3 text-xs bg-transparent border-0 outline-none focus:bg-amber-500/5 transition-colors cursor-pointer font-mono"
                                  dir="ltr"
                                />
                              </div>
                            ) : (col.type === 'number' || col.type === 'quantity') ? (
                              /* NUMBER / QUANTITY */
                              editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={cellValue}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                    setCellValue(formatNumberInput(raw));
                                  }}
                                  className={`w-full h-10 px-3 text-xs border-0 outline-none font-mono ${
                                    col.type === 'quantity' ? 'bg-purple-500/5' : 'bg-emerald-500/5'
                                  }`}
                                  dir="ltr"
                                  autoFocus
                                  onBlur={() => { setCellVal(row.id, col.id, String(parseFormattedNumber(cellValue))); setEditingCell(null); }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { setCellVal(row.id, col.id, String(parseFormattedNumber(cellValue))); setEditingCell(null); }
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <div
                                  className={`px-3 py-2.5 min-h-[40px] cursor-text text-xs font-mono hover:bg-muted/20 transition-colors flex items-center ${
                                    col.type === 'quantity' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                  dir="ltr"
                                  onClick={() => { setEditingCell({ rowId: row.id, colId: col.id }); setCellValue(row[col.id] ? formatNumberInput(row[col.id]) : ''); }}
                                >
                                  {row[col.id] ? formatNumberInput(row[col.id]) : <span className="text-muted-foreground/25">0</span>}
                                </div>
                              )
                            ) : (
                              /* TEXT */
                              editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                                <input
                                  value={cellValue}
                                  onChange={e => setCellValue(e.target.value)}
                                  className="w-full h-10 px-3 text-xs bg-blue-500/5 border-0 outline-none"
                                  autoFocus
                                  onBlur={() => { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { setCellVal(row.id, col.id, cellValue); setEditingCell(null); }
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <div
                                  className="px-3 py-2.5 min-h-[40px] cursor-text text-xs hover:bg-muted/20 transition-colors flex items-center"
                                  onClick={() => { setEditingCell({ rowId: row.id, colId: col.id }); setCellValue(row[col.id] || ''); }}
                                >
                                  {row[col.id] || <span className="text-muted-foreground/25">—</span>}
                                </div>
                              )
                            )}
                          </td>
                        ))}
                        {/* Row Subtotal */}
                        {hasSubtotal && (
                          <td className="px-3 py-2.5 border-r border-white/5 text-xs font-mono font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/[0.04]" dir="ltr">
                            {rowSub > 0 ? formatNumberInput(String(rowSub)) : <span className="text-muted-foreground/25">0</span>}
                          </td>
                        )}
                        <td className="p-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/50 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => deleteRow(row.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Grand Totals Footer */}
              {activeDraft.rows.length > 0 && activeDraft.columns.some(c => c.type === 'number' || c.type === 'quantity') && (
                <tfoot>
                  <tr className="bg-gradient-to-b from-muted/50 to-muted/30 border-t-2 border-primary/10">
                    <td className="p-3 text-center">
                      <span className="flex items-center justify-center w-6 h-6 mx-auto rounded-lg bg-primary/10 text-primary text-xs font-bold">Σ</span>
                    </td>
                    {activeDraft.columns.map(col => (
                      <td key={col.id} className="px-3 py-3 text-xs border-r border-white/5 last:border-r-0">
                        {(col.type === 'number' || col.type === 'quantity') ? (
                          <span className={`font-mono font-bold ${
                            col.type === 'quantity' ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`} dir="ltr">
                            {formatNumberInput(String(colGrandTotals[col.id] || 0))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    ))}
                    {hasSubtotal && (
                      <td className="px-3 py-3 text-xs font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-500/[0.06]" dir="ltr">
                        {formatNumberInput(String(grandSubtotal))}
                      </td>
                    )}
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Quick add row */}
        {activeDraft.columns.length > 0 && (
          <Button variant="ghost" size="sm" onClick={addRow} className="mt-3 w-full text-xs text-muted-foreground hover:text-primary border border-dashed border-border/30 hover:border-primary/30 rounded-xl transition-all">
            <Plus className="h-3.5 w-3.5 ml-1" /> إضافة صف جديد
          </Button>
        )}
      </AdminLayout>
    );
  }

  // ─── DRAFTS LIST ───
  return (
    <AdminLayout title="المسودات المالية" backTo={ADMIN_ROUTES.financials}>
      <div className="flex items-center gap-2 mb-6">
        <Input
          placeholder="اسم المسودة الجديدة..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="max-w-xs backdrop-blur bg-card/60"
          onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) createDraft.mutate(newTitle.trim()); }}
        />
        <Button
          onClick={() => newTitle.trim() && createDraft.mutate(newTitle.trim())}
          disabled={!newTitle.trim() || createDraft.isPending}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> إنشاء مسودة
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg">
            <FileSpreadsheet className="h-8 w-8 text-primary/50" />
          </div>
          <p className="font-medium">لا توجد مسودات بعد</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map(draft => (
            <Card
              key={draft.id}
              className="cursor-pointer group hover:shadow-xl transition-all duration-300 border-white/10 backdrop-blur-xl bg-card/60 hover:bg-card/80 hover:border-primary/20 rounded-2xl overflow-hidden"
              onClick={() => { setActiveDraft(draft); setDraftTitle(draft.title); }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm mb-2 group-hover:text-primary transition-colors">{draft.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border-0">{draft.columns.length} أعمدة</Badge>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border-0">{draft.rows.length} صفوف</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5">
                      {format(new Date(draft.updated_at), 'dd MMM yyyy', { locale: ar })}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={e => e.stopPropagation()}>
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
