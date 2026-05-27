const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const PLATFORM = 'https://tokenequityx.co.zw';

const STATIC_PAGES = [
  { path: '/',             changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/about',        changeFrequency: 'monthly', priority: 0.8 },
  { path: '/markets',      changeFrequency: 'daily',   priority: 0.9 },
  { path: '/market-watch', changeFrequency: 'daily',   priority: 0.8 },
  { path: '/technology',   changeFrequency: 'monthly', priority: 0.7 },
  { path: '/regulation',   changeFrequency: 'monthly', priority: 0.7 },
  { path: '/workflows',    changeFrequency: 'monthly', priority: 0.6 },
  { path: '/resources',    changeFrequency: 'monthly', priority: 0.6 },
  { path: '/defi',         changeFrequency: 'monthly', priority: 0.6 },
  { path: '/blog',         changeFrequency: 'daily',   priority: 0.9 },
  { path: '/contact',      changeFrequency: 'yearly',  priority: 0.4 },
];

export default async function sitemap() {
  const staticUrls = STATIC_PAGES.map(p => ({
    url:             `${PLATFORM}${p.path}`,
    lastModified:    new Date(),
    changeFrequency: p.changeFrequency,
    priority:        p.priority,
  }));

  let blogUrls = [];
  try {
    const res = await fetch(`${API}/blog`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts)) {
        blogUrls = posts.map(post => ({
          url:             `${PLATFORM}/blog/${post.slug}`,
          lastModified:    new Date(post.updated_at || post.published_at || post.created_at),
          changeFrequency: 'monthly',
          priority:        post.featured ? 0.9 : 0.7,
        }));
      }
    }
  } catch {
    // Blog API unavailable at build time — static pages still included
  }

  return [...staticUrls, ...blogUrls];
}
