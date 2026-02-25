import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";

type Row = Record<string, string>;
type DataRow = {
  rowNumber: number;
  values: Row;
};

type SortDirection = "asc" | "desc";

type SortState = {
  column: string;
  direction: SortDirection;
} | null;

const ALL_FILTER_VALUE = "";
const EMPTY_FILTER_VALUE = "__EMPTY__";
const VALUE_FILTER_PREFIX = "__VALUE__:";

const encodeFilterValue = (cellValue: string) =>
  cellValue === "" ? EMPTY_FILTER_VALUE : `${VALUE_FILTER_PREFIX}${cellValue}`;

const decodeFilterValue = (selectedValue: string): string | null => {
  if (selectedValue === ALL_FILTER_VALUE) {
    return null;
  }
  if (selectedValue === EMPTY_FILTER_VALUE) {
    return "";
  }
  if (selectedValue.startsWith(VALUE_FILTER_PREFIX)) {
    return selectedValue.slice(VALUE_FILTER_PREFIX.length);
  }
  return selectedValue;
};

function App() {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortState, setSortState] = useState<SortState>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

  const filterOptionsByColumn = useMemo(() => {
    const options: Record<string, string[]> = {};

    columns.forEach((column) => {
      const uniqueValues = new Set<string>();
      rows.forEach((row) => {
        uniqueValues.add(String(row.values[column] ?? ""));
      });
      options[column] = Array.from(uniqueValues).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    });

    return options;
  }, [rows, columns]);

  const filteredAndSortedRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      columns.every((column) => {
        const selectedFilterValue = filters[column] ?? ALL_FILTER_VALUE;
        const decodedFilterValue = decodeFilterValue(selectedFilterValue);

        if (decodedFilterValue === null) {
          return true;
        }

        const cellValue = String(row.values[column] ?? "");
        return cellValue === decodedFilterValue;
      })
    );

    if (!sortState) {
      return filtered;
    }

    const { column, direction } = sortState;
    return [...filtered].sort((a, b) => {
      const aValue = String(a.values[column] ?? "");
      const bValue = String(b.values[column] ?? "");
      const comparison = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: "base"
      });

      return direction === "asc" ? comparison : -comparison;
    });
  }, [rows, columns, filters, sortState]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setFileName(file.name);

    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError(result.errors[0].message);
          return;
        }

        const parsedRows = result.data.map((row, index) => {
          const normalized: Row = {};
          Object.entries(row).forEach(([key, value]) => {
            normalized[key] = String(value ?? "");
          });
          return {
            rowNumber: index + 1,
            values: normalized
          };
        });

        const detectedColumns = result.meta.fields ?? [];
        setColumns(detectedColumns);
        setRows(parsedRows);

        const initialFilters: Record<string, string> = {};
        detectedColumns.forEach((column) => {
          initialFilters[column] = "";
        });
        setFilters(initialFilters);
        setSortState(null);
      },
      error: (parseError) => {
        setError(parseError.message);
      }
    });
  };

  const toggleSort = (column: string) => {
    setSortState((current) => {
      if (!current || current.column !== column) {
        return { column, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { column, direction: "desc" };
      }

      return null;
    });
  };

  const updateFilter = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
  };

  const clearFilters = () => {
    setFilters((prev) =>
      Object.keys(prev).reduce<Record<string, string>>((acc, key) => {
        acc[key] = "";
        return acc;
      }, {})
    );
  };

  return (
    <main className="app-shell">
      <h1>CSVision</h1>
      <p className="subtitle">Upload a CSV, then sort and filter each column.</p>

      <section className="toolbar">
        <label className="upload-btn">
          <span>Select CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
        </label>
        <button type="button" onClick={clearFilters} disabled={columns.length === 0}>
          Clear Filters
        </button>
      </section>

      {fileName && <p className="file-meta">Loaded file: {fileName}</p>}
      {error && <p className="error">Could not parse CSV: {error}</p>}

      {columns.length > 0 ? (
        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="row-number-cell">#</th>
                {columns.map((column) => {
                  const direction =
                    sortState?.column === column ? (sortState.direction === "asc" ? " ↑" : " ↓") : "";
                  return (
                    <th key={column}>
                      <button type="button" className="sort-btn" onClick={() => toggleSort(column)}>
                        {column}
                        {direction}
                      </button>
                    </th>
                  );
                })}
              </tr>
              <tr>
                <th className="row-number-cell">Filter</th>
                {columns.map((column) => (
                  <th key={`${column}-filter`}>
                    <select
                      value={filters[column] ?? ""}
                      onChange={(event) => updateFilter(column, event.target.value)}
                    >
                      <option value="">All {column}</option>
                      {(filterOptionsByColumn[column] ?? []).map((value) => (
                        <option key={`${column}-${value}`} value={encodeFilterValue(value)}>
                          {value || "(empty)"}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRows.length > 0 ? (
                filteredAndSortedRows.map((row, rowIndex) => (
                  <tr key={`${row.rowNumber}-${columns.map((column) => row.values[column]).join("|")}`}>
                    <td className="row-number-cell">{row.rowNumber}</td>
                    {columns.map((column) => (
                      <td key={`${column}-${row.rowNumber}`}>{row.values[column]}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="empty-state">
                    No rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="row-count">
            Showing {filteredAndSortedRows.length} of {rows.length} rows
          </p>
        </section>
      ) : (
        <p className="empty-hint">No data yet. Upload a CSV to begin.</p>
      )}
    </main>
  );
}

export default App;
