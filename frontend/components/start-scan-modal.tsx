"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Upload, X } from "lucide-react"

// Port validation regex
const portRangeRegex = /^(?:\d{1,5}(?:-\d{1,5})?)?(?:,\d{1,5}(?:-\d{1,5})?)*$/;
const isValidPortRange = (value: string) => {
  if (!value) return true;
  if (!portRangeRegex.test(value)) return false;
  
  // Check that all ports are within valid range (1-65535)
  const segments = value.split(',');
  return segments.every(segment => {
    if (segment.includes('-')) {
      const [start, end] = segment.split('-').map(Number);
      return start >= 1 && start <= 65535 && end >= 1 && end <= 65535 && start <= end;
    } else {
      const port = Number(segment);
      return port >= 1 && port <= 65535;
    }
  });
};

// Custom error message for port validation
const getPortValidationError = () => {
  return "Ports must be comma-separated numbers or ranges (e.g., 80,443,1000-2000) between 1-65535";
};

// Validation schema for the form
const formSchema = z.object({
  targets: z.string().min(1, {
    message: "At least one target is required.",
  }),
  scanType: z.enum(["default", "deep", "custom"]),
  portTypes: z.array(z.string()).min(1, {
    message: "At least one port type must be selected."
  }),
  tcpPorts: z.string().optional()
    .refine(val => !val || isValidPortRange(val), { message: getPortValidationError() }),
  udpPorts: z.string().optional()
    .refine(val => !val || isValidPortRange(val), { message: getPortValidationError() }),
  tcpTopPorts: z.string().optional(),
  udpTopPorts: z.string().optional(),
  detectionTechnique: z.string().optional(),
  hostDiscoveryProbes: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  timing: z.string().optional(),
}).refine((data) => {
  // Validate that if TCP is selected, either tcpPorts or tcpTopPorts is specified
  if (data.portTypes.includes('tcp') && data.scanType === 'custom') {
    return !!data.tcpPorts || !!data.tcpTopPorts;
  }
  return true;
}, {
  message: "TCP ports must be specified when TCP is selected",
  path: ["tcpPorts"]
}).refine((data) => {
  // Validate that if UDP is selected, either udpPorts or udpTopPorts is specified
  if (data.portTypes.includes('udp') && data.scanType === 'custom') {
    return !!data.udpPorts || !!data.udpTopPorts;
  }
  return true;
}, {
  message: "UDP ports must be specified when UDP is selected",
  path: ["udpPorts"]
});

type ScanFormValues = z.infer<typeof formSchema>

// Default values for the form
const defaultValues: Partial<ScanFormValues> = {
  targets: "",
  scanType: "default",
  portTypes: [],
  tcpPorts: "",
  udpPorts: "",
  tcpTopPorts: "",
  udpTopPorts: "",
  detectionTechnique: "syn",
  hostDiscoveryProbes: [],
  options: [],
  timing: "T4",
}

interface StartScanModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: ScanFormValues) => void
}

