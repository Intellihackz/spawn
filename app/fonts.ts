import { Archivo, DM_Mono } from "next/font/google";

// One family with a width axis carries display and text: expanded 800 for the poster type, normal width for reading.
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
// Data: hashes, numbers, addresses, chain cards.
export const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });
