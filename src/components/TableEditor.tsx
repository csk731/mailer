"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Spreadsheet, { Matrix } from "react-spreadsheet";
import { Plus, X, AlertTriangle, AlertCircle, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TableEditorProps {
  columns: string[];
  setColumns: (cols: string[]) => void;
  data: Record<string, string>[];
  setData: (data: Record<string, string>[]) => void;
  className?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimalist data viewer
const DataViewer = ({ cell }: { cell?: { value: string; error?: string | null; warning?: string | null } }) => {
    if (!cell) return null;

    return (
        <div className={cn(
            "w-full h-full flex items-center px-3 relative font-sans text-sm tracking-tight text-foreground transition-colors duration-200",
            cell.error && "bg-red-500/5",
            cell.warning && !cell.error && "bg-yellow-500/5"
        )}>
             <span className="truncate flex-1 outline-none">{cell.value}</span>
             {cell.error && (
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 opacity-80 hover:opacity-100 transition-all z-10 cursor-help group/error">
                     <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
                     <div className="absolute right-0 top-full mt-2 hidden group-hover/error:block bg-red-950/90 border border-red-500/20 text-red-200 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap backdrop-blur-sm z-50">
                        {cell.error}
                     </div>
                 </div>
             )}
        </div>
    );
};

export function TableEditor({ columns, setColumns, data, setData, className }: TableEditorProps) {
  /* Rename Modal State */
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; oldName: string; newName: string; error?: string } | null>(null);

  /* Delete Confirmation State */
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; column: string } | null>(null);

  /* Refs */
  const modalInputRef = useRef<HTMLInputElement>(null);

  /* Safe Remount State */
  const [resetting, setResetting] = useState(false);

  /* Effects */
  useEffect(() => {
      if (renameModal?.isOpen && modalInputRef.current) {
          setTimeout(() => {
             modalInputRef.current?.focus();
             modalInputRef.current?.select();
          }, 50);
      }
  }, [renameModal?.isOpen]);
  
  const removeRow = (index: number) => {
      const newData = [...data];
      newData.splice(index, 1);
      setData(newData);
      toast.success("Row deleted");
  };

  const { spreadsheetData, errorCount } = useMemo(() => {
    let errors = 0;
    const matrix = data.map((row, i) => {
      const rowData = columns.map((col) => {
        const val = row[col] || "";
        const trimmedVal = val.trim();
        let className = "outline-none transition-colors duration-200";
        // Base style handles in CSS, this is for cell specific overrides
        
        if (!trimmedVal) {
             // Let CSS handle basic empty state, but we track errors
             errors++;
        } else if (col === "EMAIL" && !EMAIL_REGEX.test(trimmedVal)) {
             errors++;
        }
        
        return { 
            value: val, 
            className, 
            error: !trimmedVal ? null : (col === "EMAIL" && !EMAIL_REGEX.test(trimmedVal) ? "Invalid Email" : null), 
            warning: !trimmedVal ? "Required" : null 
        };
      });
      return rowData;
    });
    return { spreadsheetData: matrix, errorCount: errors };
  }, [data, columns]);

  const handleDataChange = (matrix: Matrix<{ value: string }>) => {
      const newData = matrix.map((rowCells) => {
          const rowObj: Record<string, string> = {};
          columns.forEach((col, i) => {
              rowObj[col] = (rowCells[i]?.value || "");
          });
          return rowObj;
      });
      setData(newData); 
  };
  
  const addColumn = () => {
    let baseName = "COLUMN";
    let name = baseName;
    let counter = 1;
    // Check duplication case-insensitively against ALL columns
    while(columns.some(c => c.toUpperCase() === name)) {
        name = `${baseName} ${counter++}`;
    }
    
    // Smooth add doesn't need hard reset usually, but let's be safe if it causes issues. 
    // Usually adding is fine. Deleting/Renaming (changing keys) is risky.
    setColumns([...columns, name]);
    setData(data.map((r) => ({ ...r, [name]: "" })));
    toast.success("Column added");
  };

  const confirmDeleteColumn = () => {
      if (!deleteConfirm) return;
      
      // Hard Reset: Unmount table -> Update Data -> Remount
      setResetting(true);
      
      setTimeout(() => {
          const col = deleteConfirm.column;
          setColumns(columns.filter((c) => c !== col));
          const newData = data.map((r) => { const {[col]: _, ...rest} = r; return rest; });
          setData(newData);
          setDeleteConfirm(null);
          setResetting(false);
          toast.success(`Column "${col}" deleted`);
      }, 10);
  };

  const removeColumn = (col: string) => {
    if (col === "EMAIL" || col === "NAME") return;
    setDeleteConfirm({ isOpen: true, column: col });
  };
  
  const handleRenameSubmit = (e?: React.FormEvent) => {
      e?.preventDefault();
      if(!renameModal) return;
      
      const { oldName, newName } = renameModal;
      const trimmed = newName.trim().toUpperCase();
      
      if (!trimmed) {
          setRenameModal(prev => prev ? { ...prev, error: "Name cannot be empty" } : null);
          return;
      }
      
      if (trimmed !== oldName.toUpperCase() && columns.some(c => c.toUpperCase() === trimmed)) {
          setRenameModal(prev => prev ? { ...prev, error: "Column name already exists" } : null);
          return;
      }
      
      if (trimmed === oldName.toUpperCase()) {
           setRenameModal(null);
           return;
      }
      
      setResetting(true);
      setTimeout(() => {
          const newCols = columns.map(c => c === oldName ? trimmed : c);
          const newData = data.map(r => {
               const val = r[oldName];
               const {[oldName]: _, ...rest} = r;
               return { ...rest, [trimmed]: val };
           });
           setColumns(newCols);
           setData(newData);
           setRenameModal(null);
           setResetting(false);
           toast.success("Column renamed");
      }, 10);
  };

  const addRow = () => {
      const row: Record<string, string> = {};
      columns.forEach(c => row[c] = "");
      setData([...data, row]);
  };
  
  const clearAll = () => {
      setData([]);
      setColumns(["NAME", "EMAIL"]);
  };

  const ColumnHeader = ({ label }: { label: string }) => {
      
      const isProtected = label === "EMAIL" || label === "NAME";
      
      return (
        <div 
            className="flex items-center justify-between px-3 h-full w-full group select-none hover:bg-slate-800/50 transition-colors"
        >
            <span className={cn(
                "font-medium text-xs uppercase tracking-wider truncate cursor-default text-muted-foreground group-hover:text-foreground transition-colors",
                isProtected && "text-indigo-400 font-semibold group-hover:text-indigo-300"
            )}>{label}</span>
            {!isProtected && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all gap-1">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setRenameModal({ isOpen: true, oldName: label, newName: label }); 
                        }} 
                        className="p-1 hover:bg-indigo-500/20 hover:text-indigo-400 text-muted-foreground rounded transition-all" 
                        title="Rename"
                        aria-label={`Rename column ${label}`}
                    >
                        <Pencil size={10}/>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeColumn(label); }} 
                        className="p-1 hover:bg-destructive/20 hover:text-destructive text-muted-foreground rounded transition-all" 
                        title="Remove"
                        aria-label={`Remove column ${label}`}
                    >
                        <X size={10}/>
                    </button>
                </div>
            )}
        </div>
      );
  };

  const RowLabel = ({ index }: { index: number }) => (
      <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground group relative cursor-pointer hover:bg-destructive/10 transition-colors">
          <span className="group-hover:opacity-0 transition-opacity duration-150">{index + 1}</span>
          <button 
                onClick={(e) => {
                    e.stopPropagation();
                    removeRow(index);
                }}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all duration-150"
                title="Delete Row"
                aria-label={`Delete row ${index + 1}`}
            >
              <Trash2 size={12} />
          </button>
      </div>
  );
  
  const columnLabels = [...columns.map(c => <ColumnHeader key={c} label={c} />)];

  return (
    <div className={cn("flex flex-col gap-0 select-none relative", className)}>
      
      {/* Rename Modal Overlay */}
      {renameModal?.isOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
               <div className="bg-popover border border-border p-4 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in-95 duration-200">
                   <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Rename Column</h3>
                   <form onSubmit={handleRenameSubmit} className="space-y-3">
                       <div>
                           <input 
                                ref={modalInputRef}
                                value={renameModal.newName}
                                onChange={(e) => setRenameModal(prev => prev ? { ...prev, newName: e.target.value, error: undefined } : null)}
                                className={cn(
                                    "w-full bg-background border rounded px-3 py-2 text-sm text-foreground focus:outline-none transition-all placeholder:text-muted-foreground",
                                    renameModal.error ? "border-destructive/40 focus:border-destructive" : "border-border focus:border-indigo-500/50"
                                )}
                                placeholder="COLUMN NAME"
                           />
                           {renameModal.error && <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> {renameModal.error}</p>}
                       </div>
                       <div className="flex justify-end gap-2">
                           <button 
                                type="button"
                                onClick={() => setRenameModal(null)}
                                className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                           >
                               CANCEL
                           </button>
                           <button 
                                type="submit"
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"
                           >
                               SAVE CHANGE
                           </button>
                       </div>
                   </form>
               </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm?.isOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
               <div className="bg-popover border border-border p-4 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in-95 duration-200">
                   <h3 className="text-xs font-semibold text-destructive mb-1 flex items-center gap-2"><AlertTriangle size={12} className="text-destructive"/> Delete Column?</h3>
                   <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                       Are you sure you want to delete <span className="font-mono text-foreground bg-muted px-1 rounded">"{deleteConfirm.column}"</span>? This action is irreversible.
                   </p>
                   <div className="flex justify-end gap-2">
                       <button 
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                       >
                           CANCEL
                       </button>
                       <button 
                            onClick={confirmDeleteColumn}
                            className="px-3 py-1.5 text-xs font-semibold bg-red-950/30 text-red-400 border border-red-500/20 rounded hover:bg-red-950/50 hover:border-red-500/30 transition-all shadow-lg shadow-red-900/10"
                       >
                           DELETE
                       </button>
                   </div>
               </div>
          </div>
      )}

      {/* Main Table Container */}
      <div className="flex flex-col border border-border rounded-lg bg-background overflow-hidden shadow-sm">
         
         {/* Top Toolbar / Add Column Area */}
         <div className="min-h-[36px] border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 py-2 sm:py-0 bg-muted/30 gap-2 sm:gap-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                 <button 
                    onClick={addColumn}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/20 w-full sm:w-auto justify-center sm:justify-start"
                 >
                    <Plus size={12} />
                    ADD COLUMN
                 </button>
            </div>
             <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
                <span>{data.length} ROWS</span>
                <span className="w-px h-3 bg-border hidden sm:block" />
                <span>{columns.length} COLS</span>
            </div>
         </div>

         {/* Spreadsheet View */}
