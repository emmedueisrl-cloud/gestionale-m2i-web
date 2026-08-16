import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

export default function DataTable({ 
  columns, 
  data, 
  searchPlaceholder = "Cerca...",
  itemsPerPage = 10,
  pagination = true,
  tableId = "",
  nowrap = true,
  tableClassName = "text-sm",
  selectable = false,
  selectedRows = [],
  onSelectionChange = null
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const getInitialSort = () => {
    try {
      const saved = localStorage.getItem(`dataTable_sort_${window.location.pathname}_${tableId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return { key: null, direction: 'asc' };
  };

  const [sortConfig, setSortConfig] = useState(getInitialSort);

  useEffect(() => {
    try {
      localStorage.setItem(`dataTable_sort_${window.location.pathname}_${tableId}`, JSON.stringify(sortConfig));
    } catch (e) {
      console.error(e);
    }
  }, [sortConfig, tableId]);

  // 1. Gestione Ricerca
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(item => {
      // Controlla tutte le colonne che hanno un accessor
      return columns.some(col => {
        if (!col.accessor) return false;
        const value = item[col.accessor];
        return value !== null && value !== undefined && String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, columns]);

  // 2. Gestione Ordinamento
  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  // 3. Paginazione
  const totalPages = pagination ? (Math.ceil(sortedData.length / itemsPerPage) || 1) : 1;
  const currentData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, pagination]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const allIds = filteredData.map(row => row.id).filter(id => id);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (e, rowId) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange([...selectedRows, rowId]);
    } else {
      onSelectionChange(selectedRows.filter(id => id !== rowId));
    }
  };

  const isAllSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;

  return (
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden flex flex-col h-full animate-in fade-in duration-300">
      
      {/* Header Tabella (Search) */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // reset pagina
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all bg-slate-800"
          />
        </div>
        <div className="text-sm text-slate-400 font-medium">
          {filteredData.length} risultati {selectable && selectedRows.length > 0 && `(${selectedRows.length} selezionati)`}
        </div>
      </div>

      {/* Corpo Tabella */}
      <div className="overflow-x-auto flex-1">
        <table className={`w-full text-left ${tableClassName} ${nowrap ? 'whitespace-nowrap' : ''}`}>
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700">
              {selectable && (
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-6 py-4 ${col.sortable !== false && col.accessor ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''} ${col.className || ''}`}
                  onClick={() => {
                    if (col.sortable !== false && col.accessor) {
                      requestSort(col.accessor);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable !== false && col.accessor && (
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === col.accessor ? 'text-indigo-500' : 'text-slate-300'}`} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentData.length > 0 ? (
              currentData.map((row, rowIndex) => (
                <tr key={row.id || rowIndex} className={`hover:bg-indigo-500/20 transition-colors ${selectedRows.includes(row.id) ? 'bg-indigo-500/10' : ''}`}>
                  {selectable && (
                    <td className="px-6 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900" 
                        checked={selectedRows.includes(row.id)}
                        onChange={(e) => handleSelectRow(e, row.id)}
                      />
                    </td>
                  )}
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className={`px-6 py-3 text-slate-200 ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                  Nessun dato trovato corrispondente alla ricerca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Tabella (Pagination) */}
      {pagination && (
        <div className="p-4 border-t border-slate-700 flex items-center justify-between bg-slate-900/50 text-sm">
          <span className="text-slate-400">
            Pagina <span className="font-semibold text-slate-200">{currentPage}</span> di {totalPages}
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-600 bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-600 bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}
