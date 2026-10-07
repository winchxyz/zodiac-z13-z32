'use strict';
/**
 * tools/lead_torpedo_lists.js - the a-priori theme word lists for the `torpedo` look-elsewhere task.
 *
 * Written BEFORE any null-key result was looked at. The only result known when the lists were written
 * was the claim under test itself (DREAM A TORPEDO / DR EAT A TORPEDO under the Z340 key).
 *
 *   node tools/lead_torpedo_lists.js            # writes results/lead/torpedo/theme_lists.json
 *
 * Categories (each word upper case, A-Z only):
 *   bomb      ~150 bomb / explosive / weapon / attack words (incl. firearms, blades, poisons, war vessels).
 *   letter    content words of the April 20, 1970 letter itself (both pages, diagram labels included,
 *             as written AND corrected spelling), from the Wikisource transcription and the scans
 *             data/images/z13_letter_1970-04-20_p1_commons.gif and z13_letter_1970-04-20_p2_bomb_zkf.jpg.
 *             Function words are removed.
 *   zodiac    content words (>= 4 letters) of the Z408 and Z340 plaintexts, extracted by script from
 *             data/ciphers/z408.json and z340.json (never printed), minus stopwords.
 *   insult    insults / taunts a writer might aim at Marsh, the police or the press.
 *   place     case places, Bay Area places, US states, large US cities, Marsh's Golden / Colorado.
 *   case      people, institutions and cipher words of the case (MARSH, DOCTOR, POLICE, CIPHER, ...).
 *   firstname first names: top 1000 of data/names/first_all.tsv, length >= 4, that are NOT among the
 *             3000 most frequent words of the common vocabulary (so WILL, MARK, ROSE do not count).
 *   surname   surnames: top 3000 of data/names/surnames.tsv, length >= 4, same common-word exclusion.
 * A "full name" hit (firstname word immediately followed by a surname-list word, both from the unfiltered
 * top-1000 first / top-5000 surname lists) is computed by tools/lead_torpedo_core.js, not listed here.
 */