<div className="relative overflow-auto max-h-[60vh] excel-wrapper text-sm bg-background">
             {resetting ? (
                 <div className="w-full h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                     <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                     <span className="text-xs">Updating table...</span>
                 </div>
             ) : (
                 <Spreadsheet 
                    key={columns.join(',')} 
                    data={spreadsheetData} 
                    onChange={handleDataChange}
                    columnLabels={columnLabels as any} 
                    rowLabels={data.map((_, i) => <RowLabel key={i} index={i} /> as any)}
                    DataViewer={DataViewer}
                    className="w-full"
                    darkMode={true} 
                />
             )}
         </div>
         
         {/* Bottom Action Bar */}
         <button 
                onClick={addRow} 
                className={cn(
                    "w-full h-8 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground  hover:text-foreground hover:bg-muted/50 transition-all border-t border-border/50 bg-muted/20",
                    data.length === 0 && "py-8 flex-col gap-3 text-muted-foreground hover:text-foreground"
                )}
             >
                 {data.length === 0 ? (
                     <>
                        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-1">
                            <Plus size={16} />
                        </div>
                        <span>No recipients added. Click to add a new row.</span>
                     </>
                 ) : (
                     <>
                        <Plus size={12} /> ADD NEW ROW
                     </>
                 )}
         </button>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center pt-3 px-1">
        <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            {errorCount > 0 ? (
                 <span className="text-yellow-500/80 flex items-center gap-1.5 bg-yellow-500/5 px-2 py-1 rounded border border-yellow-500/10">
                    <AlertTriangle size={10} /> 
                    {errorCount} issue{errorCount !== 1 ? 's' : ''} detected
                 </span>
            ) : (
                <span className="text-muted-foreground flex items-center gap-1.5 opacity-50">
                    All good
                 </span>
            )}
        </div>
        
      </div>
      
      <style jsx global>{`
        .excel-wrapper table {
            border-collapse: separate !important;
            border-spacing: 0;
            min-width: 100%; /* Changed from width: 100% to allow expansion */
        }
        .excel-wrapper th {
            background: var(--background) !important;
            border-right: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 0 !important;
            height: 38px !important;
            min-width: 160px; /* Increased slightly */
            position: sticky !important;
            color: var(--muted-foreground) !important;
        }
        /* Column Headers (Top Row) */
        .excel-wrapper tr:first-child th {
            top: 0;
            z-index: 10;
        }
        /* Top Left Corner */
        .excel-wrapper tr:first-child th:first-child {
             width: 40px !important; 
             min-width: 40px !important;
             max-width: 40px !important; 
             z-index: 20;
             position: sticky !important;
             left: 0;
        }
        /* Row Headers (Row Numbers) */
        .excel-wrapper tr:not(:first-child) th {
            top: auto !important;
            left: 0;
            z-index: 9;
            width: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
        }
        .excel-wrapper td:first-child {
             position: sticky !important;
             left: 0;
             z-index: 9;
             background: var(--background) !important;
             border-right: 1px solid var(--border) !important;
        }
        .excel-wrapper td {
            border-right: 1px solid var(--border) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 0 !important;
            background: var(--card);
            color: var(--card-foreground);
            height: 38px !important;
            min-width: 160px; /* MATCH HEADER MIN-WIDTH */
        }
        .excel-wrapper input {
            background: var(--card) !important;
            color: var(--card-foreground) !important;
            padding: 0 12px !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            outline: none !important;
            font-size: 14px;
        }
        .excel-wrapper td.selected {
            border: 1px solid var(--ring) !important;
            box-shadow: 0 0 0 1px #6366f1; /* Indigo-500 */
            z-index: 5;
        }
        /* Custom scrollbar for webkit */
        .excel-wrapper::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .excel-wrapper::-webkit-scrollbar-track {
            background: var(--background);
        }
        .excel-wrapper::-webkit-scrollbar-thumb {
            background: var(--muted);
            border-radius: 4px;
        }
        .excel-wrapper::-webkit-scrollbar-thumb:hover {
            background: var(--muted-foreground);
        }
      `}</style>
    </div>
  );
}
