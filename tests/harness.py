"""Shared test helpers: start headless Chrome on the local build, boot the game, step it by hand.
   The game exposes G.manual (no own loop), G.stepFrame(dt), G.noRender (simulate without drawing), G.camHook."""
import asyncio, pathlib, io
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist' / 'test.html').as_uri()
OUT = ROOT / 'tests' / 'out'
CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

# step n frames without drawing, then draw one (for screenshots)
STEP = '(n) => { G.noRender = true; for (let k = 0; k < n; k++) G.stepFrame(1/60); G.noRender = false; G.stepFrame(1/60); }'

class Game:
    def __init__(self, browser, page):
        self.browser, self.page, self.errors = browser, page, []

    async def js(self, code, arg=None):
        return await (self.page.evaluate(code) if arg is None else self.page.evaluate(code, arg))

    async def step(self, n=1):
        await self.page.evaluate(STEP, n)

    async def shot(self, path=None):
        from PIL import Image
        img = Image.open(io.BytesIO(await self.page.screenshot()))
        if path:
            OUT.mkdir(parents=True, exist_ok=True); img.save(OUT / path)
        return img

async def open_game(pw, width=480, height=360, touch=False, hud=False):
    exe = '/opt/google/chrome/chrome'
    kw = {'executable_path': exe} if pathlib.Path(exe).exists() else {}
    browser = await pw.chromium.launch(headless=True, args=CHROME_ARGS, **kw)
    ctx = await browser.new_context(viewport={'width': width, 'height': height}, has_touch=touch, is_mobile=touch)
    page = await ctx.new_page()
    g = Game(browser, page)
    page.on('pageerror', lambda e: g.errors.append(str(e)))
    # network errors (fonts, CDN) are expected offline; real script errors are not
    page.on('console', lambda m: g.errors.append('console.error: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    await page.goto(URL)
    await page.wait_for_function('() => typeof G !== "undefined" && G.cam && document.getElementById("boot").classList.contains("gone")', timeout=90000)
    await page.evaluate('(hud) => { G.manual = true; if (!hud) document.getElementById("app").classList.add("nohud"); }', hud)
    return g

def sheet(images, cols, cell=(240, 180)):
    """paste images into a contact sheet"""
    from PIL import Image
    rows = (len(images) + cols - 1) // cols
    out = Image.new('RGB', (cell[0] * cols, cell[1] * rows))
    for i, im in enumerate(images):
        out.paste(im.resize(cell), ((i % cols) * cell[0], (i // cols) * cell[1]))
    return out
