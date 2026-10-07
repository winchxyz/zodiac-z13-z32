# The Mt. Diablo map sent with Z32

Companion to `research/z32_literature.md` and `data/ciphers/z32.json`.

Statements are tagged by kind:

- **Fact**: seen in the scans or confirmed by reputable sources.
- **Claim**: something a named person asserts.
- **Ours**: our own measurement, method stated. The first-pass scripts for this note (`z32_axes2.py`, `z32_georef.py`, `z32_claims_geo.py`, `z32_bearings.py`) were scratch files and are not in this repository. The later, reviewed recomputation of the map geometry is `tools/mapgeometry_*.py` (outputs in `results/mapgeometry/`). Both need the scans listed below, which are not redistributed (see `DATA.md`).

Images used (all in `data/images/`):

| file | what | source |
|---|---|---|
| `z32_letter_and_map_1970-06-26_commons.jpg` | letter and full map piece side by side (1746x1082) | [Commons](https://commons.wikimedia.org/wiki/File:June_26_1970_Zodiac_letter.jpg), credited to history.com |
| `z32_map_1970-06-26_large_zkf.jpg` | the Zodiac's map piece, color (936x1050) | zodiackillerfacts ([page](https://zodiackillerfacts.com/The%20Mt.%20Diablo%20Map.htm)) |
| `z32_map_1970-06-26_zodiackiller.png` | the Zodiac's map piece, black and white (640x719) | [zodiackiller.com ZMap](https://zodiackiller.com/ZMap.html) |
| `z32_map_crossed_circle_zkf.jpg`, `z32_map_magnetic_north_note_zkf.jpg` | close-ups of the marking; the right half of the second image is zodiackillerfacts' own *rotated reconstruction*, not original | [zodiackillerfacts](https://zodiackillerfacts.com/The%20Mysteries%20of%20the%20Mt.%20Diablo%20Map.htm) |
| `z32_map_phillips66_inset_unmarked_zkf.jpg`, `_front_zkf.jpg`, `_cover_legend_zkf.jpg` | an unmarked exemplar of the same Phillips 66 map: the inset, the whole sheet photographed beside a ruler (photo by Ed Neil), and the cover and legend | [zodiackillerfacts](https://zodiackillerfacts.com/The%20Mt.%20Diablo%20Map.htm) |
| `z32_little_list_letter_1970-07-26_p2/_p5_zodiackiller.png` | July 26, 1970 letter: score doodle (p. 2) and radians postscript (p. 5) | [zodiackiller.com](https://www.zodiackiller.com/Mikado1.html) |

---

## 1. Which map

- **Fact.** It is a Phillips 66 road map ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer); [zodiackillerfacts](https://zodiackillerfacts.com/The%20Mt.%20Diablo%20Map.htm)). The piece the Zodiac mailed is the inset panel titled **"SAN FRANCISCO AND VICINITY"** (title at lower left; read from all three scans).
- **Fact (exemplar).** zodiackillerfacts photographed an unmarked copy of the same map:
  - Cover: "CALIFORNIA with metropolitan maps of Los Angeles and San Francisco", Phillips 66.
  - Legend imprint: "© The H. M. Gousha Company, a subsidiary of the Times Mirror Company ... **1969 Edition**".
  - Statewide map scale: one inch equals approximately 21 miles.
  - The "San Francisco and Vicinity" inset is one panel of the sheet, the side that also carries the Los Angeles inset, the points-of-interest text and the index.

  zodiackillerfacts says the Zodiac removed this inset panel from the map ([page](https://zodiackillerfacts.com/The%20Mt.%20Diablo%20Map.htm)). (That page calls this side the "front"; it also says the Los Angeles area is on the front and both state maps are on the back.)
- **Edition: open question.** The mailed piece shows only the inset, and on the exemplar the "1969 Edition" imprint is on the legend panel, not the inset. So the edition of the Zodiac's copy is *inferred* from the matching exemplar. One social-media post asserts that the map he supplied "bears the printed imprint '1969 Edition'" ([X post](https://x.com/maddiedreese/status/2083604506592575600)); we could not confirm this from any scan of the mailed piece.
- **Printed scale (fact).** At lower left of the inset is a bar from 0 to 8 miles (ticks at 0, 1, 2, 4, 6, 8) labelled "SCALE: ONE INCH EQUALS APPROX. **6.4** MILES". In our low-resolution scans the first digit could be misread as 5. Cipher Mysteries, DMW and Grinell all give 6.4 ([Cipher Mysteries](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32); [DMW PDF](https://zodiackillerciphers.com/zks-attachments/8025.pdf); [zodiacciphers.com](https://www.zodiacciphers.com/zodiac-news/solving-the-phillips-66-map-without-the-little-list-letter)).
- **Print code.** A small code is printed at the bottom edge, near the "San Mateo Co. Mem. Park" label; it is not legible in the available scans.
- **Coverage (ours, from the georeference in section 4).** The inset's neat line spans about 47.9 ground miles east-west by 58.3 miles north-south. It runs from Novato and Vallejo in the north to San Jose in the south, and from the Pacific coast to Antioch and Livermore in the east.
  - Lake Herman Road falls about 2 miles inside the top edge.
  - Blue Rock Springs falls just outside the top edge (also noted by [zodiackillerfacts](https://zodiackillerfacts.com/radian.htm)).
  - The Stine murder site (Washington & Cherry, SF) is on the map.
  - Lake Berryessa is about 30 miles north of the map's top edge.
- **Physical size (ours, rough).** From the exemplar photo with its ruler (about 75 px per inch at the ruler), the inset's neat line measures about **6.7 in × 8.3 in**, with about ±3% error for perspective.

## 2. What the Zodiac drew on it

All of the following is **fact** read from the scans, with measurements marked **ours**.

- **Location.** A Zodiac crosshair (circle plus cross) in blue ink is drawn over **Mt. Diablo**. The map prints "Mt. Diablo 3849" (elevation in feet) with a small summit cross at the northern tip of the green Mt. Diablo State Park area.
- **Gap at the centre.** The lines are broken where they meet, so the printed peak stays visible. zodiackillerfacts notes this as deliberate ([page](https://zodiackillerfacts.com/The%20Mysteries%20of%20the%20Mt.%20Diablo%20Map.htm)).
- **Centring (ours).** On the zodiackillerfacts color scan we fitted lines to the two arms. They intersect at pixel (716.5, 323.1), which coincides with the printed summit cross to within about 1-2 px. At this scan's ground scale of 17.8 px per mile, that is about 0.1 mile. The cross is centred on the summit, not on the "Mt. Diablo" label or the park.
- **Circle (ours).** The circle is freehand and slightly oval: radius about 39-43 px (2.2-2.4 ground miles, about 0.32-0.35 in on paper). Its fitted centre lies within about 3-5 px of the axis intersection.
- **Arms and numbers.**
  - The arms extend well beyond the circle.
  - Only the top (north) arm carries an **arrowhead**.
  - A numeral is written at each arm end: **0** above the arrowhead (top), **3** at the right (east), **6** at the bottom (south), **9** at the left (west). That is, 0-3-6-9 clockwise from the top, like the 12-3-6-9 positions of a clock face with 0 in place of 12.
- **Annotation.** To the right of the 0, in three lines: "is to be / set to / Mag. N." Wikipedia paraphrases it as 0 "to be set to Mag. N." ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- **Other marks.** None visible on the three scans of the mailed piece, besides printed map content.
- **Orientation of the drawn axes (ours).** We fitted the centreline of each arm, excluding the circle and the numerals.
  - The **0-arm** is rotated **2.5° clockwise** from image-up on the zodiackillerfacts scan and **2.7°** on the Commons scan (63-66 sample rows each, rms 1.3 px). These two scans may come from the same photograph.
  - The 3-arm is rotated 0.2-1.1° clockwise from image-right.
  - On the zodiackillerfacts scan, the inset's printed right-hand neat line is vertical to within 0.05°. So image-up equals map-up.
- **Where map-up points (ours).** A similarity-transform fit of 7 landmarks (section 4) finds **true north lies 4.3° clockwise of map-up**. Leave-one-out range is 4.1-4.7°, rms residual 0.23 mile. The inset is therefore not exactly north-up.
  - The drawn 0-arm points about **1.6-1.8° west of true north**, i.e. within freehand accuracy of true north and of map-up.
  - The drawn 0 does **not** point to magnetic north, which was about 16.9° east of true north in 1970 (section 3). Setting the 0 to magnetic north means turning the cross about 17° clockwise from true north (about 18-19° from where it is drawn).

## 3. Magnetic declination at Mt. Diablo, 1970

| value | source |
|---|---|
| **16.88° E** (1970-06-26, summit 37.8817 N, 121.9142 W, model DGRF1970) | NOAA NCEI declination calculator, queried by us ([API call](https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=37.8817&lon1=-121.9142&model=IGRF&startYear=1970&startMonth=6&startDay=26&resultFormat=json&key=zNEw7)) |
| 16°53′ E = 16.9° (1970-06-26, Mt. Diablo, USSD and NAD27 datums); 17°34′ E for 1950-01-01; Bay Area range 16.3-17.7° across 1950-1970 | Foxon 2023, Table 2 ([ePrint 2023/982](https://eprint.iacr.org/2023/982)) |
| 16.5-17° E | zodiackillerfacts ([page](https://zodiackillerfacts.com/The%20Mysteries%20of%20the%20Mt.%20Diablo%20Map.htm)) |
| about 17° E | DMW 2019; Grinell 2018/2020 |
| 15° clockwise of true north | Cipher Mysteries ([page](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32)); Sundberg & Thelin 2014 |

The 15° figure disagrees with the model values; 16.9° is the best estimate. A 1970-era USGS quadrangle would print a rounded value (likely 17°). We have not checked an actual quad sheet.

**Significance of the summit (fact).** In 1851 Leander Ransom chose Mt. Diablo's summit as the initial point of the Mount Diablo Base and Meridian, the reference for land surveys across much of northern California and Nevada. Summit (NGS): 37.881697781° N, 121.914154997° W, elevation 3,849 ft ([Wikipedia: Mount Diablo](https://en.wikipedia.org/wiki/Mount_Diablo)).

## 4. Georeference of the mailed map (ours, preliminary)

- **Method.** On the zodiackillerfacts color scan (936x1050) we read the pixel positions of 7 landmarks from gridded zooms (±2-4 px):
  - the Mt. Diablo summit cross (716.5, 323.1)
  - the Clayton town marker (701.9, 247.8)
  - the Danville town marker (628, 388)
  - the Sunol town marker (713.6, 676)
  - the Half Moon Bay town marker (177, 807.6)
  - Golden Gate Bridge mid-span (164, 352)
  - the Mt. Tamalpais East Peak cross (79.2, 211.3)

  Ground coordinates came from Wikipedia. We fitted scale, rotation and offset by least squares in a local east-north frame.
- **Result.**
  - Scale: **17.82 px per ground mile**.
  - Rotation: true north lies **4.27° clockwise** of map-up.
  - rms residual: 4.0 px (0.23 mi).
- **Bar versus geography.**
  - The printed bar on the same scan measures 155.3 px for 8 miles, i.e. 19.41 px per mile.
  - Distances read with the printed bar are therefore about **9% shorter** than true ground distances. Example: Mt. Diablo to Golden Gate Bridge is 28.3 "bar miles" but 31.2 true miles.
  - If the bar is physically 1.25 in long (8 mi at 6.4 mi/in), real geography is drawn at about **6.97 ground miles per printed inch**.
  - Our rough physical measurement of the exemplar inset (6.7 in wide) gives about 6.5 mi/in for the bar (consistent with 6.4) and about 7.0-7.1 ground mi/in for the geography.
- **Why it matters.** "# inches along the radians" refers to inches on paper. A solver who converts a ground location to map inches with 6.4 mi/in will be off by about 9%. Both conversions are given in the tables below.
- **Caveats.** Town markers versus Wikipedia town-centre coordinates may differ by up to about 0.5 mile, and only one scan was used. Repeat with more landmarks and the higher-resolution SFPD photo of the map, if one is found.

## 5. Bearings and distances from the summit (ours)

- Crime-scene coordinates are from the Wikipedia infobox map ([Zodiac Killer](https://en.wikipedia.org/wiki/Zodiac_Killer)).
- Geodesics are WGS84 (Vincenty).
- Magnetic = true − 16.88°.
- "Clock" means hours clockwise from magnetic north at 30° per hour.
- "in" means printed inches, at the label scale (6.4) and at the geography-implied scale (6.97).

| site | ground mi | true bearing | magnetic bearing | clock (mag) | rad cw from mag N | rad ccw from mag N | rad cw from true N | in @6.4 | in @6.97 |
|---|---|---|---|---|---|---|---|---|---|
| Lake Herman Road (Faraday/Jensen, 1968-12-20) | 19.33 | 319.60° | 302.72° | 10.09 | 5.284 | **1.000** | 5.578 | 3.02 | 2.77 |
| Blue Rock Springs (Ferrin/Mageau, 1969-07-04) | 22.63 | 318.19° | 301.31° | 10.04 | 5.259 | 1.024 | 5.554 | 3.54 | 3.25 |
| Lake Berryessa (Hartnell/Shepard, 1969-09-27) | 50.10 | 339.92° | 323.04° | 10.77 | 5.638 | 0.645 | 5.933 | 7.83 | 7.19 |
| Washington & Cherry, SF (Stine, 1969-10-11) | 30.39 | 257.91° | 241.03° | **8.03** | 4.207 | 2.076 | 4.501 | 4.75 | 4.36 |

Angles at the summit between pairs of sites:

| pair | angle |
|---|---|
| Blue Rock Springs – Stine | **60.28°** (1.052 rad) |
| Lake Herman Road – Stine | 61.69° (1.077 rad) |
| Lake Herman Road – Blue Rock Springs | 1.41° (they are almost collinear with the summit) |
| Blue Rock Springs – Berryessa | 21.72° |
| Berryessa – Stine | 82.00° |

Coincidences worth knowing. These come from multiple comparisons, so do not over-read them:

- Lake Herman Road lies 57.28° west of 1970 magnetic north as seen from the summit, i.e. 1.000 radian counter-clockwise. With a 17° declination it is 1.002 rad.
- Blue Rock Springs is about 10:00 and the Stine site about 8:00 on a magnetic-north clock face.

## 6. Radian and map theories, with checkable numbers

1. **Gareth Penn, radian theory.** Penn says he learned of the letter in December 1980 from his father; Wikipedia dates the deduction to 1981. His article "Portrait of the Artist as a Mass Murderer" appeared in *California Magazine* in November 1981, and his book *Times 17* was published in 1987 (Foxglove Press).
   - **Claim** (*Times 17* pp. 3-4 and frontispiece, [PDF](http://zodiackillerciphers.com/images/times-17-full.pdf)): with an acetate angle of 57-58° placed with its apex on Mt. Diablo and one leg through the Blue Rock Springs murder site, the other leg passes through Presidio Heights, where Stine was killed. "The two murder sites are joined to Mount Diablo by an angle of 57-58°, one radian."
   - Wikipedia adds that Lake Herman Road lies on the same arm as Blue Rock Springs ([Wikipedia](https://en.wikipedia.org/wiki/Zodiac_Killer)).
   - **Foxon's account of the 1981 article** is a different construction ([ePrint 2023/982](https://eprint.iacr.org/2023/982) §2.1). Mt. Diablo and Lake Berryessa sit on the circumference of a watch-face circle at 7:04 and 12:00. The radius through Blue Rock Springs meets the rim at 9:00, at 58° from the radius to Mt. Diablo.
   - **Critique.** Penn used the Blue Rock Springs golf course rather than the park where the shooting happened. The correct angle is about 60°, larger than a radian (Butterfield, [zodiackillerfacts](https://zodiackillerfacts.com/radian.htm)).
   - **Ours.** 60.28° with Wikipedia's coordinates: 2.98° (5%) more than 1 rad. The Lake Herman Road and Blue Rock Springs rays differ by only 1.41°.
   - Oranchak calls the observation interesting but rejects Penn's wider mathematics ([post](https://zodiackillerciphers.com/read-gareth-penns-times-17-online/)).
2. **Sundberg & Thelin (2014).** Rotate a 24-hour watch bezel 15° for magnetic north. Chemistry read from the glyphs gives 11:00 (C 11 / H 21). The bomb is where the 11:00 radial meets a line one inch west ([Cipher Mysteries](http://www.ciphermysteries.com/2014/01/30/swedish-zodiac-killer-z32-theory); [Foxon](https://eprint.iacr.org/2023/982) §2.2).
3. **Nick Pelling.** The Zodiac stood on the peak, turned his watch so 12 faced magnetic north, and read off the time of the target; San Francisco and San Mateo fall near 8 o'clock; inches × 6.4 = miles ([Cipher Mysteries](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32)). **Ours:** the Stine site is at 8.03 o'clock (magnetic).
4. **Richard Grinell (2018, 2020) and "InStepWithTheStars".**
   - The angle is 4 rad clockwise from magnetic north: 229.2° + 17° = **246.2° true**. The distance is **5 in**. This puts the point in southern San Francisco, near Ingleside police station.
   - Supporting claim: in the July 26 doodle, the bold "0" of "SFPD=0" sits at the same angle inside the crosshair ([Foxon](https://eprint.iacr.org/2023/982) §2.3; [wiki](http://zodiackillerciphers.com/wiki/index.php?title=InStepWithTheStars); [zodiacciphers.com](https://www.zodiacciphers.com/zodiac-news/solving-the-phillips-66-map-without-the-little-list-letter)).
   - **Ours.** 246.2° true and 5 in at 6.4 mi/in (32.0 mi) lands at **37.6959 N, 122.4499 W**. With the geography-implied 6.97 mi/in (34.9 mi) it lands at 37.6795 N, 122.4976 W, near Daly City. With 16.88° declination the bearing is 246.06°.
   - **Ours.** The bold zero in the July 26 doodle measures **241-242°** clockwise from the drawn vertical (zodiackiller.com p. 2 scan; centroid against fitted axes), not 246°. That is close to the Stine site's magnetic bearing of 241.0°.
5. **DMW (2019).** Ten o'clock = 300° magnetic = **317° true**; distance **3 3/8 in** (3.36 measured) at 6.4 mi/in = 21.6 mi. DMW identifies the point as Arthur Leigh Allen's address and admits the solution is not unique ([PDF](https://zodiackillerciphers.com/zks-attachments/8025.pdf)).
   - **Ours.** 317° true and 21.6 mi lands at **38.1110 N, 122.1837 W**, 1.1 mi from the Blue Rock Springs site and 2.4 mi from Lake Herman Road. We did not geocode the private address.
6. **David Stampher (2026).** Same plaintext, with the point at **38.10995 N, 122.18535 W** ([GitHub](https://github.com/dstampher/zodiac-z32-cipher)). **Ours:** 21.61 mi at 316.85° true (299.97° magnetic), 3.38 in at 6.4 mi/in, 1.15 mi from Blue Rock Springs.
7. **Floe Foxon (2023).** Watch hands set to the 16.9° declination read 12:03, giving coordinates (r, θ) = (12 in, 3 rad). With the polar axis to the east and angles counter-clockwise, the paper puts the point on Highway 24 between Orinda and Lafayette; other axis and direction conventions give points in Lost Valley, Livermore/Pleasanton, or off the map. (3 in, 0 rad) falls on Morgan Territory Road ([ePrint 2023/982](https://eprint.iacr.org/2023/982) §4).
   - **Ours.** These placements do not match the printed scale. Lafayette and Orinda are 11-15 ground miles (1.7-2.3 printed inches) from the summit, whereas 12 in at 6.4 mi/in is 77 mi, far off the 6.7 × 8.3 in inset. Morgan Territory Road is likewise much closer than 3 in (19 mi). The scale the paper used is therefore unclear.
8. **Fayçal Ziraoui (2021).** Reads "45.609 NORT 58.719 WEST" as **geomagnetic** coordinates and places them near South Tahoe Middle School. The map is used only for the magnetic-north idea ([forum](https://forum.zodiackillerciphers.com/community/zodiac-cipher-mailings-discussion/detailed-solution-to-z13-and-z32/); [Foxon](https://eprint.iacr.org/2023/982) §2.4).
9. **Grant Dickinson (2026).** True north 17 in, then east 15 in. At 6.4 mi/in that is about 109 mi north and 96 mi east, far beyond the inset, so it must assume another map or scale. He places it at Lake Spaulding ([Cipher Mysteries comment](https://ciphermysteries.com/other-ciphers/zodiac-killer-ciphers/zodiac-killer-z32)).
10. **Praetorian / Nathan Sportsman (2026).** 15° or π/8 bearings and 16.88° declination; the triangle centre is at 37.867 N, 121.914 W, about 1 mi due south of the summit by our computation ([blog](https://www.praetorian.com/blog/a-possible-solution-to-the-zodiac-killer-z32-cipher/)).

## 7. Open questions

- Is "0 is to be set to Mag. N." telling the reader to rotate the drawn cross by the declination (about 17° clockwise), or to treat the drawn 0 as already meaning magnetic north (the Zodiac's freehand 0 is within 2° of true north)?
- Should angles be read clockwise (as the 0-3-6-9 numbering suggests) or counter-clockwise (the mathematical convention for radians)? Should they be measured from the 0-arm or from the 3-arm (the polar axis)? Foxon lists all the combinations.
- Which scale converts ground to paper (6.4 printed, or about 7.0 by geography)? And did the Zodiac measure on the paper directly?
- The edition of the mailed copy (only inferred as 1969) and the illegible print code on the inset.
