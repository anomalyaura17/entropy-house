import './globals.css';

export const metadata = {
  title: 'Entropy House — A thermodynamic escape room',
  description: 'Enter a cinematic house where thermodynamics has broken. Solve four real physics puzzles and restore the arrow of time.',
  openGraph: {
    title: 'Entropy House',
    description: 'A physics-flavored escape room where the laws of thermodynamics have gone beautifully wrong.',
    images: ['/assets/entropy-house-hero.png'],
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
