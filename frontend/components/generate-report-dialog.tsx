"use client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { FileJson, FileText, FileSpreadsheet } from "lucide-react"

const formSchema = z.object({
  format: z.enum(["json", "csv", "pdf"]),
})

type ReportFormValues = z.infer<typeof formSchema>

interface GenerateReportDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (format: string) => void
  scan: any
}

export function GenerateReportDialog({ isOpen, onClose, onConfirm, scan }: GenerateReportDialogProps) {
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      format: "json",
    },
  })

  const handleSubmit = (values: ReportFormValues) => {
    onConfirm(values.format)
  }

  if (!scan) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>Select a format for the report for scan &quot;{scan.name}&quot;.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-3"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <RadioGroupItem value="json" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center">
                          <FileJson className="mr-2 h-5 w-5" />
                          JSON
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <RadioGroupItem value="csv" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center">
                          <FileSpreadsheet className="mr-2 h-5 w-5" />
                          CSV
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <RadioGroupItem value="pdf" />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center">
                          <FileText className="mr-2 h-5 w-5" />
                          PDF
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Generate</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
