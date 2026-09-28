"""Rebuild the hosted index and offline snapshot after editing material JSON files.
Run: python lib/build_catalog.py
"""
from pathlib import Path
import json
folder = Path(__file__).resolve().parent
catalog = {}
for path in sorted(folder.glob('*.json'), key=lambda p: p.name.lower()):
    if path.name.lower() == 'index.json':
        continue
    record = json.loads(path.read_text(encoding='utf-8'))
    if record.get('format') != 'TE_2D_material' or record.get('version') != 1:
        raise ValueError(f'{path.name}: unsupported material format')
    catalog[path.name] = record
(folder / 'index.json').write_text(json.dumps({'files': list(catalog)}, indent=2) + '\n', encoding='utf-8')
(folder / 'catalog.js').write_text('// Generated from lib/*.json by build_catalog.py; do not edit directly.\n'
    + 'globalThis.TE_MATERIAL_CATALOG = ' + json.dumps(catalog, ensure_ascii=True, indent=2) + ';\n', encoding='utf-8')
print(f'Built index.json and catalog.js for {len(catalog)} materials.')
