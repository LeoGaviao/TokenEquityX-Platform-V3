import Link from 'next/link';

const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const PLATFORM = 'https://tokenequityx.co.zw';
const GOLD     = '#C8972B';

const CAT_COLORS = {
  'Market Intelligence': 'bg-blue-900/50 text-blue-300',
  'Education':           'bg-green-900/50 text-green-300',
  'Research':            'bg-purple-900/50 text-purple-300',
  'Case Study':          'bg-amber-900/50 text-amber-300',
  'General':             'bg-gray-700 text-gray-300',
};

async function getPost(slug) {
  try {
    const res = await fetch(`${API}/blog/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAllPosts() {
  try {
    const res = await fetch(`${API}/blog`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title:       post.title,
    description: post.summary,
    openGraph: {
      title:         post.title,
      description:   post.summary,
      type:          'article',
      url:           `${PLATFORM}/blog/${post.slug}`,
      publishedTime: post.published_at || post.created_at,
      authors:       [post.author],
      images:        [{ url: '/og-image.png', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       post.title,
      description: post.summary,
      images:      ['/og-image.png'],
    },
  };
}

const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

export default async function BlogPostPage({ params }) {
  const [post, allPosts] = await Promise.all([
    getPost(params.slug),
    getAllPosts(),
  ]);

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-20 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-5xl mb-4">📝</p>
          <h1 className="text-2xl font-black mb-2">Article Not Found</h1>
          <p className="text-gray-400 mb-8">This article may have been moved or removed.</p>
          <Link href="/blog" className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const related = allPosts.filter(p => p.slug !== post.slug).slice(0, 3);
  const postUrl = `${PLATFORM}/blog/${post.slug}`;

  const jsonLd = {
    '@context':        'https://schema.org',
    '@type':           'BlogPosting',
    headline:          post.title,
    description:       post.summary,
    url:               postUrl,
    mainEntityOfPage:  { '@type': 'WebPage', '@id': postUrl },
    datePublished:     post.published_at || post.created_at,
    dateModified:      post.updated_at   || post.published_at || post.created_at,
    author:            { '@type': 'Person', name: post.author, jobTitle: post.author_role || undefined },
    publisher: {
      '@type': 'Organization',
      name:    'TokenEquityX',
      url:     PLATFORM,
      logo:    { '@type': 'ImageObject', url: `${PLATFORM}/og-image.png` },
    },
    articleSection: post.category,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-950 text-white pt-20">

        {/* Article */}
        <div className="max-w-3xl mx-auto px-6 py-16">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8 text-xs text-gray-500 flex items-center gap-1.5">
            <Link href="/"    className="hover:text-white transition-colors">Home</Link>
            <span>›</span>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <span>›</span>
            <span className="text-gray-300 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* Category + featured badge */}
          <div className="flex items-center gap-2 mb-5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[post.category] || 'bg-gray-700 text-gray-300'}`}>
              {post.category}
            </span>
            {post.featured && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">★ Featured</span>
            )}
          </div>

          <article>
            <h1 className="text-4xl font-black mb-5 leading-tight">{post.title}</h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mb-10 pb-8 border-b border-gray-800">
              <span>
                By <strong className="text-gray-200">{post.author}</strong>
                {post.author_role ? <span className="text-gray-500"> — {post.author_role}</span> : null}
              </span>
              <span className="text-gray-700">·</span>
              <time dateTime={post.published_at || post.created_at}>
                {fmt(post.published_at || post.created_at)}
              </time>
              <span className="text-gray-700">·</span>
              <span>{post.read_time}</span>
            </div>

            {/* Summary lead */}
            <p className="text-lg text-gray-300 leading-relaxed mb-8 font-medium border-l-4 pl-4"
               style={{ borderColor: GOLD }}>
              {post.summary}
            </p>

            {/* Body */}
            <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
              {post.body}
            </div>
          </article>

          {/* Social share */}
          <div className="mt-14 pt-8 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-semibold">Share this article</p>
            <div className="flex flex-wrap gap-3">
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}&via=TokenEquityX`}
                 target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors text-white">
                𝕏 &nbsp;Share on X
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                 target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 text-sm font-medium transition-colors">
                in &nbsp;Share on LinkedIn
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(post.title + '\n' + postUrl)}`}
                 target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-900/40 hover:bg-green-800/50 text-green-300 text-sm font-medium transition-colors">
                📱 &nbsp;WhatsApp
              </a>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-10">
            <Link href="/blog" className="text-sm text-gray-500 hover:text-white transition-colors">
              ← All articles
            </Link>
          </div>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="border-t border-gray-800 bg-gray-900/50 py-16 px-6">
            <div className="max-w-screen-xl mx-auto">
              <h2 className="text-xl font-black mb-8" style={{ color: GOLD }}>More Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map(p => (
                  <Link key={p.id} href={`/blog/${p.slug}`}
                    className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-6 flex flex-col transition-all group">
                    <span className={`text-xs px-2 py-0.5 rounded-full self-start mb-3 ${CAT_COLORS[p.category] || 'bg-gray-700 text-gray-300'}`}>
                      {p.category}
                    </span>
                    <h3 className="font-black text-base mb-2 leading-tight group-hover:text-yellow-300 transition-colors flex-1">
                      {p.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">{p.summary}</p>
                    <span className="text-xs text-gray-500">
                      {p.author} · {fmt(p.published_at || p.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      </div>
    </>
  );
}