const fs = require('fs');
const path = require('path');
const lm = require('./lm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'results', 'lead', 'torpedo', 'theme_lists.json');

const BOMB = `
BOMB BOMBS BOMBED BOMBER BOMBERS BOMBING BOMBLET HBOMB ABOMB PIPEBOMB FIREBOMB
TORPEDO TORPEDOS TORPEDOES TORPEDOED DYNAMITE DYNAMITED TNT NITRO NITROGLYCERIN NITROGLYCERINE GELIGNITE
CORDITE TROTYL PICRIC EXPLOSIVE EXPLOSIVES EXPLODE EXPLODED EXPLODES EXPLOSION EXPLOSIONS
DETONATE DETONATED DETONATOR DETONATORS DETONATION BLAST BLASTS BLASTED BLASTING BLOWUP KABOOM BOOM
FUSE FUSES FUZE MINE MINES LANDMINE MINEFIELD GRENADE GRENADES SHELL SHELLS SHELLFIRE MORTAR MORTARS
ROCKET ROCKETS MISSILE MISSILES WARHEAD WARHEADS NAPALM POWDER GUNPOWDER BLACKPOWDER CHARGE CHARGES
DEPTHCHARGE SHRAPNEL PETARD FIRECRACKER CAPS BLASTCAP PRIMER ATOMIC ATOM NUCLEAR NUKE MOLOTOV INCENDIARY
GUN GUNS GUNMAN GUNFIRE GUNSHOT RIFLE RIFLES PISTOL PISTOLS REVOLVER SHOTGUN CARBINE MAUSER LUGER COLT
MAGNUM DERRINGER WINCHESTER REMINGTON BROWNING BULLET BULLETS AMMO AMMUNITION CARTRIDGE CARTRIDGES SHOT
SHOTS SHOOT SHOOTS SHOOTING SNIPER TRIGGER SILENCER MUZZLE MACHINEGUN CANNON CANNONS ARTILLERY BAZOOKA
KNIFE KNIVES BLADE DAGGER SWORD BAYONET MACHETE AXE HATCHET CLUB GARROTE NOOSE ROPE
POISON POISONS CYANIDE ARSENIC STRYCHNINE GAS
WEAPON WEAPONS ARMS ARSENAL ARMAMENT
SUB SUBMARINE UBOAT WARSHIP DESTROYER CRUISER BATTLESHIP FRIGATE TANK TANKS
`;

// April 20, 1970 letter: all words of both pages and the diagram labels, as written and corrected.
const LETTER_ALL = `
THIS IS THE ZODIAC SPEAKING BY WAY HAVE YOU CRACKED LAST CIPHER I SENT MY NAME
AM MILDLY CEROUS CURIOUS AS TO HOW MUCH MONEY ON HEAD NOW HOPE DO NOT THINK THAT WAS ONE WHO WIPED OUT
BLUE MEANNIE MEANIE WITH A BOMB AT COP STATION EVEN THOUGH TALKED ABOUT KILLING SCHOOL CHILDREN
IT JUST WOULDNT DOO MOVE IN SOMEONE ELSES TERITORY TERRITORY BUT THERE MORE GLORY KILLING THAN CID KID
BECAUSE CAN SHOOT BACK KILLED TEN PEOPLE DATE WOULD BEEN LOT EXCEPT BUS DUD SWAMPED RAIN WE HAD WHILE
NEW SET UP LIKE SUN LIGHT SUNLIGHT EARLY MORNING STRING OF BOMBS TIMER CAR BAT BATTERY
ARE PHOTO ELECTRIC SWICHES SWITCHES SWITCH WHEN BEAM BROKEN CLOSES CIRCUIT OPENS WHICH MAKES MAKS CLOUDY DAY
DISCONNECT DISCON SO WONT GO OFF ACCID ACCIDENT PS FUN TRYING FIGGURE FIGURE SFPD
`;

const STOP = new Set(`
A AN THE AND OR BUT IF OF TO IN ON AT BY FOR WITH FROM AS IS AM ARE WAS WERE BE BEEN BEING HAVE HAS HAD
DO DOES DID NOT NO YES I ME MY WE US OUR YOU YOUR HE HIM HIS SHE HER IT ITS THEY THEM THEIR THIS THAT
THESE THOSE WHO WHOM WHICH WHAT WHEN WHERE WHY HOW SO THAN THEN THERE HERE EVEN THOUGH ABOUT JUST
WOULD WOULDNT COULD SHOULD CAN WILL SHALL MAY MIGHT MUST ONE ALL ANY SOME UP OUT OFF GO WAY MUCH MORE
VERY TOO ALSO ONLY OVER INTO UPON WHILE NOW LIKE GET GOT ARE BECAUSE PS WONT DONT DOO
`.split(/\s+/).filter(Boolean));

const INSULT = `
FOOL FOOLS FOOLED FOOLISH IDIOT IDIOTS MORON MORONS DUMB DUMMY DUMMIES STUPID JERK JERKS CREEP LIAR LIARS
COWARD COWARDS LOSER LOSERS SUCKER SUCKERS DOPE DOPES DOLT NUTS NUTTY CRAP DAMN HELL BASTARD JACKASS ASS
SCREW SCREWED HAHA LAUGH JOKE JOKER CLOWN CLOWNS CHUMP CHUMPS SAP SAPS GOON SLOB UGLY RAT RATS SNOB PHONY
FAKE FRAUD DUNCE NITWIT BOOB BOZO BUM BUMS LOUSE SKUNK WEASEL DOG DOGS BLOCKHEAD BONEHEAD DUMBBELL BRAT
PUNK NERD SISSY CHICKEN PIG PIGS SWINE QUACK HACK FAILURE FAIL FAILED LOSE LOST DUPE DUPED GULLIBLE
EAT EATS TAUNT DARE DARED NEVER CANT CANNOT TRY
`;

const PLACE = `
VALLEJO BENICIA NAPA BERRYESSA PRESIDIO SAN FRANCISCO FRISCO OAKLAND BERKELEY SOLANO MARIN SONOMA
RIVERSIDE DIABLO TAHOE MODESTO FRESNO SACRAMENTO RICHMOND CONCORD MARTINEZ PETALUMA STOCKTON
LAKE HERMAN BLUEROCK CALIFORNIA CALIF GOLDEN DENVER COLORADO BOULDER MINES
ALABAMA ALASKA ARIZONA ARKANSAS CONNECTICUT DELAWARE FLORIDA GEORGIA HAWAII IDAHO ILLINOIS INDIANA IOWA
KANSAS KENTUCKY LOUISIANA MAINE MARYLAND MASSACHUSETTS MICHIGAN MINNESOTA MISSISSIPPI MISSOURI MONTANA
NEBRASKA NEVADA OHIO OKLAHOMA OREGON PENNSYLVANIA TENNESSEE TEXAS UTAH VERMONT VIRGINIA WASHINGTON
WISCONSIN WYOMING DAKOTA CAROLINA JERSEY YORK
BOSTON CHICAGO DALLAS HOUSTON DETROIT PHOENIX SEATTLE PORTLAND MIAMI ATLANTA RENO VEGAS TUCSON ELPASO
OMAHA TULSA MEMPHIS NASHVILLE ORLANDO TAMPA DENVER SALEM EUGENE SPOKANE TACOMA FRESNO ANAHEIM HOLLYWOOD
ALAMEDA PASADENA LONGBEACH SANDIEGO SANJOSE LOSANGELES PARIS LONDON ROME TOKYO MEXICO CANADA HAVANA SAIGON
`;

const CASE = `
MARSH DOCTOR DR PROF PROFESSOR POLICE COP COPS SFPD COPPER FUZZ CHRONICLE EXAMINER EDITOR PAPER NEWS
PRESS REPORTER TOSCHI ARMSTRONG AVERY BELLI HARDEN HARDENS FBI CIA NAVY ARMY MARINE MARINES
CIPHER CIPHERS CODE CODES KEY KEYS NAME NAMES SECRET CLUE CLUES CRYPTOGRAM CRACK CRACKED SOLVE SOLVED
ZODIAC SIGN STAR STARS TAURUS CANCER ARIES CRYPTO
`;

function words(s) {
  return [...new Set(s.split(/\s+/).map((w) => w.trim().toUpperCase()).filter((w) => /^[A-Z]+$/.test(w)))];
}

function readTsv(rel, n) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'latin1').split('\n').filter(Boolean);
  return lines.slice(0, n).map((l) => l.split('\t')[0]);
}

