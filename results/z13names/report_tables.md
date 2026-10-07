## A. Letter-level baseline: P(a string of independent letters fits)

| variant | isomorph | simple, English letters | simple, name letters | homophonic, English letters | homophonic, name letters |
|---|---|---|---|---|---|
| z13.canonical | `abcdefegehcag` | 9.29e-8 (1 in 1.077e+7) | 9.25e-8 | 1.46e-6 (1 in 6.864e+5) | 1.71e-6 |
| z13.bracket_is_perp | `abcdefegehcag` | 9.29e-8 (1 in 1.077e+7) | 9.25e-8 | 1.46e-6 (1 in 6.864e+5) | 1.71e-6 |
| z13.reversed | `abcdeaefegchb` | 9.29e-8 (1 in 1.077e+7) | 9.25e-8 | 1.46e-6 (1 in 6.864e+5) | 1.71e-6 |
| z13.crosshair_null | `abcdedfdgcaf` | 1.71e-7 (1 in 5.845e+6) | 1.74e-7 | 1.46e-6 (1 in 6.864e+5) | 1.71e-6 |
| z13.circles_distinct | `abcdefghijcah` | 5.62e-6 (1 in 1.779e+5) | 5.29e-6 | 2.77e-4 (1 in 3620) | 3.00e-4 |
| z13.letters_literal | `abcdefegehcag` | 1.91e-14 (1 in 5.228e+13) | 8.82e-14 | 1.17e-13 (1 in 8.549e+12) | 7.81e-13 |

## B. Fits per variant, mode, list and pattern

f0/f1/f2 = number of fits with 0/1/2 filler letters at the ends (a fit = one name parse plus one filler placement). "frac" = fits / name strings of that length (x placements); "wfrac" = the same weighted by the name-frequency prior. MC = Monte Carlo estimate where the enumeration is not complete (2,000,000 samples per cell).

