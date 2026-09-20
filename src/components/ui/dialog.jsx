import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
function DialogContent({ className, children, ...props }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
    <DialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-white/10 bg-popover p-6 shadow-2xl outline-none', className)} {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"><X className="size-4" /><span className="sr-only">Close</span></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
function DialogHeader({ className, ...props }) { return <div className={cn('flex flex-col gap-2', className)} {...props} /> }
function DialogTitle({ className, ...props }) { return <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} /> }
function DialogDescription({ className, ...props }) { return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} /> }

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription }
