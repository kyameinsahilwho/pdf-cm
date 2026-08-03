import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { fetchTools } from './api/tools'
import { CATEGORIES, type CategoryId, type ToolDef } from './data/tools'

const columnHelper = createColumnHelper<ToolDef>()

const columns = [
  columnHelper.accessor('name', {
    header: 'Tool',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('badge', {
    header: 'Badge',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('accept', {
    header: 'Accepted files',
    cell: (info) => info.getValue() ?? 'Any',
  }),
  columnHelper.accessor('slug', {
    header: 'Slug',
    cell: (info) => info.getValue(),
  }),
]

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['tools'],
    queryFn: fetchTools,
  })

  const filteredTools = useMemo(() => {
    return data.filter((tool) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.desc.toLowerCase().includes(query) ||
        tool.slug.toLowerCase().includes(query)

      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [data, searchQuery, activeCategory])

  const table = useReactTable({
    data: filteredTools,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <main className="container">
      <header className="header">
        <p className="eyebrow">TanStack Port</p>
        <h1>PDF CM tools powered by TanStack Query and TanStack Table</h1>
        <p className="subtext">
          Vite + React + TypeScript rebuild under <code>/tanstack</code> with client-side query and tabular exploration.
        </p>
      </header>

      <section className="controls">
        <input
          className="search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name, description, or slug"
        />
        <div className="chips">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={activeCategory === category.id ? 'chip chip-active' : 'chip'}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="table-wrap">
        {isLoading ? <p>Loading tools…</p> : null}
        {isError ? <p>Failed to load tools.</p> : null}

        {!isLoading && !isError ? (
          <>
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            className="sort-button"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="sort-icon">
                              {header.column.getIsSorted() === 'asc'
                                ? '↑'
                                : header.column.getIsSorted() === 'desc'
                                  ? '↓'
                                  : '↕'}
                            </span>
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="empty">
                      No tools match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <footer className="pagination">
              <span>
                Showing {table.getRowModel().rows.length} of {filteredTools.length} tools
              </span>
              <div className="pagination-buttons">
                <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  Previous
                </button>
                <span>
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </span>
                <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  Next
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default App
