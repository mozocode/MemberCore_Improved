import { useState, useRef, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchableSelectProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Max number of suggestions to show (e.g. 8 for directory sport field) */
  maxVisible?: number
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  disabled,
  className,
  maxVisible,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const visibleOptions = maxVisible != null ? filteredOptions.slice(0, maxVisible) : filteredOptions

  const resetAndClose = useCallback(() => {
    setSearchQuery('')
    setHighlightedIndex(0)
    setIsOpen(false)
    inputRef.current?.blur()
  }, [])

  const selectOption = useCallback(
    (option: string) => {
      onChange(option)
      resetAndClose()
    },
    [onChange, resetAndClose],
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen, visibleOptions.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
        setSearchQuery('')
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (visibleOptions[highlightedIndex]) {
          selectOption(visibleOptions[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        resetAndClose()
        break
    }
  }

  const displayValue = isOpen ? searchQuery : value

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!isOpen && !!value}
          className={cn(
            'w-full h-11 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 pr-10',
            'text-white placeholder:text-zinc-500',
            'focus:outline-none focus:border-zinc-500',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
              setSearchQuery('')
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg max-h-60 overflow-y-auto shadow-lg"
        >
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option, index) => (
              <button
                key={option}
                type="button"
                data-index={index}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'w-full text-left px-4 py-3 min-h-[44px] text-white hover:bg-zinc-800 transition-colors',
                  value === option && 'bg-zinc-800',
                  highlightedIndex === index && 'bg-zinc-800',
                )}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-zinc-500">No matches found</div>
          )}
        </div>
      )}
    </div>
  )
}
