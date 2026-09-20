import { cn } from '@/lib/utils'

function Card({ className, ...props }) { return <div className={cn('flex flex-col gap-6 rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...props} /> }
function CardHeader({ className, ...props }) { return <div className={cn('grid gap-1.5 px-6 pt-6', className)} {...props} /> }
function CardTitle({ className, ...props }) { return <div className={cn('font-semibold leading-none tracking-tight', className)} {...props} /> }
function CardDescription({ className, ...props }) { return <div className={cn('text-sm text-muted-foreground', className)} {...props} /> }
function CardContent({ className, ...props }) { return <div className={cn('px-6 pb-6', className)} {...props} /> }
function CardFooter({ className, ...props }) { return <div className={cn('flex items-center px-6 pb-6', className)} {...props} /> }

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
