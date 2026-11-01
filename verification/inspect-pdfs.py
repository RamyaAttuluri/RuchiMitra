"""Inspect generated files offline and rasterize pages for actual script review."""
from pathlib import Path
import json
import pymupdf
results=[]
for file in Path('verification').glob('recipe-*.pdf'):
    doc=pymupdf.open(file)
    text='\n'.join(page.get_text() for page in doc)
    fonts=sorted({font[3] for page in doc for font in page.get_fonts()})
    missing=[]
    for page in doc:
        for span in page.get_texttrace():
            missing.extend(char[0] for char in span['chars'] if char[1]==0)
    assert not missing, f'Missing glyphs in {file}'
    if file.stem=='recipe-long':
        normalized=' '.join(text.split())
        for number in range(1,41):
            assert f'Ingredient {number}' in normalized
        for number in range(1,31):
            assert f'Complete step {number}' in normalized
    first=doc[0].get_pixmap(matrix=pymupdf.Matrix(1.2,1.2))
    first.save(str(file.with_suffix('.png')))
    Path(file.with_suffix('.txt')).write_text(text,encoding='utf-8')
    results.append({'file':str(file),'pages':len(doc),'fonts':fonts,'characters':len(text),'missingGlyphs':missing,'bytes':file.stat().st_size})
Path('verification/pdf-inspection.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
