/** Stream logo row from `streamObsProfiles.get` (Convex storage URL for OBS `file`). */
export type StreamLogoRowUi = {
  id: string;
  fileName: string;
  obsImageSourceName: string;
  url: string | null;
};
