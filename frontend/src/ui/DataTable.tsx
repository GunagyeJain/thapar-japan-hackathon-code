// Dense table: 36 px rows, sticky header, click a header to sort, click a row to open it.
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { EmptyState } from "@/ui/EmptyState"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table"

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Value to sort by; the column is sortable when given. */
  sortValue?: (row: T) => string | number
  align?: "left" | "right"
  className?: string
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  rowClassName?: (row: T) => string | undefined
  empty?: ReactNode
  isLoading?: boolean
  maxHeight?: number
  className?: string
}

type Sort = { key: string; dir: "asc" | "desc" } | null

const SKELETON_ROWS = 6

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  rowClassName,
  empty,
  isLoading = false,
  maxHeight,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const value = col.sortValue
    const dir = sort.dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => (value(a) < value(b) ? -dir : value(a) > value(b) ? dir : 0))
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null))

  if (!isLoading && rows.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>
  }

  return (
    <div className={cn("overflow-auto rounded-xl border bg-card", className)} style={maxHeight ? { maxHeight } : undefined}>
      <Table>
        <TableHeader className="z-10">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => {
              const active = sort?.key === c.key
              const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
              return (
                <TableHead
                  key={c.key}
                  className={cn(c.align === "right" && "text-right", c.className)}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.header}
                      <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden="true" />
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <span className="block h-3 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : sorted.map((row) => {
                const key = rowKey(row)
                return (
                  <TableRow
                    key={key}
                    data-state={key === selectedKey ? "selected" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn(c.align === "right" && "text-right", c.className)}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
    </div>
  )
}
