// @ts-nocheck — vendored shadcn/ui component, not maintained against checkJs
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {/* `open`/`onOpenChange` are store bookkeeping, not DOM attrs — pull them
          out so they aren't spread onto the div. `data-state` drives the
          open/close animation. */}
      {toasts.map(function ({ id, title, description, action, open, onOpenChange, ...props }) {
        return (
          <Toast key={id} data-state={open ? "open" : "closed"} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 
