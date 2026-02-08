import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Raksa AI - Royal Thai Police Assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    fontFamily: {
                      sans: ['Sarabun', 'sans-serif'],
                    },
                    colors: {
                      ios: {
                        blue: '#007AFF',
                        gray: '#F2F2F7',
                        green: '#34C759',
                        red: '#FF3B30',
                        background: '#FFFFFF',
                        text: '#000000',
                        secondaryText: '#8E8E93',
                        separator: '#C6C6C8'
                      }
                    }
                  }
                }
              }
            `,
          }}
        />
      </head>
      <body className="bg-white text-black h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
