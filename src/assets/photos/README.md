# Photo sources

Each file here feeds one photo slot on the site, named by slot (the same names the prototype
uses in `prototype/img/`). The build turns them into AVIF, WebP and JPEG at several widths.

They are copies of the originals in `assets/photos-raw/`. On 24 Oct 2026 the hero, the sample, the bulk,
the tracking card and the eight stages were replaced with photos made to look like our own cutting room
(fewer shirts: hoodies and jeans instead). Unused ones from that set are kept there too.

| Slot | Original in `assets/photos-raw/` |
|---|---|
| cat-denim | Indigo_jeans_and_denim_details_20261008122021.jpg |
| cat-hoodies | Heavyweight_hoodie_on_cutting_table_20261008122021.jpg |
| cat-knit | cat-knit.png |
| cat-outerwear | Work_jackets_on_cutting_table_20261008122021.jpg |
| cat-shirts | Shirts_and_sewing_tools_displayed_20261008122021.jpg |
| cat-tees | Two_t-shirts_on_cutting_table_20261008122021.jpg |
| hero | Cutting_room_with_the_sign_wide_20261024.jpg |
| path-scaling | Measuring_hoodie_for_garment_cor…_20261008122021.jpg |
| path-starting | Hands_drawing_technical_sketch_20261008122021.jpg |
| portal-sample | Raw_denim_jeans_hanging_on_wall_20261024.jpg |
| promise-bulk | Black_hoodies_stacked_with_tags_20261024.jpg |
| promise-sample | Black_hoodie_sample_on_dress_form_20261024.jpg |
| stage-01 | Mood_board_wall_20261024.jpg |
| stage-02 | Jeans_flat_sketch_on_cutting_table_20261024.jpg |
| stage-03 | Fabric_rolls_on_a_pallet_20261024.jpg |
| stage-04 | Hoodie_pattern_on_black_fleece_20261024.jpg |
| stage-05 | Pinning_a_white_hoodie_sample_20261024.jpg |
| stage-06 | Overlock_sewing_black_fleece_20261024.jpg |
| stage-07 | Measuring_jeans_for_QC_20261024.jpg |
| stage-08 | Packing_hoodies_into_cartons_20261024.jpg |

Slots that still have no photo show the tinted placeholder, as in the prototype: `atelier-1` to
`atelier-5`, `about-floor` and `team-1` to `team-4`. These must be real photos, not AI images.

To add or replace a photo, put the file here under the slot name (`.jpg` or `.png`) and register it
in `src/data/photos.ts`.
