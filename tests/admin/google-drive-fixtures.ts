import { GOOGLE_DRIVE_FOLDER_MIME_TYPE, type GoogleDriveNormalizedItem } from "../../lib/admin/media/google-drive-foundation";

export const SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID = "synthetic_ccpun_root_20260828";
export const SYNTHETIC_GOOGLE_DRIVE_FILE_ID = "synthetic_media_file_20260828";
export const SYNTHETIC_GOOGLE_DRIVE_ITEMS: readonly GoogleDriveNormalizedItem[] = Object.freeze([
  {
    id: SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    parents: ["synthetic_owner_my_drive_20260828"],
    trashed: false,
    shortcutDetails: null,
  },
  {
    id: "synthetic_ccpun_media_folder_20260828",
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    parents: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    trashed: false,
    shortcutDetails: null,
  },
  {
    id: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    mimeType: "video/mp4",
    parents: ["synthetic_ccpun_media_folder_20260828"],
    trashed: false,
    shortcutDetails: null,
  },
]);
