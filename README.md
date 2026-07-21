# Kimya — Sermons, Verses & Prayers Journal

A quiet, offline-first web app for recording sermons, saving favourite Bible verses, tracking prayer requests, and journaling reflections.

## Features

- **Sermon Notes** — Record date, preacher, topic, and detailed notes
- **Favourite Verses** — Save Bible references with text and personal notes
- **Prayer Requests** — Track prayers with status (Active, Answered, Archived)
- **Journal** — Quick reflection entries with timestamps
- **Profile** — Personal info, notification preferences, theme settings
- **Data Management** — Export/Import JSON backups, clear all data
- **Offline First** — Works without internet after first load
- **PWA** — Installable on mobile and desktop
- **Dark Mode** — Light, Dark, or System theme

## Tech Stack

- Pure HTML, CSS, JavaScript (no frameworks)
- LocalStorage for data persistence
- Service Worker for offline caching
- Web App Manifest for PWA installability

## Getting Started

### Option 1: GitHub Pages (Recommended)

1. Fork this repository
2. Go to **Settings → Pages**
3. Select source: **Deploy from a branch**
4. Choose branch: `main` / folder: `/ (root)`
5. Your app will be live at `https://yourusername.github.io/kimya-app/`

### Option 2: Local Development

```bash
# Clone the repo
git clone https://github.com/yourusername/kimya-app.git
cd kimya-app

# Serve locally (Python 3)
python -m http.server 8000

# Or with Node.js
npx serve .

# Open http://localhost:8000
```

### Option 3: Netlify / Vercel

1. Push to GitHub
2. Connect repo to [Netlify](https://netlify.com) or [Vercel](https://vercel.com)
3. Deploy with default settings

## Data Storage

All data is stored **locally in your browser** using LocalStorage. Nothing is sent to any server. To backup your data, use the **Export Data** button in Profile → Data Management.

## Browser Support

- Chrome / Edge / Safari / Firefox (latest 2 versions)
- iOS Safari 14+
- Chrome Android

## License

MIT License — feel free to use, modify, and share.
