import { useEffect, useRef, useState } from 'react';

import type { JobWithApplication } from '../../lib/types';
import { useMarkApplied, useSaveJob, useUnsaveJob } from './queries';

export interface JobAnnouncement {
  text: string;
  link?: { to: string; label: string };
  error?: boolean;
}

/** Save / unsave / "I applied" for job cards and the job page, with a confirmation message. */
export function useJobActions() {
  const save = useSaveJob();
  const unsave = useUnsaveJob();
  const apply = useMarkApplied();

  const [announcement, setAnnouncement] = useState<JobAnnouncement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = (a: JobAnnouncement) => {
    clearTimeout(timer.current);
    setAnnouncement(a);
    timer.current = setTimeout(() => setAnnouncement(null), 8000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const fail = (err: Error) =>
    announce({ text: `Something went wrong: ${err.message}`, error: true });
  const name = (job: JobWithApplication) => `${job.title} at ${job.company}`;

  return {
    announcement,
    pendingJobId:
      (save.isPending && save.variables.id) ||
      (unsave.isPending && unsave.variables.id) ||
      (apply.isPending && apply.variables.id) ||
      null,
    onSave: (job: JobWithApplication) =>
      save.mutate(job, {
        onSuccess: () =>
          announce({
            text: `Saved ${name(job)}.`,
            link: { to: '/saved', label: 'View saved jobs' },
          }),
        onError: fail,
      }),
    onUnsave: (job: JobWithApplication) =>
      unsave.mutate(job, {
        onSuccess: () => announce({ text: `Removed ${name(job)} from Saved Jobs.` }),
        onError: fail,
      }),
    onApply: (job: JobWithApplication) =>
      apply.mutate(job, {
        onSuccess: () =>
          announce({
            text: `Added ${name(job)} to My Applications as Applied.`,
            link: { to: '/applications', label: 'View my applications' },
          }),
        onError: fail,
      }),
  };
}