| variant | mode | list | pattern | f0 | f1 | f2 | frac f0 | wfrac f0 | wfrac f2 |
|---|---|---|---|---|---|---|---|---|---|
| z13.canonical | homophonic | male | FL | 72 | 3671 | 82715 | 2.21e-7 | 5.47e-8 | 3.71e-5 |
| z13.canonical | homophonic | male | FIL | 1494 | 70580 | 1249021 | 1.77e-7 | 1.18e-8 | 6.66e-5 |
| z13.canonical | homophonic | male | FML | 72182 | 1249769 | 9022046 | 2.86e-7 | 1.05e-7 | 5.51e-5 |
| z13.canonical | homophonic | male | FIIL | 33725 | 991095 | 12772348 | 1.93e-7 | 1.15e-7 | 6.28e-5 |
| z13.canonical | homophonic | male | IIL | 0 | 52 | 4576 | 0 | 0 | 7.88e-5 |
| z13.canonical | homophonic | male | LF | 56 | 6834 | 132859 | 1.72e-7 | 1.69e-9 | 9.86e-5 |
| z13.canonical | homophonic | female | FL | 321 | 17347 | 350871 | 6.32e-7 | 7.99e-8 | 1.70e-4 |
| z13.canonical | homophonic | female | FIL | 2958 | 129718 | 2070027 | 2.44e-7 | 1.39e-7 | 8.73e-5 |
| z13.canonical | homophonic | female | FML | 367670 | 5786950 | 33418411 | 1.17e-6 | 6.08e-7 | 2.20e-4 |
| z13.canonical | homophonic | female | FIIL | 76049 | 2214585 | 24783767 | 3.26e-7 | 2.53e-7 | 1.63e-4 |
| z13.canonical | homophonic | female | IIL | 0 | 52 | 4576 | 0 | 0 | 7.77e-5 |
| z13.canonical | homophonic | female | LF | 87 | 9825 | 211586 | 1.71e-7 | 9.00e-9 | 1.51e-4 |
| z13.canonical | homophonic | nick_male | FL | 2 | 40 | 1048 | 9.06e-7 | 3.26e-7 | 7.69e-5 |
| z13.canonical | homophonic | nick_male | FIL | 2 | 636 | 20324 | 2.44e-8 | 4.82e-9 | 4.85e-5 |
| z13.canonical | homophonic | nick_female | FL | 0 | 42 | 734 | 0 | 0 | 8.48e-5 |
| z13.canonical | homophonic | nick_female | FIL | 0 | 492 | 12971 | 0 | 0 | 5.98e-5 |
| z13.canonical | simple | male | FL | 6 | 520 | 17632 | 1.84e-8 | 3.23e-11 | 1.14e-5 |
| z13.canonical | simple | male | FIL | 208 | 13926 | 271533 | 2.47e-8 | 1.73e-9 | 9.42e-6 |
| z13.canonical | simple | male | FML | 9723 | 221514 | 1872735 | 3.85e-8 | 2.63e-9 | 1.33e-5 |
| z13.canonical | simple | male | FIIL | 4142 | 190197 | 2936413 | 2.37e-8 | 3.55e-9 | 9.01e-6 |
| z13.canonical | simple | male | IIL | 0 | 0 | 874 | 0 | 0 | 2.36e-5 |
| z13.canonical | simple | male | LF | 12 | 1240 | 28372 | 3.68e-8 | 4.04e-10 | 2.40e-5 |
| z13.canonical | simple | female | FL | 44 | 3089 | 66775 | 8.66e-8 | 2.16e-8 | 1.64e-5 |
| z13.canonical | simple | female | FIL | 234 | 21063 | 394847 | 1.93e-8 | 5.71e-9 | 1.10e-5 |
| z13.canonical | simple | female | FML | 51521 | 952161 | 6430738 | 1.64e-7 | 4.73e-8 | 2.62e-5 |
| z13.canonical | simple | female | FIIL | 11454 | 435399 | 5503042 | 4.92e-8 | 7.40e-9 | 2.98e-5 |
| z13.canonical | simple | female | IIL | 0 | 0 | 874 | 0 | 0 | 1.83e-5 |
| z13.canonical | simple | female | LF | 3 | 1019 | 34333 | 5.91e-9 | 1.96e-11 | 2.36e-5 |
| z13.canonical | simple | nick_male | FL | 0 | 3 | 216 | 0 | 0 | 4.92e-5 |
| z13.canonical | simple | nick_male | FIL | 0 | 51 | 4222 | 0 | 0 | 5.25e-6 |
| z13.canonical | simple | nick_female | FL | 0 | 4 | 184 | 0 | 0 | 1.68e-5 |
| z13.canonical | simple | nick_female | FIL | 0 | 49 | 2620 | 0 | 0 | 6.26e-6 |
| z13.bracket_is_perp | homophonic | male | FL | 72 | n/e | n/e | 2.21e-7 | 5.47e-8 | n/e |
| z13.bracket_is_perp | homophonic | male | FIL | 1494 | n/e | n/e | 1.77e-7 | 1.18e-8 | n/e |
| z13.bracket_is_perp | homophonic | male | FML | 72182 | n/e | n/e | 2.86e-7 | 1.05e-7 | n/e |
| z13.bracket_is_perp | homophonic | male | FIIL | 33725 | n/e | n/e | 1.93e-7 | 1.15e-7 | n/e |
| z13.bracket_is_perp | homophonic | male | IIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | homophonic | male | LF | 56 | n/e | n/e | 1.72e-7 | 1.69e-9 | n/e |
| z13.bracket_is_perp | homophonic | female | FL | 321 | n/e | n/e | 6.32e-7 | 7.99e-8 | n/e |
| z13.bracket_is_perp | homophonic | female | FIL | 2958 | n/e | n/e | 2.44e-7 | 1.39e-7 | n/e |
| z13.bracket_is_perp | homophonic | female | FML | 367670 | n/e | n/e | 1.17e-6 | 6.08e-7 | n/e |
| z13.bracket_is_perp | homophonic | female | FIIL | 76049 | n/e | n/e | 3.26e-7 | 2.53e-7 | n/e |
| z13.bracket_is_perp | homophonic | female | IIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | homophonic | female | LF | 87 | n/e | n/e | 1.71e-7 | 9.00e-9 | n/e |
| z13.bracket_is_perp | homophonic | nick_male | FL | 2 | n/e | n/e | 9.06e-7 | 3.26e-7 | n/e |
| z13.bracket_is_perp | homophonic | nick_male | FIL | 2 | n/e | n/e | 2.44e-8 | 4.82e-9 | n/e |
| z13.bracket_is_perp | homophonic | nick_female | FL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | homophonic | nick_female | FIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | male | FL | 6 | n/e | n/e | 1.84e-8 | 3.23e-11 | n/e |
| z13.bracket_is_perp | simple | male | FIL | 208 | n/e | n/e | 2.47e-8 | 1.73e-9 | n/e |
| z13.bracket_is_perp | simple | male | FML | 9723 | n/e | n/e | 3.85e-8 | 2.63e-9 | n/e |
| z13.bracket_is_perp | simple | male | FIIL | 4142 | n/e | n/e | 2.37e-8 | 3.55e-9 | n/e |
| z13.bracket_is_perp | simple | male | IIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | male | LF | 12 | n/e | n/e | 3.68e-8 | 4.04e-10 | n/e |
| z13.bracket_is_perp | simple | female | FL | 44 | n/e | n/e | 8.66e-8 | 2.16e-8 | n/e |
| z13.bracket_is_perp | simple | female | FIL | 234 | n/e | n/e | 1.93e-8 | 5.71e-9 | n/e |
| z13.bracket_is_perp | simple | female | FML | 51521 | n/e | n/e | 1.64e-7 | 4.73e-8 | n/e |
| z13.bracket_is_perp | simple | female | FIIL | 11454 | n/e | n/e | 4.92e-8 | 7.40e-9 | n/e |
| z13.bracket_is_perp | simple | female | IIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | female | LF | 3 | n/e | n/e | 5.91e-9 | 1.96e-11 | n/e |
| z13.bracket_is_perp | simple | nick_male | FL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | nick_male | FIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | nick_female | FL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.bracket_is_perp | simple | nick_female | FIL | 0 | n/e | n/e | 0 | 0 | n/e |
| z13.reversed | homophonic | male | FL | 106 | 3625 | 66690 | 3.25e-7 | 8.13e-9 | 3.24e-5 |
| z13.reversed | homophonic | male | FIL | 3378 | 70885 | 1022508 | 4.01e-7 | 1.05e-6 | 6.47e-5 |
| z13.reversed | homophonic | male | FML | 91906 | 1180742 | 8214217 | 3.64e-7 | 8.94e-8 | 4.90e-5 |
| z13.reversed | homophonic | male | FIIL | 44941 | 881356 | 11047320 | 2.57e-7 | 4.34e-7 | 6.78e-5 |
| z13.reversed | homophonic | male | IIL | 0 | 58 | 4446 | 0 | 0 | 8.00e-5 |
| z13.reversed | homophonic | male | LF | 212 | 6626 | 126612 | 6.50e-7 | 1.39e-7 | 9.44e-5 |
| z13.reversed | homophonic | female | FL | 506 | 16745 | 284881 | 9.96e-7 | 1.89e-7 | 1.30e-4 |
| z13.reversed | homophonic | female | FIL | 4282 | 116812 | 1624592 | 3.53e-7 | 2.78e-7 | 7.23e-5 |
| z13.reversed | homophonic | female | FML | 564058 | 5500554 | 31743925 | 1.80e-6 | 6.21e-7 | 2.43e-4 |
| z13.reversed | homophonic | female | FIIL | 113052 | 2140905 | 20498122 | 4.85e-7 | 6.51e-7 | 1.50e-4 |
| z13.reversed | homophonic | female | IIL | 0 | 58 | 4446 | 0 | 0 | 7.87e-5 |
| z13.reversed | homophonic | female | LF | 914 | 11076 | 160751 | 1.80e-6 | 2.14e-7 | 1.03e-4 |
| z13.reversed | homophonic | nick_male | FL | 1 | 61 | 1248 | 4.53e-7 | 1.41e-7 | 1.36e-4 |
| z13.reversed | homophonic | nick_male | FIL | 20 | 868 | 20450 | 2.44e-7 | 6.51e-7 | 5.82e-5 |
| z13.reversed | homophonic | nick_female | FL | 0 | 9 | 363 | 0 | 0 | 5.63e-5 |
| z13.reversed | homophonic | nick_female | FIL | 4 | 341 | 10477 | 6.54e-8 | 2.02e-8 | 4.38e-5 |
| z13.reversed | simple | male | FL | 16 | 645 | 13347 | 4.90e-8 | 3.60e-11 | 4.39e-6 |
| z13.reversed | simple | male | FIL | 532 | 13587 | 221408 | 6.31e-8 | 8.88e-9 | 1.33e-5 |
| z13.reversed | simple | male | FML | 14637 | 209944 | 1695986 | 5.80e-8 | 3.51e-8 | 9.85e-6 |
| z13.reversed | simple | male | FIIL | 6982 | 167687 | 2522201 | 3.99e-8 | 6.30e-8 | 8.56e-6 |
| z13.reversed | simple | male | IIL | 0 | 12 | 1026 | 0 | 0 | 2.49e-5 |
| z13.reversed | simple | male | LF | 30 | 1200 | 27187 | 9.19e-8 | 1.12e-9 | 1.79e-5 |
| z13.reversed | simple | female | FL | 58 | 2462 | 51293 | 1.14e-7 | 6.67e-9 | 1.91e-5 |
| z13.reversed | simple | female | FIL | 482 | 18521 | 305289 | 3.97e-8 | 3.73e-8 | 1.07e-5 |
| z13.reversed | simple | female | FML | 74191 | 861418 | 6279494 | 2.37e-7 | 4.14e-8 | 3.36e-5 |
| z13.reversed | simple | female | FIIL | 15494 | 388010 | 4523501 | 6.65e-8 | 1.15e-7 | 2.56e-5 |
| z13.reversed | simple | female | IIL | 0 | 12 | 1026 | 0 | 0 | 1.93e-5 |
| z13.reversed | simple | female | LF | 97 | 1284 | 25356 | 1.91e-7 | 6.72e-9 | 1.55e-5 |
| z13.reversed | simple | nick_male | FL | 0 | 10 | 296 | 0 | 0 | 2.12e-5 |
| z13.reversed | simple | nick_male | FIL | 5 | 160 | 4386 | 6.09e-8 | 3.47e-9 | 8.18e-6 |
| z13.reversed | simple | nick_female | FL | 0 | 3 | 94 | 0 | 0 | 3.41e-5 |
| z13.reversed | simple | nick_female | FIL | 0 | 69 | 2215 | 0 | 0 | 7.32e-6 |
| z13.crosshair_null | homophonic | male | FL | 103 | 2782 | 38166 | 3.18e-7 | 2.70e-7 | 4.40e-5 |
| z13.crosshair_null | homophonic | male | FIL | 2319 | 43795 | 458381 | 3.44e-7 | 2.72e-7 | 6.17e-5 |
| z13.crosshair_null | homophonic | male | FML | 29585 | 297053 | 1557392 | 3.38e-7 | 4.44e-8 | 9.94e-5 |
| z13.crosshair_null | homophonic | male | FIIL | 24762 | 431217 | 3842573 | 2.27e-7 | 5.48e-8 | 8.25e-5 |
| z13.crosshair_null | homophonic | male | IIL | 0 | 130 | 2136 | 0 | 0 | 8.39e-6 |
| z13.crosshair_null | homophonic | male | LF | 120 | 4554 | 64974 | 3.70e-7 | 6.71e-8 | 6.99e-5 |
| z13.crosshair_null | homophonic | female | FL | 499 | 9846 | 117024 | 1.07e-6 | 2.87e-7 | 2.11e-4 |
| z13.crosshair_null | homophonic | female | FIL | 3100 | 67405 | 631984 | 3.46e-7 | 1.12e-7 | 1.29e-4 |
| z13.crosshair_null | homophonic | female | FML | 103916 | 961314 | 4318691 | 1.06e-6 | 7.67e-7 | 2.17e-4 |
| z13.crosshair_null | homophonic | female | FIIL | 41579 | 696234 | 5700055 | 3.10e-7 | 5.80e-7 | 1.48e-4 |
| z13.crosshair_null | homophonic | female | IIL | 0 | 130 | 2136 | 0 | 0 | 7.27e-6 |
| z13.crosshair_null | homophonic | female | LF | 95 | 7273 | 83099 | 2.03e-7 | 8.48e-9 | 1.31e-4 |
| z13.crosshair_null | homophonic | nick_male | FL | 0 | 27 | 781 | 0 | 0 | 5.82e-5 |
| z13.crosshair_null | homophonic | nick_male | FIL | 22 | 613 | 13452 | 2.26e-7 | 6.04e-9 | 6.41e-5 |
| z13.crosshair_null | homophonic | nick_female | FL | 0 | 7 | 286 | 0 | 0 | 3.51e-5 |
| z13.crosshair_null | homophonic | nick_female | FIL | 10 | 322 | 6096 | 1.57e-7 | 3.49e-9 | 5.48e-5 |
| z13.crosshair_null | simple | male | FL | 22 | 846 | 11637 | 6.78e-8 | 4.37e-10 | 1.41e-5 |
| z13.crosshair_null | simple | male | FIL | 451 | 12871 | 148599 | 6.70e-8 | 1.19e-8 | 2.46e-5 |
| z13.crosshair_null | simple | male | FML | 8177 | 83038 | 476351 | 9.33e-8 | 1.10e-8 | 3.56e-5 |
| z13.crosshair_null | simple | male | FIIL | 8043 | 140032 | 1293906 | 7.39e-8 | 1.86e-8 | 2.53e-5 |
| z13.crosshair_null | simple | male | IIL | 0 | 60 | 1151 | 0 | 0 | 3.09e-6 |
| z13.crosshair_null | simple | male | LF | 26 | 1523 | 20975 | 8.02e-8 | 1.00e-9 | 1.58e-5 |
| z13.crosshair_null | simple | female | FL | 71 | 2819 | 41077 | 1.52e-7 | 2.69e-8 | 3.52e-5 |
| z13.crosshair_null | simple | female | FIL | 395 | 18492 | 200542 | 4.41e-8 | 8.89e-9 | 5.19e-5 |
| z13.crosshair_null | simple | female | FML | 25651 | 249987 | 1312696 | 2.62e-7 | 1.14e-7 | 5.78e-5 |
| z13.crosshair_null | simple | female | FIIL | 11328 | 213114 | 1899545 | 8.45e-8 | 8.00e-8 | 2.99e-5 |
| z13.crosshair_null | simple | female | IIL | 0 | 60 | 1151 | 0 | 0 | 2.34e-6 |
| z13.crosshair_null | simple | female | LF | 9 | 1328 | 21515 | 1.93e-8 | 3.34e-10 | 1.97e-5 |
| z13.crosshair_null | simple | nick_male | FL | 0 | 9 | 257 | 0 | 0 | 2.17e-5 |
| z13.crosshair_null | simple | nick_male | FIL | 2 | 151 | 3982 | 2.05e-8 | 1.86e-10 | 1.57e-5 |
| z13.crosshair_null | simple | nick_female | FL | 0 | 3 | 81 | 0 | 0 | 7.94e-6 |
| z13.crosshair_null | simple | nick_female | FIL | 0 | 82 | 2025 | 0 | 0 | 1.07e-5 |
| z13.circles_distinct | homophonic | male | FL | ~5.32e+4 (MC) | ~2.25e+6 (MC) | ~4.00e+7 (MC) | 1.63e-4 (MC) | 6.70e-5 (MC) | 0.0529 (MC) |
| z13.circles_distinct | homophonic | male | FIL | ~1.41e+6 (MC) | ~4.29e+7 (MC) | ~5.95e+8 (MC) | 1.67e-4 (MC) | 6.85e-5 (MC) | 0.0484 (MC) |
| z13.circles_distinct | homophonic | male | FML | ~4.21e+7 (MC) | ~6.43e+8 (MC) | ~3.29e+9 (MC) | 1.67e-4 (MC) | 1.16e-4 (MC) | 0.0537 (MC) |
| z13.circles_distinct | homophonic | male | FIIL | ~2.65e+7 (MC) | ~6.68e+8 (MC) | ~7.21e+9 (MC) | 1.51e-4 (MC) | 9.80e-5 (MC) | 0.0487 (MC) |
| z13.circles_distinct | homophonic | male | IIL | ~219 (MC) | ~3.12e+4 (MC) | ~9.23e+5 (MC) | 7.85e-5 (MC) | 2.45e-5 (MC) | 0.0246 (MC) |
| z13.circles_distinct | homophonic | male | LF | ~3.65e+4 (MC) | ~2.15e+6 (MC) | ~4.22e+7 (MC) | 1.12e-4 (MC) | 6.35e-5 (MC) | 0.0496 (MC) |
| z13.circles_distinct | homophonic | female | FL | ~1.03e+5 (MC) | ~3.83e+6 (MC) | ~5.58e+7 (MC) | 2.04e-4 (MC) | 8.80e-5 (MC) | 0.0644 (MC) |
| z13.circles_distinct | homophonic | female | FIL | ~2.32e+6 (MC) | ~6.72e+7 (MC) | ~7.80e+8 (MC) | 1.91e-4 (MC) | 1.16e-4 (MC) | 0.0603 (MC) |
| z13.circles_distinct | homophonic | female | FML | ~5.30e+7 (MC) | ~7.93e+8 (MC) | ~3.53e+9 (MC) | 1.69e-4 (MC) | 1.60e-4 (MC) | 0.0487 (MC) |
| z13.circles_distinct | homophonic | female | FIIL | ~3.60e+7 (MC) | ~8.37e+8 (MC) | ~8.25e+9 (MC) | 1.54e-4 (MC) | 1.21e-4 (MC) | 0.0467 (MC) |
| z13.circles_distinct | homophonic | female | IIL | ~228 (MC) | ~3.10e+4 (MC) | ~9.24e+5 (MC) | 8.20e-5 (MC) | 2.85e-5 (MC) | 0.0263 (MC) |
| z13.circles_distinct | homophonic | female | LF | ~1.04e+5 (MC) | ~4.30e+6 (MC) | ~4.77e+7 (MC) | 2.05e-4 (MC) | 1.48e-4 (MC) | 0.0443 (MC) |
| z13.circles_distinct | homophonic | nick_male | FL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | homophonic | nick_male | FIL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | homophonic | nick_female | FL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | homophonic | nick_female | FIL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | simple | male | FL | ~2450 (MC) | ~1.24e+5 (MC) | ~2.28e+6 (MC) | 7.50e-6 (MC) | 1.50e-6 (MC) | 2.85e-3 (MC) |
| z13.circles_distinct | simple | male | FIL | ~7.17e+4 (MC) | ~2.76e+6 (MC) | ~4.51e+7 (MC) | 8.50e-6 (MC) | 2.50e-6 (MC) | 3.32e-3 (MC) |
| z13.circles_distinct | simple | male | FML | ~1.39e+6 (MC) | ~3.50e+7 (MC) | ~2.01e+8 (MC) | 5.50e-6 (MC) | 4.00e-6 (MC) | 3.98e-3 (MC) |
| z13.circles_distinct | simple | male | FIIL | ~2.01e+6 (MC) | ~5.13e+7 (MC) | ~6.62e+8 (MC) | 1.15e-5 (MC) | 6.00e-6 (MC) | 4.37e-3 (MC) |
| z13.circles_distinct | simple | male | IIL | ~0 (MC) | ~1760 (MC) | ~8.25e+4 (MC) | 0 (MC) | 0 (MC) | 1.89e-3 (MC) |
| z13.circles_distinct | simple | male | LF | ~816 (MC) | ~1.27e+5 (MC) | ~2.47e+6 (MC) | 2.50e-6 (MC) | 1.50e-6 (MC) | 2.74e-3 (MC) |
| z13.circles_distinct | simple | female | FL | ~1520 (MC) | ~1.28e+5 (MC) | ~2.32e+6 (MC) | 3.00e-6 (MC) | 1.00e-6 (MC) | 2.61e-3 (MC) |
| z13.circles_distinct | simple | female | FIL | ~9.72e+4 (MC) | ~3.41e+6 (MC) | ~4.58e+7 (MC) | 8.00e-6 (MC) | 1.45e-5 (MC) | 3.18e-3 (MC) |
| z13.circles_distinct | simple | female | FML | ~1.10e+6 (MC) | ~2.48e+7 (MC) | ~1.30e+8 (MC) | 3.50e-6 (MC) | 2.00e-6 (MC) | 1.57e-3 (MC) |
| z13.circles_distinct | simple | female | FIIL | ~1.75e+6 (MC) | ~5.35e+7 (MC) | ~6.42e+8 (MC) | 7.50e-6 (MC) | 4.00e-6 (MC) | 2.63e-3 (MC) |
| z13.circles_distinct | simple | female | IIL | ~0 (MC) | ~1830 (MC) | ~8.31e+4 (MC) | 0 (MC) | 0 (MC) | 1.85e-3 (MC) |
| z13.circles_distinct | simple | female | LF | ~3560 (MC) | ~1.92e+5 (MC) | ~2.14e+6 (MC) | 7.00e-6 (MC) | 6.00e-6 (MC) | 2.15e-3 (MC) |
| z13.circles_distinct | simple | nick_male | FL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | simple | nick_male | FIL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | simple | nick_female | FL | - | n/e | n/e | - | n/e | n/e |
| z13.circles_distinct | simple | nick_female | FIL | - | n/e | n/e | - | n/e | n/e |
| z13.letters_literal | homophonic | male | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | male | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | male | FML | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | male | FIIL | 0 | 0 | 14 | 0 | 0 | 1.47e-14 |
| z13.letters_literal | homophonic | male | IIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | male | LF | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | female | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | female | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | female | FML | 0 | 9 | 39 | 0 | 0 | 7.87e-14 |
| z13.letters_literal | homophonic | female | FIIL | 0 | 0 | 9 | 0 | 0 | 6.28e-13 |
| z13.letters_literal | homophonic | female | IIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | female | LF | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | nick_male | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | nick_male | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | nick_female | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | homophonic | nick_female | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | male | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | male | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | male | FML | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | male | FIIL | 0 | 0 | 7 | 0 | 0 | 8.31e-15 |
| z13.letters_literal | simple | male | IIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | male | LF | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | FML | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | FIIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | IIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | female | LF | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | nick_male | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | nick_male | FIL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | nick_female | FL | 0 | 0 | 0 | 0 | 0 | 0 |
| z13.letters_literal | simple | nick_female | FIL | 0 | 0 | 0 | 0 | 0 | 0 |

