# Iconly assets

The native app uses bundled Iconly Light regular SVGs, converted to Android VectorDrawable resources for offline rendering and Compose tinting.

- Source: [Iconly Pro](https://web.iconly.pro/)
- Iconly usage terms: [Terms](https://iconly.pro/pages/terms) and [Licensing Guide](https://iconly.pro/pages/licensing-guide)
- Bundled assets are from the Free icons collection, style `Light`, type `regular`.
- Iconly icon IDs: 353, 354, 359, 364, 369, 379, 384, 386, 387, 388, 391, 394, 395, 397, 401, 404, 405, 408, 412, 414, 415, 416, 422, 425, 426, 427, 428, 430, 431, 434, 435, 436, 437, 449, 351, 352.

These icons are incorporated as part of the app UI and are not provided as a standalone icon pack. Review Iconly's current license terms before distributing the app beyond the club.

The five `*_filled.xml` navigation resources are selected-state treatments derived from the same free Light icons: enclosed icon silhouettes are filled in place, while the idle state keeps the original stroke-only vectors.
Animated interactions use three bundled Iconly Pro animations from the Free collection: Star Ticket (ID 1661) for Matches, 2 users ai (ID 2503) for Meetings, and 1 Repeat (ID 3151) in the data refresh menu. Their JSON is recolored for the club palette and bundled in app/src/main/res/raw, so playback works offline. Playback runs once on selection or menu opening; other navigation icons retain the stroke-to-filled selected state.
