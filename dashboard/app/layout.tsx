import type { Metadata } from "next";

export const metadata: Metadata = {
    title:       "AgentPay — Autonomous Payment Agent",
    description: "AI-driven USDT payment settlement on Ethereum",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body style={{
                margin:     0,
                padding:    0,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                background: "#080c14",
                color:      "#c9d1d9",
                minHeight:  "100vh",
            }}>
                {children}
            </body>
        </html>
    );
}
