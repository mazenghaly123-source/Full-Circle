# Photo sources

Each file here feeds one photo slot on the site, named by slot (the same names the prototype
uses in `prototype/img/`). The build turns them into AVIF, WebP and JPEG at several widths.

They are copies of the originals in `assets/photos-raw/`. Each slot was matched to its original by
comparing the images, and every match was exact:

| Slot | Original in `assets/photos-raw/` |
|---|---|
| cat-denim | Indigo_jeans_and_denim_details_20261008122021.jpg |
| cat-hoodies | Heavyweight_hoodie_on_cutting_table_20261008122021.jpg |
| cat-knit | cat-knit.png |
| cat-outerwear | Work_jackets_on_cutting_table_20261008122021.jpg |
| cat-shirts | Shirts_and_sewing_tools_displayed_20261008122021.jpg |
| cat-tees | Two_t-shirts_on_cutting_table_20261008122021.jpg |
| hero | Garment_development_worktable_in…_20261008122021.jpg |
| path-scaling | Measuring_hoodie_for_garment_cor…_20261008122021.jpg |
| path-starting | Hands_drawing_technical_sketch_20261008122021.jpg |
| portal-sample | Denim_overshirt_hanging_on_wall_20261008122021.jpg |
| promise-bulk | Denim_overshirts_stacked_on_table_20261008122021.jpg |
| promise-sample | Denim_overshirt_on_dress_form_20261008122021.jpg |
| stage-01 | stage-01-research.jpg |
| stage-02 | stage-02-sketch.jpg |
| stage-03 | stage-03-sourcing.jpg |
| stage-04 | Garment_worktable_with_sewing_tools_20261008122021.jpg |
| stage-05 | Pattern_maker_pinning_denim_over…_20261008122021.jpg |
| stage-06 | Sewing_denim_overshirt_pocket_20261008122021.jpg |
| stage-07 | Craftspeople_measuring_indigo_de…_20261008122021.jpg |
| stage-08 | Hands_packing_garments_into_carton_20261008122021.jpg |

Slots that still have no photo show the tinted placeholder, as in the prototype: `atelier-1` to
`atelier-5`, `about-floor` and `team-1` to `team-4`. These must be real photos, not AI images.

To add or replace a photo, put the file here under the slot name (`.jpg` or `.png`) and register it
in `src/data/photos.ts`.
