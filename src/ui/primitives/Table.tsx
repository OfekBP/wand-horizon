import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'right'
  sort?: (a: T, b: T) => number
  width?: string
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  empty?: ReactNode
  label: string
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, selectedKey, empty, label }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key)
    if (!col?.sort || !sort) return rows
    const cmp = col.sort
    return [...rows].sort((a, b) => cmp(a, b) * sort.dir)
  }, [rows, columns, sort])

  return (
    <div className="table-wrap">
      <table className="table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                data-col={c.key}
                className={c.align === 'right' ? 'right' : ''}
                style={c.width ? { width: c.width } : undefined}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
              >
                {c.sort ? (
                  <button onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))}>
                    {c.header}
                    <span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row)
            return (
              <tr
                key={key}
                className={[onRowClick ? 'is-clickable' : '', selectedKey === key ? 'is-selected' : ''].join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c, i) => (
                  <td key={c.key} data-col={c.key} className={c.align === 'right' ? 'right num' : ''}>
                    {/* the first cell holds a real button so keyboard and screen-reader users can open the row */}
                    {onRowClick && i === 0 ? (
                      <button
                        className="cell-link"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRowClick(row)
                        }}
                      >
                        {c.render(row)}
                      </button>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="table__empty">{empty ?? 'Nothing to show.'}</div>}
    </div>
  )
}
