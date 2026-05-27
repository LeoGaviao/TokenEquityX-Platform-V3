export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  ['/admin/', '/api/', '/setup/'],
      },
    ],
    sitemap: 'https://tokenequityx.co.zw/sitemap.xml',
  };
}
