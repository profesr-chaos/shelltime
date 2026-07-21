// Change notes shown once per version when the app opens. Newest first.
// Add a new entry (matching package.json's version) whenever there's something worth telling users.
export interface ChangelogEntry {
  version: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.6.0',
    highlights: [
      'Group projects by category across the Today and Projects tabs, with collapsible sections ranked by hours worked.',
      'New recent-project switch list and a right-click menu on projects.',
      '"Finished for today" is now a proper toggle you can switch back off.',
      'Edit Timings drag uses the same distribution chooser as the snail.',
      'Fixes: post-midnight session reassignment, banked-idle discard no longer deletes the live session, and the calendar feed now follows redirects.',
    ],
  },
];
