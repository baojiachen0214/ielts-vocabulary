#!/usr/bin/env python3
"""Build traceable single-word listening banks from an existing local mock corpus."""
import argparse
from collections import Counter, defaultdict
import html
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]

def build(mock_root, target):
    text = target.read_text()
    match = re.search(r'(<script[^>]*id="words-data"[^>]*>)(.*?)(</script>)', text, re.S)
    banks = {key: words for key, words in json.loads(match[2]).items() if re.fullmatch(r'20\d\d_Part[14]', key)}
    known = {word['w'].lower(): word for words in banks.values() for word in words}
    meanings = json.loads((ROOT/'data/word-meanings.json').read_text())
    excluded_names = set(json.loads((ROOT/'data/excluded-proper-names.json').read_text()))
    catalog = json.loads((mock_root/'public/data/catalog.json').read_text())
    papers = [p for block in catalog for p in block['list'] if re.match(r'^Cambridge IELTS \d+\s*Test \d+', p['title'])]
    words = {1: defaultdict(dict), 4: defaultdict(dict)}
    omitted = Counter()
    stats = Counter()
    missing = set()
    for paper in papers:
        book, test = map(int, re.search(r'IELTS (\d+)\s*Test (\d+)', paper['title']).groups())
        payload = json.loads((mock_root/f'public/data/{paper["id"]}-1.json').read_text())
        for part in payload.values():
            if not isinstance(part, dict):
                continue
            part_match = re.fullmatch(r'(?:Part|Section)\s*([14])', part.get('title', '').strip(), re.I)
            if not part_match:
                continue
            part_number = int(part_match[1])
            for page in part.get('pages', []):
                for section in page.get('sections', []):
                    for question in section.get('questions', []):
                        stats['questions_examined'] += 1
                        if str(page.get('real_type')) != '11':
                            omitted['non_text_completion_questions'] += 1
                            continue
                        answer = html.unescape(str(question.get('local_answer') or question.get('option_names') or '')).strip()
                        if re.search(r'\d', answer):
                            omitted['numbers_dates_codes'] += 1
                            continue
                        candidates = set()
                        for candidate in answer.split('|'):
                            candidate = unicodedata.normalize('NFKC', candidate.strip()).replace('’', "'").lower()
                            if candidate == 'café':
                                candidate = 'cafe'
                            if re.fullmatch(r"[a-z]+(?:[-'][a-z]+)*", candidate):
                                candidates.add(candidate)
                        if not candidates:
                            omitted['phrases_or_unreviewed_format'] += 1
                            continue
                        included = False
                        for word in candidates:
                            if word in excluded_names:
                                omitted['unreviewed_proper_name_variants'] += 1
                                continue
                            if word not in known and word not in meanings:
                                missing.add(word)
                                continue
                            question_id = f'{paper["id"]}-1-{question["sort"]}'
                            words[part_number][word][question_id] = {'paperId': str(paper['id']), 'book': book, 'test': test, 'part': part_number, 'question': int(question['sort'])}
                            included = True
                        if included:
                            stats['included_questions'] += 1
    if missing:
        raise ValueError(f'Missing meanings: {sorted(missing)}')
    for part, entries in words.items():
        generated = []
        for word, source_map in entries.items():
            existing = known.get(word, {})
            sources = sorted(source_map.values(), key=lambda s: (-s['book'], s['test'], s['question']))
            generated.append({'w': word, 'f': len({s['paperId'] for s in sources}), 'uk': existing.get('uk', ''), 'us': existing.get('us', ''), 'm': existing.get('m') or meanings[word], 'sources': sources})
        generated.sort(key=lambda w: (-w['f'], w['w']))
        banks[f'Cambridge_Part{part}'] = generated
    report = {'source': 'Local mock-system Cambridge listening answer data', 'books': sorted({int(re.search(r'IELTS (\d+)', p['title'])[1]) for p in papers}), 'papers': len(papers), **stats, 'excluded': dict(omitted), 'words_by_part': {str(part): len(entries) for part, entries in words.items()}, 'new_spellings': len((set(words[1]) | set(words[4])) - set(known)), 'frequency_definition': 'Number of distinct Cambridge test papers accepting this spelling in this part; repeated questions within the same paper count once.', 'year_policy': 'Book and Test are known; actual exam years are not inferred from book numbers or file timestamps.', 'original_year_frequency': 'Original year-list frequencies remain unchanged and are ranked separately from Cambridge paper counts.'}
    encoded = json.dumps(banks, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    target.write_text(text[:match.start(2)] + encoded + text[match.end(2):])
    (ROOT/'data/corpus-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mock-root', type=Path, required=True)
    parser.add_argument('--target', type=Path, default=ROOT/'index.html')
    args = parser.parse_args()
    build(args.mock_root, args.target)
