"""Generate *public* browser configuration from GitHub Actions environment variables."""
import json, os, pathlib, re
url=os.environ.get('PUBLIC_SUPABASE_URL','').strip().rstrip('/')
key=os.environ.get('PUBLIC_SUPABASE_ANON_KEY','').strip()
if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',url):
    raise SystemExit('Missing/invalid PUBLIC_SUPABASE_URL; expected https://PROJECT.supabase.co')
if not key or len(key)<16 or any(x in key.lower() for x in ('service_role','sb_secret_')):
    raise SystemExit('Missing/unsafe PUBLIC_SUPABASE_ANON_KEY; use only publishable/anon key')
out=pathlib.Path(__file__).resolve().parents[1]/'config.js'
out.write_text('/* Public browser config. Never put service_role keys here. */\nwindow.DANYUL_CLOUD_CONFIG = '+json.dumps({'supabaseUrl':url,'publishableKey':key})+';\n')
print('Created public config.js; no credentials printed.')
