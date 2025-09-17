import './globals.css' 

export const metadata = {
  title: 'AI Options Scanner Pro',
  description: 'Live options trading scanner with real-time market data',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
