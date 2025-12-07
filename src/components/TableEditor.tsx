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
            "w-full h-full flex items-center px-3 relative font-sans text-sm tracking-tight text-slate-300 transition-colors duration-200",
            cell.error && "bg-red-500/5",
            cell.warning && !cell.error && "bg-yellow-500/5"
        )}>
             <span className="truncate flex-1 outline-none">{cell.value}</span>
             {cell.error && (
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 opacity-80 hover:opacity-100 transition-all z-10 cursor-help group/error">
                     <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" />
                     <div className="absolute right-0 top-full mt-2 hidden group-hover/error:block bg-red-950/90 border border-red-500/20 text-red-200 text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap backdrop-blur-sm z-50">
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
        let className = "outline-none transition-colors duration-200";
        // Base style handles in CSS, this is for cell specific overrides
        
        if (!val) {
             // Let CSS handle basic empty state, but we track errors
             errors++;
        } else if (col === "EMAIL" && !EMAIL_REGEX.test(val)) {
             errors++;
        }
        
        return { 
            value: val, 
            className, 
            error: !val ? null : (col === "EMAIL" && !EMAIL_REGEX.test(val) ? "Invalid Email" : null), 
            warning: !val ? "Required" : null 
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
    setColumns([...columns, name]);
    setData(data.map((r) => ({ ...r, [name]: "" })));
    toast.success("Column added");
  };

  const confirmDeleteColumn = () => {
      if (!deleteConfirm) return;
      const col = deleteConfirm.column;
      setColumns(columns.filter((c) => c !== col));
      const newData = data.map((r) => { const {[col]: _, ...rest} = r; return rest; });
      setData(newData);
      setDeleteConfirm(null);
      toast.success(`Column "${col}" deleted`);
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

      // Check duplication case-insensitively, excluding the current column
      if (trimmed !== oldName.toUpperCase() && columns.some(c => c.toUpperCase() === trimmed)) {
          setRenameModal(prev => prev ? { ...prev, error: "Column name already exists" } : null);
          return;
      }
      
      if (trimmed === oldName.toUpperCase()) {
           setRenameModal(null);
           return;
      }
      
      const newCols = columns.map(c => c === oldName ? trimmed : c);
      const newData = data.map(r => {
           const val = r[oldName];
           const {[oldName]: _, ...rest} = r;
           return { ...rest, [trimmed]: val };
       });
       setColumns(newCols);
       setData(newData);
       setRenameModal(null);
       toast.success("Column renamed");
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
                "font-medium text-[10px] uppercase tracking-wider truncate cursor-default text-slate-500 group-hover:text-slate-300 transition-colors",
                isProtected && "text-blue-400/80 font-semibold group-hover:text-blue-400"
            )}>{label}</span>
            {!isProtected && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all gap-1">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setRenameModal({ isOpen: true, oldName: label, newName: label }); 
                        }} 
                        className="p-1 hover:bg-blue-500/20 hover:text-blue-400 text-slate-600 rounded transition-all" 
                        title="Rename"
                    >
                        <Pencil size={10}/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeColumn(label); }} className="p-1 hover:bg-red-500/20 hover:text-red-400 text-slate-600 rounded transition-all" title="Remove">
                        <X size={10}/>
                    </button>
                </div>
            )}
        </div>
      );
  };

  const RowLabel = ({ index }: { index: number }) => (
      <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-slate-600 group relative cursor-pointer hover:bg-red-500/10 transition-colors">
          <span className="group-hover:opacity-0 transition-opacity duration-150">{index + 1}</span>
          <button 
                onClick={(e) => {
                    e.stopPropagation();
                    removeRow(index);
                }}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all duration-150"
                title="Delete Row"
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
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-lg">
               <div className="bg-[#09090b] border border-slate-800 p-4 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in-95 duration-200">
                   <h3 className="text-xs font-semibold text-slate-200 mb-3 uppercase tracking-wide">Rename Column</h3>
                   <form onSubmit={handleRenameSubmit} className="space-y-3">
                       <div>
                           <input 
                                ref={modalInputRef}
                                value={renameModal.newName}
                                onChange={(e) => setRenameModal(prev => prev ? { ...prev, newName: e.target.value, error: undefined } : null)}
                                className={cn(
                                    "w-full bg-slate-900/50 border rounded px-3 py-2 text-sm text-white focus:outline-none transition-all placeholder:text-slate-600",
                                    renameModal.error ? "border-red-500/40 focus:border-red-500" : "border-slate-800 focus:border-blue-500/50"
                                )}
                                placeholder="COLUMN NAME"
                           />
                           {renameModal.error && <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1"><AlertCircle size={10} /> {renameModal.error}</p>}
                       </div>
                       <div className="flex justify-end gap-2">
                           <button 
                                type="button"
                                onClick={() => setRenameModal(null)}
                                className="px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                           >
                               CANCEL
                           </button>
                           <button 
                                type="submit"
                                className="px-3 py-1.5 text-[10px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
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
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-lg">
               <div className="bg-[#09090b] border border-slate-800 p-4 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in-95 duration-200">
                   <h3 className="text-xs font-semibold text-red-200 mb-1 flex items-center gap-2"><AlertTriangle size={12} className="text-red-500"/> Delete Column?</h3>
                   <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                       Are you sure you want to delete <span className="font-mono text-slate-200 bg-slate-800 px-1 rounded">"{deleteConfirm.column}"</span>? This action is irreversible.
                   </p>
                   <div className="flex justify-end gap-2">
                       <button 
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                       >
                           CANCEL
                       </button>
                       <button 
                            onClick={confirmDeleteColumn}
                            className="px-3 py-1.5 text-[10px] font-semibold bg-red-950/30 text-red-400 border border-red-500/20 rounded hover:bg-red-950/50 hover:border-red-500/30 transition-all shadow-lg shadow-red-900/10"
                       >
                           DELETE
                       </button>
                   </div>
               </div>
          </div>
      )}

      {/* Main Table Container */}
      <div className="flex flex-col border border-slate-800 rounded-lg bg-[#09090b] overflow-hidden shadow-sm">
         
         {/* Top Toolbar / Add Column Area */}
         <div className="min-h-[36px] border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 py-2 sm:py-0 bg-slate-900/30 gap-2 sm:gap-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                 <button 
                    onClick={addColumn}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-500/20 w-full sm:w-auto justify-center sm:justify-start"
                 >
                    <Plus size={12} />
                    ADD COLUMN
                 </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
                <span>{data.length} ROWS</span>
                <span className="w-px h-3 bg-slate-800 hidden sm:block" />
                <span>{columns.length} COLS</span>
            </div>
         </div>

         {/* Spreadsheet View */}
