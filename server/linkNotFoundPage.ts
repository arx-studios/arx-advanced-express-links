// A self-contained page for unknown or deleted short links. Returned straight
// from the redirect route handler so the hot path never renders React.
export const LINK_NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Link not found | axl</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
    background: #000 radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,.08), transparent 70%);
    color: #fff; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main {
    width: 100%; max-width: 420px; text-align: center; padding: 40px 32px;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 24px;
  }
  .brand { font-size: 12px; font-weight: 600; letter-spacing: .25em; text-transform: uppercase; color: rgba(255,255,255,.4); }
  h1 { font-size: 30px; font-weight: 600; letter-spacing: -.03em; margin: 20px 0 10px; }
  p { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,.45); }
  a.btn {
    display: inline-block; margin-top: 28px; padding: 12px 28px; border-radius: 999px;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15);
    color: #fff; font-size: 14px; font-weight: 500; text-decoration: none; transition: all .2s;
  }
  a.btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.25); }
</style>
</head>
<body>
<main>
  <div class="brand">axl</div>
  <h1>Link not found</h1>
  <p>This short link doesn't exist, has expired, or was deleted by its owner.</p>
  <a class="btn" href="/">Go to axl</a>
</main>
</body>
</html>`;
