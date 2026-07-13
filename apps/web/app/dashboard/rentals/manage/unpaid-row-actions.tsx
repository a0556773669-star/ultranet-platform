'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markRentalPaidAction } from '../actions';

type Props = {
  rentalId: string;
  routes: { id: string; name: string }[];
};

export function UnpaidRowActions({ rentalId, routes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>(routes[0]?.id ?? '');

  function mark(method: 'cash' | 'route', routeId?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await markRentalPaidAction(rentalId, method, routeId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה');
      }
    });
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700'>לא שולם</span>
      <button
        type='button'
        disabled={pending}
        onClick={() => mark('cash')}
        className='rounded-[6px] bg-[#f4f6f9] px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#e9edf3] disabled:opacity-50'
      >
        סמן כשולם (מזומן)
      </button>
      {routes.length > 0 && (
        <>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            disabled={pending}
            className='rounded-[6px] border border-card-border bg-white px-2 py-1 text-[11px]'
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type='button'
            disabled={pending || !selectedRoute}
            onClick={() => mark('route', selectedRoute)}
            className='rounded-[6px] bg-[#f4f6f9] px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#e9edf3] disabled:opacity-50'
          >
            סמן כשולם (דרך מסלול גביה)
          </button>
        </>
      )}
      {error && <span className='text-[11px] font-bold text-red-600'>{error}</span>}
    </div>
  );
}
