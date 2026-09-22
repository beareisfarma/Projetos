import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata={title:"Médicos disponíveis",description:"Consulta rápida de médicos disponíveis por dia e turno.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>;}
