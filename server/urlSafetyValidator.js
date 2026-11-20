import dns from 'dns/promises';
import net from 'net';

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Blocks loopback, private RFC1918 subnets, and cloud instance metadata addresses.
 */
export async function validateUrlSafety(targetUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  // Enforce protocol whitelist
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted for health monitoring');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Reject immediate localhost aliases
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '0.0.0.0') {
    throw new Error('SSRF Protection: Loopback targets (localhost) are prohibited');
  }

  // Resolve DNS to verify the actual destination IP address
  let resolvedIp;
  try {
    const lookup = await dns.lookup(hostname);
    resolvedIp = lookup.address;
  } catch (err) {
    throw new Error(`DNS resolution failed for host "${hostname}": ${err.message}`);
  }

  if (isPrivateOrRestrictedIp(resolvedIp)) {
    throw new Error(`SSRF Protection: Target IP ${resolvedIp} belongs to a private/internal network`);
  }

  return { isValid: true, resolvedIp };
}

/**
 * Checks if an IP is private, loopback, link-local, or cloud metadata.
 */
function isPrivateOrRestrictedIp(ip) {
  if (!net.isIP(ip)) return true;

  // IPv4 Checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);

    // Loopback: 127.0.0.0/8
    if (parts[0] === 127) return true;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;

    // Private RFC 1918: 10.0.0.0/8
    if (parts[0] === 10) return true;

    // Private RFC 1918: 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // Private RFC 1918: 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    // Link-local & Cloud Metadata: 169.254.0.0/16 (e.g., 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // Carrier-grade NAT: 100.64.0.0/10
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

    // Multicast & Reserved: 224.0.0.0/4
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // Link-local: fe80::/10
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
        normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // Unique local (private): fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  }

  return false;
}

