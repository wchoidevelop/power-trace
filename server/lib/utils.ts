import SOCtoCPSMap from '@/constants/soc_to_cps.json'
//converts SOC codes to CPS occupation codes
export function SOCtoCPS(codes: string[]): (string | null)[] {
    //@ts-ignore
    return codes.map(code => SOCtoCPSMap[code] || null)
}