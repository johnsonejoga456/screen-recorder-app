<<<<<<< HEAD
import './globals.css'; // Import the global styles
=======
import './globals.css';
>>>>>>> 9c4bf377acfaf54c4935c5fb3f83636b63ec7e81
import Providers from './providers';
import { ReactNode } from 'react';

interface RootLayoutProps {
<<<<<<< HEAD
  children: ReactNode; // Define the type for children
=======
  children: ReactNode;
>>>>>>> 9c4bf377acfaf54c4935c5fb3f83636b63ec7e81
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}