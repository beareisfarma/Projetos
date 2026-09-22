import json
import re
from pathlib import Path
from docx import Document

SOURCE = Path('/workspace/scratch/4f3b392c8927/upload/Roteiro_Medicos_Semana_Completa(1).docx')
OUTPUT = Path(__file__).parent / 'dist' / 'medicos.json'

day_map = {
    'SEGUNDA-FEIRA': 'Segunda', 'TERÇA-FEIRA': 'Terça',
    'QUARTA-FEIRA': 'Quarta', 'QUINTA-FEIRA': 'Quinta',
    'SEXTA-FEIRA': 'Sexta'
}

doc = Document(SOURCE)
day = shift = neighborhood = address = None
records = []

for paragraph in doc.paragraphs:
    text = paragraph.text.strip()
    if not text:
        continue
    if text in day_map:
        day = day_map[text]
        shift = neighborhood = address = None
        continue
    if text.startswith('MANHÃ —'):
        shift = 'Manhã'
        neighborhood = address = None
        continue
    if text.startswith('TARDE —'):
        shift = 'Tarde'
        neighborhood = address = None
        continue
    if text.startswith('📍'):
        neighborhood = text.replace('📍', '', 1).strip()
        address = None
        continue
    if not (day and shift and neighborhood):
        continue
    if text.startswith('•'):
        match = re.match(r'^•\s*(\d{2}:\d{2})–(\d{2}:\d{2})\s+—\s+(.+?)(?:\s+—\s+sala/complemento\s+(.+?))?\s*(⚠)?$', text)
        if not match:
            continue
        start, end, name, room, warning = match.groups()
        # Remove source annotations that were typed into a few cells.
        if room:
            room = re.sub(r'\s+OK\s*$', '', room).strip().rstrip('.')
        name = re.sub(r'\s+OK\s*$', '', name).strip()
        records.append({
            'day': day, 'shift': shift, 'neighborhood': neighborhood,
            'address': address or 'Endereço não informado',
            'start': start, 'end': end, 'name': name,
            'room': room or '', 'warning': bool(warning or start == end)
        })
    else:
        address = text

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'records': len(records), 'output': str(OUTPUT)}, ensure_ascii=False))
