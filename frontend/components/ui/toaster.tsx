"use client"

import { useToast } from "@/components/ui/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const getIcon = () => {
          if (props.variant === "success") return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
          if (props.variant === "error") return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
          if (props.variant === "destructive") return <AlertCircle className="h-5 w-5 text-white" />;
          return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
        };

        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon()}</div>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