n/e = not enumerated (bracket_is_perp has the same isomorph as canonical, so its 1-2 filler cells equal canonical's by construction).

## C. z13.crosshair_null with the crosshair as a word divider (a name part must start at position 3, AEN | ...)

| mode | list | pattern | f0 fits (with divider) | f1 | f2 |
|---|---|---|---|---|---|
| homophonic | male | FL | 103 (0) | 2782 (32) | 38166 (705) |
| homophonic | male | FIL | 2319 (31) | 43795 (2020) | 458381 (49286) |
| homophonic | male | FML | 29585 (5398) | 297053 (63383) | 1557392 (481641) |
| homophonic | male | FIIL | 24762 (947) | 431217 (31445) | 3842573 (607310) |
| homophonic | male | IIL | 0 (0) | 130 (26) | 2136 (784) |
| homophonic | male | LF | 120 (0) | 4554 (33) | 64974 (264) |
| homophonic | female | FL | 499 (0) | 9846 (26) | 117024 (1162) |
| homophonic | female | FIL | 3100 (31) | 67405 (2448) | 631984 (74556) |
| homophonic | female | FML | 103916 (16906) | 961314 (167334) | 4318691 (1097894) |
| homophonic | female | FIIL | 41579 (1158) | 696234 (35407) | 5700055 (771537) |
| homophonic | female | IIL | 0 (0) | 130 (26) | 2136 (784) |
| homophonic | female | LF | 95 (0) | 7273 (35) | 83099 (1057) |
| homophonic | nick_male | FL | 0 (0) | 27 (1) | 781 (25) |
| homophonic | nick_male | FIL | 22 (1) | 613 (78) | 13452 (2584) |
| homophonic | nick_female | FL | 0 (0) | 7 (1) | 286 (23) |
| homophonic | nick_female | FIL | 10 (0) | 322 (53) | 6096 (1465) |
| simple | male | FL | 22 (0) | 846 (7) | 11637 (205) |
| simple | male | FIL | 451 (4) | 12871 (590) | 148599 (14915) |
| simple | male | FML | 8177 (993) | 83038 (15684) | 476351 (132057) |
| simple | male | FIIL | 8043 (165) | 140032 (7431) | 1293906 (171822) |
| simple | male | IIL | 0 (0) | 60 (0) | 1151 (311) |
| simple | male | LF | 26 (0) | 1523 (16) | 20975 (108) |
| simple | female | FL | 71 (0) | 2819 (5) | 41077 (255) |
| simple | female | FIL | 395 (4) | 18492 (616) | 200542 (19272) |
| simple | female | FML | 25651 (3175) | 249987 (35021) | 1312696 (242014) |
| simple | female | FIIL | 11328 (162) | 213114 (7875) | 1899545 (185054) |
| simple | female | IIL | 0 (0) | 60 (0) | 1151 (311) |
| simple | female | LF | 9 (0) | 1328 (7) | 21515 (206) |
| simple | nick_male | FL | 0 (0) | 9 (0) | 257 (9) |
| simple | nick_male | FIL | 2 (0) | 151 (11) | 3982 (789) |
| simple | nick_female | FL | 0 (0) | 3 (1) | 81 (9) |
| simple | nick_female | FIL | 0 (0) | 82 (37) | 2025 (611) |

## D. Posterior over the 0-filler fits under the name-frequency prior

Within one pattern, if Z13 IS a name of that pattern. "flat" = every consistent key equally likely (exact for simple substitution); "h-model" = homophonic random-homophone likelihood (h_l from the Z408/Z340 keys). top1 = posterior of the best fit; n50 = fits needed for half the mass; effN = 1/sum p^2.

| variant | mode | list | pattern | fits | distinct strings | best fit (flat) | top1 | top10 | n50 | effN | best fit (h-model) | top1 h |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z13.canonical | homophonic | male | FL | 72 | 72 | EDDIE RESENDES | 0.934 | 0.989 | 1 | 1.15 | EDDIE RESENDES | 0.7 |
| z13.canonical | homophonic | male | FIL | 1494 | 1492 | THOMAS A SANOTS | 0.275 | 0.607 | 6 | 10.9 | THOMAS A SANOTS | 0.173 |
| z13.canonical | homophonic | male | FML | 72182 | 70535 | STEVE PETE WEST | 0.292 | 0.631 | 5 | 9.77 | CARL BOB ABARCA | 0.291 |
| z13.canonical | homophonic | male | FIIL | 33725 | 33663 | EDDIE J E REEDER | 0.053 | 0.272 | 30 | 78.2 | GERALD L E LARGE | 0.0624 |
| z13.canonical | homophonic | male | LF | 56 | 56 | ENDRESEN ELDEN | 0.234 | 0.849 | 3 | 7.52 | ARRIAGADA BRAD | 0.254 |
| z13.canonical | homophonic | female | FL | 321 | 321 | ELSIE HENEISEN | 0.194 | 0.788 | 5 | 11.4 | CHASTITY TRACY | 0.727 |
| z13.canonical | homophonic | female | FIL | 2958 | 2942 | ESTHER E REITER | 0.314 | 0.765 | 2 | 6.7 | ASHLEY E MECHAM | 0.203 |
| z13.canonical | homophonic | female | FML | 367670 | 348459 | MARY LULA LERMA | 0.109 | 0.502 | 10 | 27.6 | MARY LULA LERMA | 0.27 |
| z13.canonical | homophonic | female | FIIL | 76049 | 75926 | ESTHER E S ESTES | 0.0462 | 0.204 | 66 | 134 | MARTHA H S HARMS | 0.13 |
| z13.canonical | homophonic | female | LF | 87 | 87 | SOOKNANAN ROSA | 0.503 | 0.898 | 1 | 3.46 | SOOKNANAN ROSA | 0.349 |
| z13.canonical | homophonic | nick_male | FL | 2 | 2 | EDDIE RESENDES | 0.972 | 1 | 1 | 1.06 | EDDIE RESENDES | 0.898 |
| z13.canonical | homophonic | nick_male | FIL | 2 | 2 | AL H RAMANATHAN | 0.88 | 1 | 1 | 1.27 | AL H RAMANATHAN | 0.88 |
| z13.canonical | simple | male | FL | 6 | 6 | IMOGENE REVOIR | 0.374 | 1 | 2 | 4.11 | - | - |
| z13.canonical | simple | male | FIL | 208 | 206 | OATHER E NEWTON | 0.234 | 0.946 | 3 | 7.04 | - | - |
| z13.canonical | simple | male | FML | 9723 | 9614 | ARNOLD LYLE NAY | 0.152 | 0.564 | 8 | 21.2 | - | - |
| z13.canonical | simple | male | FIIL | 4142 | 4134 | ALBERT R S RIBAS | 0.148 | 0.585 | 8 | 18.9 | - | - |
| z13.canonical | simple | male | LF | 12 | 12 | ALIRE NEHEMIAH | 0.457 | 0.986 | 2 | 3.22 | - | - |
| z13.canonical | simple | female | FL | 44 | 44 | CHASTITY TRACY | 0.491 | 0.996 | 2 | 2.71 | - | - |
| z13.canonical | simple | female | FIL | 234 | 232 | ASHLEY E MECHAM | 0.878 | 0.976 | 1 | 1.29 | - | - |
| z13.canonical | simple | female | FML | 51521 | 49454 | AMY HELENE RYAN | 0.29 | 0.642 | 3 | 8.46 | - | - |
| z13.canonical | simple | female | FIIL | 11454 | 11438 | CLAIRE R H ROACH | 0.141 | 0.307 | 39 | 39.3 | - | - |
| z13.canonical | simple | female | LF | 3 | 3 | ANICETE MERIAM | 0.916 | 1 | 1 | 1.19 | - | - |
| z13.bracket_is_perp | homophonic | male | FL | 72 | 72 | EDDIE RESENDES | 0.934 | 0.989 | 1 | 1.15 | EDDIE RESENDES | 0.7 |
| z13.bracket_is_perp | homophonic | male | FIL | 1494 | 1492 | THOMAS A SANOTS | 0.275 | 0.607 | 6 | 10.9 | THOMAS A SANOTS | 0.173 |
| z13.bracket_is_perp | homophonic | male | FML | 72182 | 70535 | STEVE PETE WEST | 0.292 | 0.631 | 5 | 9.77 | CARL BOB ABARCA | 0.291 |
| z13.bracket_is_perp | homophonic | male | FIIL | 33725 | 33663 | EDDIE J E REEDER | 0.053 | 0.272 | 30 | 78.2 | GERALD L E LARGE | 0.0624 |
| z13.bracket_is_perp | homophonic | male | LF | 56 | 56 | ENDRESEN ELDEN | 0.234 | 0.849 | 3 | 7.52 | ARRIAGADA BRAD | 0.254 |
| z13.bracket_is_perp | homophonic | female | FL | 321 | 321 | ELSIE HENEISEN | 0.194 | 0.788 | 5 | 11.4 | CHASTITY TRACY | 0.727 |
| z13.bracket_is_perp | homophonic | female | FIL | 2958 | 2942 | ESTHER E REITER | 0.314 | 0.765 | 2 | 6.7 | ASHLEY E MECHAM | 0.203 |
| z13.bracket_is_perp | homophonic | female | FML | 367670 | 348459 | MARY LULA LERMA | 0.109 | 0.502 | 10 | 27.6 | MARY LULA LERMA | 0.27 |
| z13.bracket_is_perp | homophonic | female | FIIL | 76049 | 75926 | ESTHER E S ESTES | 0.0462 | 0.204 | 66 | 134 | MARTHA H S HARMS | 0.13 |
| z13.bracket_is_perp | homophonic | female | LF | 87 | 87 | SOOKNANAN ROSA | 0.503 | 0.898 | 1 | 3.46 | SOOKNANAN ROSA | 0.349 |
| z13.bracket_is_perp | homophonic | nick_male | FL | 2 | 2 | EDDIE RESENDES | 0.972 | 1 | 1 | 1.06 | EDDIE RESENDES | 0.898 |
| z13.bracket_is_perp | homophonic | nick_male | FIL | 2 | 2 | AL H RAMANATHAN | 0.88 | 1 | 1 | 1.27 | AL H RAMANATHAN | 0.88 |
| z13.bracket_is_perp | simple | male | FL | 6 | 6 | IMOGENE REVOIR | 0.374 | 1 | 2 | 4.11 | - | - |
| z13.bracket_is_perp | simple | male | FIL | 208 | 206 | OATHER E NEWTON | 0.234 | 0.946 | 3 | 7.04 | - | - |
| z13.bracket_is_perp | simple | male | FML | 9723 | 9614 | ARNOLD LYLE NAY | 0.152 | 0.564 | 8 | 21.2 | - | - |
| z13.bracket_is_perp | simple | male | FIIL | 4142 | 4134 | ALBERT R S RIBAS | 0.148 | 0.585 | 8 | 18.9 | - | - |
| z13.bracket_is_perp | simple | male | LF | 12 | 12 | ALIRE NEHEMIAH | 0.457 | 0.986 | 2 | 3.22 | - | - |
| z13.bracket_is_perp | simple | female | FL | 44 | 44 | CHASTITY TRACY | 0.491 | 0.996 | 2 | 2.71 | - | - |
| z13.bracket_is_perp | simple | female | FIL | 234 | 232 | ASHLEY E MECHAM | 0.878 | 0.976 | 1 | 1.29 | - | - |
| z13.bracket_is_perp | simple | female | FML | 51521 | 49454 | AMY HELENE RYAN | 0.29 | 0.642 | 3 | 8.46 | - | - |
| z13.bracket_is_perp | simple | female | FIIL | 11454 | 11438 | CLAIRE R H ROACH | 0.141 | 0.307 | 39 | 39.3 | - | - |
| z13.bracket_is_perp | simple | female | LF | 3 | 3 | ANICETE MERIAM | 0.916 | 1 | 1 | 1.19 | - | - |
| z13.reversed | homophonic | male | FL | 106 | 106 | LEVIE LEFEBVRE | 0.214 | 0.89 | 3 | 7.93 | LEVIE LEFEBVRE | 0.413 |
| z13.reversed | homophonic | male | FIL | 3378 | 3375 | DONALD L BLANCO | 0.357 | 0.95 | 2 | 3.86 | DONALD L BLANCO | 0.459 |
| z13.reversed | homophonic | male | FML | 91906 | 89283 | DONALD LYLE NGO | 0.364 | 0.641 | 4 | 6.84 | DONALD LYLE NGO | 0.637 |
| z13.reversed | homophonic | male | FIIL | 44941 | 44772 | DONALD L J LONGO | 0.0625 | 0.284 | 30 | 71.7 | DONALD L J LONGO | 0.0604 |
| z13.reversed | homophonic | male | LF | 212 | 212 | HERWEHE GEORGE | 0.582 | 0.976 | 1 | 2.49 | ALICEA EZEKIEL | 0.306 |
| z13.reversed | homophonic | female | FL | 506 | 506 | LAURA LAPADULA | 0.217 | 0.809 | 3 | 8.42 | LAURA LAPADULA | 0.261 |
| z13.reversed | homophonic | female | FIL | 4282 | 4278 | ANDREA E WELDON | 0.0866 | 0.455 | 13 | 34 | ANGELA L CLAGON | 0.0812 |
| z13.reversed | homophonic | female | FML | 564058 | 523285 | SELMA SARAH LEE | 0.192 | 0.366 | 36 | 23.6 | SELMA SARAH LEE | 0.128 |
| z13.reversed | homophonic | female | FIIL | 113052 | 112762 | ANGELA L M LOGAN | 0.0471 | 0.255 | 37 | 97.2 | EUNICE C M CANTU | 0.0596 |
| z13.reversed | homophonic | female | LF | 914 | 913 | VANDEVERE ANNA | 0.197 | 0.576 | 7 | 16 | KALICK CECELIA | 0.133 |
| z13.reversed | homophonic | nick_male | FL | 1 | 1 | ARTIE AEGERTER | 1 | 1 | 1 | 1 | ARTIE AEGERTER | 1 |
| z13.reversed | homophonic | nick_male | FIL | 20 | 20 | STEVE S EVERETT | 0.87 | 0.997 | 1 | 1.31 | CHAS A CAVANAGH | 0.953 |
| z13.reversed | homophonic | nick_female | FIL | 4 | 4 | SHIRL S LILLICH | 0.71 | 1 | 1 | 1.74 | SHIRL S LILLICH | 0.75 |
| z13.reversed | simple | male | FL | 16 | 16 | DORSE DEMETRIO | 0.32 | 0.959 | 2 | 5.4 | - | - |
| z13.reversed | simple | male | FIL | 532 | 532 | NORMAN A CAPRIO | 0.546 | 0.858 | 1 | 3.14 | - | - |
| z13.reversed | simple | male | FML | 14637 | 14381 | DONALD LYLE NGO | 0.926 | 0.948 | 1 | 1.17 | - | - |
| z13.reversed | simple | male | FIIL | 6982 | 6951 | DONALD L J LINGO | 0.132 | 0.53 | 9 | 22.8 | - | - |
| z13.reversed | simple | male | LF | 30 | 30 | ANDREAE WELDON | 0.313 | 0.96 | 2 | 5.63 | - | - |
| z13.reversed | simple | female | FL | 58 | 58 | ELAINE NUNDAHL | 0.473 | 0.898 | 2 | 3.74 | - | - |
| z13.reversed | simple | female | FIL | 482 | 482 | ANDREA E WELDON | 0.645 | 0.898 | 1 | 2.34 | - | - |
| z13.reversed | simple | female | FML | 74191 | 69971 | SONIA SARAH NGO | 0.0906 | 0.415 | 18 | 39.6 | - | - |
| z13.reversed | simple | female | FIIL | 15494 | 15458 | DEBRA D A GAMBLE | 0.114 | 0.486 | 11 | 28.2 | - | - |
| z13.reversed | simple | female | LF | 97 | 96 | NIEMAN ARACELI | 0.438 | 0.899 | 2 | 4.04 | - | - |
| z13.reversed | simple | nick_male | FIL | 5 | 5 | DOUG E DEVENUTO | 0.501 | 1 | 1 | 2.86 | - | - |
| z13.crosshair_null | homophonic | male | FL | 103 | 103 | EUGENE LENGEL | 0.288 | 0.986 | 3 | 6.03 | EUGENE LENGEL | 0.296 |
| z13.crosshair_null | homophonic | male | FIL | 2319 | 2308 | EUGENE L ENGEL | 0.361 | 0.833 | 2 | 5.59 | EUGENE L ENGEL | 0.32 |
| z13.crosshair_null | homophonic | male | FML | 29585 | 28389 | ALLAN ALAN LAL | 0.0511 | 0.394 | 16 | 47.5 | KIM LYLE LEMKE | 0.229 |
| z13.crosshair_null | homophonic | male | FIIL | 24762 | 24646 | EUGENE E E AGEE | 0.0693 | 0.32 | 28 | 65.7 | BRUCE C B CLUBB | 0.151 |
| z13.crosshair_null | homophonic | male | LF | 120 | 120 | ABRAHAM ABRAM | 0.304 | 0.919 | 3 | 6.8 | ABRAHAM ABRAM | 0.401 |
| z13.crosshair_null | homophonic | female | FL | 499 | 498 | ELLA VANALLEN | 0.285 | 0.833 | 3 | 7.37 | ETHELENE CHEN | 0.185 |
| z13.crosshair_null | homophonic | female | FIL | 3100 | 3043 | AIMEE E NEWMAN | 0.122 | 0.532 | 9 | 25 | AIMEE E NEWMAN | 0.187 |
| z13.crosshair_null | homophonic | female | FML | 103916 | 95736 | ELLA JAN ALLEN | 0.252 | 0.588 | 6 | 12 | EULA JAN ALLEN | 0.0643 |
| z13.crosshair_null | homophonic | female | FIIL | 41579 | 41290 | ANNA M A HANNAH | 0.0714 | 0.381 | 19 | 53.3 | CLARA R H ROACH | 0.0722 |
| z13.crosshair_null | homophonic | female | LF | 95 | 95 | ANNALA HANNAH | 0.344 | 0.827 | 2 | 5.85 | ANNALA HANNAH | 0.197 |
| z13.crosshair_null | homophonic | nick_male | FIL | 22 | 22 | ERNIE I RISNER | 0.277 | 0.929 | 3 | 6.19 | CLIFF F AFRICA | 0.841 |
| z13.crosshair_null | homophonic | nick_female | FIL | 10 | 10 | ELLIE I RIGLER | 0.293 | 1 | 3 | 5.74 | ELLIE I RIGLER | 0.311 |
| z13.crosshair_null | simple | male | FL | 22 | 22 | ELIODORO MIER | 0.188 | 0.892 | 4 | 9.84 | - | - |
| z13.crosshair_null | simple | male | FIL | 451 | 446 | OSCAR A MALCOM | 0.45 | 0.881 | 2 | 4.3 | - | - |
| z13.crosshair_null | simple | male | FML | 8177 | 7917 | DON LYLE LUNDE | 0.157 | 0.719 | 4 | 12.1 | - | - |
| z13.crosshair_null | simple | male | FIIL | 8043 | 8017 | CLARK R H ROACH | 0.11 | 0.487 | 11 | 27.4 | - | - |
| z13.crosshair_null | simple | male | LF | 26 | 26 | ORTAGA SANTOS | 0.727 | 0.993 | 1 | 1.85 | - | - |
| z13.crosshair_null | simple | female | FL | 71 | 71 | LORENE SEARLS | 0.596 | 0.963 | 1 | 2.57 | - | - |
| z13.crosshair_null | simple | female | FIL | 395 | 391 | LORENE S EARLS | 0.607 | 0.854 | 1 | 2.64 | - | - |
| z13.crosshair_null | simple | female | FML | 25651 | 23912 | EDNA KAY ABNEY | 0.188 | 0.649 | 6 | 14.6 | - | - |
| z13.crosshair_null | simple | female | FIIL | 11328 | 11286 | EDNA M A RAYNER | 0.0542 | 0.32 | 22 | 62.4 | - | - |
| z13.crosshair_null | simple | female | LF | 9 | 9 | ORTAGA SANTOS | 0.841 | 1 | 1 | 1.39 | - | - |
| z13.crosshair_null | simple | nick_male | FIL | 2 | 2 | ARTIE I DISTAD | 0.899 | 1 | 1 | 1.22 | - | - |
| z13.circles_distinct | homophonic | male | FL | 3847 with w>=1e-10 | 3841 | EUGENE KRUEGER | 0.0514 (MC denominator) | 0.282 | - | - | - | - |
| z13.circles_distinct | homophonic | male | FIL | 11622 with w>=1e-10 | 11620 | CHARLES K BLACK | 0.0233 (MC denominator) | 0.107 | - | - | - | - |
| z13.circles_distinct | homophonic | male | FML | 2825 with w>=1e-10 | 2825 | LEON JAMES COLE | 0.024 (MC denominator) | 0.107 | - | - | - | - |
| z13.circles_distinct | homophonic | male | FIIL | 17658 with w>=1e-10 | 17658 | THOMAS J T SCOTT | 0.0131 (MC denominator) | 0.0634 | - | - | - | - |
| z13.circles_distinct | homophonic | male | IIL | 137 with w>=1e-10 | 137 | L J LANDREVILLE | 0.0495 (MC denominator) | 0.301 | - | - | - | - |
| z13.circles_distinct | homophonic | male | LF | 2598 with w>=1e-10 | 2598 | LEAVITT DONALD | 0.0796 (MC denominator) | 0.39 | - | - | - | - |
| z13.circles_distinct | homophonic | female | FL | 5698 with w>=1e-10 | 5694 | LILLIE PADILLA | 0.0394 (MC denominator) | 0.152 | - | - | - | - |
| z13.circles_distinct | homophonic | female | FIL | 18692 with w>=1e-10 | 18688 | LILLIAN S WELLS | 9.55e-3 (MC denominator) | 0.0642 | - | - | - | - |
| z13.circles_distinct | homophonic | female | FML | 3753 with w>=1e-10 | 3753 | EDNA LOIS JONES | 0.0258 (MC denominator) | 0.0958 | - | - | - | - |
| z13.circles_distinct | homophonic | female | FIIL | 25199 with w>=1e-10 | 25197 | EUNICE M S JONES | 2.72e-3 (MC denominator) | 0.0164 | - | - | - | - |
| z13.circles_distinct | homophonic | female | IIL | 154 with w>=1e-10 | 154 | L M LANDREVILLE | 0.0564 (MC denominator) | 0.323 | - | - | - | - |
| z13.circles_distinct | homophonic | female | LF | 5954 with w>=1e-10 | 5951 | REAVES BARBARA | 0.048 (MC denominator) | 0.296 | - | - | - | - |
| z13.circles_distinct | homophonic | nick_male | FL | 295 with w>=1e-10 | 295 | ERNIE GARDINER | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | homophonic | nick_male | FIL | 2610 with w>=1e-10 | 2610 | CHARLIE K BLACK | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | homophonic | nick_female | FL | 249 with w>=1e-10 | 249 | GINNY HASTINGS | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | homophonic | nick_female | FIL | 2264 with w>=1e-10 | 2264 | DONNIE M ARANDA | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | simple | male | FL | 117 with w>=1e-10 | 117 | CHARLES KOVACK | 0.18 (MC denominator) | 0.836 | - | - | - | - |
| z13.circles_distinct | simple | male | FIL | 569 with w>=1e-10 | 569 | CLIFTON E PRICE | 0.0593 (MC denominator) | 0.159 | - | - | - | - |
| z13.circles_distinct | simple | male | FML | 86 with w>=1e-10 | 86 | DON JAMES HINDS | 0.0594 (MC denominator) | 0.237 | - | - | - | - |
| z13.circles_distinct | simple | male | FIIL | 967 with w>=1e-10 | 967 | CHARLES K J MACK | 0.0231 (MC denominator) | 0.124 | - | - | - | - |
| z13.circles_distinct | simple | male | LF | 96 with w>=1e-10 | 96 | SHOWALTER JOSE | 0.24 (MC denominator) | 0.922 | - | - | - | - |
| z13.circles_distinct | simple | female | FL | 134 with w>=1e-10 | 134 | MARILYN STORMS | 0.65 (MC denominator) | 1.58 | - | - | - | - |
| z13.circles_distinct | simple | female | FIL | 922 with w>=1e-10 | 922 | EDITH M FRAZIER | 0.0739 (MC denominator) | 0.346 | - | - | - | - |
| z13.circles_distinct | simple | female | FML | 83 with w>=1e-10 | 83 | APRIL JOYCE RAY | 0.0353 (MC denominator) | 0.247 | - | - | - | - |
| z13.circles_distinct | simple | female | FIIL | 1123 with w>=1e-10 | 1123 | LOIS J M GENTILE | 4.06e-3 (MC denominator) | 0.0329 | - | - | - | - |
| z13.circles_distinct | simple | female | LF | 254 with w>=1e-10 | 254 | CHILDS BERNICE | 0.318 (MC denominator) | 0.764 | - | - | - | - |
| z13.circles_distinct | simple | nick_male | FL | 8 with w>=1e-10 | 8 | CHARLIE KOVACK | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | simple | nick_male | FIL | 92 with w>=1e-10 | 92 | CHARLIE K STACK | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | simple | nick_female | FL | 2 with w>=1e-10 | 2 | FLO WHEATCROFT | - (MC denominator) | - | - | - | - | - |
| z13.circles_distinct | simple | nick_female | FIL | 83 with w>=1e-10 | 83 | CINDY M POLANCO | - (MC denominator) | - | - | - | - | - |

### Equal-prior mixture of the patterns (each pattern conditioned on the cipher length)

| variant | mode | list | top 3 (posterior) | mass by pattern | effN |
|---|---|---|---|---|---|
| z13.canonical | homophonic | male | CARL BOB ABARCA (FML, 0.14); ANGELO LYLE GAY (FML, 0.0921); GARY LYLE LARGE (FML, 0.0615) | FML 0.48, FIIL 0.433, FL 0.0501, FIL 0.0347, LF 2.71e-3 | 26.2 |
| z13.canonical | homophonic | female | MARY LULA LERMA (FML, 0.211); MARY LOLA LERMA (FML, 0.19); MARY LILA LERMA (FML, 0.115) | FML 0.78, FIIL 0.139, FL 0.0416, FIL 0.0359, LF 2.78e-3 | 9.62 |
| z13.canonical | homophonic | nick_male | EDDIE RESENDES (FL, 0.845); EDDIE REZENDEZ (FL, 0.0956); AL H RAMANATHAN (FIL, 0.0522) | FL 0.941, FIL 0.0593 | 1.38 |
| z13.canonical | simple | male | ALBERT R S RIBAS (FIIL, 0.0629); ALBERT R K RYBAK (FIIL, 0.0485); OATHER E NEWTON (FIL, 0.0485) | FIIL 0.426, FML 0.315, FIL 0.207, LF 0.0484, FL 3.87e-3 | 47.4 |
| z13.canonical | simple | female | AMY HELENE RYAN (FML, 0.168); CHASTITY TRACY (FL, 0.129); IDA HELENE CAIN (FML, 0.0952) | FML 0.577, FL 0.263, FIIL 0.0902, FIL 0.0696, LF 2.39e-4 | 14.5 |
| z13.bracket_is_perp | homophonic | male | CARL BOB ABARCA (FML, 0.14); ANGELO LYLE GAY (FML, 0.0921); GARY LYLE LARGE (FML, 0.0615) | FML 0.48, FIIL 0.433, FL 0.0501, FIL 0.0347, LF 2.71e-3 | 26.2 |
| z13.bracket_is_perp | homophonic | female | MARY LULA LERMA (FML, 0.211); MARY LOLA LERMA (FML, 0.19); MARY LILA LERMA (FML, 0.115) | FML 0.78, FIIL 0.139, FL 0.0416, FIL 0.0359, LF 2.78e-3 | 9.62 |
| z13.bracket_is_perp | homophonic | nick_male | EDDIE RESENDES (FL, 0.845); EDDIE REZENDEZ (FL, 0.0956); AL H RAMANATHAN (FIL, 0.0522) | FL 0.941, FIL 0.0593 | 1.38 |
| z13.bracket_is_perp | simple | male | ALBERT R S RIBAS (FIIL, 0.0629); ALBERT R K RYBAK (FIIL, 0.0485); OATHER E NEWTON (FIL, 0.0485) | FIIL 0.426, FML 0.315, FIL 0.207, LF 0.0484, FL 3.87e-3 | 47.4 |
| z13.bracket_is_perp | simple | female | AMY HELENE RYAN (FML, 0.168); CHASTITY TRACY (FL, 0.129); IDA HELENE CAIN (FML, 0.0952) | FML 0.577, FL 0.263, FIIL 0.0902, FIL 0.0696, LF 2.39e-4 | 14.5 |
| z13.reversed | homophonic | male | DONALD L BLANCO (FIL, 0.286); DONALD L ALONSO (FIL, 0.161); DONALD L ALONZO (FIL, 0.144) | FIL 0.624, FIIL 0.321, FML 0.0486, LF 4.61e-3, FL 1.81e-3 | 7.62 |
| z13.reversed | homophonic | female | EUNICE C M CANTU (FIIL, 0.0442); MARY C M CICORIA (FIIL, 0.0439); ANGELA L M LOGAN (FIIL, 0.0362) | FIIL 0.741, FML 0.126, LF 0.0572, FIL 0.0385, FL 0.0372 | 69.6 |
| z13.reversed | homophonic | nick_male | CHAS A CAVANAGH (FIL, 0.865); ARTIE AEGERTER (FL, 0.0923); PHIL O POPOVICH (FIL, 0.0155) | FIL 0.908, FL 0.0923 | 1.32 |
| z13.reversed | homophonic | nick_female | SHIRL S LILLICH (FIL, 0.75); KATE A KAYASTHA (FIL, 0.245); ALEX D ADUDDELL (FIL, 2.72e-3) | FIL 1 | 1.6 |
| z13.reversed | simple | male | DONALD LYLE NGO (FML, 0.301); DONALD L J LINGO (FIIL, 0.0769); DONALD L R LINGO (FIIL, 0.0598) | FIIL 0.583, FML 0.324, FIL 0.082, LF 0.0104, FL 3.32e-4 | 9.31 |
| z13.reversed | simple | female | ANDREA E WELDON (FIL, 0.116); DEBRA D A GAMBLE (FIIL, 0.0633); EUNICE C M CANTU (FIIL, 0.0449) | FIIL 0.556, FML 0.2, FIL 0.18, LF 0.0324, FL 0.0322 | 38.1 |
| z13.reversed | simple | nick_male | DOUG E DEVENUTO (FIL, 0.501); PHIL A PADAVICH (FIL, 0.271); STAN E SEGEBART (FIL, 0.118) | FIL 1 | 2.86 |
| z13.crosshair_null | homophonic | male | EUGENE L ENGEL (FIL, 0.1); OSCAR A MALCOM (FIL, 0.082); EUGENE LENGEL (FL, 0.0793) | FIL 0.313, FIIL 0.283, FL 0.268, FML 0.0745, LF 0.0623 | 28 |
| z13.crosshair_null | homophonic | female | CLARA R H ROACH (FIIL, 0.0314); STACY C E CHASE (FIIL, 0.0286); EULA JAN ALLEN (FML, 0.025) | FIIL 0.434, FML 0.389, FL 0.0957, FIL 0.074, LF 6.53e-3 | 121 |
| z13.crosshair_null | homophonic | nick_male | CLIFF F AFRICA (FIL, 0.841); ERNIE I RISNER (FIL, 0.0502); EDDIE I RIEDER (FIL, 0.0343) | FIL 1 | 1.41 |
| z13.crosshair_null | homophonic | nick_female | ELLIE I RIGLER (FIL, 0.311); ELLIE I SIRLES (FIL, 0.191); ELLIE I RIDLER (FIL, 0.154) | FIL 1 | 5.28 |
| z13.crosshair_null | simple | male | OSCAR A MALCOM (FIL, 0.125); CLARK R H ROACH (FIIL, 0.0477); DON LYLE LUNDE (FML, 0.0401) | FIIL 0.433, FIL 0.278, FML 0.256, LF 0.0234, FL 0.0102 | 32.8 |
| z13.crosshair_null | simple | female | EDNA KAY ABNEY (FML, 0.0933); LORENE SEARLS (FL, 0.0696); RITA KAY AUTRY (FML, 0.0584) | FML 0.496, FIIL 0.347, FL 0.117, FIL 0.0386, LF 1.45e-3 | 40.6 |
| z13.crosshair_null | simple | nick_male | ARTIE I DISTAD (FIL, 0.899); ARTIE I SINTAS (FIL, 0.101) | FIL 1 | 1.22 |

## E. Monte Carlo check of the enumerated weighted fractions (canonical, fillers 2)

| mode | list | pattern | enumerated wfrac | MC wfrac [95% CI] | hits |
|---|---|---|---|---|---|
| simple | male | FL | 1.14e-5 | 8.00e-6 [4.92e-6, 1.30e-5] | 16 |
| homophonic | male | FL | 3.71e-5 | 3.60e-5 [2.86e-5, 4.53e-5] | 72 |
| simple | male | FIL | 9.42e-6 | 1.00e-5 [6.47e-6, 1.54e-5] | 20 |
| homophonic | male | FIL | 6.66e-5 | 6.50e-5 [5.47e-5, 7.72e-5] | 130 |
| simple | male | FML | 1.33e-5 | 1.30e-5 [8.87e-6, 1.90e-5] | 26 |
| homophonic | male | FML | 5.51e-5 | 5.45e-5 [4.52e-5, 6.57e-5] | 109 |
| simple | male | FIIL | 9.01e-6 | 6.50e-6 [3.80e-6, 1.11e-5] | 13 |
| homophonic | male | FIIL | 6.28e-5 | 6.05e-5 [5.06e-5, 7.23e-5] | 121 |
| simple | male | IIL | 2.36e-5 | 2.00e-5 [1.47e-5, 2.72e-5] | 40 |
| homophonic | male | IIL | 7.88e-5 | 7.85e-5 [6.71e-5, 9.18e-5] | 157 |
| simple | male | LF | 2.40e-5 | 3.00e-5 [2.33e-5, 3.86e-5] | 60 |
| homophonic | male | LF | 9.86e-5 | 9.00e-5 [7.78e-5, 1.04e-4] | 180 |
| simple | female | FL | 1.64e-5 | 1.70e-5 [1.22e-5, 2.38e-5] | 34 |
| homophonic | female | FL | 1.70e-4 | 1.79e-4 [1.62e-4, 1.99e-4] | 359 |
| simple | female | FIL | 1.10e-5 | 1.10e-5 [7.26e-6, 1.67e-5] | 22 |
| homophonic | female | FIL | 8.73e-5 | 9.55e-5 [8.29e-5, 1.10e-4] | 191 |
| simple | female | FML | 2.62e-5 | 2.85e-5 [2.20e-5, 3.69e-5] | 57 |
| homophonic | female | FML | 2.20e-4 | 2.28e-4 [2.08e-4, 2.50e-4] | 457 |
| simple | female | FIIL | 2.98e-5 | 3.55e-5 [2.81e-5, 4.48e-5] | 71 |
| homophonic | female | FIIL | 1.63e-4 | 1.66e-4 [1.49e-4, 1.85e-4] | 332 |
| simple | female | IIL | 1.83e-5 | 1.85e-5 [1.34e-5, 2.55e-5] | 37 |
| homophonic | female | IIL | 7.77e-5 | 7.40e-5 [6.30e-5, 8.69e-5] | 148 |
| simple | female | LF | 2.36e-5 | 2.15e-5 [1.60e-5, 2.90e-5] | 43 |
| homophonic | female | LF | 1.51e-4 | 1.47e-4 [1.31e-4, 1.64e-4] | 293 |

## F. Suspects and proposed persons

Each rendering checked against 12 variant x mode combinations with 0-2 free fillers at the ends. Null: 10000 replicates with every name part replaced by a random name of the same length and frequency bin.

| person | category | renderings (in length range) | fitting renderings | null P(>=1 fit) | null mean fitting renderings |
|---|---|---|---|---|---|
| Arthur Leigh Allen | suspect (police) | 28 (13) | none | 0.513 | 0.679 |
| Earl Van Best Jr. | suspect (Stewart 2014) | 14 (6) | EARLVBESTJR: circles_distinct/homophonic | 0.638 | 0.917 |
| Giuseppe Bevilacqua | suspect (Amicone 2017) | 8 (4) | none | 0.106 | 0.201 |
| Paul Doerr | suspect (Kobek 2022) | 3 (0) | none | 0 | 0 |
| Richard Gaikowski | suspect (Narlow; Blaine Smith) | 8 (6) | none | 1.00e-3 | 1.00e-3 |
| Lawrence Kane | suspect (Hines; Ziraoui) | 10 (4) | none | 0.0458 | 0.0491 |
| Richard Marshall (Rick Marshall) | suspect (Narlow) | 7 (4) | none | 0.0107 | 0.0107 |
| Gary Francis Poste | suspect (Case Breakers 2021) | 10 (4) | none | 8.30e-3 | 8.60e-3 |
| Ross Sullivan | suspect (Riverside link) | 3 (2) | none | 0.0277 | 0.0277 |
| Charles Milles Manson | investigated 1970, eliminated | 28 (12) | none | 0.0108 | 0.0113 |
| Bruce McGregor Davis | floated (Manson Family member) | 10 (5) | none | 0.208 | 0.218 |
| Richard Hoffman | accused by grandson (TikTok 2024) | 7 (4) | none | 0.357 | 0.414 |
| Jim Mordecai | suspected by family | 5 (4) | none | 0.306 | 0.335 |
| Jack Tarrance | accused by stepson Dennis Kaufman | 5 (4) | none | 0.039 | 0.0401 |
| Guy Ward Hendrickson | accused by daughter Deborah Perez (2009) | 10 (2) | none | 3.40e-3 | 3.40e-3 |
| Louie (Louis) Joseph Myers | claimed confession (Kennedy/Johnson 2001-02) | 18 (9) | JOSEPHMYERS: circles_distinct/homophonic | 0.385 | 0.513 |
| Theodore Robert Bundy | eliminated 1989 | 14 (4) | none | 0.138 | 0.146 |
| David Joseph Carpenter | ruled out | 14 (4) | none | 0.0854 | 0.0854 |
| Theodore John Kaczynski | investigated 1996, eliminated; Oswell Z13 reading | 14 (6) | none | 0.0894 | 0.0906 |
| Kjell Qvale | accused by Mike Rodelli | 3 (2) | none | 7.00e-4 | 7.00e-4 |
| William McDuff Andrew | suggested by Mike Morford (2023) | 14 (7) | none | 0.146 | 0.147 |
| Marvin Margolis (Marvin Merrill) | Baber 2025 Z13 claim | 10 (6) | none | 0.283 | 0.306 |
| George Hill Hodel | suspect (Steve Hodel) | 10 (5) | GEORGEHODEL: circles_distinct/homophonic | 0.263 | 0.295 |
| Edward Wayne Edwards | suspect (John Cameron) | 18 (8) | none | 0.0142 | 0.0159 |
| Michael O'Hare | accused by Gareth Penn (1981-) | 5 (2) | none | 0.014 | 0.014 |
| Gareth Penn | author; named as a suspect by some researchers | 3 (2) | none | 5.00e-4 | 5.00e-4 |
| William Joseph Grant (Lafferty suspect) | Lafferty 2012 (NAME GRANT); pseudonyms George Russell Tucker (Lafferty), Andrew Todd Walker (Graysmith) | 34 (18) | none | 0.262 | 0.301 |
| Fred Manalli | suspect named in Oranchak Ep. 11 rebuttal of Ziraoui | 5 (2) | none | 0.306 | 0.335 |
| Robert Kenneth Beausoleil | Z13 anagram reading (Deb Silva) | 18 (4) | none | 0.108 | 0.112 |
| Juan Vallejo Corona | real killer matching a Z13 Solutions wiki reading (JUAN O CORONA JR) | 10 (5) | JUANVCORONA: circles_distinct/homophonic<br>JUANOCORONAJR (lit., excluded): canonical/homophonic, circles_distinct/homophonic, bracket_is_perp/homophonic | 0.306 | 0.336 |
| Dennis Kaufman | accuser of Jack Tarrance, not a suspect | 5 (4) | none | 0.0159 | 0.0159 |
| Kenneth Kauffman (as listed in the task brief; no source found) | unverified | 5 (2) | KENKAUFFMAN: circles_distinct/homophonic | 0.348 | 0.39 |
| Kathleen Johns | abduction victim; Graysmith counts her among the claimed ten | 5 (4) | none | 4.00e-4 | 4.00e-4 |
| Alfred E. Neuman (fictional) | Graysmith/Bauer reading | 13 (7) | none | 0.144 | 0.144 |
| Andrea J. Odell | T.C. 2025 reading | 7 (4) | none | 0.296 | 0.323 |
| Ed Shaw | "Rembrandt" reading | 5 (2) | none | 0 | 0 |

### Permutation test (suspects vs matched random names)

| variant/mode | persons with a fit: observed / null mean / p | persons, 0 fillers: obs / mean / p | fitting renderings: obs / mean / p |
|---|---|---|---|
| z13.canonical/simple | 0 / 1.40e-3 / 1 | 0 / 0 / 1 | 0 / 1.50e-3 / 1 |
| z13.canonical/homophonic | 0 / 0.0146 / 1 | 0 / 0 / 1 | 0 / 0.0148 / 1 |
| z13.circles_distinct/simple | 0 / 0.351 / 1 | 0 / 2.00e-4 / 1 | 0 / 0.36 / 1 |
| z13.circles_distinct/homophonic | 5 / 5.47 / 0.687 | 0 / 7.50e-3 / 1 | 5 / 6.48 / 0.792 |
| z13.crosshair_null/simple | 0 / 2.80e-3 / 1 | 0 / 0 / 1 | 0 / 2.80e-3 / 1 |
| z13.crosshair_null/homophonic | 0 / 7.00e-3 / 1 | 0 / 0 / 1 | 0 / 7.00e-3 / 1 |
| z13.bracket_is_perp/simple | 0 / 1.40e-3 / 1 | 0 / 0 / 1 | 0 / 1.50e-3 / 1 |
| z13.bracket_is_perp/homophonic | 0 / 0.0146 / 1 | 0 / 0 / 1 | 0 / 0.0148 / 1 |
| z13.reversed/simple | 0 / 1.30e-3 / 1 | 0 / 0 / 1 | 0 / 1.60e-3 / 1 |
| z13.reversed/homophonic | 0 / 0.012 / 1 | 0 / 0 / 1 | 0 / 0.0123 / 1 |
| z13.letters_literal/simple | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 0 / 1 |
| z13.letters_literal/homophonic | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 0 / 1 |
| any | 5 / 5.48 / 0.688 | 0 / 7.50e-3 / 1 | 5 / 6.49 / 0.793 |

