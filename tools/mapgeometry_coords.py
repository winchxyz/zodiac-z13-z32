"""tools/mapgeometry_coords.py - collect ground coordinates for sites and georeference landmarks.

Writes results/mapgeometry/coords_raw.json: for each entry the coordinate source
(fixed value with citation, Wikipedia API, or Nominatim) and the result.
Run: python tools/mapgeometry_coords.py [--offline]
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeometry_fetch as F  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'results', 'mapgeometry', 'coords_raw.json')

# (id, label, kind, method, query-or-value, note)
# kind: zodiac = Zodiac-related site; claim = a point a published proposal names; landmark = georeference landmark
ENTRIES = [
    ('MTD', 'Mt. Diablo summit (Mount Diablo Base and Meridian initial point)', 'origin', 'fixed', (37.881697781, -121.914154997),
     'NGS value quoted on Wikipedia "Mount Diablo"'),
    ('LHR', 'Lake Herman Road (Faraday/Jensen, 1968-12-20)', 'zodiac', 'fixed', (38.09489167, -122.14395556),
     'Wikipedia "Zodiac Killer" OSM location map, mark-coord1'),
    ('BRS', 'Blue Rock Springs Park lot (Ferrin/Mageau, 1969-07-04)', 'zodiac', 'fixed', (38.12598889, -122.19109444),
     'Wikipedia "Zodiac Killer" OSM location map, mark-coord2'),
    ('LB', 'Lake Berryessa, Twin Oak Ridge (Hartnell/Shepard, 1969-09-27)', 'zodiac', 'fixed', (38.56341389, -122.23178611),
     'Wikipedia "Zodiac Killer" OSM location map, mark-coord3'),
    ('STINE', 'Washington & Cherry, Presidio Heights (Stine, 1969-10-11)', 'zodiac', 'fixed', (37.78818611, -122.45709444),
     'Wikipedia "Zodiac Killer" OSM location map, mark-coord4'),
    ('RADETICH', '643 Waller St, Haight-Ashbury (Sgt. Radetich, 1970-06-19)', 'zodiac', 'nominatim', '643 Waller Street, San Francisco',
     'address from SFPD memorial record (search summary); the .38 shooting the June 26 letter claims'),
    ('JOHNS_VERNALIS', 'Vernalis on Hwy 132 (Kathleen Johns stop, 1970-03-22; reported near I-5 west of Modesto)', 'zodiac', 'wiki', 'Vernalis, California',
     'proxy: the stop was on westbound Hwy 132 near I-5; Vernalis is on Hwy 132 a few miles east of I-5; uncertainty several miles'),
    ('JOHNS_PATTERSON', 'Patterson (Johns escaped nearby, reported to Patterson police)', 'zodiac', 'wiki', 'Patterson, California', 'town centre'),
    ('BATES', 'Terracina Drive by Riverside City College (Cheri Jo Bates, 1966-10-30)', 'zodiac', 'nominatim', 'Terracina Drive, Riverside, California', ''),
    ('NAPA_PHONE', 'Napa car-wash phone booth, 1231 Main St (Berryessa call)', 'zodiac', 'nominatim_box', ('1231 Main Street', (-122.32, 38.33, -122.26, 38.27)), 'Napa city box'),
    ('VALLEJO_PHONE', 'Springs Rd & Tuolumne St, Vallejo (Blue Rock Springs call)', 'zodiac', 'nominatim', 'Springs Road & Tuolumne Street, Vallejo', ''),
    ('CHRONICLE', 'San Francisco Chronicle, 901 Mission St', 'zodiac', 'nominatim', '901 Mission Street, San Francisco', ''),
    ('PUC', 'Pacific Union College, Angwin (Hartnell/Shepard school)', 'zodiac', 'wiki', 'Pacific Union College', ''),
    ('LASS', 'Sahara Tahoe casino, Stateline NV (Donna Lass, 1970-09-06)', 'zodiac', 'nominatim', 'Stateline, Nevada', 'town centre proxy'),
    ('INGLESIDE', 'SFPD Ingleside Station (Grinell / InStepWithTheStars target area)', 'claim', 'nominatim', 'Ingleside Police Station, San Francisco', ''),
    ('DMW_PT', 'DMW / Stampher point (38.10995 N, 122.18535 W)', 'claim', 'fixed', (38.10995, -122.18535), 'Stampher GitHub (research/z32_map.md 6.6)'),
    ('PRAETORIAN_PT', 'Praetorian triangle centre (37.867 N, 121.914 W)', 'claim', 'fixed', (37.867, -121.914), 'Praetorian blog (research/z32_map.md 6.10)'),
    ('SOUTH_TAHOE_MS', 'South Tahoe Middle School (Ziraoui)', 'claim', 'nominatim', 'South Tahoe Middle School', ''),
    ('LAKE_SPAULDING', 'Lake Spaulding (Dickinson)', 'claim', 'wiki', 'Lake Spaulding', ''),
    # georeference landmarks (printed features with well-defined points)
    ('L_TAM', 'Mt. Tamalpais East Peak', 'landmark', 'nominatim_box', ('East Peak', (-122.62, 37.95, -122.55, 37.91)), ''),
    ('L_SCARPER', 'Scarper Peak', 'landmark', 'nominatim', 'Scarper Peak, San Mateo County', ''),
    ('L_MORENA', 'Sierra Morena', 'landmark', 'nominatim', 'Sierra Morena, San Mateo County', ''),
    ('L_MAGUIRE', 'Maguire Peaks', 'landmark', 'nominatim', 'Maguire Peaks', ''),
    ('L_GGB', 'Golden Gate Bridge mid-span', 'landmark', 'fixed', (37.8199, -122.4783), 'Wikipedia "Golden Gate Bridge" infobox'),
    ('L_ALCATRAZ', 'Alcatraz Island', 'landmark', 'wiki', 'Alcatraz Island', ''),
    ('L_YBI', 'Yerba Buena Island', 'landmark', 'wiki', 'Yerba Buena Island', ''),
    ('L_PILLAR', 'Pillar Point', 'landmark', 'nominatim', 'Pillar Point, San Mateo County', ''),
    ('L_CLAYTON', 'Clayton (town)', 'landmark', 'wiki', 'Clayton, California', ''),
    ('L_DANVILLE', 'Danville (town)', 'landmark', 'wiki', 'Danville, California', ''),
    ('L_SUNOL', 'Sunol (town)', 'landmark', 'wiki', 'Sunol, California', ''),
    ('L_HMB', 'Half Moon Bay (town)', 'landmark', 'wiki', 'Half Moon Bay, California', ''),
    ('L_LIVERMORE', 'Livermore (town)', 'landmark', 'wiki', 'Livermore, California', ''),
    ('L_ANTIOCH', 'Antioch (town)', 'landmark', 'wiki', 'Antioch, California', ''),
    ('L_NOVATO', 'Novato (town)', 'landmark', 'wiki', 'Novato, California', ''),
    ('L_LAHONDA', 'La Honda (town)', 'landmark', 'wiki', 'La Honda, California', ''),
    ('L_MILPITAS', 'Milpitas (town)', 'landmark', 'wiki', 'Milpitas, California', ''),
    ('L_STINSON', 'Stinson Beach (town)', 'landmark', 'wiki', 'Stinson Beach, California', ''),
    ('L_CROCKETT', 'Crockett (town)', 'landmark', 'wiki', 'Crockett, California', ''),
    ('L_ALAMO', 'Alamo (town)', 'landmark', 'wiki', 'Alamo, California', ''),
]


def main():
    offline = '--offline' in sys.argv
    out = {}
    for eid, label, kind, method, q, note in ENTRIES:
        rec = dict(id=eid, label=label, kind=kind, method=method, query=q if method != 'fixed' else None, note=note)
        if method == 'fixed':
            rec['lat'], rec['lon'] = q
            rec['source'] = note
        elif method == 'wiki':
            r = F.wiki_coords(q, offline=offline)
            if r:
                rec['lat'], rec['lon'] = r[0], r[1]
                rec['source'] = 'Wikipedia API coordinates of "%s"' % r[2]
        elif method in ('nominatim', 'nominatim_box'):
            if method == 'nominatim_box':
                r = F.nominatim_search(q[0], viewbox=q[1], limit=3, offline=offline)
            else:
                r = F.nominatim_search(q, limit=3, offline=offline)
            if r:
                rec['lat'], rec['lon'] = float(r[0]['lat']), float(r[0]['lon'])
                rec['source'] = 'Nominatim: %s (%s/%s)' % (r[0]['display_name'][:120], r[0].get('category'), r[0].get('type'))
                rec['alternatives'] = [(float(x['lat']), float(x['lon']), x['display_name'][:80]) for x in r[1:]]
        if 'lat' not in rec:
            rec['source'] = 'NOT FOUND'
        out[eid] = rec
        print('%-16s %-10s %s' % (eid, ('%.5f' % rec['lat']) if 'lat' in rec else '-', rec['source'][:110]))
    F.save()
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
