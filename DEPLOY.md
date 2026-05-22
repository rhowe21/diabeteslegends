# Deploy Guide — diabeteslegends.org

Step-by-step to take this site from local files to live on `diabeteslegends.org`.

---

## 1. Wire up the contact form (5 min) — DO THIS FIRST

The form is currently pointed at a placeholder. To make submissions email `rob@diabeticsdoingthings.com`:

1. Go to https://formspree.io and sign up (free tier: 50 submissions/month).
2. Verify the email `rob@diabeticsdoingthings.com` — Formspree sends a confirmation link.
3. Create a new form. Set the destination to `rob@diabeticsdoingthings.com`.
4. Copy the form's endpoint URL (looks like `https://formspree.io/f/xqkrwabc`).
5. Open `index.html`, find the line:
   ```
   <form action="https://formspree.io/f/REPLACE_ME" method="POST" ...>
   ```
   Replace `REPLACE_ME` with your form ID (the part after `/f/`).

That's it. Submissions land in Rob's inbox.

**Free alternative:** if you'd rather skip a third party, change the form's `action` to `mailto:rob@diabeticsdoingthings.com` — but this opens the user's mail client instead of sending direct, and breaks on mobile users without configured mail apps. Formspree is the better default.

---

## 2. Push to GitHub (10 min)

```bash
cd ~/Sites/diabeteslegends

git init
git add .
git commit -m "Initial site build"
git branch -M main
```

Create a new repo on GitHub:
- Go to https://github.com/new
- Name: `diabeteslegends` (or `diabeteslegends.org` — your choice)
- Public
- Don't initialize with README (we already have files)

Then push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/diabeteslegends.git
git push -u origin main
```

---

## 3. Enable GitHub Pages (2 min)

In the GitHub repo:
1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`, folder: `/ (root)`
4. Click **Save**

GitHub will show a green box with your live URL (something like `https://YOUR_USERNAME.github.io/diabeteslegends/`). The site will be live within ~60 seconds.

The `CNAME` file in this repo already says `diabeteslegends.org`, so GitHub will recognize the custom domain and the Settings → Pages screen will show it. Check the **"Enforce HTTPS"** box — it'll be greyed out until DNS is set (next step), then enable it.

---

## 4. Point the domain at GitHub Pages (5 min setup, up to 24 hr to propagate)

In your domain registrar's DNS panel for `diabeteslegends.org`, add these records:

### Apex domain (`diabeteslegends.org`)
Four A records pointing to GitHub:
```
Type   Name   Value
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
```

### www subdomain
One CNAME so `www.diabeteslegends.org` also works:
```
Type    Name   Value
CNAME   www    YOUR_USERNAME.github.io
```

(Replace `YOUR_USERNAME` with your GitHub username — not the repo name. The trailing dot may or may not be required depending on your registrar.)

### Remove conflicting records
If your registrar set parking or default A/AAAA records on `@`, delete those first.

### Verify
- Wait 15–60 minutes, then check `https://diabeteslegends.org`.
- Use `dig diabeteslegends.org` from Terminal — you should see GitHub's `185.199.x.x` addresses.
- Back in GitHub: Settings → Pages → tick **"Enforce HTTPS"** once it's available.

---

## 5. Edits going forward

The site is plain HTML/CSS/JS — no build step. To make changes:

```bash
cd ~/Sites/diabeteslegends
# edit files
git add .
git commit -m "Update events" 
git push
```

GitHub Pages re-deploys automatically within ~30 seconds of pushing to `main`.

---

## 6. Local preview before pushing

```bash
cd ~/Sites/diabeteslegends
python3 -m http.server 8000
```

Open http://localhost:8000

---

## Adding real board headshots

The board cards currently use designed initial cards (`RH`, `LC`, `GF`). When you have headshots:

1. Drop the files into `assets/board/` named:
   - `rob.jpg`
   - `lauren.jpg`
   - `gary.jpg`
   (Square or 4:5 portrait crops work best, ~800px wide is plenty.)

2. In `index.html`, change each `<div class="board-portrait">` to:
   ```html
   <div class="board-portrait has-photo" style="--photo: url('assets/board/rob.jpg')"></div>
   ```
   (Repeat for `lauren.jpg` and `gary.jpg`.)

The CSS automatically hides the initials and shows the photo when `.has-photo` is present.

---

## Photo curation

Photos live in `assets/photos/{camp23,dallas,denver,ffl}/` — 10 photos per event, resized to 1600px wide. To swap any photo:

1. Drop your replacement into the right folder, named `dallas-1.jpg`, `denver-7.jpg`, etc.
2. Re-resize if it's a giant camera JPEG:
   ```bash
   sips -Z 1600 -s formatOptions 82 input.jpg --out output.jpg
   ```
3. Commit and push.

To add a whole new event gallery (say, Orlando '26 after the July clinic):
1. Create `assets/photos/orlando26/` and drop 10 photos named `orlando26-1.jpg` ... `orlando26-10.jpg`.
2. In `index.html`, add a tab:
   ```html
   <button class="gallery-tab" data-tab="orlando26" role="tab">Orlando '26</button>
   ```
3. In `script.js`, add to the `galleries` object:
   ```js
   orlando26: { count: 10, prefix: 'orlando26', label: 'Orlando 2026' }
   ```

---

## Files in this repo

```
diabeteslegends/
├── index.html        ← main page
├── styles.css        ← all styles
├── script.js         ← nav, gallery tabs, lightbox
├── CNAME             ← tells GitHub Pages which domain to use
├── .nojekyll         ← disables Jekyll processing (faster builds)
├── .gitignore
├── DEPLOY.md         ← this file
└── assets/
    ├── logo/         ← logo-full.png, logo-mark.png
    └── photos/
        ├── camp23/   ← 10 photos
        ├── dallas/   ← 10 photos
        ├── denver/   ← 10 photos
        └── ffl/      ← 10 photos
```
