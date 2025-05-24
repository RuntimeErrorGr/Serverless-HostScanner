"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Shield, Globe, Lock, AlertTriangle, Info, FileText, Server, Key } from "lucide-react"

interface ScriptDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  port: {
    port?: number
    protocol?: string
    service?: string
    state?: string
    scripts?: Record<string, string>
  }
  target: string
}

export function ScriptDetailsDialog({ isOpen, onClose, port, target }: ScriptDetailsDialogProps) {
  const scripts = port.scripts || {}
  const scriptEntries = Object.entries(scripts)

  // Function to get script icon based on script name
  const getScriptIcon = (scriptName: string) => {
    if (scriptName.includes("ssl") || scriptName.includes("tls")) {
      return <Lock className="h-4 w-4" />
    }
    if (scriptName.includes("http")) {
      return <Globe className="h-4 w-4" />
    }
    if (scriptName.includes("vuln") || scriptName.includes("exploit")) {
      return <AlertTriangle className="h-4 w-4" />
    }
    if (scriptName.includes("enum") || scriptName.includes("discovery")) {
      return <Shield className="h-4 w-4" />
    }
    if (scriptName.includes("cert") || scriptName.includes("certificate")) {
      return <Key className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  // Function to get script category
  const getScriptCategory = (scriptName: string) => {
    if (scriptName.includes("ssl") || scriptName.includes("tls") || scriptName.includes("cert")) {
      return "SSL/TLS"
    }
    if (scriptName.includes("http")) {
      return "HTTP"
    }
    if (scriptName.includes("vuln") || scriptName.includes("exploit")) {
      return "Vulnerability"
    }
    if (scriptName.includes("enum") || scriptName.includes("discovery")) {
      return "Discovery"
    }
    return "General"
  }

  // Function to parse SSL certificate information
  const parseSSLCert = (certData: string) => {
    const lines = certData.split("\n")
    const parsed: Record<string, string> = {}

    for (const line of lines) {
      if (line.includes("Subject:")) {
        parsed.subject = line.replace("Subject:", "").trim()
      }
      if (line.includes("Issuer:")) {
        parsed.issuer = line.replace("Issuer:", "").trim()
      }
      if (line.includes("Not valid before:")) {
        parsed.validFrom = line.replace("Not valid before:", "").trim()
      }
      if (line.includes("Not valid after:")) {
        parsed.validTo = line.replace("Not valid after:", "").trim()
      }
      if (line.includes("Public Key type:")) {
        parsed.keyType = line.replace("Public Key type:", "").trim()
      }
      if (line.includes("Public Key bits:")) {
        parsed.keyBits = line.replace("Public Key bits:", "").trim()
      }
      if (line.includes("Signature Algorithm:")) {
        parsed.signatureAlgorithm = line.replace("Signature Algorithm:", "").trim()
      }
      if (line.includes("SHA-1:")) {
        parsed.sha1 = line.replace("SHA-1:", "").trim()
      }
      if (line.includes("MD5:")) {
        parsed.md5 = line.replace("MD5:", "").trim()
      }
    }

    return parsed
  }

  // Function to format script output
  const formatScriptOutput = (scriptName: string, output: string) => {
    if (scriptName === "ssl-cert") {
      const parsed = parseSSLCert(output)
      return (
        <div className="space-y-3">
          {Object.entries(parsed).map(([key, value]) => (
            <div key={key} className="grid grid-cols-3 gap-2">
              <div className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</div>
              <div className="col-span-2 text-sm font-mono break-all">{value}</div>
            </div>
          ))}
          <Separator />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium mb-2">Raw Certificate Data</summary>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{output}</pre>
          </details>
        </div>
      )
    }

    if (scriptName.includes("http-headers")) {
      const lines = output.split("\n").filter((line) => line.trim())
      return (
        <div className="space-y-2">
          {lines.map((line, index) => {
            if (line.includes(":")) {
              const [header, ...valueParts] = line.split(":")
              const value = valueParts.join(":").trim()
              return (
                <div key={index} className="grid grid-cols-3 gap-2">
                  <div className="font-medium text-sm">{header.trim()}:</div>
                  <div className="col-span-2 text-sm font-mono break-all">{value}</div>
                </div>
              )
            }
            return (
              <div key={index} className="text-sm text-muted-foreground">
                {line}
              </div>
            )
          })}
        </div>
      )
    }

    // Default formatting with preserved whitespace
    return (
      <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded-md overflow-auto max-h-96">
        {output}
      </pre>
    )
  }

  // Group scripts by category
  const groupedScripts = scriptEntries.reduce(
    (acc, [scriptName, output]) => {
      const category = getScriptCategory(scriptName)
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push([scriptName, output])
      return acc
    },
    {} as Record<string, Array<[string, string]>>,
  )

  if (scriptEntries.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Port {port.port}/{port.protocol} - {target}
            </DialogTitle>
            <DialogDescription>
              Service: {port.service} | State: {port.state}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <div className="text-center">
              <Info className="h-8 w-8 mx-auto mb-2" />
              <p>No script information available for this port</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Port {port.port}/{port.protocol} - {target}
          </DialogTitle>
          <DialogDescription>
            Service: {port.service} | State: {port.state} | {scriptEntries.length} script
            {scriptEntries.length !== 1 ? "s" : ""} available
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue={Object.keys(groupedScripts)[0]} className="h-full flex flex-col">
            <TabsList
              className="grid w-full"
              style={{ gridTemplateColumns: `repeat(${Object.keys(groupedScripts).length}, 1fr)` }}
            >
              {Object.keys(groupedScripts).map((category) => (
                <TabsTrigger key={category} value={category} className="flex items-center gap-1 text-xs">
                  {category === "SSL/TLS" && <Lock className="h-3 w-3" />}
                  {category === "HTTP" && <Globe className="h-3 w-3" />}
                  {category === "Vulnerability" && <AlertTriangle className="h-3 w-3" />}
                  {category === "Discovery" && <Shield className="h-3 w-3" />}
                  {category === "General" && <FileText className="h-3 w-3" />}
                  {category}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {groupedScripts[category].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(groupedScripts).map(([category, scripts]) => (
              <TabsContent key={category} value={category} className="flex-1 mt-4">
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-4 pr-4">
                    {scripts.map(([scriptName, output], index) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {getScriptIcon(scriptName)}
                            {scriptName}
                            {scriptName.includes("vuln") && (
                              <Badge variant="destructive" className="ml-2">
                                Security
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>{formatScriptOutput(scriptName, output)}</CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
