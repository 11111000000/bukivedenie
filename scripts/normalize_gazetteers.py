#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GZ = ROOT / 'data' / 'gazetteers'


def strip_parenthetical(s: str) -> str:
    # remove parenthetical parts like (графиня) anywhere
    return re.sub(r"\s*\([^)]*\)", "", s)


def strip_quotes_and_spaces(s: str) -> str:
    if s is None:
        return s
    s = s.strip()
    # remove surrounding quotes and guillemets
    s = s.strip('"\'')
    s = s.strip('«»')
    # normalize whitespace
    s = re.sub(r"\s+", " ", s)
    return s


def normalize_name(original: str) -> str:
    s = original
    s = strip_quotes_and_spaces(s)
    s = strip_parenthetical(s)
    s = strip_quotes_and_spaces(s)
    return s


def split_aliases(original: str):
    # If the original contains comma or slash, split into variants
    parts = re.split(r"[,/]+", original)
    parts = [strip_quotes_and_spaces(p) for p in parts if p.strip()]
    return parts


def load_characters():
    originals = []
    ids_map = {}

    # load CSV files if present
    for csv_name in ('список_персонажей.csv', 'персонажи_уник.csv'):
        p = GZ / csv_name
        if not p.exists():
            continue
        with p.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get('name') or row.get('Name')
                idv = row.get('id') or row.get('Id') or row.get('ID')
                if not name or not name.strip():
                    continue
                name = name.strip()
                originals.append((name, idv))
                ids_map.setdefault(name, []).append(idv)

    # load simple json list
    p = GZ / 'war_and_peace_characters.json'
    if p.exists():
        with p.open(encoding='utf-8') as f:
            j = json.load(f)
            for name in j.get('characters', []):
                if not name or not name.strip():
                    continue
                originals.append((name, None))

    return originals, ids_map


def build_characters():
    originals, ids_map = load_characters()
    groups = {}
    generated_id_counter = 1

    for original, csv_id in originals:
        orig = strip_quotes_and_spaces(original)
        canonical = normalize_name(orig)
        canonical_lower = canonical.lower()

        # collect aliases from original if it contains comma or slash
        aliases = []
        if ',' in orig or '/' in orig:
            parts = split_aliases(orig)
            for p in parts:
                np = normalize_name(p)
                if np and np != canonical:
                    aliases.append(np)

        entry = groups.get(canonical_lower)
        if not entry:
            entry = {
                'ids': [],
                'originals': [],
                'aliases': set(),
                'canonical_name': canonical,
            }
            groups[canonical_lower] = entry

        entry['originals'].append(orig)
        if csv_id:
            entry['ids'].append(csv_id)
        for a in aliases:
            entry['aliases'].add(a)

    # finalize entries and assign ids
    results = []
    for i, (clower, entry) in enumerate(sorted(groups.items())):
        if entry['ids']:
            id_chosen = entry['ids'][0]
        else:
            id_chosen = f'char_{generated_id_counter}'
            generated_id_counter += 1

        # combine originals unique
        originals_unique = []
        for o in entry['originals']:
            if o not in originals_unique:
                originals_unique.append(o)

        aliases_list = sorted(entry['aliases'])

        results.append({
            'id': id_chosen,
            'original_name': originals_unique[0],
            'canonical_name': entry['canonical_name'],
            'canonical_lower': clower,
            'aliases': aliases_list,
        })

    return results


def load_places():
    p = GZ / 'war_and_peace_places_osm.csv'
    places = []
    if not p.exists():
        return places
    with p.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            place = row.get('Place') or row.get('place')
            modern = row.get('ModernName') or row.get('ModernName') or row.get('Modern')
            country = row.get('Country')
            lat = row.get('Lat')
            long = row.get('Long') or row.get('Lng')
            if not place:
                continue
            place = strip_quotes_and_spaces(place)
            modern = strip_quotes_and_spaces(modern) if modern else ''
            country = strip_quotes_and_spaces(country) if country else ''
            key = re.sub(r"[^\w\-]+", "_", place.lower(), flags=re.UNICODE).strip('_')
            places.append({
                'place': place,
                'modern_name': modern,
                'country': country,
                'lat': float(lat) if lat and lat.strip() else None,
                'long': float(long) if long and long.strip() else None,
                'key': key,
            })
    # deduplicate by key
    uniq = {}
    for p in places:
        if p['key'] in uniq:
            # keep first (but ensure lat/long present if missing)
            existing = uniq[p['key']]
            if (existing.get('lat') is None or existing.get('long') is None) and (p.get('lat') is not None):
                uniq[p['key']] = p
        else:
            uniq[p['key']] = p

    return list(uniq.values())


def write_characters(results):
    out_csv = GZ / 'war_and_peace_characters_normalized.csv'
    out_json = GZ / 'war_and_peace_characters_normalized.json'

    with out_csv.open('w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'original_name', 'canonical_name', 'canonical_lower', 'aliases'])
        for r in results:
            writer.writerow([r['id'], r['original_name'], r['canonical_name'], r['canonical_lower'], json.dumps(r['aliases'], ensure_ascii=False)])

    with out_json.open('w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def write_places(places):
    out = GZ / 'war_and_peace_places_normalized.json'
    with out.open('w', encoding='utf-8') as f:
        json.dump(places, f, ensure_ascii=False, indent=2)


def main():
    chars = build_characters()
    places = load_places()

    write_characters(chars)
    write_places(places)

    summary = {
        'characters_count': len(chars),
        'places_count': len(places),
        'characters_csv': str(GZ / 'war_and_peace_characters_normalized.csv'),
        'characters_json': str(GZ / 'war_and_peace_characters_normalized.json'),
        'places_json': str(GZ / 'war_and_peace_places_normalized.json'),
    }

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
