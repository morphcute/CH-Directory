# Design notes

## Direction

Community Heroes is a local competition platform, with an editorial esports identity: forest green (#1d493b), warm ivory (#f8f9f5), and pale lime (#d5ef87). Barlow Condensed provides strong display typography, balanced by DM Sans for interface copy. Both fonts are served locally; their SIL Open Font License files are in public/fonts.

The homepage prioritizes tournament discovery. The hero leads into community totals, then the searchable lineup. Restrained color accents differentiate organizer cards. Capacity is communicated with both labels and progress indicators. Saved tournaments use device-local storage; organizer changes use a separate draft-and-publish flow.

The layout adapts from a desktop filter sidebar to horizontal region controls on mobile. Dialogs use the native dialog element for focus containment and Escape dismissal. Error states explain a next action rather than silently failing.

## Original hero asset

Generated with the built-in ImageGen tool. Final project asset: `public/images/hero-knight.png`.

Final prompt:

> Use case: stylized-concept. Asset: wide cinematic hero background for a Filipino community esports tournament website. Create a premium 3D fantasy game key art of a lone heroic knight in elaborate burnished gold armor with a flowing ivory cape, holding a huge luminous gold sword downward, standing on a jagged dark emerald rock formation. Hero occupies right half only; left half empty deep forest green atmospheric mist for overlaid website heading. Dramatic gold sunlight shafts from upper right, emerald magical particles, ancient stone arena silhouettes in distant background, elegant olive and forest green monochromatic atmosphere with warm metallic gold highlights. Three-quarter heroic view, dynamic cloth, incredible material detail, AAA fantasy MOBA splash art quality. Landscape 1536x1024. No text, no logos, no UI, no watermark. Strong readable silhouette. Dark green lower edge.

The fantasy champion is original illustrative artwork, not an official Mobile Legends character asset. The browser receives an optimized image through Next.js Image. Artwork and typography remain within the project rather than depending on external asset URLs.
