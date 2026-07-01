import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@shared/types';

export function useProjects(includeInactive = true) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return window.api.projects.list(includeInactive).then((list) => {
      setProjects(list);
      setLoading(false);
      return list;
    });
  }, [includeInactive]);

  useEffect(() => {
    refresh();
    return window.api.projects.onChanged(refresh);
  }, [refresh]);

  return { projects, loading, refresh };
}
