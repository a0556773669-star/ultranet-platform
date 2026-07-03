import Link from "next/link";

const MODULES = [
  { href: "/dashboard/branches", title: "סניפים", desc: "ניהול סניפים, שותפי משנה וחלוקת רווחים" },
  { href: "/dashboard/rentals", title: "השכרות", desc: "לקוחות, מכשירים והשכרות מחשבים" },
  { href: "/dashboard/coworking", title: "קוורקינג", desc: "עמדות, לקוחות ותשלומי קוורקינג" },
  { href: "/dashboard/accounting", title: "הנהלת חשבונות", desc: "הכנסות, הוצאות ומסלולי גביה" },
];

export default function DashboardHomePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">סקירה כללית</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-teal hover:shadow-md"
          >
            <h2 className="mb-1 font-semibold text-teal-dark">{m.title}</h2>
            <p className="text-sm text-gray-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
