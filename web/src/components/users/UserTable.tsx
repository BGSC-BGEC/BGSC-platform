import React, { useId, useMemo, useState } from "react"
import {
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  X,
  UserCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { User, UserStatus } from "@/types/user"
import type { UserRole } from "@/types/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface UserTableProps {
  users: User[]
  onViewUser: (user: User) => void
  onExportSelected?: (selectedUsers: User[]) => void
}

const ROLE_BADGES: Record<UserRole, { label: string; className: string }> = {
  founder: {
    label: "Founder",
    className: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  },
  coordinator: {
    label: "Coordinator",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  core: {
    label: "Core",
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  },
  member: {
    label: "Member",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  user: {
    label: "User",
    className: "bg-muted text-muted-foreground border-border",
  },
  guest: {
    label: "Guest",
    className: "bg-muted text-muted-foreground border-border",
  },
}

const STATUS_BADGES: Record<
  UserStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  active: {
    label: "Active",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  pending: {
    label: "Pending",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  suspended: {
    label: "Suspended",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  inactive: {
    label: "Inactive",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-500/15 text-muted-foreground border-border",
  },
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onViewUser,
  onExportSelected,
}) => {
  const selectId = useId()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "name",
      desc: false,
    },
  ])

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 32,
        enableSorting: false,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Member",
        cell: ({ row }) => {
          const user = row.original
          const initials = getInitials(user.name)
          return (
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20"
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">
                  {user.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  @{user.username}
                </div>
              </div>
            </div>
          )
        },
        size: 200,
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="truncate text-foreground/90 font-mono text-xs">
            {row.getValue("email") || "—"}
          </div>
        ),
        size: 190,
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.getValue("role") as UserRole
          const config = ROLE_BADGES[role] ?? {
            label: role,
            className: "bg-muted text-muted-foreground border-border",
          }
          return (
            <Badge variant="outline" className={cn("capitalize font-medium text-xs", config.className)}>
              {config.label}
            </Badge>
          )
        },
        size: 130,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as UserStatus
          const config = STATUS_BADGES[status] ?? {
            label: status,
            dotClass: "bg-slate-400",
            badgeClass: "bg-slate-500/15 text-muted-foreground border-border",
          }
          return (
            <Badge
              variant="outline"
              className={cn("inline-flex items-center gap-1.5 font-medium text-xs", config.badgeClass)}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
              {config.label}
            </Badge>
          )
        },
        size: 120,
      },
      {
        id: "pointsBalance",
        accessorKey: "pointsBalance",
        header: "Points",
        cell: ({ row }) => {
          const points = Number(row.getValue("pointsBalance")) || 0
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-foreground">
              <span>{new Intl.NumberFormat("en-US").format(points)}</span>
              <span className="text-[10px] tracking-wide text-muted-foreground font-sans uppercase">
                PTS
              </span>
            </div>
          )
        },
        size: 120,
      },
      {
        id: "joinDate",
        accessorKey: "joinDate",
        header: "Joined Date",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground tabular-nums">
            {row.getValue("joinDate") || "—"}
          </div>
        ),
        size: 120,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onViewUser(row.original)
              }}
              className="h-8 gap-1.5 px-3 text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </Button>
          </div>
        ),
        size: 90,
        enableSorting: false,
      },
    ],
    [onViewUser]
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const totalCount = users.length

  const handleExportSelectedRows = () => {
    if (onExportSelected && selectedCount > 0) {
      onExportSelected(selectedRows.map((r) => r.original))
    }
  }

  return (
    <div className="space-y-4">
      {/* Batch Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm transition-all animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {selectedCount} of {totalCount} member{selectedCount === 1 ? "" : "s"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onExportSelected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelectedRows}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                Export Selected ({selectedCount})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetRowSelection()}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Main TanStack Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="relative w-full overflow-x-auto">
          <Table className="w-full table-fixed min-w-[760px]">
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-border">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const isSorted = header.column.getIsSorted()

                    return (
                      <TableHead
                        key={header.id}
                        style={{ width: `${header.getSize()}px` }}
                        className="h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <div
                            className={cn(
                              "flex h-full cursor-pointer select-none items-center justify-between gap-2 hover:text-foreground transition-colors",
                              isSorted && "text-foreground font-bold"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                header.column.getToggleSortingHandler()?.(e)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Sort by ${header.column.id}`}
                          >
                            <span className="truncate">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {{
                              asc: (
                                <ChevronUp
                                  className="shrink-0 text-primary"
                                  size={16}
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                />
                              ),
                              desc: (
                                <ChevronDown
                                  className="shrink-0 text-primary"
                                  size={16}
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                />
                              ),
                            }[isSorted as string] ?? (
                              <ChevronDown
                                className="shrink-0 opacity-20 hover:opacity-60 transition-opacity"
                                size={14}
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "transition-colors hover:bg-muted/50 border-b border-border/60",
                      row.getIsSelected() && "bg-muted/70"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-3 text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                      <p className="text-sm font-medium text-foreground">
                        No members found
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your search or filter options.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
        {/* Results per page */}
        <div className="flex items-center gap-3">
          <Label htmlFor={selectId} className="text-xs text-muted-foreground whitespace-nowrap">
            Rows per page
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger id={selectId} className="h-8 w-[72px] text-xs">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent className="min-w-[72px]">
              {[5, 10, 25, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page counter & navigation */}
        <div className="flex items-center gap-6">
          <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums" aria-live="polite">
            <span className="font-semibold text-foreground">
              {users.length === 0
                ? 0
                : table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                  1}
              -
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                table.getRowCount()
              )}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {table.getRowCount().toString()}
            </span>
          </p>

          <Pagination className="mx-0 w-auto">
            <PaginationContent className="gap-1">
              {/* First page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to first page"
                >
                  <ChevronFirst size={15} strokeWidth={2} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Previous page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Next page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                </Button>
              </PaginationItem>
              {/* Last page button */}
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to last page"
                >
                  <ChevronLast size={15} strokeWidth={2} aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}
