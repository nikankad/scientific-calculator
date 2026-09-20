import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }) { return <span className={cn(badgeVariants({ variant }), className)} {...props} /> }

export { Badge, badgeVariants }
