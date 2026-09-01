import './globals.css';

export const metadata = {
  title: 'Protocol by MAAN.life',
  description: 'Rules-based training and nutrition plans that adjust every week.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          {children}
          <footer>
            PROTOCOL by MAAN.life · rules-based engine · not medical advice: clear new training programs with your physician
          </footer>
        </div>
      </body>
    </html>
  );
}
