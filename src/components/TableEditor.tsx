"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import Spreadsheet, { Matrix } from "react-spreadsheet";
import { Plus, X, AlertTriangle, Trash2, Pencil, Upload, Download } from "lucide-react";
import { cn, parseCsv, exportCsv } from "@/lib/utils";
import { toast } from "sonner";

interface TableEditorProps {
  columns: string[];
  setColumns: (cols: string[]) => void;
  data: Record<string, string>[];
  setData: (data: Record<string, string>[]) => void;
  className?: string;
  privacyMode?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimalist data viewer
const DataViewer = ({ cell }: { cell?: { value: string; error?: string | null; warning?: string | null; className?: string } }) => {
    if (!cell) return null;

    return (
        <div className={cn(
            "w-full h-full flex items-center px-3 relative font-sans text-sm tracking-tight text-foreground transition-colors duration-200",
            cell.error && "bg-red-500/5",
            cell.warning && !cell.error && "bg-yellow-500/5"
        )}>
             <span className={cn("truncate flex-1 outline-none", cell.className)}>{cell.value}</span>
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

export function TableEditor({ columns, setColumns, data, setData, className, privacyMode }: TableEditorProps) {
  /* Rename Modal State */
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; oldName: string; newName: string; error?: string } | null>(null);

  /* Delete Confirmation State */
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; column: string } | null>(null);

  /* Refs */
  const modalInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const dataBeforeDelete = [...data];
      newData.splice(index, 1);
      setData(newData);
      toast.success(`Row ${index + 1} deleted`, {
          action: {
              label: "Undo",
              onClick: () => {
                  const restored = [...dataBeforeDelete];
                  setData(restored);
              }
          },
          duration: 4000,
      });
  };

