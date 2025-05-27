import {
    SiLinux,
    SiUbuntu,
    SiDebian,
    SiCentos,
    SiRedhat,
    SiFedora,
    SiArchlinux,
    SiOpensuse,
    SiFreebsd,
    SiNetbsd,
    SiOpenbsd,
    SiApple,
    SiAndroid,
  } from "react-icons/si"
  import { FaWindows, FaServer, FaMobile, FaDesktop, FaHdd } from "react-icons/fa"
  
  interface OSIconProps {
    osName: string
    className?: string
  }
  
  export function OSIcon({ osName, className = "h-6 w-6" }: OSIconProps) {
    const name = osName?.toLowerCase() || ""
  
    // Windows variants
    if (name.includes("windows") || name.includes("microsoft") || name.includes("win")) {
      return <FaWindows className={`${className} text-foreground`} />
    }
  
    // Linux distributions
    if (name.includes("ubuntu")) {
      return <SiUbuntu className={`${className} text-foreground`} />
    }
    if (name.includes("debian")) {
      return <SiDebian className={`${className} text-foreground`} />
    }
    if (name.includes("centos")) {
      return <SiCentos className={`${className} text-foreground`} />
    }
    if (name.includes("redhat") || name.includes("red hat") || name.includes("rhel")) {
      return <SiRedhat className={`${className} text-foreground`} />
    }
    if (name.includes("fedora")) {
      return <SiFedora className={`${className} text-foreground`} />
    }
    if (name.includes("arch")) {
      return <SiArchlinux className={`${className} text-foreground`} />
    }
    if (name.includes("opensuse") || name.includes("suse")) {
      return <SiOpensuse className={`${className} text-foreground`} />
    }
  
    // BSD variants
    if (name.includes("freebsd")) {
      return <SiFreebsd className={`${className} text-foreground`} />
    }
    if (name.includes("netbsd")) {
      return <SiNetbsd className={`${className} text-foreground`} />
    }
    if (name.includes("openbsd")) {
      return <SiOpenbsd className={`${className} text-foreground`} />
    }
  
    // Generic Linux (penguin)
    if (name.includes("linux") || name.includes("gnu") || name.includes("unix")) {
      return <SiLinux className={`${className} text-foreground`} />
    }
  
    // Apple products
    if (name.includes("macos") || name.includes("mac os") || name.includes("darwin")) {
      return <SiApple className={`${className} text-foreground`} />
    }
    if (name.includes("ios")) {
      return <SiApple className={`${className} text-foreground`} />
    }
  
    // Mobile
    if (name.includes("android")) {
      return <SiAndroid className={`${className} text-foreground`} />
    }
  
    // Fallback icons based on type
    if (name.includes("mobile") || name.includes("phone")) {
      return <FaMobile className={`${className} text-foreground`} />
    }
    if (name.includes("server")) {
      return <FaServer className={`${className} text-foreground`} />
    }
    if (name.includes("desktop") || name.includes("workstation")) {
      return <FaDesktop className={`${className} text-foreground`} />
    }
  
    // Default fallback
    return <FaHdd className={`${className} text-foreground`} />
  }
  