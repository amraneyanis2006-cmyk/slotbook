import { useEffect, useState } from 'react';
import { http } from '../api/http';

// Shows which commit is running (Lab 5 R-08); renders nothing when /api/version is missing (an older image).
export default function ReleaseFooter() {
  const [commit, setCommit] = useState<string | null>(null);
  useEffect(() => {
    http<{ commit: string }>('/version').then((res) => { if (res.ok) setCommit(res.data.commit); });
  }, []);
  return commit ? <footer className="app-footer">Release {commit.slice(0, 7)}</footer> : null;
}
