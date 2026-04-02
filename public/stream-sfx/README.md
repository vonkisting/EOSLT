# Stream overlay sound files

Add **MP3** files **only in this folder** (`public/stream-sfx/`). The overlay loads them from `/stream-sfx/…` in the browser; files under `app/` are **not** served as static audio.

Use **letters, numbers, spaces, underscores, and hyphens** in the basename (before `.mp3`). The Stream page lists one button per file on load; the label is the basename with hyphens turned into spaces and each word title-cased (e.g. `Crowd Cheer.mp3` or `crowd-cheer.mp3` → **Crowd Cheer**).

**OBS:** Add a **Browser** source (or dock) with the copied URL, enable **Control audio via OBS**, and keep the source **unmuted** in the mixer.
