# Photo sources

Each file here feeds one photo slot on the site, named by slot (the same names the prototype
uses in `prototype/img/`). The build turns them into AVIF, WebP and JPEG at several widths.

They are copies of the originals in `assets/photos-raw/`. On 24 Oct 2026 every photo was replaced with photos made to look like our own cutting room
(fewer shirts: hoodies and jeans instead). Unused ones from that set are kept there too.

| Slot | Original in `assets/photos-raw/` |
|---|---|
| cat-denim | Washed_wide_leg_jeans_on_cutting_table_20261024.jpg |
| cat-hoodies | Grey_hoodie_with_trims_on_cutting_table_20261024.jpg |
| cat-knit | Chunky_knit_sweater_with_yarn_20261024.jpg |
| cat-outerwear | Work_jacket_and_zip_jacket_on_rail_20261024.jpg |
| cat-shirts | Shirt_and_tailored_trousers_on_rail_20261024.jpg |
| cat-tees | White_and_black_tees_on_cutting_table_20261024.jpg |
| hero | Cutting_room_with_the_sign_wide_20261024.jpg |
| path-scaling | Cut_denim_pieces_and_bundles_20261024.jpg |
| path-starting | Checking_a_first_hoodie_sample_20261024.jpg |
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

Phones get a tall version of the full-width photos (Mazen, 24 Oct 2026): `hero-phone.jpg` and
`stage-01-phone.jpg` to `stage-08-phone.jpg`, registered in `PHOTOS_PHONE` (`src/data/photos.ts`).
`BgImg` switches to them up to 760px (the hero) or 860px (the How it works backgrounds). Their
originals are the `…_tall_20261024.jpg` files in `assets/photos-raw/`.

Slots that still have no photo show the tinted placeholder, as in the prototype: `atelier-1` to
`atelier-5`, `about-floor` and `team-1` to `team-4`. These must be real photos, not AI images.

To add or replace a photo, put the file here under the slot name (`.jpg` or `.png`) and register it
in `src/data/photos.ts`.
