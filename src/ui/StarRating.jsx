import { StarIcon } from '@phosphor-icons/react'

export function StarRating({ value = 0, onChange, size = 22 }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className="text-amber-400 transition-transform active:scale-90"
        >
          <StarIcon size={size} weight={n <= value ? 'fill' : 'regular'} className={n <= value ? '' : 'text-ink-3'} />
        </button>
      ))}
    </div>
  )
}
