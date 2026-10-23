#!/usr/bin/env python3
"""Build the Visuals category pages and the home-page category cards.

Inputs
  assets/performances/manifest.json   original 8 performance items
  assets/visuals/manifest.json        optional: new items, one per photo/video
                                      (category, file, title, venue, caption,
                                       link, source, cover, ...)
  index.html                          source of the shared head/nav/footer

Outputs (static HTML, safe to commit)
  visuals/<slug>/index.html           one page per category
  index.html                          the 4 cards between the VISUALS-CARDS markers

Run:  python scripts/build-visuals.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'

CATEGORIES = [
    ('college-events', 'College events',
     'College fests and campus concerts: packed grounds, thousands of voices and zero dead moments.'),
    ('sangeet', 'Sangeet',
     'Sangeet, cocktail and reception nights. Soft when the moment calls for it, explosive when the dance floor demands it.'),
    ('cultural-events', 'Cultural events',
     'Cultural and public programmes where the stage is big and the audience is bigger.'),
    ('corporate-events', 'Corporate events',
     'Brand launches and corporate shows. Rock, Bollywood anthems and metal vibes, tuned to your event.'),
]
SLUGS = [c[0] for c in CATEGORIES]
PHONE = 'tel:+919630039087'

# How the original 8 performance items map onto categories (07/08 are held out
# until their event is known).
LEGACY_CATEGORY = {'01': 'corporate-events', '02': 'college-events', '03': 'college-events',
                   '04': 'college-events', '05': 'college-events', '06': 'college-events'}
LEGACY_POS = {'02': '50% 0%', '03': '50% 100%', '05': '50% 0%', '07': '50% 40%', '08': '50% 40%'}
LEGACY_ALT = {
    '01': 'Pyro flames in front of the Toyota sign at the Phoenix Citadel corporate show',
    '02': 'The band posing on a red carpet of confetti in front of a huge college crowd at night',
    '03': 'Vocalist singing into the mic above a cheering college crowd under purple lights',
    '04': 'Naman on stage in a white mesh vest under a cloud of stage smoke at IES University',
    '05': 'Close-up of the live flute performance on stage',
    '06': 'Vocalist in a bright headband mid-song at a college show',
}


def esc(s):
    return html.escape(s or '', quote=True)


def video_id(link):
    m = re.search(r'/reel/([\w-]+)/', link or '')
    if m:
        return m.group(1)
    m = re.search(r'(?:youtu\.be/|[?&]v=|/shorts/)([\w-]{11})', link or '')
    return m.group(1) if m else None


def find_video(photo):
    """A self-hosted clip named like the photo (assets/visuals/videos/<stem>.mp4) plays in the lightbox."""
    stem = Path(photo).stem
    for ext in ('mp4', 'webm'):
        if (ROOT / 'assets/visuals/videos' / f'{stem}.{ext}').exists():
            return f'assets/visuals/videos/{stem}.{ext}'
    return ''


def make_item(m, base, category, alt=None, pos='50% 50%'):
    link = m.get('link') or ''
    is_yt = 'youtu' in link
    is_reel = '/reel/' in link
    kind = 'youtube' if is_yt else 'instagram'
    embed = video_id(link) if (is_yt or is_reel) else ''
    if is_yt:
        cta = 'Watch on YouTube'
    elif is_reel:
        cta = 'Watch on Instagram'
    else:
        cta = 'View on Instagram'
    return {
        'category': category,
        'img': f'{base}/{m["file"]}',
        'alt': alt or f'{m.get("title", "")}{" — " + m["venue"] if m.get("venue") else ""}',
        'title': m.get('title') or 'Live',
        'venue': m.get('venue') or 'Live',
        'desc': m.get('caption') or '',
        'pos': m.get('pos') or pos,
        'link': link,
        'embed': embed or '',
        'video': find_video(m['file']),
        'kind': kind,
        'cta': cta,
        'play': bool(embed) or bool(find_video(m['file'])),
        'cover': bool(m.get('cover')),
    }


# Items kept out of the pages until someone confirms they're fine to publish.
HOLD = {
    'sangeet/01-udta-punjab-sangeet.jpg': 'LED wall shows a name; confirm with the family first',
}

# Short label shown next to a card title when no venue is known.
CATEGORY_LABEL = {'college-events': 'College', 'sangeet': 'Sangeet',
                  'cultural-events': 'Cultural', 'corporate-events': 'Corporate'}


def load_items():
    items = {slug: [] for slug in SLUGS}
    new_links = set()
    new_path = ROOT / 'assets/visuals/manifest.json'
    new = json.loads(new_path.read_text(encoding='utf8')) if new_path.exists() else []
    for m in new:
        if m.get('link'):
            new_links.add(m['link'])

    legacy = ROOT / 'assets/performances/manifest.json'
    if legacy.exists():
        for m in json.loads(legacy.read_text(encoding='utf8')):
            num = m['file'][:2]
            cat = LEGACY_CATEGORY.get(num)
            # the new manifest may re-cover the same reel: keep only one copy
            if cat and m.get('link') not in new_links:
                items[cat].append(make_item(m, 'assets/performances', cat, LEGACY_ALT.get(num), LEGACY_POS.get(num, '50% 50%')))

    for m in new:
        cat = m.get('category')
        if cat not in items or m.get('file') in HOLD:
            continue
        # a YouTube copy plays inside the page with sound; an Instagram embed can't
        if 'youtu' in (m.get('alt_link') or ''):
            m = {**m, 'link': m['alt_link']}
        it = make_item(m, 'assets/visuals', cat)
        if not m.get('venue'):
            it['venue'] = CATEGORY_LABEL[cat]
        items[cat].append(it)

    for cat in items:  # cover first, otherwise keep manifest order
        items[cat].sort(key=lambda it: not it['cover'])
    return items


# ---------- shared pieces pulled from index.html ----------
def between(text, start, end):
    a = text.index(start)
    b = text.index(end, a) + len(end)
    return text[a:b]


def to_subpage(fragment):
    """Rewrite home-relative links/assets so a fragment works from visuals/<slug>/."""
    fragment = fragment.replace('href="#', 'href="../../index.html#')
    fragment = fragment.replace('src="./assets/', 'src="../../assets/')
    fragment = fragment.replace('href="./contact/"', 'href="../../contact/"')
    fragment = fragment.replace('href="./contact"', 'href="../../contact/"')
    fragment = fragment.replace('href="./index.html', 'href="../../index.html')
    return fragment


def shared(index_html):
    css_version = re.search(r'styles\.css\?v=(\d+)', index_html).group(1)
    pixel = between(index_html, '<!-- Meta Pixel Code -->', '<!-- End Meta Pixel Code -->')
    favicon = re.search(r'<link rel="icon"[^>]*>', index_html, re.S).group(0)
    preconnect = '\n  '.join(re.findall(r'<link rel="preconnect"[^>]*>', index_html))
    fonts = re.search(r'<link rel="stylesheet"\s+href="https://fonts\.googleapis\.com[^>]*>', index_html).group(0)
    nav = between(index_html, '<nav aria-label="Main"', '</nav>')
    drawer_start = index_html.index('<div id="mobile-menu"')
    drawer_end = index_html.index('<!-- Hero Main Typography', drawer_start)
    drawer = index_html[drawer_start:drawer_end].rstrip()
    footer = between(index_html, '<footer id="join"', '</footer>')
    return {
        'css_version': css_version, 'pixel': pixel, 'favicon': favicon,
        'preconnect': preconnect, 'fonts': fonts,
        'nav': to_subpage(nav), 'drawer': to_subpage(drawer), 'footer': to_subpage(footer),
    }


LIGHTBOX = '''<div id="lookbook-lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Performance preview">
    <div class="lightbox-content">
      <button id="lightbox-close" class="lightbox-close" type="button" aria-label="Close dialog">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="lightbox-img-wrap" id="lightbox-media">
        <img id="lightbox-img" src="" alt="">
        <iframe id="lightbox-frame" title="Performance video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin" style="display: none; border: 0"></iframe>
      </div>

      <div class="lightbox-details">
        <span id="lightbox-era" class="xc"
          style="font-size: 12px; font-weight: 800; letter-spacing: .25em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px"></span>
        <h3 id="lightbox-title" class="serif"
          style="margin: 0 0 16px; font-size: clamp(36px, 4vw, 54px); font-style: italic; line-height: 1"></h3>
        <p id="lightbox-desc" style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #CFC7BE"></p>
        <div style="border-top: 1px solid var(--border-light); padding-top: 18px">
          <a id="lightbox-link" href="#" target="_blank" rel="noopener noreferrer" class="btn-primary x"
            style="display: inline-flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 24px; border-radius: 999px; background: var(--accent, #b31f12); color: #0B0A09; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase"></a>
        </div>
      </div>
    </div>
  </div>'''

ARROW = '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 17 17 7M8 7h9v9"></path>
              </svg>'''


def count_label(n):
    if not n:
        return 'Coming soon'
    return f'{n} moment' + ('' if n == 1 else 's')


def cover_of(items):
    for it in items:
        if it['cover']:
            return it
    return items[0] if items else None


def home_cards(items):
    out = ['<div class="cat-grid">']
    for slug, name, _ in CATEGORIES:
        its = items[slug]
        cov = cover_of(its)
        if cov:
            art = (f'<img src="{esc(cov["img"])}" alt="" loading="lazy" decoding="async" '
                   f'style="object-position: {esc(cov["pos"])}">')
        else:
            art = '<span class="cat-card-soon serif" aria-hidden="true">Soon</span>'
        out.append(f'''
        <a class="cat-card{'' if cov else ' cat-card--empty'}" href="visuals/{slug}/">
          <div class="cat-card-img">{art}</div>
          <div class="cat-card-body">
            <span class="cat-card-count xc">{count_label(len(its))}</span>
            <h3 class="serif">{esc(name)}</h3>
            <span class="cat-card-arrow" aria-hidden="true">↗</span>
          </div>
        </a>''')
    out.append('\n      </div>')
    return ''.join(out)


def gallery_cards(its):
    figs = []
    for i, it in enumerate(its):
        play = ('\n              <span class="look-play" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" '
                'fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></span>') if it['play'] else ''
        data = (f'data-title="{esc(it["title"])}" data-venue="{esc(it["venue"])}" data-desc="{esc(it["desc"])}" '
                f'data-link="{esc(it["link"])}" data-embed="{esc(it["embed"])}" '
                f'data-video="{"../../" + esc(it["video"]) if it["video"] else ""}" data-kind="{it["kind"]}" '
                f'data-cta="{esc(it["cta"])}" data-img="../../{esc(it["img"])}" data-alt="{esc(it["alt"])}" '
                f'data-pos="{esc(it["pos"])}"')
        figs.append(f'''
        <figure class="look" {data} style="margin: 0; display: flex; flex-direction: column; gap: 14px">
          <div style="position: relative">
            <div class="look-img"
              style="position: relative; overflow: hidden; aspect-ratio: 3 / 4.3; background: #1A1714; cursor: pointer"
              data-look-index="{i}">
              <img src="../../{esc(it["img"])}" alt="{esc(it["alt"])}" loading="lazy" decoding="async"
                style="display: block; width: 100%; height: 100%; object-fit: cover; object-position: {esc(it["pos"])}">
              <span class="x"
                style="position: absolute; left: 14px; bottom: 12px; font-size: 12px; font-weight: 900; letter-spacing: .14em; color: #F3EEE8">{i + 1:02d}</span>{play}
            </div>
            <button type="button" class="notch look-notch-btn" data-look-index="{i}" aria-label="Open {esc(it["title"])}"
              style="position: absolute; top: 0; right: 0; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; background: #0B0A09; color: #F3EEE8; border: 0">
              {ARROW}
            </button>
          </div>
          <figcaption
            style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(243,238,232,.16)">
            <span class="serif" style="font-size: 24px; font-style: italic">{esc(it["title"])}</span>
            <span class="xc"
              style="font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #A39C94; text-align: right">{esc(it["venue"].split(",")[0])}</span>
          </figcaption>
        </figure>''')
    return '\n'.join(figs)


def more_cards(items, current):
    out = ['<div class="cat-grid cat-grid--more">']
    for slug, name, _ in CATEGORIES:
        if slug == current:
            continue
        its = items[slug]
        cov = cover_of(its)
        art = (f'<img src="../../{esc(cov["img"])}" alt="" loading="lazy" decoding="async" style="object-position: {esc(cov["pos"])}">'
               if cov else '<span class="cat-card-soon serif" aria-hidden="true">Soon</span>')
        out.append(f'''
        <a class="cat-card{'' if cov else ' cat-card--empty'}" href="../{slug}/">
          <div class="cat-card-img">{art}</div>
          <div class="cat-card-body">
            <span class="cat-card-count xc">{count_label(len(its))}</span>
            <h3 class="serif">{esc(name)}</h3>
            <span class="cat-card-arrow" aria-hidden="true">↗</span>
          </div>
        </a>''')
    out.append('\n      </div>')
    return ''.join(out)


def page(sh, items, slug, name, blurb):
    its = items[slug]
    if its:
        body = f'<div class="looks cat-looks">\n{gallery_cards(its)}\n      </div>'
    else:
        body = f'''<div class="cat-empty">
        <p class="serif">Photos and videos from {esc(name.lower())} are on their way.</p>
        <p>Want to see what a {esc(name.lower().rstrip("s"))} set looks like? Call us and we will send you the reel.</p>
        <a href="../../contact/" class="btn-primary x book-btn">Book the band · Contact us →</a>
      </div>'''
    title = f'{name} — Naman Musica'
    return f'''<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(blurb)} Live visuals from NAMANMUSICA, the high-energy live band from Indore.">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(blurb)}">
  <meta property="og:type" content="website">

  {sh['favicon']}

  {sh['preconnect']}
  {sh['fonts']}

  <link rel="stylesheet" href="../../styles.css?v={sh['css_version']}">

  {sh['pixel']}
</head>

<body>
  <header class="cat-top" style="position: relative; background: #0B0A09">
    {sh['nav']}

    {sh['drawer']}
  </header>

  <main class="cat-page">
    <div class="cat-wrap">
      <a href="../../index.html#visuals" class="xc cat-back">← All visuals</a>
      <div class="cat-head">
        <span class="xc book-pill"><span aria-hidden="true"></span>Visuals</span>
        <h1 class="serif">{esc(name)}</h1>
        <p>{esc(blurb)}</p>
      </div>

      {body}

      <div class="cat-more">
        <h2 class="x book-sub">More visuals</h2>
        {more_cards(items, slug)}
      </div>

      <div class="book-cta">
        <a href="../../contact/" class="btn-primary x book-btn">Book the band · Contact us →</a>
        <a href="../../index.html#book" class="btn-ghost x book-btn book-btn-ghost">What we play</a>
      </div>
    </div>
  </main>

  {sh['footer']}

  <!-- ======================================================================
       LIGHTBOX
       ====================================================================== -->
  {LIGHTBOX}

  <script src="../../lead.js?v=1"></script>
  <script src="../../main.js?v=26"></script>
</body>

</html>
'''


def main():
    index_html = INDEX.read_text(encoding='utf8')
    items = load_items()
    sh = shared(index_html)

    for slug, name, blurb in CATEGORIES:
        out = ROOT / 'visuals' / slug / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page(sh, items, slug, name, blurb), encoding='utf8', newline='\n')

    # home cards between markers (first run: replace the old gallery grid)
    cards = f'<!-- VISUALS-CARDS:START -->\n      {home_cards(items)}\n      <!-- VISUALS-CARDS:END -->'
    if '<!-- VISUALS-CARDS:START -->' in index_html:
        index_html = re.sub(r'<!-- VISUALS-CARDS:START -->.*?<!-- VISUALS-CARDS:END -->',
                            lambda m: cards, index_html, flags=re.S)
    else:
        a = index_html.index('<!-- 4 Looks Grid with Staggered Visual Alignment -->')
        b = index_html.index('\n    </div>\n  </section>', a)
        index_html = index_html[:a] + cards + '\n' + index_html[b:]
    INDEX.write_text(index_html, encoding='utf8', newline='\n')
    print({s: len(items[s]) for s in SLUGS})


if __name__ == '__main__':
    main()
