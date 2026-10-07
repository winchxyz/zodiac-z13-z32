# Name-frequency lists

Built by `python tools/lm_build_names.py` (re-runnable; raw downloads in `raw/`).

| File | Rows | Content |
|---|---|---|
| `first_male.tsv` | 10,853 | male first names, `NAME<TAB>weight` |
| `first_female.tsv` | 16,831 | female first names, `NAME<TAB>weight` |
| `first_all.tsv` | 24,490 | both sexes, `weight = 0.5*male + 0.5*female` |
| `surnames.tsv` | 175,879 | surnames, `NAME<TAB>weight` |
| `names_stats.json` | | row counts, source sizes, weight sums |

All names are upper-case A-Z only. Rows are sorted by weight, highest first. A weight is
an estimated **relative frequency**: the share of people with that name. It is not
renormalised over the list. Weights sum to about 0.975 for first names and about 0.904
for surnames, because the source lists leave out the rarest names.

## Sources

| Raw file | Source | Notes |
|---|---|---|
| `raw/dist.male.first`, `raw/dist.female.first`, `raw/dist.all.last` | 1990 US Census name files, https://www2.census.gov/topics/genealogy/1990surnames/ | Columns: name, frequency in percent, cumulative percent, rank. Covers about 90% of the population. Frequencies are printed to 3 decimals. |
| `raw/names2010.zip` (`Names_2010Census.csv`) | 2010 US Census surnames, https://www2.census.gov/topics/genealogy/2010surnames/names.zip | 162,253 surnames that occur at least 100 times, with exact counts. A final row, `ALL OTHER NAMES`, holds 29,312,001 people. The total of all rows is 294,979,229. |
| `raw/ssa_name-counts_jsvine.csv` | SSA national baby-name data (https://www.ssa.gov/oact/babynames/limits.html), using the CSV from https://github.com/jsvine/babynames (`data/name-counts.csv`, columns `year,name,sex,count`, 1880-2012) | ssa.gov answered the scripted download of `names.zip` with HTTP 403 (Akamai "Access Denied"). We did not try to get around the block, so we used jsvine's repository. It concatenates SSA's own `yobYYYY.txt` files. Spot check: 1880, Mary, F = 7,065, the same as the SSA file. SSA lists only name/sex/year combinations with at least 5 births. |

## Formulas

**First names.** Computed separately for each sex s.

```
p_SSA(n)  = sum over birth years 1900..1955 of SSA count(n, s, year)
            / sum over the same years of all SSA counts for sex s
            (56,170,503 male and 59,321,149 female births in those years)
p_C90(n)  = 1990 Census frequency percent / 100
weight(n) = 0.75 * p_SSA(n) + 0.25 * p_C90(n)       (a source that lacks the name adds 0)
```

- **Why SSA:** births from 1900 to 1955 cover the people who were roughly 15 to 70
  years old in 1970, which is the adult population at the time of the letters.
- **Why the 1990 Census:** it is given a quarter of the weight because it records names
  as people reported them, including nicknames such as BOB, BILL and JIM. The SSA
  records rarely contain those forms.

**Surnames.**

```
p_C90(n)  = 1990 Census frequency percent / 100
p_C10(n)  = 2010 count(n) / 294,979,229
weight(n) = (2/3) * p_C90(n) + (1/3) * p_C10(n)     (a source that lacks the name adds 0)
```

1990 gets two thirds of the weight because it is closer to 1970.

**Smoothing of the 1990 tail.** The 1990 files print frequencies to only 3 decimals, and
69,960 of the 88,799 surnames show `0.000`. For any 1990 name printed below 0.010%, the
frequency is estimated from the slope of the cumulative-percent column over ±200 ranks:

```
f = (cum[i+200] - cum[i-200]) / 400
```

The window shrinks at the ends of the list. The estimate is then clamped to the interval
that the printed rounded value allows, [printed - 0.0005, printed + 0.0005].

## Caveats

- The SSA counts for people born before 1937 come from Social Security card
  applications, most of them filed in adulthood after 1936. So the early birth years
  under-count people who died young or never applied.
- A name that appears only in the 1990 Census list (mostly nicknames) gets only the
  Census term, so its weight is at most a quarter of its 1990 share.
- The lists contain only the letters A-Z. Hyphens and apostrophes do not occur in the
  sources.