function main() {
  const commonOrder = readTsv('data/lm/words_common.tsv', 1e9);
  const commonRank = new Map(commonOrder.map((w, i) => [w, i + 1]));
  const top3000 = new Set(commonOrder.slice(0, 3000));

  const letter = words(LETTER_ALL).filter((w) => !STOP.has(w) && w.length >= 2);

  // Zodiac's own cipher vocabulary, segmented by script from the solved plaintexts (not printed).
  const zv = new Set();
  for (const f of ['z408.json', 'z340.json']) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ciphers', f), 'utf8'));
    const pt = String(d.plaintext_corrected || d.plaintext).toUpperCase().replace(/[^A-Z]/g, '');
    // segment in overlapping chunks of 60 letters to keep the Viterbi cheap
    for (let i = 0; i < pt.length; i += 40) {
      const seg = lm.wordSegment(pt.slice(i, i + 60));
      for (const w of seg.words) if (w.length >= 4 && !STOP.has(w) && commonRank.has(w)) zv.add(w);
    }
  }

  const first1000 = readTsv('data/names/first_all.tsv', 1000);
  const sur3000 = readTsv('data/names/surnames.tsv', 3000);
  const firstname = first1000.filter((w) => w.length >= 4 && !top3000.has(w));
  const surname = sur3000.filter((w) => w.length >= 4 && !top3000.has(w));

  const out = {
    tool: 'tools/lead_torpedo_lists.js',
    created: new Date().toISOString(),
    note: 'Lists fixed before any null-key run. Words outside the common vocabulary can never be segmented as words by lm.wordSegment and are kept only for the substring counts.',
    lists: {
      bomb: words(BOMB),
      letter,
      zodiac: [...zv].sort(),
      insult: words(INSULT),
      place: words(PLACE),
      case: words(CASE),
      firstname,
      surname,
    },
    fullname: { first: readTsv('data/names/first_all.tsv', 1000), surname: readTsv('data/names/surnames.tsv', 5000) },
  };
  out.counts = Object.fromEntries(Object.entries(out.lists).map(([k, v]) => [k, { n: v.length, inCommonVocab: v.filter((w) => commonRank.has(w)).length }]));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.counts));
  console.log('bomb words not in the common vocabulary:', out.lists.bomb.filter((w) => !commonRank.has(w)).join(' '));
}

main();
