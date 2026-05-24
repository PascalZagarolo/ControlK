import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ctrlk.de';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep the app's authenticated surface, share-link tokens and
        // confirmation/utility endpoints out of search indexes.
        disallow: [
          '/api/',
          '/share/',
          '/invite/',
          '/magic-link',
          '/verify-email',
          '/reset-password',
          '/forgot-password',
          '/sign-in',
          '/sign-up',
          '/settings/',
          '/workspace/',
          '/workspaces/',
          '/inbox',
          '/notes',
          '/notes/',
          '/todos',
          '/todos/',
          '/kalender',
          '/kunden',
          '/kunden/',
          '/flotte',
          '/flotte/',
          '/vertraege',
          '/vertraege/',
          '/channels',
          '/channels/',
          '/danke',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