<div className="relative overflow-x-auto excel-wrapper text-sm bg-[#09090b]">
             <Spreadsheet 
                data={spreadsheetData} 
                onChange={handleDataChange}
                columnLabels={columnLabels as any} 
                rowLabels={data.map((_, i) => <RowLabel key={i} index={i} /> as any)}
                DataViewer={DataViewer}
                className="w-full"
                darkMode={true} 
            />
         </div>
         
         {/* Bottom Action Bar */}
         <button 
                onClick={addRow} 
                className={cn(
                    "w-full h-8 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-500  hover:text-slate-200 hover:bg-slate-800/50 transition-all border-t border-slate-800/50 bg-slate-900/20",
                    data.length === 0 && "py-8 flex-col gap-3 text-slate-600 hover:text-slate-400"
                )}
             >
                 {data.length === 0 ? (
                     <>
                        <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center mb-1">
                            <Plus size={16} />
                        </div>
                        <span>Table is empty. Click to add a new row.</span>
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
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
            {errorCount > 0 ? (
                 <span className="text-yellow-500/80 flex items-center gap-1.5 bg-yellow-500/5 px-2 py-1 rounded border border-yellow-500/10">
                    <AlertTriangle size={10} /> 
                    {errorCount} issue{errorCount !== 1 ? 's' : ''} detected
                 </span>
            ) : (
                <span className="text-slate-600 flex items-center gap-1.5 opacity-50">
                    All good
                 </span>
            )}
        </div>
        
        {data.length > 0 && (
            <button 
                onClick={() => {
                    if (confirm("Clear all table data? This action cannot be undone.")) {
                        clearAll();
                        toast.success("Table cleared");
                    }
                }} 
                className="text-[10px] text-slate-600 hover:text-red-400 transition-colors hover:underline flex items-center gap-1"
            >
                <Trash2 size={10} />
                Clear Table
            </button>
        )}
      </div>
      
      <style jsx global>{`
        .excel-wrapper table {
            border-collapse: separate !important;
            border-spacing: 0;
            width: 100%;
        }
        .excel-wrapper th {
            background: #09090b !important;
            border-right: 1px solid #1e293b !important;
            border-bottom: 1px solid #1e293b !important;
            padding: 0 !important;
            height: 38px !important;
            min-width: 140px;
            position: sticky !important;
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
             background: #09090b !important;
             border-right: 1px solid #1e293b !important;
        }
        .excel-wrapper td {
            border-right: 1px solid #1e293b !important;
            border-bottom: 1px solid #1e293b !important;
            padding: 0 !important;
            background: #09090b;
            color: #cbd5e1;
            height: 38px !important;
        }
        .excel-wrapper input {
            background: transparent !important;
            color: #f1f5f9 !important;
            padding: 0 12px !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            outline: none !important;
            font-size: 13px;
        }
        .excel-wrapper td.selected {
            border: 1px solid #3b82f6 !important;
            box-shadow: 0 0 0 1px #3b82f6;
            z-index: 5;
        }
        /* Custom scrollbar for webkit */
        .excel-wrapper::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .excel-wrapper::-webkit-scrollbar-track {
            background: #09090b;
        }
        .excel-wrapper::-webkit-scrollbar-thumb {
            background: #1e293b;
            border-radius: 4px;
        }
        .excel-wrapper::-webkit-scrollbar-thumb:hover {
            background: #334155;
        }
      `}</style>
    </div>
  );
}
