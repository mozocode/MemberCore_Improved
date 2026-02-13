import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { ORG_TYPE_GROUPS } from '@/lib/orgTypes'
import { cn } from '@/lib/utils'

interface GroupedOrgTypeSelectProps {
  value: string
  onChange: (type: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

export function GroupedOrgTypeSelect({
  value,
  onChange,
  required,
  disabled,
  className,
}: GroupedOrgTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-sm',
          'hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={value ? 'text-white' : 'text-zinc-500'}>
          {value || 'Select the option that best describes your organization.'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-zinc-400 shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-hidden rounded-t-2xl bg-zinc-900 border border-zinc-700 border-b-0 sm:rounded-2xl sm:border-b">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div>
                <h3 className="font-semibold text-white">
                  Organization Type {required && <span className="text-destructive">*</span>}
                </h3>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Select the option that best describes your organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-4">
              {ORG_TYPE_GROUPS.map((group) => (
                <div key={group.category}>
                  <div className="mb-2">
                    <p className="font-medium text-white">{group.category}</p>
                    <p className="text-xs text-zinc-500">({group.subtitle})</p>
                  </div>
                  <div className="space-y-1">
                    {group.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          onChange(opt)
                          setOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-4 py-3 rounded-lg text-sm transition-colors',
                          value === opt
                            ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/50'
                            : 'text-zinc-300 hover:bg-zinc-800 border border-transparent',
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden input for form validation */}
      <input
        id="org-type"
        type="text"
        value={value}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        aria-hidden
      />
    </div>
  )
}
