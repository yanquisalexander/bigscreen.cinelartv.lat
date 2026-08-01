declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'tv-player-controls': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'tv-ad-overlay': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};
