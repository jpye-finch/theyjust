import type { Child } from '../children/queries';
import type { Moment } from '../moments/momentQueries';
import { momentTitle } from '../moments/momentText';

export type ExportBundle = {
  exportedAt: string;
  children: {
    name: string;
    dateOfBirth: string;
    dueDate: string | null;
    moments: {
      title: string;
      milestoneId: string | null;
      occurredOn: string;
      note: string | null;
      photos: string[];
    }[];
  }[];
};

/** Storage paths are `{momentId}/{photoId}.jpg`; the zip keeps them flat. */
export function photoFileName(storagePath: string): string {
  return storagePath.split('/').pop() as string;
}

// A parent's export should read like their book, not like our database: the
// celebration wording is resolved here, and internal ids are left out.
export function buildExportBundle(
  exportedAt: string,
  children: Child[],
  moments: Moment[],
): ExportBundle {
  return {
    exportedAt,
    children: children.map((child) => ({
      name: child.name,
      dateOfBirth: child.date_of_birth,
      dueDate: child.due_date,
      moments: moments
        .filter((moment) => moment.child_id === child.id)
        .map((moment) => ({
          title: momentTitle(moment),
          milestoneId: moment.milestone_id,
          occurredOn: moment.occurred_on,
          note: moment.note,
          photos: [...moment.moment_photos]
            .sort((a, b) => a.position - b.position)
            .map((photo) => `photos/${photoFileName(photo.storage_path)}`),
        })),
    })),
  };
}
