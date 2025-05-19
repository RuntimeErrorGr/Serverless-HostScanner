"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Upload } from "lucide-react"

// Validation schema for the form
const formSchema = z.object({
  targets: z.string().min(1, {
    message: "At least one target is required.",
  }),
  scanType: z.enum(["default", "deep", "custom"]),
  portTypes: z.array(z.string()).optional(),
  tcpPorts: z.string().optional(),
  udpPorts: z.string().optional(),
  options: z.array(z.string()).optional(),
  timing: z.string().optional(),
})

type ScanFormValues = z.infer<typeof formSchema>

// Default values for the form
const defaultValues: Partial<ScanFormValues> = {
  targets: "",
  scanType: "default",
  portTypes: [],
  tcpPorts: "",
  udpPorts: "",
  options: [],
  timing: "T3",
}

interface StartScanModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: ScanFormValues) => void
}

export function StartScanModal({ isOpen, onClose, onSubmit }: StartScanModalProps) {
  const [isCustom, setIsCustom] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ScanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      // Split by newlines or commas and filter out empty strings
      const targets = content
        .split(/[\n,]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .join(", ")

      form.setValue("targets", targets)
    }
    reader.readAsText(file)
  }

  const handleScanTypeChange = (value: string) => {
    if (value === "custom") {
      setIsCustom(true)
    } else {
      setIsCustom(false)
    }
  }

  const handleSubmit = (values: ScanFormValues) => {
    onSubmit(values)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start New Scan</DialogTitle>
          <DialogDescription>Configure your scan settings and targets</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="targets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Targets</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter targets (hostnames, URLs, IP addresses, ranges, or CIDR format)"
                        className="min-h-[100px]"
                        {...field}
                      />
                      <div className="flex items-center">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Targets File
                        </Button>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Enter targets separated by commas. Supports hostnames, URLs, IP addresses, ranges (e.g.,
                    90.8.10-100), or CIDR format.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Scan Options</h3>

              <FormField
                control={form.control}
                name="scanType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Scan Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value)
                          handleScanTypeChange(value)
                        }}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="default" />
                          </FormControl>
                          <FormLabel className="font-normal">Default</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="deep" />
                          </FormControl>
                          <FormLabel className="font-normal">Deep</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="custom" />
                          </FormControl>
                          <FormLabel className="font-normal">Custom</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCustom && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Custom Scan Configuration</h4>

                  <Tabs defaultValue="ports">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="ports">Ports</TabsTrigger>
                      <TabsTrigger value="detection">Detection</TabsTrigger>
                      <TabsTrigger value="timing">Timing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ports" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="portTypes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port Types</FormLabel>
                            <div className="flex flex-col space-y-2">
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("tcp")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "tcp"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "tcp"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">TCP</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("udp")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "udp"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "udp"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">UDP</FormLabel>
                              </FormItem>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tcpPorts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>TCP Ports</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 80,443,8080 or 1-1000"
                                {...field}
                                disabled={!form.watch("portTypes")?.includes("tcp")}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter specific ports (comma-separated) or ranges (e.g., 80-100)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="udpPorts"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UDP Ports</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 53,123,161 or 1-1000"
                                {...field}
                                disabled={!form.watch("portTypes")?.includes("udp")}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter specific ports (comma-separated) or ranges (e.g., 80-100)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="detection" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="options"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detection Options</FormLabel>
                            <div className="grid grid-cols-2 gap-2">
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("os-detection")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "os-detection"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "os-detection"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">OS Detection</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("version-detection")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "version-detection"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "version-detection"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">Version Detection</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("script-scan")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "script-scan"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "script-scan"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">Script Scan</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("traceroute")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "traceroute"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "traceroute"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">Traceroute</FormLabel>
                              </FormItem>
                            </div>
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="timing" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="timing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timing Template</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-3 gap-2"
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T0" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T0 (Paranoid)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T1" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T1 (Sneaky)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T2" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T2 (Polite)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T3" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T3 (Normal)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T4" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T4 (Aggressive)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="T5" />
                                  </FormControl>
                                  <FormLabel className="font-normal">T5 (Insane)</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormDescription>
                              Higher timing templates are faster but more likely to be detected
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Start Scan</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
