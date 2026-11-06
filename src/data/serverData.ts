/* ============================================================
   Data server: plan, region, network plan, image (OS & apps)
   Harga bulanan IDR, harga per jam = monthly / 720
   ============================================================ */

export type PlanFamily = 'Burstable' | 'Highload' | 'High Frequency';

export const PLAN_FAMILIES: PlanFamily[] = ['Burstable', 'Highload', 'High Frequency'];

export interface PlanSpec {
  id: string;
  family: PlanFamily;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  bandwidth: string;
  traffic: string;
  monthly: number;
}

export const PLANS: PlanSpec[] = [
  /* ---------------- BURSTABLE ---------------- */
  { id: 'brs-1', family: 'Burstable', name: 'Boosteryuk-1', cpu: '1 CPU', ram: '1 GiB RAM', storage: '10 GiB NVMe', bandwidth: '50 Mbit/s Bandwidth', traffic: '0.5 TB Traffic', monthly: 25000 },
  { id: 'brs-2', family: 'Burstable', name: 'Boosteryuk-2', cpu: '1 CPU', ram: '2 GiB RAM', storage: '20 GiB NVMe', bandwidth: '1 Gbit/s Bandwidth', traffic: '1 TB Traffic', monthly: 50000 },
  { id: 'brs-3', family: 'Burstable', name: 'Boosteryuk-3', cpu: '2 CPU', ram: '4 GiB RAM', storage: '40 GiB NVMe', bandwidth: '10 Gbit/s Bandwidth', traffic: '2 TB Traffic', monthly: 99000 },
  { id: 'brs-4', family: 'Burstable', name: 'Boosteryuk-4', cpu: '2 CPU', ram: '8 GiB RAM', storage: '80 GiB NVMe', bandwidth: '10 Gbit/s Bandwidth', traffic: '4 TB Traffic', monthly: 189000 },
  { id: 'brs-5', family: 'Burstable', name: 'Boosteryuk-5', cpu: '4 CPU', ram: '16 GiB RAM', storage: '160 GiB NVMe', bandwidth: '10 Gbit/s Bandwidth', traffic: '8 TB Traffic', monthly: 359000 },
  { id: 'brs-6', family: 'Burstable', name: 'Boosteryuk-6', cpu: '4 CPU', ram: '32 GiB RAM', storage: '320 GiB NVMe', bandwidth: '10 Gbit/s Bandwidth', traffic: '16 TB Traffic', monthly: 699000 },
  { id: 'brs-7', family: 'Burstable', name: 'Boosteryuk-7', cpu: '8 CPU', ram: '64 GiB RAM', storage: '640 GiB NVMe', bandwidth: '10 Gbit/s Bandwidth', traffic: '20 TB Traffic', monthly: 1199000 },
  /* ---------------- HIGHLOAD ---------------- */
  { id: 'hl-1', family: 'Highload', name: 'Boosteryuk-HL-1', cpu: '4 CPU', ram: '8 GiB RAM', storage: '2× 480 GB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '5 TB Traffic', monthly: 329000 },
  { id: 'hl-2', family: 'Highload', name: 'Boosteryuk-HL-2', cpu: '6 CPU', ram: '16 GiB RAM', storage: '2× 960 GB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '8 TB Traffic', monthly: 519000 },
  { id: 'hl-3', family: 'Highload', name: 'Boosteryuk-HL-3', cpu: '8 CPU', ram: '32 GiB RAM', storage: '2× 1.92 TB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '10 TB Traffic', monthly: 779000 },
  { id: 'hl-4', family: 'Highload', name: 'Boosteryuk-HL-4', cpu: '8 CPU', ram: '64 GiB RAM', storage: '2× 3.84 TB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '15 TB Traffic', monthly: 1199000 },
  { id: 'hl-5', family: 'Highload', name: 'Boosteryuk-HL-5', cpu: '16 CPU', ram: '128 GiB RAM', storage: '4× 3.84 TB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '20 TB Traffic', monthly: 2099000 },
  { id: 'hl-6', family: 'Highload', name: 'Boosteryuk-HL-6', cpu: '24 CPU', ram: '256 GiB RAM', storage: '4× 7.68 TB SSD', bandwidth: '10 Gbit/s Bandwidth', traffic: '30 TB Traffic', monthly: 3499000 },
  /* ---------------- HIGH FREQUENCY ---------------- */
  { id: 'hf-1', family: 'High Frequency', name: 'Boosteryuk-HF-1', cpu: '2 CPU 4.5 GHz', ram: '4 GiB RAM', storage: '80 GB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '2 TB Traffic', monthly: 119000 },
  { id: 'hf-2', family: 'High Frequency', name: 'Boosteryuk-HF-2', cpu: '4 CPU 4.7 GHz', ram: '8 GiB RAM', storage: '160 GB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '4 TB Traffic', monthly: 219000 },
  { id: 'hf-3', family: 'High Frequency', name: 'Boosteryuk-HF-3', cpu: '8 CPU 4.9 GHz', ram: '16 GiB RAM', storage: '320 GB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '8 TB Traffic', monthly: 429000 },
  { id: 'hf-4', family: 'High Frequency', name: 'Boosteryuk-HF-4', cpu: '8 CPU 5.0 GHz', ram: '32 GiB RAM', storage: '640 GB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '12 TB Traffic', monthly: 739000 },
  { id: 'hf-5', family: 'High Frequency', name: 'Boosteryuk-HF-5', cpu: '16 CPU 5.0 GHz', ram: '64 GiB RAM', storage: '1.28 TB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '20 TB Traffic', monthly: 1399000 },
  { id: 'hf-6', family: 'High Frequency', name: 'Boosteryuk-HF-6', cpu: '32 CPU 5.2 GHz', ram: '128 GiB RAM', storage: '2.56 TB NVMe Gen4', bandwidth: '10 Gbit/s Bandwidth', traffic: '30 TB Traffic', monthly: 2599000 },
];

/* ============================ REGION ============================ */
export interface RegionSpec {
  id: string;
  country: string;
  flag: string;
  city: string;
  ping: number;
  code: string;
}

export const REGIONS: RegionSpec[] = [
  { id: 'sg-1', country: 'Singapore', flag: 'sg', city: 'Singapore', ping: 45, code: 'SGP' },
  { id: 'jp-1', country: 'Japan', flag: 'jp', city: 'Tokyo', ping: 62, code: 'TYO' },
  { id: 'in-1', country: 'India', flag: 'in', city: 'Mumbai', ping: 78, code: 'BOM' },
  { id: 'us-1', country: 'United States', flag: 'us', city: 'Ashburn', ping: 88, code: 'IAD' },
  { id: 'nl-1', country: 'Netherlands', flag: 'nl', city: 'Amsterdam', ping: 96, code: 'AMS' },
  { id: 'us-2', country: 'United States', flag: 'us', city: 'Hillsboro', ping: 118, code: 'HIO' },
  { id: 'gb-1', country: 'United Kingdom', flag: 'gb', city: 'London', ping: 142, code: 'LON' },
  { id: 'au-1', country: 'Australia', flag: 'au', city: 'Sydney', ping: 158, code: 'SYD' },
  { id: 'de-1', country: 'Germany', flag: 'de', city: 'Nuremberg', ping: 172, code: 'NUE' },
  { id: 'de-2', country: 'Germany', flag: 'de', city: 'Falkenstein', ping: 181, code: 'FSN' },
  { id: 'fi-1', country: 'Finland', flag: 'fi', city: 'Helsinki', ping: 212, code: 'HEL' },
  { id: 'fr-1', country: 'France', flag: 'fr', city: 'Paris', ping: 235, code: 'PAR' },
  { id: 'br-1', country: 'Brazil', flag: 'br', city: 'São Paulo', ping: 268, code: 'GRU' },
];

export function pingLevel(ping: number): 'green' | 'yellow' | 'red' {
  if (ping <= 120) return 'green';
  if (ping <= 200) return 'yellow';
  return 'red';
}

/* ========================= NETWORK PLAN ========================= */
export interface NetworkPlan {
  id: string;
  name: string;
  traffic: string;
  bandwidth: string;
  extraTb: string;
  monthly: number;
  included?: boolean;
  tag?: string;
}

export const NETWORK_PLANS: NetworkPlan[] = [
  { id: 'net-included', name: 'Unlimited Shared 100 Mbps', traffic: '∞', bandwidth: '100 Mbit/s', extraTb: 'GRATIS', monthly: 0, included: true, tag: 'Gratis di semua paket' },
  { id: 'net-1g', name: 'Unlimited Shared 1 Gbps', traffic: '∞', bandwidth: '1 Gbit/s', extraTb: 'GRATIS', monthly: 17000 },
  { id: 'net-10g', name: 'Unlimited Shared 10 Gbps', traffic: '∞', bandwidth: '10 Gbit/s', extraTb: 'GRATIS', monthly: 34000 },
  { id: 'net-ded50', name: 'Unlimited Dedicated 50 Mbps', traffic: '∞', bandwidth: '50 Mbit/s', extraTb: 'GRATIS', monthly: 52000 },
  { id: 'net-ded1g', name: 'Unlimited Dedicated 1 Gbps', traffic: '∞', bandwidth: '1 Gbit/s', extraTb: 'GRATIS', monthly: 112000 },
];

/* ============================ IMAGE ============================ */
export type ImageKind = 'os' | 'app';
export interface ImageSpec {
  id: string;
  kind: ImageKind;
  name: string;
  icon: string;
  color: string;
  versions: string[];
  size?: string;
}

export const IMAGES: ImageSpec[] = [
  { id: 'alma', kind: 'os', name: 'Alma', icon: 'almalinux', color: '#E8B104', versions: ['10.0', '9.6', '9.5', '8.10'] },
  { id: 'centos', kind: 'os', name: 'centOS', icon: 'centos', color: '#932279', versions: ['Stream 10', 'Stream 9', '7.9.2009'] },
  { id: 'debian', kind: 'os', name: 'Debian', icon: 'debian', color: '#A80030', versions: ['13 Trixie', '12 Bookworm', '11 Bullseye'] },
  { id: 'fedora', kind: 'os', name: 'Fedora', icon: 'fedora', color: '#294172', versions: ['43', '42', '41'] },
  { id: 'rocky', kind: 'os', name: 'Rocky', icon: 'rockylinux', color: '#10B981', versions: ['10.0', '9.6', '9.5', '8.10'] },
  { id: 'ubuntu', kind: 'os', name: 'Ubuntu', icon: 'ubuntu', color: '#E95420', versions: ['25.10', '25.04', '24.04 LTS', '22.04 LTS'] },
  { id: 'docker', kind: 'app', name: 'Docker', icon: 'docker', color: '#2496ED', versions: ['28.x', '27.5', '26.1'], size: '1.2 GB' },
  { id: 'plesk', kind: 'app', name: 'Plesk', icon: 'plesk', color: '#52BAD5', versions: ['18.0.68', '18.0.66'], size: '2.4 GB' },
  { id: 'cpanel', kind: 'app', name: 'cPanel', icon: 'cpanel', color: '#FF6C2C', versions: ['118', '116'], size: '2.1 GB' },
  { id: 'wordpress', kind: 'app', name: 'WordPress', icon: 'wordpress', color: '#21759B', versions: ['6.9', '6.8', '6.7'], size: '640 MB' },
  { id: 'nextcloud', kind: 'app', name: 'Nextcloud', icon: 'nextcloud', color: '#0082C9', versions: ['31', '30', '29'], size: '1.6 GB' },
  { id: 'gitlab', kind: 'app', name: 'GitLab', icon: 'gitlab', color: '#FC6D26', versions: ['18.5', '17.11'], size: '4.8 GB' },
  { id: 'coolify', kind: 'app', name: 'Coolify', icon: 'coolify', color: '#7C3AED', versions: ['4.0.5', '4.0.3'], size: '1.1 GB' },
  { id: 'n8n', kind: 'app', name: 'n8n', icon: 'n8n', color: '#EA4B71', versions: ['1.100', '1.90'], size: '820 MB' },
];

/* ============================ IP ADDRESS ============================ */
export interface IpOption {
  id: string;
  label: string;
  desc: string;
  monthly: number;
}

export const IP_OPTIONS: IpOption[] = [
  { id: 'ipv4', label: 'IPv4', desc: '1 alamat IPv4 publik', monthly: 0 },
  { id: 'ipv4v6', label: 'IPv4 + IPv6', desc: '1 IPv4 publik + /64 IPv6 subnet', monthly: 0 },
  { id: 'ipv6', label: 'IPv6', desc: 'Hanya /64 IPv6 subnet', monthly: 0 },
];

/* ============================ HELPERS ============================ */
export function hourlyFromMonthly(monthly: number): number {
  return Math.round((monthly / 720) * 100) / 100;
}

export function rupiah(value: number, digits = 0): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: digits,
  }).format(value);
}

export function euro(value: number): string {
  return rupiah(value);
}

export function rupiahHourly(monthly: number): string {
  return `${rupiah(hourlyFromMonthly(monthly))}/jam`;
}

export function euroHourly(monthly: number): string {
  return rupiahHourly(monthly);
}

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w160/${code}.png`;
}

export function iconUrl(slug: string, color: string): string {
  return `https://cdn.simpleicons.org/${slug}/${color.replace('#', '')}`;
}