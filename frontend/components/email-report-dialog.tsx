"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { formatToBucharestTime, formatToBucharestTimeSingleLine } from "@/lib/timezone"

interface EmailReportDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (emailData: EmailData) => Promise<void>
  report: any
}

export interface EmailData {
  to: string
  subject: string
  message: string
}

export function EmailReportDialog({ isOpen, onClose, onConfirm, report }: EmailReportDialogProps) {
  const [emailData, setEmailData] = useState<EmailData>({
    to: "",
    subject: "",
    message: ""
  })
  const [errors, setErrors] = useState<Partial<EmailData>>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<EmailData> = {}

    if (!emailData.to.trim()) {
      newErrors.to = "Recipient email is required"
    } else if (!validateEmail(emailData.to.trim())) {
      newErrors.to = "Please enter a valid email address"
    }

    if (!emailData.subject.trim()) {
      newErrors.subject = "Subject is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      await onConfirm({
        to: emailData.to.trim(),
        subject: emailData.subject.trim(),
        message: emailData.message.trim()
      })
      
      // Reset form
      setEmailData({
        to: "",
        subject: "",
        message: ""
      })
      setErrors({})
      onClose()
    } catch (error) {
      console.error("Error sending email:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setEmailData({
        to: "",
        subject: "",
        message: ""
      })
      setErrors({})
      onClose()
    }
  }

  // Set default subject when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && report && !emailData.subject) {
      setEmailData(prev => ({
        ...prev,
        subject: `Security Scan Report: ${report.name}`
      }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Report via Email
          </DialogTitle>
          <DialogDescription>
            Send the "{report?.name}" report to someone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email-to">To Email Address *</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="recipient@example.com"
              value={emailData.to}
              onChange={(e) => {
                setEmailData(prev => ({ ...prev, to: e.target.value }))
                if (errors.to) {
                  setErrors(prev => ({ ...prev, to: undefined }))
                }
              }}
              className={errors.to ? "border-red-500 focus-visible:ring-red-500" : ""}
              disabled={isLoading}
            />
            {errors.to && (
              <p className="text-sm text-red-500">{errors.to}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              placeholder="Email subject"
              value={emailData.subject}
              onChange={(e) => {
                setEmailData(prev => ({ ...prev, subject: e.target.value }))
                if (errors.subject) {
                  setErrors(prev => ({ ...prev, subject: undefined }))
                }
              }}
              className={errors.subject ? "border-red-500 focus-visible:ring-red-500" : ""}
              disabled={isLoading}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email-message">Message (Optional)</Label>
            <Textarea
              id="email-message"
              placeholder="Add a custom message..."
              value={emailData.message}
              onChange={(e) => {
                setEmailData(prev => ({ ...prev, message: e.target.value }))
              }}
              className="min-h-[100px]"
              disabled={isLoading}
            />
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Report Details:</strong><br />
              Format: {report?.type?.toUpperCase()}<br />
              Generated on: {formatToBucharestTimeSingleLine(report?.created_at)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !emailData.to.trim() || !emailData.subject.trim()}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 