export function StartScanModal({ isOpen, onClose, onSubmit }: StartScanModalProps) {
  const [isCustom, setIsCustom] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tcpInputDisabled, setTcpInputDisabled] = useState(false)
  const [udpInputDisabled, setUdpInputDisabled] = useState(false)
  // Add state for protocol selection
  const [tcpDisabled, setTcpDisabled] = useState(false)
  const [udpDisabled, setUdpDisabled] = useState(false)

  const form = useForm<ScanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  // Watch for changes in port inputs and port types
  const tcpPorts = form.watch("tcpPorts")
  const udpPorts = form.watch("udpPorts")
  const tcpTopPorts = form.watch("tcpTopPorts")
  const udpTopPorts = form.watch("udpTopPorts")
  const portTypes = form.watch("portTypes")
  const scanType = form.watch("scanType")

  // Update disabled states based on input values
  useEffect(() => {
    setTcpInputDisabled(!!tcpTopPorts)
    setUdpInputDisabled(!!udpTopPorts)
    
    // Update protocol disabled states to ensure at least one is selected
    setTcpDisabled(portTypes.includes('udp') && !portTypes.includes('tcp') ? false : portTypes.length <= 1)
    setUdpDisabled(portTypes.includes('tcp') && !portTypes.includes('udp') ? false : portTypes.length <= 1)
  }, [tcpTopPorts, udpTopPorts, portTypes])

  // Update protocol section visibility based on scan type
  useEffect(() => {
    if (scanType !== 'custom') {
      // If not custom scan, ensure at least TCP is selected
      if (!portTypes.includes('tcp')) {
        form.setValue('portTypes', [...portTypes, 'tcp'])
      }
    }
  }, [scanType, portTypes, form])

  const handleTcpTopPortsChange = (value: string) => {
    // If selecting "disabled", clear the dropdown value
    if (value === "disabled") {
      form.setValue("tcpTopPorts", "")
      setTcpInputDisabled(false)
      return
    }
    
    form.setValue("tcpTopPorts", value)
    form.setValue("tcpPorts", "")
    setTcpInputDisabled(true)
  }

  const handleUdpTopPortsChange = (value: string) => {
    // If selecting "disabled", clear the dropdown value
    if (value === "disabled") {
      form.setValue("udpTopPorts", "")
      setUdpInputDisabled(false)
      return
    }
    
    form.setValue("udpTopPorts", value)
    form.setValue("udpPorts", "")
    setUdpInputDisabled(true)
  }

  const handleTcpPortsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    form.setValue("tcpPorts", value)
    if (value) {
      form.setValue("tcpTopPorts", "")
    }
  }

  const handleUdpPortsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    form.setValue("udpPorts", value)
    if (value) {
      form.setValue("udpTopPorts", "")
    }
  }

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
    // For default and deep scans, make sure basic configuration is set
    const finalValues = { ...values };
    
    // If deep scan, set all advanced options
    if (values.scanType === 'deep') {
      finalValues.options = [
        'os-detection',
        'version-detection',
        'ssl-scan',
        'http-headers',
        'traceroute'
      ];
      finalValues.hostDiscoveryProbes = ['echo', 'timestamp', 'netmask'];
      finalValues.timing = 'T3';
      finalValues.tcpTopPorts = '5000';
      finalValues.udpTopPorts = '100';
      if (!finalValues.portTypes?.includes('tcp')) {
        finalValues.portTypes = [...(finalValues.portTypes || []), 'tcp'];
      }
      if (!finalValues.portTypes?.includes('udp')) {
        finalValues.portTypes = [...(finalValues.portTypes || []), 'udp'];
      }
    } 
    // If default scan, set minimal options
    else if (values.scanType === 'default') {
      finalValues.detectionTechnique = 'syn';
      finalValues.tcpTopPorts = '100';
      finalValues.hostDiscoveryProbes = ['echo'];
      finalValues.timing = 'T5';
      if (!finalValues.portTypes?.includes('tcp')) {
        finalValues.portTypes = [...(finalValues.portTypes || []), 'tcp'];
      }
    }
    
    onSubmit(finalValues);
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
                      <div className="relative">
                        <Textarea
                          placeholder="Enter targets (hostnames, URLs, IP addresses, ranges, or CIDR format)"
                          className="min-h-[100px] pr-8"
                          {...field}
                        />
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-2 h-6 w-6 p-0"
                            onClick={() => form.setValue("targets", "")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
                                                  <TooltipProvider>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="default" />
                            </FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <FormLabel className="font-normal cursor-help">Default</FormLabel>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="right" 
                                align="start" 
                                className="w-72 p-3 text-sm"
                              >
                                <p>
                                  Basic scan that checks the most common 100 ports. Fast and suitable for most
                                  scenarios. Duration: around 10 seconds per target.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormItem>

                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="deep" />
                            </FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <FormLabel className="font-normal cursor-help">Deep</FormLabel>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="right" 
                                align="start" 
                                className="w-72 p-3 text-sm"
                              >
                                <p>
                                  Comprehensive scan that includes service detection, OS detection, and script scanning
                                  on all ports. Slower but more thorough. Duration: 10-30 minutes per target.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormItem>

                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="custom" />
                            </FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <FormLabel className="font-normal cursor-help">Custom</FormLabel>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="right" 
                                align="start" 
                                className="w-72 p-3 text-sm"
                              >
                                <p>
                                  Configure your own scan parameters including port selection, detection techniques, and
                                  timing. Duration varies based on settings.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </FormItem>
                        </TooltipProvider>
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
                        name="tcpPorts"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <FormField
                                control={form.control}
                                name="portTypes"
                                render={({ field: portTypesField }) => (
                                  <FormControl>
                                    <Checkbox
                                      checked={portTypesField.value?.includes("tcp")}
                                      disabled={tcpDisabled}
                                      onCheckedChange={(checked) => {
                                        const current = portTypesField.value || []
                                        if (checked) {
                                          portTypesField.onChange([...current, "tcp"])
                                        } else {
                                          portTypesField.onChange(current.filter((value) => value !== "tcp"))
                                        }
                                      }}
                                    />
                                  </FormControl>
                                )}
                              />
                              <FormLabel>TCP Ports</FormLabel>
                            </div>
                            <div className="space-y-2">
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    placeholder="e.g., 80,443,8080 or 1-1000"
                                    {...field}
                                    disabled={tcpInputDisabled || !portTypes.includes('tcp')}
                                    onChange={handleTcpPortsChange}
                                  />
                                </FormControl>
                                {field.value && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                                    onClick={() => form.setValue("tcpPorts", "")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <FormField
                                control={form.control}
                                name="tcpTopPorts"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={handleTcpTopPortsChange}
                                    value={field.value || "disabled"}
                                    disabled={!!tcpPorts || !portTypes.includes('tcp')}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Or select top ports" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="disabled">---</SelectItem>
                                      <SelectItem value="10">Top 10 ports</SelectItem>
                                      <SelectItem value="100">Top 100 ports</SelectItem>
                                      <SelectItem value="1000">Top 1000 ports</SelectItem>
                                      <SelectItem value="5000">Top 5000 ports</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <FormDescription>
                              Enter specific ports (comma-separated) or ranges (e.g., 80-100), or select from top ports
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
                            <div className="flex items-center space-x-3">
                              <FormField
                                control={form.control}
                                name="portTypes"
                                render={({ field: portTypesField }) => (
                                  <FormControl>
                                    <Checkbox
                                      checked={portTypesField.value?.includes("udp")}
                                      disabled={udpDisabled}
                                      onCheckedChange={(checked) => {
                                        const current = portTypesField.value || []
                                        if (checked) {
                                          portTypesField.onChange([...current, "udp"])
                                        } else {
                                          portTypesField.onChange(current.filter((value) => value !== "udp"))
                                        }
                                      }}
                                    />
                                  </FormControl>
                                )}
                              />
                              <FormLabel>UDP Ports</FormLabel>
                            </div>
                            <div className="space-y-2">
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    placeholder="e.g., 53,123,161 or 1-1000"
                                    {...field}
                                    disabled={udpInputDisabled || !portTypes.includes('udp')}
                                    onChange={handleUdpPortsChange}
                                  />
                                </FormControl>
                                {field.value && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                                    onClick={() => form.setValue("udpPorts", "")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <FormField
                                control={form.control}
                                name="udpTopPorts"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={handleUdpTopPortsChange}
                                    value={field.value || "disabled"}
                                    disabled={!!udpPorts || !portTypes.includes('udp')}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Or select top ports" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="disabled">---</SelectItem>
                                      <SelectItem value="10">Top 10 ports</SelectItem>
                                      <SelectItem value="100">Top 100 ports</SelectItem>
                                      <SelectItem value="1000">Top 1000 ports</SelectItem>
                                      <SelectItem value="5000">Top 5000 ports</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <FormDescription>
                              Enter specific ports (comma-separated) or ranges (e.g., 80-100), or select from top ports
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="detection" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="detectionTechnique"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detection Technique</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a detection technique" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="syn">TCP SYN scan</SelectItem>
                                <SelectItem value="connect">TCP Connect scan</SelectItem>
                                <SelectItem value="ack">TCP ACK scan</SelectItem>
                                <SelectItem value="window">TCP Window scan</SelectItem>
                                <SelectItem value="maimon">TCP Maimon scan</SelectItem>
                                <SelectItem value="null">TCP Null scan</SelectItem>
                                <SelectItem value="fin">TCP FIN scan</SelectItem>
                                <SelectItem value="xmas">TCP Xmas scan</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Select the scanning technique to use for port detection</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hostDiscoveryProbes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host Discovery Probes</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("echo")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "echo"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "echo"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">ICMP Echo</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("timestamp")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "timestamp"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "timestamp"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">ICMP Timestamp</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("netmask")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "netmask"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "netmask"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">ICMP Netmask</FormLabel>
                              </FormItem>
                            </div>
                            <FormDescription>Select the probes to use for host discovery</FormDescription>
                          </FormItem>
                        )}
                      />

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
                                    checked={field.value?.includes("ssl-scan")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "ssl-scan"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "ssl-scan"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">SSL/TLS Scan</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes("http-headers")}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, "http-headers"])
                                      } else {
                                        field.onChange(current.filter((value) => value !== "http-headers"))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">HTTP Headers Scan</FormLabel>
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
                                <TooltipProvider>
                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T0" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T0 (Paranoid)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>
                                          Very slow scan designed to avoid detection. Serializes all scans and waits up
                                          to 5 minutes between probes.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>

                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T1" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T1 (Sneaky)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>
                                          Slow scan that minimizes bandwidth usage and target impact. Waits 15 seconds
                                          between probes.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>

                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T2" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T2 (Polite)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>
                                          Slows down to consume less bandwidth and target resources. Waits 0.4 seconds
                                          between probes.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>

                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T3" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T3 (Normal)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>Default timing template with a balance between accuracy and speed.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>

                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T4" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T4 (Aggressive)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>
                                          Faster scan that assumes a reasonably fast and reliable network. May overwhelm
                                          slow hosts.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>

                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="T5" />
                                    </FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FormLabel className="font-normal cursor-help">T5 (Insane)</FormLabel>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center" className="w-64 p-3 text-sm">
                                        <p>
                                          Very aggressive scan that sacrifices accuracy for speed. Assumes an
                                          extraordinarily fast network.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </FormItem>
                                </TooltipProvider>
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
