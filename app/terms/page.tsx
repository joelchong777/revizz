import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use · Revizz',
  description: 'The rules for using Revizz.',
};

const sectionHeading = 'font-heading text-xl font-black text-[#201e1d] mb-2';
const para = 'text-base leading-7 text-[#201e1d]';
const list = 'list-disc pl-5 space-y-1.5 text-base leading-7 text-[#201e1d]';

export default function TermsPage() {
  return (
    <div className="w-full max-w-[680px] mx-auto px-4 py-6 flex flex-col gap-5">
      <Link
        href="/"
        className="self-start text-sm font-bold text-[#201e1d] underline underline-offset-2 hover:text-accent-700"
      >
        ← Back to Revizz
      </Link>

      <article className="bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-5 sm:p-8 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-black text-[#201e1d]">Terms of Use</h1>
          <p className="inline-block self-start text-xs font-bold text-[#201e1d] bg-accent-200 border-2 border-text rounded-full px-3 py-1">
            Draft · last updated 24 October 2026
          </p>
          <p className={para}>
            By using Revizz you agree to these terms. They are short and written in plain words.
          </p>
        </header>

        <section>
          <h2 className={sectionHeading}>Who can use Revizz</h2>
          <ul className={list}>
            <li>You must be 13 or older.</li>
            <li>One account per person.</li>
            <li>Keep your password private. You are responsible for what happens on your account.</li>
          </ul>
        </section>

        <section>
          <h2 className={sectionHeading}>Fair use</h2>
          <p className={`${para} mb-2`}>Please do not:</p>
          <ul className={list}>
            <li>use cheating tools or bots,</li>
            <li>scrape the site or attack it in any way,</li>
            <li>share answer keys.</li>
          </ul>
        </section>

        <section>
          <h2 className={sectionHeading}>Content</h2>
          <p className={para}>
            Questions come from past Cambridge papers and are here for revision. Explanations may contain mistakes, so
            check important points with your teacher or textbook. Revizz is not affiliated with Cambridge.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Accounts</h2>
          <p className={para}>
            We can suspend accounts that break these terms. You can delete your own account at any time in Settings.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>No warranty</h2>
          <p className={para}>
            Revizz is provided as is. We try to keep it working and accurate, but we cannot promise it will always be
            available or error free.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Changes to these terms</h2>
          <p className={para}>
            If we change these terms we will update the date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Contact</h2>
          <p className={para}>
            Questions about these terms? Email us at <a href="mailto:joel.chong.777@gmail.com" className="font-bold underline">joel.chong.777@gmail.com</a>.
          </p>
        </section>

        <p className="text-sm text-[#645c50]">
          See also our{' '}
          <Link href="/privacy" className="font-bold underline underline-offset-2 text-[#201e1d]">
            Privacy Policy
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