  const { spreadsheetData, errorCount } = useMemo(() => {
    let errors = 0;
    const matrix = data.map((row) => {
      const rowData = columns.map((col) => {
        const val = row[col] || "";
        const trimmedVal = val.trim();
        let className = cn(
            "outline-none transition-all duration-200",
            privacyMode && "blur-[5px] hover:blur-none select-none"
        );
        
        if (col === "EMAIL" && trimmedVal && !EMAIL_REGEX.test(trimmedVal)) {
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
    return { spreadsheetData: matrix as Matrix<any>, errorCount: errors };
  }, [data, columns, privacyMode]);

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
    while(columns.some(c => c.toUpperCase() === name.toUpperCase())) {
        name = `${baseName}_${counter++}`;
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
    if (col === "EMAIL") return;
    setDeleteConfirm({ isOpen: true, column: col });
  };
  
  const handleRenameSubmit = (e?: React.FormEvent) => {
      e?.preventDefault();
      if(!renameModal) return;
      
      const { oldName, newName } = renameModal;
      const trimmed = newName.trim().toUpperCase();
      
      if (oldName.toUpperCase() === "EMAIL") {
          setRenameModal(prev => prev ? { ...prev, error: "EMAIL column cannot be renamed" } : null);
          return;
      }

      if (!trimmed) {
          setRenameModal(prev => prev ? { ...prev, error: "Column name cannot be empty" } : null);
          return;
      }

      // Allow only digits, alphabets, and underscores
      if (!/^[A-Z0-9_]+$/.test(trimmed)) {
          setRenameModal(prev => prev ? { ...prev, error: "Only letters, numbers, and underscores are allowed" } : null);
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
          const newCols = columns.map(c => c.toUpperCase() === oldName.toUpperCase() ? trimmed : c);
          const newData = data.map(r => {
               const val = r[oldName] || r[oldName.toUpperCase()] || "";
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

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processCsvText = (text: string) => {
    try {
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) {
        toast.error("Empty CSV file", { description: "The imported file contains no header row." });
        return;
      }
      setResetting(true);
      setTimeout(() => {
        setColumns(headers);
        setData(rows);
        setResetting(false);
        toast.success("CSV imported successfully", {
          description: `Loaded ${rows.length} contact${rows.length !== 1 ? 's' : ''} across ${headers.length} column${headers.length !== 1 ? 's' : ''}.`
        });
      }, 20);
    } catch {
      toast.error("Failed to parse CSV", { description: "Please ensure the file is a valid CSV format." });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCsvText(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text) processCsvText(text);
        };
        reader.readAsText(file);
      } else {
        toast.error("Please drop a valid .csv file");
      }
    }
  };

  const handleExportCsv = () => {
    if (data.length === 0) {
      toast.info("No data to export", { description: "Add at least one recipient row to export." });
      return;
    }
    const csvContent = exportCsv(columns, data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mailer-recipients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Contacts exported to CSV");
  };

  const duplicateCount = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0;
    data.forEach(row => {
      const email = (row.EMAIL || "").trim().toLowerCase();
      if (email) {
        if (seen.has(email)) {
          duplicates++;
        } else {
          seen.add(email);
        }
      }
    });
    return duplicates;
  }, [data]);

  const removeDuplicates = () => {
    if (duplicateCount === 0) return;
    const seen = new Set<string>();
    const deduplicatedData: Record<string, string>[] = [];
    data.forEach(row => {
      const email = (row.EMAIL || "").trim().toLowerCase();
      if (!email || !seen.has(email)) {
        if (email) seen.add(email);
        deduplicatedData.push(row);
      }
    });
    const removed = data.length - deduplicatedData.length;
    setResetting(true);
    setTimeout(() => {
      setData(deduplicatedData);
      setResetting(false);
      toast.success("Duplicates removed", {
        description: `Removed ${removed} duplicate contact${removed !== 1 ? 's' : ''}.`
      });
    }, 20);
  };

  const addRow = () => {
      const row: Record<string, string> = {};
      columns.forEach(c => row[c] = "");
      setData([...data, row]);
  };
  
  const clearAll = () => {
      setData([]);
      setColumns(["EMAIL"]);
  };

  const ColumnHeader = ({ label }: { label: string }) => {
      
      const isProtected = label === "EMAIL";
      
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
                title={`Delete row ${index + 1} (Undo available)`}
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
                                placeholder="COLUMN_NAME"
                           />
                           {renameModal.error && (
                               <span className="text-[10px] text-destructive mt-1 block">{renameModal.error}</span>
                           )}
                       </div>
                       <div className="flex justify-end gap-2 pt-1">
                           <button 
                                type="button" 
                                onClick={() => setRenameModal(null)}
                                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                           >
                               Cancel
                           </button>
                           <button 
                                type="submit" 
                                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                           >
                               Save
                           </button>
                       </div>
                   </form>
               </div>
          </div>
      )}

      {/* Delete Column Confirmation Modal */}
      {deleteConfirm?.isOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
               <div className="bg-popover border border-destructive/30 p-4 rounded-lg shadow-2xl w-[320px] animate-in fade-in zoom-in-95 duration-200">
                   <h3 className="text-xs font-semibold text-destructive mb-2 uppercase tracking-wide flex items-center gap-1.5">
                       <AlertTriangle size={14} /> Delete Column &ldquo;{deleteConfirm.column}&rdquo;
                   </h3>
                   <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                       This will permanently delete this column and discard all values stored in it across all {data.length} row(s).
                   </p>
                   <div className="flex justify-end gap-2">
                       <button 
                            type="button" 
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                       >
                           Cancel
                       </button>
                       <button 
                            onClick={confirmDeleteColumn}
                            className="px-3 py-1.5 text-xs font-semibold bg-red-950/30 text-red-400 border border-red-500/20 rounded hover:bg-red-950/50 hover:border-red-500/30 transition-all shadow-lg shadow-red-900/10"
                       >
                           Delete Column
                       </button>
                   </div>
               </div>
          </div>
      )}

      {/* Main Table Container */}
      <div className="flex flex-col border border-border rounded-lg bg-background overflow-hidden shadow-sm">
         
          {/* Top Toolbar / Status Area */}
          <div className="min-h-[36px] border-b border-border flex flex-wrap items-center justify-between px-3 py-1.5 bg-muted/30 text-xs font-mono text-muted-foreground gap-2">
             <div className="flex items-center gap-1.5">
                 {/* Hidden File Input for CSV Upload */}
                 <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".csv,text/csv" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-sans px-2.5 py-1 rounded bg-background border border-border text-foreground hover:bg-muted/80 transition-colors"
                    title="Import contacts from a CSV file"
                 >
                    <Upload size={12} className="text-indigo-400" />
                    <span>Import CSV</span>
                 </button>

                 {data.length > 0 && (
                     <button 
                        onClick={handleExportCsv}
                        className="flex items-center gap-1 text-[11px] font-sans px-2.5 py-1 rounded bg-background border border-border text-foreground hover:bg-muted/80 transition-colors"
                        title="Download current table as CSV"
                     >
                        <Download size={12} className="text-emerald-400" />
                        <span>Export CSV</span>
                     </button>
                 )}

                 {duplicateCount > 0 && (
                     <button 
                        onClick={removeDuplicates}
                        className="flex items-center gap-1 text-[11px] font-sans px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors shadow-sm"
                        title={`Found ${duplicateCount} duplicate email(s). Click to remove.`}
                     >
                        <AlertTriangle size={11} className="text-amber-400" />
                        <span>Remove {duplicateCount} Duplicate{duplicateCount !== 1 ? 's' : ''}</span>
                     </button>
                 )}
             </div>

             <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground ml-auto">
                 <span>{data.length} {data.length === 1 ? 'Contact' : 'Contacts'}</span>
                 <span className="w-px h-3 bg-border" />
                 <span>{columns.length} {columns.length === 1 ? 'Column' : 'Columns'}</span>
             </div>
          </div>

          {/* Spreadsheet View / Dropzone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative overflow-auto max-h-[60vh] excel-wrapper text-sm bg-background transition-all",
              isDraggingOver && "ring-2 ring-indigo-500 bg-indigo-500/5"
            )}
          >
              {isDraggingOver && (
                <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-indigo-200 border-2 border-dashed border-indigo-400 rounded-lg pointer-events-none animate-in fade-in duration-200">
                  <Upload size={32} className="text-indigo-400 animate-bounce mb-2" />
                  <p className="text-sm font-semibold">Drop CSV file here to import</p>
                  <p className="text-xs text-indigo-300/70">Headers and contact rows will be loaded automatically</p>
                </div>
              )}
              {resetting ? (
                  <div className="w-full h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span className="text-xs">Updating table...</span>
                  </div>
              ) : data.length === 0 ? (
                  <div className="w-full flex flex-col">
                      {/* Column Headers on 0 Rows */}
                      <div className="flex border-b border-border bg-background sticky top-0 z-10">
                          <div className="w-10 min-w-[40px] max-w-[40px] h-[38px] flex items-center justify-center border-r border-border text-xs font-mono text-muted-foreground bg-background sticky left-0 z-20">
                              #
                          </div>
                          {columns.map((c) => (
                              <div key={c} className="min-w-[160px] flex-1 h-[38px] border-r border-border bg-background">
                                  <ColumnHeader label={c} />
                              </div>
                          ))}
                      </div>
                      {/* Empty State Message */}
                      <div className="py-10 px-4 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-muted/5 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">No recipients added yet</p>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Import your contacts from a CSV file or click "Add Row" below.</p>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center">
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-background text-foreground border border-border hover:bg-muted transition-all shadow-sm cursor-pointer"
                              >
                                <Upload size={13} className="text-indigo-400" />
                                <span>Import CSV File</span>
                              </button>
                          </div>
                      </div>
                  </div>
              ) : (
                  <Spreadsheet 
                     key={`${columns.join(',')}-${data.length}`} 
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
          
          {/* Bottom Action Bar: Add Row & Add Column */}
          <div className="grid grid-cols-2 divide-x divide-border/50 border-t border-border/50 bg-muted/20">
              <button 
                 onClick={addRow} 
                 className="h-9 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all select-none cursor-pointer"
                 title="Add a new recipient row"
                 aria-label="Add a new row"
              >
                  <Plus size={12} />
                  <span>Add Row</span>
              </button>
              <button 
                 onClick={addColumn} 
                 className="h-9 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all select-none cursor-pointer"
                 title="Add a new column"
                 aria-label="Add a new column"
              >
                  <Plus size={12} />
                  <span>Add Column</span>
              </button>
          </div>
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
    </div>
  );
}
