'use client';
import { useState, useTransition } from 'react';
import { auditRentalPermissionsAction } from './actions';

export function AuditPermsButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await auditRentalPermissionsAction();
        setResult(`נבדקו ${r.checked} סניפים עם שותף, תוקנו/נוצרו ${r.fixed} הרשאות משתמשים.`);
      } catch (e) {
        setResult(e instanceof Error ? e.message : 'שגיאה');
      }
    });
  }

  return (
    <div className='flex flex-col items-end gap-1'>
      <button
        type='button'
        disabled={pending}
        onClick={run}
        className='rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-bold text-ink shadow-card transition hover:bg-[#f4f6f9] disabled:opacity-50'
      >
        {pending ? 'בודק...' : 'בדוק הרשאות השכרות לכל הסניפים'}
      </button>
      {result && <span className='max-w-[260px] text-left text-[11px] font-bold text-teal-dark'>{result}</span>}
    </div>
  );
}
