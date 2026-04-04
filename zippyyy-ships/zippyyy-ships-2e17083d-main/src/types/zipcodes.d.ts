declare module "zipcodes" {
  export function lookup(zip: string): { state?: string; city?: string; zip?: string } | undefined;
}
