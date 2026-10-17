"""Streamlit host for the self-contained racing portfolio experience."""
import base64
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'docs'
st.set_page_config(page_title='Against the odds · Corinne Bish', page_icon='🏇', layout='wide', initial_sidebar_state='collapsed')
st.markdown('''<style>
header[data-testid="stHeader"],footer,#MainMenu,[data-testid="stToolbar"]{display:none!important}
.block-container,[data-testid="stMainBlockContainer"]{padding:0!important;max-width:100%!important}
iframe{display:block;width:100%!important;height:100dvh!important;border:0}
[data-testid="stAppViewContainer"]{overflow:hidden}
[data-testid="stMain"]{overflow:hidden}
</style>''', unsafe_allow_html=True)

@st.cache_data
def page_html():
    html = (SITE/'index.html').read_text()
    css = (SITE/'styles.css').read_text()
    for font in ['display','inter']:
        encoded = base64.b64encode((SITE/f'fonts/{font}.woff2').read_bytes()).decode()
        css = css.replace(f"url('fonts/{font}.woff2')",f"url('data:font/woff2;base64,{encoded}')")
    html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>{css}</style>')
    for name in ['vendor/d3.min.js','vendor/three.min.js','data.js','scene.js','app.js']:
        # Escape HTML script terminators inside any embedded string.
        script = (SITE/name).read_text().replace('</script', '<\\/script')
        html = html.replace(f'<script src="{name}"></script>', f'<script>{script}</script>')
    return html

components.html(page_html(), height=1000, scrolling=True)
