import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="w-full max-w-[480px] mx-auto px-4 py-10">
      <div className="bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-6 sm:p-8 flex flex-col gap-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent-200 border-2 border-text shadow-offset-2 flex items-center justify-center text-xl">
          🔍
        </div>
        <h1 className="font-heading text-2xl font-black text-[#201e1d]">Page not found</h1>
        <p className="text-sm text-[#645c50]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="h-14 mt-2 rounded-2xl bg-accent-200 border-4 border-text shadow-offset-4 font-heading font-black text-base text-[#201e1d] active:translate-y-0.5 transition-all flex items-center justify-center"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
