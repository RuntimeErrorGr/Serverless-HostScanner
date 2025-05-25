// Comprehensive Nmap parameter documentation
// Based on official Nmap documentation

export interface ParameterDoc {
  name: string;
  description: string;
  scanTime: string;
  precision: string;
  findings: string;
  category: string;
}

export const nmapParameterDocs: Record<string, ParameterDoc> = {
  // Host Discovery Probes
  echo_request: {
    name: "ICMP Echo Request",
    description: "Sends traditional ping packets (ICMP echo requests) to determine if hosts are alive. Most fundamental host discovery method.",
    scanTime: "Fast - minimal overhead, adds ~1-2ms per host",
    precision: "High for most networks, but blocked by many firewalls",
    findings: "Live hosts, network responsiveness, ICMP filtering policies",
    category: "Host Discovery"
  },
  
  timestamp_request: {
    name: "ICMP Timestamp Request",
    description: "Sends ICMP timestamp requests to discover hosts. Alternative to echo requests when they're blocked.",
    scanTime: "Fast - similar to echo requests, ~1-2ms per host",
    precision: "Medium - less commonly filtered than echo requests",
    findings: "Live hosts, potential timezone information, timestamp filtering",
    category: "Host Discovery"
  },
  
  address_mask_request: {
    name: "ICMP Address Mask Request",
    description: "Sends ICMP address mask requests for host discovery. Rarely used on modern networks.",
    scanTime: "Fast - minimal timing impact",
    precision: "Low - most modern systems ignore these requests",
    findings: "Legacy system detection, network mask information",
    category: "Host Discovery"
  },

  // Scan Techniques
  tcp_syn_scan: {
    name: "TCP SYN Scan",
    description: "Half-open scanning technique that sends SYN packets without completing TCP handshake. Default and most popular scan.",
    scanTime: "Fast - doesn't complete connections, ~0.1-1ms per port",
    precision: "Very High - accurate port state detection",
    findings: "Open/closed/filtered TCP ports, service availability, firewall behavior",
    category: "Scan Technique"
  },

  tcp_connect_scan: {
    name: "TCP Connect Scan",
    description: "Completes full TCP three-way handshake. More detectable but works without raw socket privileges.",
    scanTime: "Slower - completes full connections, ~5-50ms per port",
    precision: "High - definitive connection status",
    findings: "Open TCP ports, services that accept connections, connection logging",
    category: "Scan Technique"
  },

  // Detection Options
  os_detection: {
    name: "OS Detection",
    description: "Performs TCP/IP fingerprinting to determine operating system. Uses various packet tests and timing analysis.",
    scanTime: "Moderate - adds 5-15 seconds per host",
    precision: "High - can identify OS family, version, and device type",
    findings: "Operating system, version, device type, network stack behavior",
    category: "Detection"
  },

  service_version: {
    name: "Service Version Detection",
    description: "Probes open ports to determine service/version information. Sends various probes to identify running services.",
    scanTime: "Slow - adds 10-60 seconds per open port",
    precision: "Very High - detailed service information",
    findings: "Service names, versions, banner information, vulnerability hints",
    category: "Detection"
  },

  ssl_scan: {
    name: "SSL/TLS Scanning",
    description: "Analyzes SSL/TLS configurations, certificates, and supported protocols/ciphers on encrypted services.",
    scanTime: "Moderate - adds 2-10 seconds per SSL service",
    precision: "High - comprehensive SSL/TLS configuration analysis",
    findings: "SSL certificates, cipher suites, protocol versions, vulnerabilities",
    category: "Detection"
  },

  http_headers: {
    name: "HTTP(S) Scan",
    description: "Retrieves and analyzes HTTP(S) headers from web servers to gather information about technologies and configurations.",
    scanTime: "Fast - adds 1-3 seconds per HTTP service",
    precision: "High - reveals web server technologies",
    findings: "Server software, technologies, security headers, hidden directories",
    category: "Detection"
  },

  traceroute: {
    name: "Traceroute",
    description: "Traces network path to targets, revealing intermediate routers and network topology between scanner and target.",
    scanTime: "Slow - adds 10-30 seconds per target",
    precision: "High - accurate network path mapping",
    findings: "Network topology, routing paths, intermediate devices, network latency",
    category: "Network Analysis"
  },

  // Port Specifications
  tcp_ports: {
    name: "TCP Port Range",
    description: "Specifies which TCP ports to scan. Can be individual ports, ranges, or 'top-N' most common ports.",
    scanTime: "Variable - directly proportional to number of ports",
    precision: "High - scans exactly specified ports",
    findings: "TCP services on specified ports, port filtering policies",
    category: "Port Selection"
  },

  udp_ports: {
    name: "UDP Port Range", 
    description: "Specifies which UDP ports to scan. UDP scanning is slower due to lack of connection establishment.",
    scanTime: "Very Slow - UDP requires timeouts, ~1-5 seconds per port",
    precision: "Medium - UDP responses vary, many false positives",
    findings: "UDP services, ICMP responses, UDP filtering behavior",
    category: "Port Selection"
  },

  // Timing Templates
  timing_flag: {
    name: "Timing Template",
    description: "Controls scan speed and stealth. T0-T5 where T0 is paranoid (slowest) and T5 is insane (fastest).",
    scanTime: "T0: Hours, T1: ~30min, T2: ~10min, T3: ~3min, T4: ~1min, T5: <30sec",
    precision: "Slower templates = higher accuracy, faster = more detection risk",
    findings: "Same findings but speed vs stealth trade-off affects reliability",
    category: "Timing"
  }
};

export function getParameterDocumentation(key: string): ParameterDoc | null {
  return nmapParameterDocs[key] || null;
}

export function formatParameterKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getParameterValue(key: string, value: any): string {
  if (typeof value === 'boolean') {
    return value ? '' : 'Disabled';
  }
  if (key === 'timing_flag') {
    const timingNames = ['T0 (Paranoid)', 'T1 (Sneaky)', 'T2 (Polite)', 'T3 (Normal)', 'T4 (Aggressive)', 'T5 (Insane)'];
    return timingNames[parseInt(value)] || `T${value}`;
  }
  if (key === 'tcp_ports' || key === 'udp_ports') {
    if (value.startsWith('top-')) {
      return `Top ${value.replace('top-', '')} ports`;
    }
  }
  return String(value);
} 