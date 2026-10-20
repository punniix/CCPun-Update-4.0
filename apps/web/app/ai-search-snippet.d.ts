import type { HTMLAttributes } from 'react';

type CloudflareSearchElement = HTMLAttributes<HTMLElement> & {
  [attribute: string]: unknown;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'search-bar-snippet': CloudflareSearchElement;
      'search-modal-snippet': CloudflareSearchElement;
      'chat-bubble-snippet': CloudflareSearchElement;
    }
  }
}
