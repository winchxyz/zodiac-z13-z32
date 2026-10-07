"""tools/z13names_nicknames.py - build nickname first-name lists for the z13names task.

Writes results/z13names/lists/nick_male.tsv, nick_female.tsv and nick_all.tsv
(NAME<TAB>weight, sorted by weight), plus nick_map.json (the hand-made map).

Weight model (an explicit, crude assumption): each formal first name's weight
from data/names/first_<sex>.tsv is split equally between the formal name and
its k nicknames, so a nickname gets  sum over its formal names f of w(f)/(1+k_f).
If the nickname itself is in the first-name list with a larger weight (the 1990
Census records some nicknames), that larger weight is used instead.  The list
holds ONLY nicknames (the formal names are already covered by first_*.tsv).

Usage: python tools/z13names_nicknames.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'results', 'z13names', 'lists')

MALE = {
    'ROBERT': ['BOB', 'BOBBY', 'ROB', 'ROBBIE', 'BERT'],
    'WILLIAM': ['BILL', 'BILLY', 'WILL', 'WILLIE'],
    'JAMES': ['JIM', 'JIMMY', 'JAMIE'],
    'JOHN': ['JACK', 'JOHNNY'],
    'RICHARD': ['DICK', 'RICK', 'RICH', 'RICKY', 'RICHIE'],
    'CHARLES': ['CHARLIE', 'CHUCK', 'CHAS'],
    'THOMAS': ['TOM', 'TOMMY'],
    'JOSEPH': ['JOE', 'JOEY'],
    'EDWARD': ['ED', 'EDDIE', 'TED', 'NED'],
    'THEODORE': ['TED', 'TEDDY', 'THEO'],
    'MICHAEL': ['MIKE', 'MICKEY'],
    'DAVID': ['DAVE', 'DAVEY'],
    'DANIEL': ['DAN', 'DANNY'],
    'DONALD': ['DON', 'DONNIE'],
    'RONALD': ['RON', 'RONNIE'],
    'KENNETH': ['KEN', 'KENNY'],
    'GERALD': ['JERRY', 'GERRY'],
    'LAWRENCE': ['LARRY'],
    'ANTHONY': ['TONY'],
    'STEPHEN': ['STEVE'],
    'STEVEN': ['STEVE'],
    'FREDERICK': ['FRED', 'FREDDIE'],
    'ALFRED': ['AL', 'ALF', 'FRED'],
    'ALBERT': ['AL', 'BERT'],
    'ALAN': ['AL'],
    'ALLEN': ['AL'],
    'HAROLD': ['HAL', 'HARRY'],
    'HENRY': ['HANK', 'HARRY'],
    'LEONARD': ['LEN', 'LENNY'],
    'FRANCIS': ['FRANK'],
    'FRANKLIN': ['FRANK'],
    'SAMUEL': ['SAM', 'SAMMY'],
    'BENJAMIN': ['BEN', 'BENNY'],
    'DOUGLAS': ['DOUG'],
    'GREGORY': ['GREG'],
    'JEFFREY': ['JEFF'],
    'PATRICK': ['PAT'],
    'PETER': ['PETE'],
    'PHILIP': ['PHIL'],
    'RAYMOND': ['RAY'],
    'NICHOLAS': ['NICK'],
    'TIMOTHY': ['TIM'],
    'MATTHEW': ['MATT'],
    'ANDREW': ['ANDY', 'DREW'],
    'LOUIS': ['LOU', 'LOUIE'],
    'EUGENE': ['GENE'],
    'CLIFFORD': ['CLIFF'],
    'CHRISTOPHER': ['CHRIS'],
    'WALTER': ['WALT', 'WALLY'],
    'VINCENT': ['VINCE', 'VINNY'],
    'NORMAN': ['NORM'],
    'HERBERT': ['HERB'],
    'STANLEY': ['STAN'],
    'ARTHUR': ['ART', 'ARTIE'],
    'EDWIN': ['ED'],
    'EDGAR': ['ED'],
    'MARVIN': ['MARV'],
    'MELVIN': ['MEL'],
    'SIDNEY': ['SID'],
    'DENNIS': ['DENNY'],
    'RUSSELL': ['RUSS'],
    'NATHANIEL': ['NATE', 'NAT'],
    'ERNEST': ['ERNIE'],
    'GILBERT': ['GIL'],
    'HOWARD': ['HOWIE'],
    'CURTIS': ['CURT'],
    'RANDALL': ['RANDY'],
    'RANDOLPH': ['RANDY'],
    'LEROY': ['ROY'],
    'VICTOR': ['VIC'],
    'WALLACE': ['WALLY'],
    'GIUSEPPE': ['JOE'],
    'ABRAHAM': ['ABE'],
    'MORRIS': ['MOE'],
    'MAURICE': ['MOE'],
    'MITCHELL': ['MITCH'],
    'BRADLEY': ['BRAD'],
    'GORDON': ['GORDIE'],
    'JEROME': ['JERRY'],
    'MILTON': ['MILT'],
    'SYLVESTER': ['SLY'],
    'ZACHARY': ['ZACK'],
}

FEMALE = {
    'ELIZABETH': ['BETTY', 'BETH', 'LIZ', 'LIZZIE', 'BETSY', 'LIBBY'],
    'MARGARET': ['PEGGY', 'MAGGIE', 'MARGE', 'MEG', 'PEG', 'MARGIE'],
    'CATHERINE': ['KATHY', 'CATHY', 'KATE', 'KATIE', 'KAY'],
    'KATHERINE': ['KATHY', 'KATE', 'KATIE', 'KAY'],
    'KATHLEEN': ['KATHY', 'KATE', 'KAY'],
    'PATRICIA': ['PAT', 'PATTY', 'PATSY', 'TRISH'],
    'BARBARA': ['BARB', 'BABS'],
    'DOROTHY': ['DOT', 'DOTTIE', 'DOLLY'],
    'SUSAN': ['SUE', 'SUSIE'],
    'DEBORAH': ['DEBBIE', 'DEB'],
    'JENNIFER': ['JENNY', 'JEN'],
    'VIRGINIA': ['GINNY', 'GINGER'],
    'REBECCA': ['BECKY'],
    'JUDITH': ['JUDY'],
    'ROBERTA': ['BOBBIE'],
    'ANNA': ['ANNIE'],
    'ANN': ['ANNIE'],
    'CHRISTINE': ['CHRIS', 'CHRISSY'],
    'CAROL': ['CARRIE'],
    'CAROLYN': ['CARRIE'],
    'SANDRA': ['SANDY'],
    'PAMELA': ['PAM'],
    'CYNTHIA': ['CINDY'],
    'JOSEPHINE': ['JOSIE', 'JO'],
    'FRANCES': ['FRAN', 'FRANNIE'],
    'THERESA': ['TERRY', 'TESS'],
    'VICTORIA': ['VICKY'],
    'GERALDINE': ['GERRY'],
    'JACQUELINE': ['JACKIE'],
    'EDITH': ['EDIE'],
    'LOUISE': ['LOU'],
    'WINIFRED': ['WINNIE'],
    'CONSTANCE': ['CONNIE'],
    'EVELYN': ['EVIE'],
    'FLORENCE': ['FLO'],
    'GWENDOLYN': ['GWEN'],
    'HARRIET': ['HATTIE'],
    'JANET': ['JAN'],
    'MILDRED': ['MILLIE'],
    'VALERIE': ['VAL'],
    'ABIGAIL': ['ABBY'],
    'ANDREA': ['ANDIE'],
    'SHIRLEY': ['SHIRL'],
    'BEVERLY': ['BEV'],
    'DONNA': ['DONNIE'],
    'NANCY': ['NAN'],
    'ELEANOR': ['ELLIE', 'NELL'],
    'HELEN': ['NELL'],
    'GERTRUDE': ['GERTIE', 'TRUDY'],
    'ALEXANDRA': ['ALEX', 'SANDY'],
}


def read(fn):
    d = {}
    with open(fn, encoding='latin1') as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            n, w = ln.split('\t')
            d[n] = float(w)
    return d


def build(mapping, first):
    nick = {}
    missing = []
    for formal, nicks in mapping.items():
        wf = first.get(formal, 0.0)
        if wf == 0.0:
            missing.append(formal)
        for n in nicks:
            nick[n] = nick.get(n, 0.0) + wf / (1 + len(nicks))
    for n in list(nick):
        if first.get(n, 0.0) > nick[n]:
            nick[n] = first[n]
    return nick, missing


def write(fn, d):
    with open(fn, 'w', encoding='ascii', newline='\n') as f:
        for n, w in sorted(d.items(), key=lambda kv: -kv[1]):
            f.write('%s\t%.6e\n' % (n, w))


def main():
    os.makedirs(OUT, exist_ok=True)
    fm = read(os.path.join(ROOT, 'data', 'names', 'first_male.tsv'))
    ff = read(os.path.join(ROOT, 'data', 'names', 'first_female.tsv'))
    nm, miss_m = build(MALE, fm)
    nf, miss_f = build(FEMALE, ff)
    na = {}
    for d in (nm, nf):
        for n, w in d.items():
            na[n] = na.get(n, 0.0) + 0.5 * w
    write(os.path.join(OUT, 'nick_male.tsv'), nm)
    write(os.path.join(OUT, 'nick_female.tsv'), nf)
    write(os.path.join(OUT, 'nick_all.tsv'), na)
    in_list_m = sum(1 for n in nm if n in fm)
    in_list_f = sum(1 for n in nf if n in ff)
    info = {
        'model': 'nickname weight = sum over formal names f of w(f)/(1+k_f), or its own first-list weight if larger',
        'male': {'formal': len(MALE), 'nicknames': len(nm), 'already_in_first_male': in_list_m,
                 'weight_sum': sum(nm.values()), 'formal_missing_from_list': miss_m},
        'female': {'formal': len(FEMALE), 'nicknames': len(nf), 'already_in_first_female': in_list_f,
                   'weight_sum': sum(nf.values()), 'formal_missing_from_list': miss_f},
        'map_male': MALE, 'map_female': FEMALE,
    }
    with open(os.path.join(OUT, 'nick_map.json'), 'w', encoding='ascii') as f:
        json.dump(info, f, indent=1)
    print(json.dumps({k: v for k, v in info.items() if not k.startswith('map')}, indent=1))


if __name__ == '__main__':
    main()
