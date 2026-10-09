import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border-2 border-slate-200 space-y-6">
        <div className="text-6xl">🔍</div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Page Not Found</h1>
        <p className="text-slate-600 font-medium">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block w-full py-3.5 px-6 bg-indigo-600 text-white font-bold rounded-2xl shadow-chunky hover:bg-indigo-700 transition-colors"
        >
          Back to Revizz Home
        </Link>
      </div>
    </div>
  );
}
